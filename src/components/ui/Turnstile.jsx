// Cloudflare Turnstile widget for the auth forms — bot protection on the
// two endpoints that matter: password login (credential stuffing) and the
// email-code send (signup spam, since signInWithOtp with
// shouldCreateUser:true is what actually creates accounts).
//
// Soft-skips exactly like _shared/resend.ts and _shared/sentdm.ts: with
// VITE_TURNSTILE_SITE_KEY unset this renders nothing and reports a null
// token, so auth keeps working unchanged until the keys are configured.
// Supabase enforces the token server-side, so a client that skips it only
// gets through while captcha is ALSO disabled in the Supabase dashboard —
// the two are turned on together (see .env.example).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
export const isTurnstileConfigured = Boolean(SITE_KEY)

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

// One shared loader promise — AuthCard can mount/unmount the widget as the
// user flips between login and signup, and the script must only load once.
let scriptPromise = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile script failed to load')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

// A Turnstile token is single-use: after any auth attempt (success OR
// failure) it's spent, and reusing it makes the next call fail with a
// confusing "captcha protection: request disallowed". Callers reset via
// the ref so a user who fumbles their password can retry.
const Turnstile = forwardRef(function Turnstile({ onToken }, ref) {
  const boxRef = useRef(null)
  const widgetIdRef = useRef(null)
  const onTokenRef = useRef(onToken)
  const [failed, setFailed] = useState(false)

  // Keep the latest callback without re-running the render effect (which
  // would tear down and re-create the widget on every parent re-render).
  useEffect(() => { onTokenRef.current = onToken }, [onToken])

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
        onTokenRef.current?.(null)
      }
    },
  }), [])

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false

    // A blocked script fires onerror, but a script that merely hangs (a
    // captive portal, a filtering DNS, a proxy that black-holes the host)
    // never settles at all — without this the submit button would sit
    // disabled forever with nothing on screen explaining why.
    const timeout = setTimeout(() => {
      if (!cancelled && widgetIdRef.current === null) setFailed(true)
    }, 10000)

    loadTurnstile()
      .then(() => {
        if (cancelled || !boxRef.current || widgetIdRef.current !== null) return
        widgetIdRef.current = window.turnstile.render(boxRef.current, {
          sitekey: SITE_KEY,
          // The app's dark mode is an opt-in class on <html>, not the OS
          // preference, so 'auto' (which reads prefers-color-scheme) would
          // mismatch a light-mode user on a dark-mode OS.
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token) => onTokenRef.current?.(token),
          'expired-callback': () => onTokenRef.current?.(null),
          'error-callback': () => { setFailed(true); onTokenRef.current?.(null) },
        })
      })
      .catch(() => setFailed(true))

    return () => {
      cancelled = true
      clearTimeout(timeout)
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null

  return (
    <div>
      <div ref={boxRef} className="flex justify-center" />
      {failed && (
        <p role="alert" className="auth-error mt-1">
          Couldn't load the verification check. Disable any ad blocker for this site and reload.
        </p>
      )}
    </div>
  )
})

export default Turnstile
