// Scheduled job (not user-invoked): emails admins their un-emailed
// admin_alert notifications (new signups — 092 — and anything else
// notify_admins raises), then stamps emailed_at so each goes out once.
//
// One digest email per admin address per run, not one per alert, so a burst
// of signups doesn't turn into a burst of emails.
//
// Deploy: supabase functions deploy email-admin-alerts --no-verify-jwt
// Secrets: RESEND_API_KEY, CRON_SECRET (same value the other cron jobs use).
// Schedule: every 5 minutes.
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { json } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { isCronAuthorized } from '../_shared/cronAuth.ts'
import { sendEmail } from '../_shared/resend.ts'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// afantasyprodu+claude-admin@gmail.com and afantasyprodu@gmail.com are the
// same inbox — collapse +tags so one person doesn't get the digest twice.
const inboxKey = (email: string) => email.toLowerCase().replace(/\+[^@]*@/, '@')

Deno.serve(async (req) => {
  if (!isCronAuthorized(req)) return json({ error: 'Unauthorized' }, 401)

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Skip stale backlog (e.g. the first run after deploy) — older than a day
    // isn't news; it's still in the in-app feed.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const { data: rows, error } = await admin
      .from('notifications')
      .select('id, title, body, created_at, users!inner(email)')
      .eq('kind', 'admin_alert')
      .is('emailed_at', null)
      .gte('created_at', since)
      .order('created_at')
      .limit(500)
    if (error) throw error
    if (!rows?.length) return json({ ok: true, sent: 0 })

    // Each notify_admins call writes one row per admin, so the same alert
    // appears once per admin — group by inbox and dedupe by title+body+time.
    const byInbox = new Map<string, { to: string; items: Map<string, { title: string; body: string; at: string }> }>()
    for (const r of rows as any[]) {
      const to = r.users?.email
      if (!to) continue
      const k = inboxKey(to)
      if (!byInbox.has(k)) byInbox.set(k, { to: k, items: new Map() })
      byInbox.get(k)!.items.set(`${r.title}|${r.body}|${r.created_at.slice(0, 19)}`, {
        title: r.title, body: r.body ?? '', at: r.created_at,
      })
    }

    let sent = 0
    for (const { to, items } of byInbox.values()) {
      const list = [...items.values()]
      const subject = list.length === 1 ? `ShinePoint: ${list[0].title}` : `ShinePoint: ${list.length} admin alerts`
      const html =
        `<p>${list.length === 1 ? 'New admin alert' : `${list.length} new admin alerts`}:</p><ul>` +
        list.map((i) => `<li><b>${esc(i.title)}</b> — ${esc(i.body)}<br><small>${esc(new Date(i.at).toUTCString())}</small></li>`).join('') +
        `</ul><p><a href="https://shinepoint.app/admin">Open the admin console</a></p>`
      await sendEmail({ to, subject, html })
      sent++
    }

    // Stamp after sending: a crash mid-run re-sends rather than drops.
    const { error: upErr } = await admin
      .from('notifications')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', rows.map((r: any) => r.id))
    if (upErr) throw upErr

    return json({ ok: true, sent, alerts: rows.length })
  } catch (e) {
    console.error('email-admin-alerts:', e)
    await captureException(e, 'email-admin-alerts')
    return json({ error: 'failed' }, 500)
  }
})
