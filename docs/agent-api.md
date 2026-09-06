# ShinePoint Agent Booking API v1

Machine-facing HTTP API for external AI agents: search, quote, create booking pending human payment, get status.
Real Supabase path only (no demo store fallback). MCP wrapper: see docs/agent-mcp.md.

## Usage policy — humans stay in the loop

Two decisions in this flow belong to the person, not the agent:

1. **Which detailer.** `/search` returns results sorted nearest-first —
   present a short list (top 3-5 by distance/rating) and let the person pick
   one. Do not auto-book the first or closest result.
2. **Payment.** As documented under `POST /bookings` below, agents never
   mark a booking paid — the human completes checkout via `client_secret`
   or `checkout_url`.

## Base URL

https://<PROJECT_REF>.supabase.co/functions/v1/agent-v1

Deploy: supabase functions deploy agent-v1
config.toml has verify_jwt = false for agent-v1; use agent API key auth.

## Auth

Send header X-Agent-Api-Key with your plaintext key (or Authorization bearer token).
Configure Edge secrets AGENT_API_KEY_HASH (preferred SHA-256 hex) or AGENT_API_KEY (local smoke).
Optional AGENT_API_KEY_HASHES for rotation. Never commit secrets.

## Endpoints

### GET /health
Unauthenticated liveness.

### POST /search
JSON body: zip (required), date, vehicle_type, max_miles, limit.
Results are sorted nearest-first; present a short list to the person and let them choose — see Usage policy above.

### POST /quote
JSON body: detailer_id, service_id, addon_service_ids, booking_zip, vehicle_type, promo_code.
Uses shared fee tiers from _shared/fees.ts (same as src/lib/fees.js display schedule).
Loyalty and referral credits are out of scope for v1.

### POST /bookings
Creates a pending booking and returns payment.client_secret plus payment.checkout_url.
Humans finish checkout; agents do not mark bookings as paid.
Body: customer_id or customer_email, detailer_id, service_id, scheduled_time, address, zip.
Optional: addon_service_ids, vehicle_type, vehicle_make, vehicle_model, promo_code.

### GET /bookings/:id
Returns status including paid boolean after confirmed success.

## OpenAPI
See docs/openapi/agent-v1.yaml.

## Guards
Booking column guards are unchanged. Schedule conflicts are re-checked in the function.

## Smoke
Use the smoke:agent-api package script for a static artifact check.

## MCP

Stdio MCP server for Cursor / Claude Desktop lives in `mcp/`. Tools map 1:1 to these endpoints (thin HTTP client; no DB writes; bookings stay pending until human payment). Install and config: [agent-mcp.md](./agent-mcp.md).
