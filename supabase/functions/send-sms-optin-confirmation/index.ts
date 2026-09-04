// Sends the "double opt-in" confirmation text right after a customer
// checks the SMS consent checkbox (CustomerSettings or BookingWizard's
// post-booking prompt) — the confirmation carriers/10DLC review expect to
// see land on the number that was just entered. Reads the caller's own
// phone + sms_opt_in straight from `users` rather than trusting whatever
// the client passes, so this can only ever text the number actually saved
// on the account, never an arbitrary one.
//
// Deploy: supabase functions deploy send-sms-optin-confirmation
// Secrets: SENTDM_API_KEY (soft-skips with a warning if unset, same as
// every other sendSms call site).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { optInConfirmationSms } from '../_shared/sms-templates.ts'

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // One confirmation per opt-in is the only legitimate use — this cap is
    // just a backstop against a buggy/looping caller, not a real limit
    // anyone should ever hit.
    if (!(await withinRateLimit(admin, `sms-optin-confirm:${user.id}`, 5, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const { data: row, error: rowErr } = await admin
      .from('users')
      .select('phone, sms_opt_in')
      .eq('id', user.id)
      .single()
    if (rowErr || !row) return json({ error: 'Account not found' }, 404)
    if (!row.sms_opt_in) return json({ error: 'SMS is not opted in on this account.' }, 409)
    if (!row.phone) return json({ error: 'No phone number on file.' }, 409)

    await sendSms({ to: row.phone, body: optInConfirmationSms() })

    return json({ ok: true })
  } catch (e) {
    console.error('send-sms-optin-confirmation:', e)
    await captureException(e, 'send-sms-optin-confirmation')
    return json({ error: (e as Error).message }, 500)
  }
})
