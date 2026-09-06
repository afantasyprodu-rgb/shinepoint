// Agent API key auth for machine-facing edge functions.
// Preferred: set AGENT_API_KEY_HASH to the hex SHA-256 of the plaintext key
// (so the secret never lives in env). Fallback: AGENT_API_KEY plaintext
// (same pattern as CRON_SECRET) for local/smoke testing.
// Multiple hashes: AGENT_API_KEY_HASHES=hex1,hex2
import { json } from './cors.ts'

const encoder = new TextEncoder()

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

function extractApiKey(req: Request): string | null {
  const headerKey = req.headers.get('x-agent-api-key')?.trim()
  if (headerKey) return headerKey
  const auth = req.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

function configuredHashes(): string[] {
  const multi = Deno.env.get('AGENT_API_KEY_HASHES') ?? ''
  const single = Deno.env.get('AGENT_API_KEY_HASH') ?? ''
  return [...multi.split(','), single]
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
}

/**
 * Identifies the authenticated caller for rate-limit buckets. Derived from
 * the presented key itself (never client-supplied input like a body
 * field) so a caller can't reset its own quota by sending a different
 * `agent_id` on every request — the key is the only thing here an attacker
 * can't freely choose per request.
 */
export async function agentKeyId(req: Request): Promise<string> {
  const key = extractApiKey(req) ?? ''
  return (await sha256Hex(key)).slice(0, 16)
}

/** Returns null when auth succeeds; otherwise an HTTP Response to return. */
export async function requireAgentAuth(req: Request): Promise<Response | null> {
  const hashes = configuredHashes()
  const plain = Deno.env.get('AGENT_API_KEY')?.trim() ?? ''
  if (hashes.length === 0 && !plain) {
    console.error('agent auth: AGENT_API_KEY_HASH (or AGENT_API_KEY) is not configured')
    return json({ error: 'Agent API is not configured' }, 503)
  }

  const key = extractApiKey(req)
  if (!key) {
    return json({
      error: 'Missing agent API key. Send X-Agent-Api-Key or Authorization: Bearer <key>.',
    }, 401)
  }

  if (plain && timingSafeEqual(key, plain)) return null

  if (hashes.length > 0) {
    const incoming = (await sha256Hex(key)).toLowerCase()
    if (hashes.some((h) => timingSafeEqual(incoming, h))) return null
  }

  return json({ error: 'Invalid agent API key' }, 401)
}

export const agentCorsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-agent-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function agentJson(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...agentCorsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}