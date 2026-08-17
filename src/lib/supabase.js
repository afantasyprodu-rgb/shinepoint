import { createClient } from '@supabase/supabase-js'

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
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
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
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
