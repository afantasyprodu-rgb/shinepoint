import { createClient } from '@supabase/supabase-js'
import { isNative } from './native'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and fill in your project credentials, then restart the dev server.'
  )
}

// Placeholder values keep the app rendering before .env is set up;
// any real auth/database call will fail until credentials are provided.
// Native OAuth returns through the shinepoint:// custom scheme, which any other
// installed app can also register. Under the default implicit flow that
// redirect carried the access + refresh tokens themselves, so an app claiming
// the scheme could take over the account. PKCE returns only a one-time code
// that's useless without the verifier stored in THIS app. Web keeps implicit:
// its redirect goes to our own https origin, and nothing else needs changing.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { flowType: isNative ? 'pkce' : 'implicit' } }
)

// Password-reset emails open in the phone's browser, not the app, so a PKCE
// link (verifier stored in-app) could never be redeemed there. This client
// only sends the reset email; it holds no session.
export const recoveryClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sb-recovery' } }
)

// Every edge function returns either a transport error or a `{ error }` body,
// and every caller wants the same thing: the payload, or a throw. One place
// to do that instead of the same four lines in each wrapper.
export async function invokeFn(name, body = {}) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // supabase-js's error.message is a generic "Edge Function returned a
    // non-2xx status code" for ANY non-2xx response — the actual message
    // our functions return (e.g. "You have an active or disputed booking...")
    // lives in the raw response body instead, reachable via error.context.
    let message = error.message
    if (error.context?.json) {
      try {
        const body = await error.context.json()
        if (body?.error) message = body.error
      } catch {
        // Not JSON (or already consumed) — fall back to the generic message.
      }
    } else {
      // No Response to read a body from at all — the request never made it
      // to the function (offline, DNS/CORS failure, dropped connection).
      // error.message here is the raw underlying fetch error (e.g. Safari's
      // "TypeError: Load failed"), which leaks the Supabase project's
      // internal hostname straight into the UI. Every caller's catch block
      // does `e.message || <fallback>` and a non-empty raw message always
      // wins, so this has to be normalized here, the one shared place.
      message = 'Network error — check your connection and try again.'
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
