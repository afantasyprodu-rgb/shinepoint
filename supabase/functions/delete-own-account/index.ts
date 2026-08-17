// Self-service permanent account deletion (customer or detailer). Mirrors
// admin-delete-user's cascade (removing auth.users cascades to public.users
// and profile/booking rows via FK) but is reachable by any signed-in user
// deleting themselves, with an up-front guard admin-delete-user doesn't
// need — there's no admin in the loop here to notice a blocked cascade or
// choose to ban instead, so unresolved state is checked before attempting
// the delete rather than surfaced as a raw DB error.
//
// Deploy: supabase functions deploy delete-own-account
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'

// Anything short of complete/cancelled still has money or a dispute in
// flight — deleting the account out from under that would strand the
// other party (detailer mid-job, or a customer who still owes a review of
// damage evidence).
const ACTIVE_STATUSES = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'disputed']

// bookings.customer_id / bookings.detailer_id have no ON DELETE action, so
// ANY booking row — even a long-finished completed or cancelled one — blocks
// the users -> customer_profiles/detailer_profiles cascade at the Postgres
// level. Without this check that surfaces as the raw "Database error
// deleting user" from admin.auth.admin.deleteUser below, with no indication
// why. Checked separately from ACTIVE_STATUSES above so the two cases get
// distinct, actionable messages instead of one generic booking message.
const HISTORY_MESSAGE =
  'You have booking history on this account. We keep completed and cancelled bookings for records, so this account can\'t be self-deleted — contact support and we\'ll take care of it.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401)

    const { reason } = await req.json().catch(() => ({ reason: null }))

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await admin
      .from('users').select('role, email, phone, full_name').eq('id', user.id).single()

    if (profile?.role === 'customer') {
      const { data: cp } = await admin
        .from('customer_profiles').select('id').eq('user_id', user.id).single()
      if (cp) {
        const { data: active } = await admin
          .from('bookings').select('id').eq('customer_id', cp.id).in('status', ACTIVE_STATUSES).limit(1)
        if (active?.length) {
          return json({ error: 'You have an active or disputed booking. Resolve it before deleting your account.' }, 409)
        }
        const { data: anyBooking } = await admin
          .from('bookings').select('id').eq('customer_id', cp.id).limit(1)
        if (anyBooking?.length) {
          return json({ error: HISTORY_MESSAGE }, 409)
        }
      }
    } else if (profile?.role === 'detailer') {
      const { data: dp } = await admin
        .from('detailer_profiles').select('id').eq('user_id', user.id).single()
      if (dp) {
        const { data: active } = await admin
          .from('bookings').select('id').eq('detailer_id', dp.id).in('status', ACTIVE_STATUSES).limit(1)
        if (active?.length) {
          return json({ error: 'You have an active or disputed booking. Resolve it before deleting your account.' }, 409)
        }
        // Paid but not yet transferred to the detailer's Stripe balance —
        // deleting now would orphan that payout (see release-payouts).
        const { data: pending } = await admin
          .from('bookings').select('id')
          .eq('detailer_id', dp.id)
          .is('transferred_at', null)
          .not('paid_at', 'is', null)
          .gt('detailer_payout', 0)
          .limit(1)
        if (pending?.length) {
          return json({ error: 'You have a payout still pending release. Wait for it to complete before deleting your account.' }, 409)
        }
        const { data: anyBooking } = await admin
          .from('bookings').select('id').eq('detailer_id', dp.id).limit(1)
        if (anyBooking?.length) {
          return json({ error: HISTORY_MESSAGE }, 409)
        }
      }
    }

    // Snapshot who/when/why BEFORE the delete — the row this reads from is
    // about to be gone, and this is the only place that history survives.
    await admin.from('account_deletion_feedback').insert({
      user_id: user.id,
      role: profile?.role ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      full_name: profile?.full_name ?? null,
      reason: reason || null,
    })

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) return json({ error: delErr.message }, 409)

    return json({ ok: true })
  } catch (e) {
    console.error('delete-own-account:', e)
    await captureException(e, 'delete-own-account')
    return json({ error: (e as Error).message }, 500)
  }
})
