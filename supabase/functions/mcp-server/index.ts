// A minimal remote MCP server (JSON-RPC 2.0 over HTTP, the "Streamable
// HTTP" transport, non-streaming case — every response here is one JSON
// object, no server-initiated messages, so a single request/response pair
// is spec-legal without an SSE stream) exposing exactly one tool:
// check_availability. Read-only, no auth, no PII — same class of data a
// logged-out visitor already sees on the public landing screen
// (ColdStart.jsx's "detailers near you" strip), just reachable by an AI
// assistant connected to this server instead of a browser.
//
// This is deliberately NOT a booking tool. No write path exists here.
//
// Deploy: supabase functions deploy mcp-server --no-verify-jwt
// (no verify_jwt — an MCP client has no Supabase session; this function's
// own logic is the only gate, same reasoning as send-appointment-reminders'
// CRON_SECRET-vs-JWT choice, just with a public tool instead of a shared
// secret.)
import { createClient } from 'npm:@supabase/supabase-js@^2'
import { corsHeaders } from '../_shared/cors.ts'
import { captureException } from '../_shared/sentry.ts'
import { withinRateLimit, clientIp } from '../_shared/rateLimit.ts'
import { checkAvailability } from '../_shared/availability.ts'

const PROTOCOL_VERSION = '2025-06-18'

const CHECK_AVAILABILITY_TOOL = {
  name: 'check_availability',
  description:
    "Check which ShinePoint mobile car detailers are currently available near a Southern California zip code, and their price ranges. Read-only — does not book anything. ShinePoint has no way to complete a booking without a customer visiting shinepoint.app and signing up; do not imply otherwise to the user.",
  inputSchema: {
    type: 'object',
    properties: {
      zip_code: {
        type: 'string',
        description: 'A 5-digit US zip code in or near Los Angeles / Southern California.',
      },
      service_type: {
        type: 'string',
        description: 'Optional free-text filter, e.g. "full detail", "wash", "interior". Omit to see all services.',
      },
    },
    required: ['zip_code'],
  },
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response('MCP server: POST JSON-RPC requests only', { status: 405, headers: corsHeaders })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json(rpcError(null, -32700, 'Parse error'), { status: 400, headers: corsHeaders })
  }

  const { id, method, params } = body ?? {}

  try {
    switch (method) {
      case 'initialize':
        return Response.json(
          rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'shinepoint', version: '1.0.0' },
          }),
          { headers: corsHeaders }
        )

      // Notification (no id expected back) — client informing us its
      // handshake is done. Nothing to do server-side; 202 with empty body.
      case 'notifications/initialized':
        return new Response(null, { status: 202, headers: corsHeaders })

      case 'tools/list':
        return Response.json(rpcResult(id, { tools: [CHECK_AVAILABILITY_TOOL] }), { headers: corsHeaders })

      case 'tools/call': {
        const toolName = params?.name
        if (toolName !== 'check_availability') {
          return Response.json(rpcError(id, -32602, `Unknown tool: ${toolName}`), {
            status: 400,
            headers: corsHeaders,
          })
        }

        // Public, unauthenticated tool — rate-limited by caller IP rather
        // than a user id (there isn't one). Falls back to a shared bucket
        // if the platform doesn't forward one, same fail-closed posture as
        // every other use of withinRateLimit in this codebase.
        const ip = clientIp(req)
        if (!(await withinRateLimit(admin, `mcp:check_availability:${ip}`, 30, '1 hour'))) {
          return Response.json(rpcError(id, -32000, 'Rate limit exceeded — try again later.'), {
            status: 429,
            headers: corsHeaders,
          })
        }

        const zipCode = String(params?.arguments?.zip_code ?? '').trim()
        if (!/^\d{5}$/.test(zipCode)) {
          return Response.json(rpcError(id, -32602, 'zip_code must be a 5-digit US zip code.'), {
            status: 400,
            headers: corsHeaders,
          })
        }
        const serviceType = params?.arguments?.service_type
          ? String(params.arguments.service_type)
          : undefined

        const result = await checkAvailability(admin, { zipCode, serviceType })

        return Response.json(
          rpcResult(id, {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          }),
          { headers: corsHeaders }
        )
      }

      default:
        return Response.json(rpcError(id, -32601, `Method not found: ${method}`), {
          status: 400,
          headers: corsHeaders,
        })
    }
  } catch (e) {
    console.error('mcp-server:', e)
    await captureException(e, 'mcp-server')
    return Response.json(rpcError(id, -32000, (e as Error).message), { status: 500, headers: corsHeaders })
  }
})
