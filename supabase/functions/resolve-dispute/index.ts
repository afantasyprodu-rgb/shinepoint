// Admin resolves a dispute, issuing a REAL Stripe refund when the customer
// is owed money.
//
// Before this, admin_resolve_dispute wrote disputes.refund_amount and moved
// the booking to 'complete'. Nothing ever called Stripe: the customer got
// nothing back, AdminFinance reported "refunds issued" from a column that
// described money which never moved, and setting the booking to 'complete'
// started the 48h payout hold and awarded the customer a loyalty point — so
// a dispute decided in the customer's favour paid the detailer in full and
// rewarded the customer for it.
//
// Postgres cannot call Stripe, so the refund happens here FIRST and the RPC
// records the outcome (and reduces detailer_payout) only once it succeeded.
//
// Deploy: supabase functions deploy resolve-dispute
// Secrets: STRIPE_SECRET_KEY (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically).
import Stripe from 'npm:stripe@^18'
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isUuid, isOneOf, isFiniteNumber, cleanText } from '../_shared/validate.ts'

// Mirrors the resolution CHECK constraint on public.disputes (migration 002).
const RESOLUTIONS = ['customer_wins', 'detailer_wins', 'split', 'dismissed'] as const

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2026-05-27.dahlia' as Stripe.LatestApiVersion,
})

// What Stripe Identity itself costs per check (043) — recovered from the
// customer only when a dispute that REQUIRED verification (i.e. not their
// first) is then also ruled against them. Never charged on a first dispute,
// and never charged just for verifying — only on a proven-false repeat.
const FALSE_DISPUTE_FEE = 1.5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { disputeId, resolution, refundAmount, resolutionNotes } = await req.json().catch(() => ({}))
    // The DB has a CHECK constraint on resolution, but reaching it means a
    // 500 from the RPC rather than something the admin UI can show. Same
    // list as migration 002's constraint.
    if (!isUuid(disputeId)) return json({ error: 'Missing or malformed disputeId' }, 400)
    if (!isOneOf(resolution, RESOLUTIONS)) {
      return json({ error: `resolution must be one of: ${RESOLUTIONS.join(', ')}` }, 400)
    }
    // Number(undefined) is NaN and Number('') is 0 — neither is a refund,
    // but only one of them is obviously not one. Reject anything that isn't
    // a real, non-negative number outright.
    if (refundAmount != null && !(isFiniteNumber(refundAmount) && refundAmount >= 0)) {
      return json({ error: 'refundAmount must be a non-negative number' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: me } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdmin = me?.role === 'admin'

    const { data: dispute } = await admin
      .from('disputes')
      .select('id, status, filed_by, filed_against, required_identity, booking_id, stripe_refund_id, bookings!inner(customer_id, total_price, stripe_payment_intent, refunded_amount, stripe_payment_method)')
      .eq('id', disputeId)
      .single()
    if (!dispute) return json({ error: 'Dispute not found' }, 404)

    // Admin, or the party the dispute was filed against, resolving it
    // themselves with the other side. The RPC checks this too, but
    // refunding before that check would move money for an unauthorized user.
    if (!isAdmin && user.id !== dispute.filed_against) {
      return json({ error: 'Admin or the disputed party only' }, 403)
    }
    // A detailer resolving their own case can't re-resolve one that's
    // already closed; admin can still override a prior resolution.
    if (dispute.status === 'resolved' && !isAdmin) {
      return json({ error: 'This dispute is already resolved.' }, 409)
    }

    const booking = (dispute as any).bookings
    const amount = Number(refundAmount ?? 0)
    let refundId: string | null = null

    if (amount > 0) {
      // Never refund more than was actually charged, minus anything already
      // refunded on this booking.
      const alreadyRefunded = Number(booking?.refunded_amount ?? 0)
      const refundable = Number(booking?.total_price ?? 0) - alreadyRefunded
      if (amount > refundable + 0.001) {
        return json({ error: `Refund exceeds the refundable amount ($${refundable.toFixed(2)}).` }, 400)
      }
      if (!booking?.stripe_payment_intent) {
        return json({ error: 'No payment on this booking to refund.' }, 409)
      }
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: Math.round(amount * 100),
        metadata: { dispute_id: disputeId, booking_id: dispute.booking_id },
      })
      refundId = refund.id
    }

    // Records the outcome, reduces detailer_payout by the refund, and only
    // marks the booking 'complete' when the customer was NOT made whole.
    const { error: rpcErr } = await admin.rpc('admin_resolve_dispute', {
      p_dispute_id: disputeId,
      p_resolution: resolution,
      p_refund_amount: amount > 0 ? amount : null,
      p_stripe_refund_id: refundId,
      p_resolution_notes: cleanText(resolutionNotes, 2000),
    })
    if (rpcErr) {
      // The refund already went out; surface loudly rather than silently
      // leaving the record and the money out of step.
      console.error('resolve-dispute: refund succeeded but RPC failed', refundId, rpcErr.message)
      return json({ error: `Refund issued (${refundId}) but recording it failed: ${rpcErr.message}` }, 500)
    }

    // False-dispute fee: only when this specific dispute required
    // verification (i.e. it wasn't the customer's first) AND it was ruled
    // against them. Best-effort — if the card fails or there's none on
    // file, the dispute resolution itself has already succeeded and isn't
    // rolled back over an unrelated $1.50.
    let feeCharged = false
    if (resolution === 'detailer_wins' && dispute.required_identity && booking?.stripe_payment_method) {
      // The saved card on the booking belongs to the booking's CUSTOMER. If
      // a detailer ever filed the dispute, charging that card under the
      // filer's Stripe customer would bill the WRONG PERSON — so the fee
      // only applies when the filer is provably the booking customer.
      const filerIsCustomer = dispute.filed_by === booking.customer_id
      if (!filerIsCustomer) {
        console.warn('resolve-dispute: skipping false-dispute fee — filer is not the booking customer', disputeId)
      }
      try {
        const { data: filer } = await admin.from('users').select('stripe_customer_id').eq('id', dispute.filed_by).single()
        if (filerIsCustomer && filer?.stripe_customer_id) {
          const feeIntent = await stripe.paymentIntents.create({
            amount: Math.round(FALSE_DISPUTE_FEE * 100),
            currency: 'usd',
            customer: filer.stripe_customer_id,
            payment_method: booking.stripe_payment_method,
            off_session: true,
            confirm: true,
            metadata: { dispute_id: disputeId, kind: 'false_dispute_fee' },
          })
          await admin
            .from('disputes')
            .update({ false_dispute_fee_charged: true, false_dispute_fee_payment_intent: feeIntent.id })
            .eq('id', disputeId)
          feeCharged = true
        }
      } catch (feeErr) {
        console.error('resolve-dispute: false-dispute fee charge failed', disputeId, (feeErr as Error).message)
      }
    }

    return json({ ok: true, refundId, refunded: amount, feeCharged })
  } catch (e) {
    console.error('resolve-dispute:', e)
    await captureException(e, 'resolve-dispute')
    return json({ error: (e as Error).message }, 500)
  }
})
