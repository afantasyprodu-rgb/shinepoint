# Autopilot SMS send path

Autopilot does **not** invent a new sender. Approve calls the same path as Remind:

`invokeFn('detailer-helper', { intent: 'send_reminder', clientId, message })`

Server (`supabase/functions/detailer-helper`):

- Validates detailer owns client
- Requires `sms_opt_in` and phone
- Requires STOP language in message
- Calls `_shared/sentdm.ts` `sendSms`
- If API key missing → `{ sent: false, skipped: true, reply: 'SMS provider not configured…' }`

No Autopilot cron / edge job was added or deployed. Scanning is browser-side on page load.
