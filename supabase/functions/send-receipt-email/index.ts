// Sends the payment receipt email when a job is marked complete. Invoked
// from the client (DetailerJob's "Mark job complete" action, real bookings
// only) rather than from a webhook, since job completion is a status change
// the client makes directly — there's no Stripe event for it.
//
// Deploy: supabase functions deploy send-receipt-email
// Secrets: RESEND_API_KEY (optional — send is skipped, not fatal, if unset).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { sendEmail } from '../_shared/resend.ts'
import { receiptEmail } from '../_shared/email-templates.ts'

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

    const { bookingId } = await req.json()
    if (!bookingId) return json({ error: 'bookingId required' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error } = await admin
      .from('bookings')
      .select(
        `id, status, total_price, tip_amount, completed_at, invoice,
         customer_profiles!inner(user_id, users!inner(email, full_name)),
         detailer_profiles!inner(user_id, users!inner(full_name)),
         services(service_name)`
      )
      .eq('id', bookingId)
      .single()
    if (error || !booking) return json({ error: 'Booking not found' }, 404)

    // Only the detailer on the job (who just marked it complete) or the
    // customer it belongs to may trigger this — never an arbitrary caller.
    const callerIsDetailer = (booking as any).detailer_profiles?.user_id === user.id
    const callerIsCustomer = (booking as any).customer_profiles?.user_id === user.id
    if (!callerIsDetailer && !callerIsCustomer) {
      return json({ error: 'Not authorized for this booking' }, 403)
    }
    if (booking.status !== 'complete') {
      return json({ error: 'Booking is not complete yet' }, 400)
    }

    const customer = (booking as any).customer_profiles?.users
    const detailer = (booking as any).detailer_profiles?.users
    const service = (booking as any).services?.service_name ?? 'Detail service'
    if (!customer?.email) return json({ error: 'No customer email on file' }, 422)

    const price = Number(booking.total_price ?? 0)
    const tip = Number(booking.tip_amount ?? 0)

    // Use the detailer's itemized invoice when one exists and they've opted
    // to email it (InvoiceBuilder's "email itemized" toggle, on by default).
    // Falls back to a single "service — total_price" line otherwise, same as
    // before the invoice builder existed. The invoice's own total is what's
    // shown; it can legitimately differ from total_price (extra line items,
    // discounts applied after the fact) and the email should match what the
    // detailer actually itemized, not the original booked price.
    const invoice = (booking as any).invoice as { items?: { label: string; amount: number }[]; total?: number; emailItemized?: boolean } | null
    const useInvoice = invoice?.items?.length && invoice.emailItemized !== false
    const items = useInvoice ? invoice!.items! : [{ label: service, amount: price }]
    const total = useInvoice ? Number(invoice!.total ?? price) : price

    const { subject, html } = receiptEmail({
      customerName: customer.full_name ?? 'there',
      detailerName: detailer?.full_name ?? 'Your detailer',
      bookingId: booking.id,
      service,
      items,
      tip: tip > 0 ? tip : undefined,
      total,
      paidAt: booking.completed_at ?? new Date().toISOString(),
      receiptUrl: `${Deno.env.get('APP_ORIGIN') ?? 'https://shinepoint.app'}/bookings/${booking.id}`,
    })
    // Each send costs a Resend credit and lands in a customer's inbox —
    // capped so a loop can't bill you or spam them.
    if (!(await withinRateLimit(admin, `receipt:${user.id}`, 10, '1 hour'))) {
      return tooManyRequests(3600)
    }

    // Email only — job-complete stays an email notification, not a text
    // (SMS is scoped to the day-of reminder and the en-route tracking link).
    const result = await sendEmail({ to: customer.email, subject, html })

    return json({ ok: true, ...result })
  } catch (e) {
    console.error('send-receipt-email:', e)
    await captureException(e, 'send-receipt-email')
    return json({ error: (e as Error).message }, 500)
  }
})
