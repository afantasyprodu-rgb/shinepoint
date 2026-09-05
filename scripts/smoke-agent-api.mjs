// Static smoke for the Agent Booking API v1 artifacts.
// Optional live GET /health when AGENT_API_BASE is set.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const required = [
  'supabase/functions/agent-v1/index.ts',
  'supabase/functions/_shared/agentAuth.ts',
  'supabase/functions/_shared/agentPricing.ts',
  'docs/agent-api.md',
  'docs/openapi/agent-v1.yaml',
  'docs/agent-mcp.md',
  'mcp/package.json',
  'mcp/src/index.ts',
  'mcp/src/client.ts',
]

let failed = false
for (const rel of required) {
  const p = join(root, rel)
  if (!existsSync(p)) {
    console.error('FAIL: missing ' + rel)
    failed = true
    continue
  }
  const text = readFileSync(p, 'utf8')
  if (text.trim().length < 50) {
    console.error('FAIL: too short ' + rel)
    failed = true
  }
}

const index = readFileSync(join(root, 'supabase/functions/agent-v1/index.ts'), 'utf8')
for (const needle of ['handleSearch', 'handleQuote', 'handleCreateBooking', 'handleGetBooking', 'requireAgentAuth', 'computeQuote', 'Deno.serve']) {
  if (!index.includes(needle)) {
    console.error('FAIL: agent-v1/index.ts missing ' + needle)
    failed = true
  }
}
if (index.includes('paid_at:') && index.match(/paid_at:\s*new Date/)) {
  console.error('FAIL: agent-v1 must not stamp paid_at itself')
  failed = true
}

const openapi = readFileSync(join(root, 'docs/openapi/agent-v1.yaml'), 'utf8')
for (const path of ['/search', '/quote', '/bookings', '/health']) {
  if (!openapi.includes(path)) {
    console.error('FAIL: openapi missing path ' + path)
    failed = true
  }
}

const cfg = readFileSync(join(root, 'supabase/config.toml'), 'utf8')
if (!cfg.includes('[functions.agent-v1]') || !cfg.includes('verify_jwt = false')) {
  console.error('FAIL: config.toml must disable JWT verify for agent-v1')
  failed = true
}

if (failed) process.exit(1)
console.log('OK: agent-api v1 artifacts present (guards not modified by this check)')

const base = process.env.AGENT_API_BASE
if (base) {
  const url = base.replace(/\/$/, '') + '/health'
  const res = await fetch(url)
  const body = await res.text()
  if (!res.ok) {
    console.error('FAIL: live health ' + res.status + ' ' + body)
    process.exit(1)
  }
  console.log('OK: live health ' + url)
}