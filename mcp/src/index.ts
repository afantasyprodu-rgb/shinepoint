#!/usr/bin/env node
/**
 * ShinePoint MCP server — exposes Agent Booking API v1 as MCP tools over stdio.
 * Payment stays human-owned: create_booking returns client_secret / checkout_url only.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { AgentApiClient, AgentApiError, loadConfig } from './client.js'

const VEHICLE_TYPES = [
  'Sedan',
  'SUV',
  'Truck',
  'Van',
  'Coupe',
  'Hatchback',
  'Other',
] as const

function textResult(data: unknown, isError = false) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  }
}

function formatError(err: unknown) {
  if (err instanceof AgentApiError) {
    return textResult(
      {
        error: true,
        status: err.status,
        message: err.message,
        body: err.body,
      },
      true,
    )
  }
  const message = err instanceof Error ? err.message : String(err)
  return textResult({ error: true, message }, true)
}

function createServer(): McpServer {
  const client = new AgentApiClient(loadConfig())
  const server = new McpServer({
    name: 'shinepoint-agent',
    version: '1.0.0',
  })

  server.tool(
    'health',
    'Ping the ShinePoint Agent Booking API (liveness / health check). Does not require an API key.',
    {},
    async () => {
      try {
        return textResult(await client.health())
      } catch (err) {
        return formatError(err)
      }
    },
  )

  // Alias for hosts that prefer "ping"
  server.tool(
    'ping',
    'Alias of health — ping the ShinePoint Agent Booking API.',
    {},
    async () => {
      try {
        return textResult(await client.health())
      } catch (err) {
        return formatError(err)
      }
    },
  )

  server.tool(
    'search_detailers',
    'Search available ShinePoint detailers near a ZIP code. Returns detailers, services, and distance estimates, sorted nearest-first. Present a short list of the top few (e.g. 3-5) to the person and let THEM pick which detailer to book — do not auto-select the closest/first result and book it on their behalf.',
    {
      zip: z.string().describe('Customer ZIP code (required)'),
      date: z
        .string()
        .optional()
        .describe('Preferred service date (YYYY-MM-DD)'),
      vehicle_type: z
        .enum(VEHICLE_TYPES)
        .optional()
        .describe('Vehicle type filter'),
      max_miles: z
        .number()
        .optional()
        .describe('Max travel distance in miles (default ~50)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Max results (1–50, default 20)'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { zip: args.zip }
        if (args.date !== undefined) body.date = args.date
        if (args.vehicle_type !== undefined) body.vehicle_type = args.vehicle_type
        if (args.max_miles !== undefined) body.max_miles = args.max_miles
        if (args.limit !== undefined) body.limit = args.limit
        return textResult(await client.search(body))
      } catch (err) {
        return formatError(err)
      }
    },
  )

  server.tool(
    'get_quote',
    'Get a price quote for a detailer + service (and optional add-ons) at a booking ZIP. Loyalty/referral credits are out of scope for v1.',
    {
      detailer_id: z.string().uuid().describe('Detailer profile UUID'),
      service_id: z.string().uuid().describe('Primary service UUID'),
      booking_zip: z.string().describe('Job site ZIP code'),
      addon_service_ids: z
        .array(z.string().uuid())
        .optional()
        .describe('Optional add-on service UUIDs'),
      vehicle_type: z.enum(VEHICLE_TYPES).optional().describe('Vehicle type'),
      promo_code: z
        .string()
        .nullable()
        .optional()
        .describe('Optional promo code'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {
          detailer_id: args.detailer_id,
          service_id: args.service_id,
          booking_zip: args.booking_zip,
        }
        if (args.addon_service_ids !== undefined) {
          body.addon_service_ids = args.addon_service_ids
        }
        if (args.vehicle_type !== undefined) body.vehicle_type = args.vehicle_type
        if (args.promo_code !== undefined) body.promo_code = args.promo_code
        return textResult(await client.quote(body))
      } catch (err) {
        return formatError(err)
      }
    },
  )

  server.tool(
    'create_booking',
    'Create a pending ShinePoint booking and return Stripe payment.client_secret / payment.checkout_url for a HUMAN to complete. Only call this for the detailer the person actually chose from search_detailers\' shortlist — never the first/closest result by default. Agents must NEVER mark the booking paid — payment confirmation is webhook-only.',
    {
      detailer_id: z.string().uuid().describe('Detailer profile UUID'),
      service_id: z.string().uuid().describe('Primary service UUID'),
      scheduled_time: z
        .string()
        .describe('ISO-8601 datetime for the appointment (must be in the future)'),
      address: z.string().describe('Service street address'),
      zip: z.string().describe('Service ZIP code'),
      customer_id: z
        .string()
        .uuid()
        .optional()
        .describe('Existing customer user UUID (provide this or customer_email)'),
      customer_email: z
        .string()
        .email()
        .optional()
        .describe('Customer email if customer_id is unknown'),
      addon_service_ids: z
        .array(z.string().uuid())
        .optional()
        .describe('Optional add-on service UUIDs'),
      vehicle_type: z.enum(VEHICLE_TYPES).optional().describe('Vehicle type'),
      vehicle_make: z.string().optional().describe('Vehicle make'),
      vehicle_model: z.string().optional().describe('Vehicle model'),
      promo_code: z
        .string()
        .nullable()
        .optional()
        .describe('Optional promo code'),
    },
    async (args) => {
      try {
        if (!args.customer_id && !args.customer_email) {
          return textResult(
            {
              error: true,
              message:
                'Provide customer_id or customer_email so the booking can be attached to a customer.',
            },
            true,
          )
        }
        const body: Record<string, unknown> = {
          detailer_id: args.detailer_id,
          service_id: args.service_id,
          scheduled_time: args.scheduled_time,
          address: args.address,
          zip: args.zip,
        }
        if (args.customer_id !== undefined) body.customer_id = args.customer_id
        if (args.customer_email !== undefined) {
          body.customer_email = args.customer_email
        }
        if (args.addon_service_ids !== undefined) {
          body.addon_service_ids = args.addon_service_ids
        }
        if (args.vehicle_type !== undefined) body.vehicle_type = args.vehicle_type
        if (args.vehicle_make !== undefined) body.vehicle_make = args.vehicle_make
        if (args.vehicle_model !== undefined) {
          body.vehicle_model = args.vehicle_model
        }
        if (args.promo_code !== undefined) body.promo_code = args.promo_code

        const result = await client.createBooking(body)
        // Remind the model: payment is human-owned
        return textResult({
          ...(typeof result === 'object' && result !== null ? result : { data: result }),
          _mcp_note:
            'Booking is pending payment. Give the human payment.checkout_url or use payment.client_secret in Stripe Elements. Do not mark paid.',
        })
      } catch (err) {
        return formatError(err)
      }
    },
  )

  server.tool(
    'get_booking_status',
    'Fetch booking status by id (includes paid boolean after confirmed success).',
    {
      booking_id: z.string().uuid().describe('Booking UUID'),
    },
    async ({ booking_id }) => {
      try {
        return textResult(await client.getBooking(booking_id))
      } catch (err) {
        return formatError(err)
      }
    },
  )

  return server
}

async function main() {
  // stdout is the MCP JSON-RPC channel — log only to stderr
  const cfg = loadConfig()
  console.error(
    `[shinepoint-mcp] base=${cfg.baseUrl} key=${cfg.apiKey ? 'set' : 'MISSING'}`,
  )
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[shinepoint-mcp] connected over stdio')
}

main().catch((err) => {
  console.error('[shinepoint-mcp] fatal', err)
  process.exit(1)
})
