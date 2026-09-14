// Shared CORS headers for browser-invoked edge functions.
//
// APP_ORIGIN pins the allowed origin (the production app URL). This FAILS
// CLOSED: when APP_ORIGIN is unset the allowed origin is set to a value no
// browser can match, so a missing/typo'd secret blocks cross-origin browser
// calls instead of silently opening the functions to every site.
//
//   supabase secrets set APP_ORIGIN=https://shinepoint.app
//
// For local dev against the deployed functions, opt in explicitly:
//   supabase secrets set CORS_ALLOW_ANY=1
// (never set CORS_ALLOW_ANY in production).
//
// Non-browser callers (Stripe webhook, cron, the agent API) don't send an
// Origin and are unaffected by CORS either way.
const APP_ORIGIN = Deno.env.get('APP_ORIGIN')
const ALLOW_ANY = Deno.env.get('CORS_ALLOW_ANY') === '1'

if (!APP_ORIGIN && !ALLOW_ANY) {
  console.warn(
    'APP_ORIGIN is not set — browser origins are blocked (fail-closed). ' +
      'Set APP_ORIGIN=https://shinepoint.app, or CORS_ALLOW_ANY=1 for local dev.'
  )
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN ?? (ALLOW_ANY ? '*' : 'https://app-origin-unset.invalid'),
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}