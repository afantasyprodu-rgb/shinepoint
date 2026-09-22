// Minimal Sentry error reporting via the raw HTTP Store API — no SDK
// dependency (keeps edge function bundles small), mirrors resend.ts's /
// sentdm.ts's soft-skip pattern exactly: unset SENTRY_DSN = silent no-op,
// never throws back into the caller's error path.
function parseDsn(dsn: string) {
  const url = new URL(dsn)
  const projectId = url.pathname.replace(/^\//, '')
  return {
    storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/`,
    publicKey: url.username,
  }
}

export async function captureException(error: unknown, fnName: string) {
  const dsn = Deno.env.get('SENTRY_DSN')
  if (!dsn) return
  try {
    const { storeUrl, publicKey } = parseDsn(dsn)
    const err = error instanceof Error ? error : new Error(String(error))
    await fetch(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=shinepoint-edge/1.0`,
      },
      body: JSON.stringify({
        message: err.message,
        exception: { values: [{ type: err.name, value: err.message, stacktrace: err.stack }] },
        tags: { function: fnName },
        platform: 'other',
        timestamp: Date.now() / 1000,
        environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
      }),
    })
  } catch (sendErr) {
    console.error('captureException: failed to report to Sentry:', (sendErr as Error).message)
  }
}
