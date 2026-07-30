// Shared CORS headers for browser-invoked edge functions.
// APP_ORIGIN pins the allowed origin (the Vercel prod URL). Falls back to '*'
// only when unset so local dev / first deploy still works — set it before launch:
//   supabase secrets set APP_ORIGIN=https://your-app.vercel.app
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
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
