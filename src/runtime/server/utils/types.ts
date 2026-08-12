export type SqlQueryEvent = {
  id: string
  requestId: string | null
  sql: string
  params: unknown[]
  durationMs: number
  timestamp: number
  error?: string
}

export type RequestEvent = {
  id: string
  method: string
  path: string
  statusCode: number | null
  startedAt: number
  durationMs: number | null
  queries: SqlQueryEvent[]
}

export type InspectorBusEvent =
  | { type: 'request:start'; request: RequestEvent }
  | { type: 'sql'; query: SqlQueryEvent }
  | { type: 'request:finish'; request: RequestEvent }
  | { type: 'cleared' }

export type InspectorSnapshot = {
  requests: RequestEvent[]
  backgroundQueries: SqlQueryEvent[]
}
