// Admin-only: texts a phone number that isn't in the system yet, inviting
// them to sign up as a detailer. This is for the case where an admin has
// already talked to someone in person/by phone and they agreed to join --
// this just sends the follow-up link, it doesn't discover or cold-blast
// numbers on its own. No account, booking, or opt-in row exists yet for
// the recipient (that's the whole point), so unlike every other SMS site
// in this codebase there's no `users` row to check consent against; the
// admin calling this is the consent check.
//
// Deploy: supabase functions deploy send-detailer-recruit-sms
// Secrets: SENTDM_API_KEY (soft-skips with a warning if unset, same as
// every other sendSms call site).
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { toE164 } from '../_shared/validate.ts'
import { withinRateLimit, tooManyRequests } from '../_shared/rateLimit.ts'
import { sendSms } from '../_shared/sentdm.ts'
import { detailerRecruitSms } from '../_shared/sms-templates.ts'

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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerRow } = await admin
      .from('users').select('role').eq('id', user.id).single()
    if (callerRow?.role !== 'admin') return json({ error: 'admin only' }, 403)

    const { phone: rawPhone } = await req.json().catch(() => ({}))
    // toE164 normalizes a bare 10-digit US number ("4244696986") or one with
    // formatting ("424-469-6986") into the strict +1XXXXXXXXXX Sent's API
    // requires -- it rejected the raw form outright (400 VALIDATION_001)
    // the first time an admin typed a number the way people actually type
    // phone numbers.
    const phone = toE164(rawPhone)
    if (!phone) return json({ error: 'A valid phone number is required.' }, 400)

    // Per-admin, generous but bounded -- this is a person manually inviting
    // people one at a time, not a bulk-import tool.
    if (!(await withinRateLimit(admin, `detailer-recruit-sms:${user.id}`, 30, '1 hour'))) {
      return tooManyRequests(3600)
    }

    const result = await sendSms({ to: phone, ...detailerRecruitSms() })

    return json({ ok: true, ...result })
  } catch (e) {
    console.error('send-detailer-recruit-sms:', e)
    await captureException(e, 'send-detailer-recruit-sms')
    return json({ error: (e as Error).message }, 500)
  }
})
