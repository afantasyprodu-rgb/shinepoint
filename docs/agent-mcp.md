# ShinePoint Agent MCP Server

Thin stdio MCP server that wraps the deployed [Agent Booking API v1](./agent-api.md).
Humans install the server once in Cursor / Claude Desktop; agents then call tools — no direct database access and no ability to mark bookings paid.

## What you get

| MCP tool | API | Notes |
| --- | --- | --- |
| `health` / `ping` | `GET /health` | Liveness; no API key required |
| `search_detailers` | `POST /search` | ZIP search |
| `get_quote` | `POST /quote` | Price a job |
| `create_booking` | `POST /bookings` | Pending payment only — returns `client_secret` / `checkout_url` |
| `get_booking_status` | `GET /bookings/:id` | Includes `paid` after confirmed success |

Package lives at `mcp/` (`@shinepoint/mcp`).

## Prerequisites

1. Node.js 18+
2. Your plaintext Agent API key (same key hashed as Edge secret `AGENT_API_KEY_HASH`)
3. Install MCP package deps once:
``bash
cd mcp
npm install
```

Optional build (for `node dist/index.js` launches):
``bash
npm run build
```

## Environment

| Variable | Required | Default |
| --- | --- | --- |
| `SHINEPOINT_AGENT_API_KEY` | Yes (for tools other than health) | — |
| `SHINEPOINT_AGENT_API_BASE` | No | `https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/agent-v1` |

Fallbacks: `AGENT_API_KEY` / `AGENT_API_BASE` (same semantics). **Never commit the real key.**

## Run locally (stdio)

From the repo root:

```bash
npm run mcp
```

Or from `mcp/`:

```bash
npm run mcp
# equivalent: npm run dev
```

The process speaks MCP on stdin/stdout. Use it via an MCP host, or inspect with the MCP Inspector pointed at `npm run mcp` from the `mcp/` folder.

## Cursor

Add a server entry (Cursor Settings — MCP, or project `.cursor/mcp.json`).
Replace paths with your absolute repo path and put the key in `env` only (never in git).

```json
{
  "mcpServers": {
    "shinepoint": {
      "command": "npx",
      "args": ["tsx", "REPO/mcp/src/index.ts"],
      "env": {
        "SHINEPOINT_AGENT_API_BASE": "https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/agent-v1",
        "SHINEPOINT_AGENT_API_KEY": "YOUR_AGENT_API_KEY"
      }
    }
  }
}
```

Windows example:

```json
{
  "mcpServers": {
    "shinepoint": {
      "command": "npx",
      "args": [
        "tsx",
        "C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\mcp\\src\\index.ts"
      ],
      "cwd": "C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\mcp",
      "env": {
        "SHINEPOINT_AGENT_API_KEY": "YOUR_AGENT_API_KEY"
      }
    }
  }
}
```

After `npm run build` inside `mcp/`, launch with Node:

```json
{
  "mcpServers": {
    "shinepoint": {
      "command": "node",
      "args": [
        "C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\mcp\\dist\\index.js"
      ],
      "env": {
        "SHINEPOINT_AGENT_API_KEY": "YOUR_AGENT_API_KEY"
      }
    }
  }
}
```

Reload MCP servers in Cursor. The agent should list ShinePoint tools.

## Claude Desktop

Edit Claude Desktop config:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "shinepoint": {
      "command": "npx",
      "args": [
        "tsx",
        "C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\mcp\\src\\index.ts"
      ],
      "cwd": "C:\\Users\\Richrx\\Documents\\Cloud stuff\\detailing-marketplace\\mcp",
      "env": {
        "SHINEPOINT_AGENT_API_BASE": "https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/agent-v1",
        "SHINEPOINT_AGENT_API_KEY": "YOUR_AGENT_API_KEY"
      }
    }
  }
}
```

Fully quit and reopen Claude Desktop. Confirm tools appear under the MCP connector.

## Payment rules (do not bypass)

- `create_booking` creates a **pending** booking and returns Stripe payment fields for a **human**.
- Agents must not invent "mark paid" tools, write `paid_at`, or skip checkout.
- Status after payment: `get_booking_status` → `paid: true` once webhooks confirm.

## Publishing (optional / out of scope)

This repo does **not** require publishing to a public MCP registry. To share later:

1. Publish `@shinepoint/mcp` (or a public fork) to npm with no secrets in the package.
2. Document install as an npx one-liner with env vars supplied by the host.
3. Optionally list on an MCP directory once you have a support story.

Until then, stdio config pointing at this repo path is the supported install.

## Smoke

From repo root, `num run smoke:agent-api` checks static API artifacts.
MCP itself is exercised by connecting a host and calling `health` / `ping`.
