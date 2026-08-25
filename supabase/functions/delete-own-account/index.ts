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
import { cleanText } from '../_shared/validate.ts'

// Anything short of complete/cancelled still has money or a dispute in
// flight — deleting the account out from under that would strand the
// other party (detailer mid-job, or a customer who still owes a review of
// damage evidence). This is the ONLY thing that should block self-delete —
// a completed or cancelled booking is fine, it just needs to not be
// silently dropped (see admin_purge_booking_history below).
const ACTIVE_STATUSES = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'disputed']
const ACTIVE_BOOKING_MESSAGE =
  'You have an active booking. Open it from My Bookings and cancel it, then you can delete your account.'

// Only for genuine failures below (purge/delete erroring out) — never for
// the routine ACTIVE_BOOKING_MESSAGE block above, which is expected UX,
// not something every admin needs paged about. Sentry already logs these;
// this puts the same signal in the admin-facing notifications feed too.
async function notifyAdmins(admin: ReturnType<typeof createClient>, who: string, detail: string) {
  const { error } = await admin.rpc('notify_admins', {
    p_title: 'Account deletion failed',
    p_body: `${who} tried to delete their account and it failed: ${detail}`,
  })
  if (error) console.error('notify_admins failed:', error.message)
}

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

    // Re-auth freshness gate: this endpoint is irreversible, so a hijacked
    // session (stolen laptop, XSS'd token) must not be able to use it. The
    // caller must have signed in within the last 15 minutes — same window
    // GitHub uses for sudo mode. Clients should route the user through a
    // fresh sign-in first when they hit the 403 (ChangePassword already
    // re-authenticates; deletion previously had no such check).
    const FRESH_WINDOW_MS = 15 * 60 * 1000
    const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0
    if (!lastSignIn || Date.now() - lastSignIn > FRESH_WINDOW_MS) {
      return json(
        { error: 'Please sign in again before deleting your account.', code: 'reauth_required' },
        403
      )
    }

    // Free text straight into account_deletion_feedback — capped so a
    // scripted caller can't push a multi-megabyte row.
    const { reason: rawReason } = await req.json().catch(() => ({ reason: null }))
    const reason = cleanText(rawReason, 1000)

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
          return json({ error: ACTIVE_BOOKING_MESSAGE }, 409)
        }
      }
    } else if (profile?.role === 'detailer') {
      const { data: dp } = await admin
        .from('detailer_profiles').select('id').eq('user_id', user.id).single()
      if (dp) {
        const { data: active } = await admin
          .from('bookings').select('id').eq('detailer_id', dp.id).in('status', ACTIVE_STATUSES).limit(1)
        if (active?.length) {
          return json({ error: ACTIVE_BOOKING_MESSAGE }, 409)
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
      }
    }

    // Only completed/cancelled bookings can be left at this point (active
    // ones already returned above) — but those still block the delete at
    // the Postgres level (bookings.customer_id/detailer_id and several
    // tables past it are ON DELETE NO ACTION, not cascade). Same purge the
    // admin path uses: archives everything about to be touched into
    // admin_purge_archive first, then clears it. purged_by is null here to
    // distinguish a self-service purge from an admin-initiated one.
    const { error: purgeErr } = await admin.rpc('admin_purge_booking_history', {
      p_user_id: user.id,
      p_admin_id: null,
    })
    if (purgeErr) {
      console.error('delete-own-account: purge failed:', purgeErr.message)
      await captureException(purgeErr, 'delete-own-account:purge')
      await notifyAdmins(admin, profile?.email ?? user.id, purgeErr.message)
      return json({ error: purgeErr.message }, 500)
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
    if (delErr) {
      await notifyAdmins(admin, profile?.email ?? user.id, delErr.message)
      return json({ error: delErr.message }, 409)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('delete-own-account:', e)
    await captureException(e, 'delete-own-account')
    return json({ error: (e as Error).message }, 500)
  }
})
