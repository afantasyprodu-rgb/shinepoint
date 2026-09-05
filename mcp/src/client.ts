/**
 * Thin HTTP client for ShinePoint Agent Booking API v1.
 * No DB access — all writes go through the deployed edge function.
 */

const DEFAULT_BASE =
  'https://ggcfwwpmclypcexiprro.supabase.co/functions/v1/agent-v1'

export type AgentApiConfig = {
  baseUrl: string
  apiKey: string | undefined
}

export function loadConfig(): AgentApiConfig {
  const baseUrl = (
    process.env.SHINEPOINT_AGENT_API_BASE ||
    process.env.AGENT_API_BASE ||
    DEFAULT_BASE
  ).replace(/\/$/, '')

  const apiKey =
    process.env.SHINEPOINT_AGENT_API_KEY ||
    process.env.AGENT_API_KEY ||
    undefined

  return { baseUrl, apiKey }
}

export class AgentApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown, message?: string) {
    super(message || `Agent API HTTP ${status}`)
    this.name = 'AgentApiError'
    this.status = status
    this.body = body
  }
}

export class AgentApiClient {
  readonly config: AgentApiConfig

  constructor(config: AgentApiConfig = loadConfig()) {
    this.config = config
  }

  private authHeaders(requireAuth: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['X-Agent-Api-Key'] = this.config.apiKey
    } else if (requireAuth) {
      throw new Error(
        'Missing SHINEPOINT_AGENT_API_KEY (or AGENT_API_KEY). Set it in the MCP server env — never commit the real key.',
      )
    }
    return headers
  }

  private async parseBody(res: Response): Promise<unknown> {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return { raw: text }
    }
  }

  async request(
    method: 'GET' | 'POST',
    path: string,
    options: { body?: unknown; requireAuth?: boolean } = {},
  ): Promise<unknown> {
    const requireAuth = options.requireAuth !== false
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const res = await fetch(url, {
      method,
      headers: this.authHeaders(requireAuth),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
    const body = await this.parseBody(res)
    if (!res.ok) {
      throw new AgentApiError(res.status, body)
    }
    return body
  }

  health() {
    return this.request('GET', '/health', { requireAuth: false })
  }

  search(body: Record<string, unknown>) {
    return this.request('POST', '/search', { body })
  }

  quote(body: Record<string, unknown>) {
    return this.request('POST', '/quote', { body })
  }

  createBooking(body: Record<string, unknown>) {
    return this.request('POST', '/bookings', { body })
  }

  getBooking(id: string) {
    return this.request('GET', `/bookings/${encodeURIComponent(id)}`)
  }
}
