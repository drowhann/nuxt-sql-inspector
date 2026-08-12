import { randomUUID } from 'node:crypto'
import { DEFAULT_MAX_REQUESTS, getSqlInspectorConfig } from './enabled'
import { redactParams as redactParamList } from './redact-params'
import type {
  InspectorBusEvent,
  InspectorSnapshot,
  RequestEvent,
  SqlQueryEvent,
} from './types'

const MAX_QUERIES_PER_REQUEST = 100
const MAX_BACKGROUND_QUERIES = 100
const MAX_PARAM_STRING = 200

type Listener = (event: InspectorBusEvent) => void

type PendingRequest = {
  id: string
  method: string
  path: string
  startedAt: number
}

type StoreState = {
  requests: Map<string, RequestEvent>
  pending: Map<string, PendingRequest>
  requestOrder: string[]
  backgroundQueries: SqlQueryEvent[]
  listeners: Set<Listener>
}

// Nuxt dev: Vite SSR and Nitro can load separate module copies — share via globalThis.
const STORE_KEY = '__nuxt_sql_inspector_store__'
const g = globalThis as typeof globalThis & { [STORE_KEY]?: StoreState }
const state: StoreState = g[STORE_KEY] ?? (g[STORE_KEY] = {
  requests: new Map(),
  pending: new Map(),
  requestOrder: [],
  backgroundQueries: [],
  listeners: new Set(),
})

const { requests, pending, requestOrder, backgroundQueries, listeners } = state

function maxRequests() {
  return getSqlInspectorConfig().maxRequests ?? DEFAULT_MAX_REQUESTS
}

function truncateParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (typeof p === 'string' && p.length > MAX_PARAM_STRING) {
      return `${p.slice(0, MAX_PARAM_STRING)}…`
    }
    return p
  })
}

function sanitizeParams(params: unknown[]): unknown[] {
  if (getSqlInspectorConfig().redactParams !== false) {
    return redactParamList(params)
  }
  return truncateParams(params)
}

function cloneRequest(req: RequestEvent): RequestEvent {
  return {
    ...req,
    queries: req.queries.map((q) => ({ ...q, params: [...q.params] })),
  }
}

function broadcast(event: InspectorBusEvent) {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // ponytail: ignore broken SSE listeners; they are removed on close
    }
  }
}

function evictOldestRequests() {
  const max = maxRequests()
  while (requestOrder.length > max) {
    const oldest = requestOrder.shift()
    if (oldest) requests.delete(oldest)
  }
}

/** Remember a request; it only appears in the UI after the first SQL query. */
export function trackRequest(input: PendingRequest) {
  pending.set(input.id, input)
}

export function startRequest(input: PendingRequest): RequestEvent {
  pending.delete(input.id)
  const request: RequestEvent = {
    id: input.id,
    method: input.method,
    path: input.path,
    statusCode: null,
    startedAt: input.startedAt,
    durationMs: null,
    queries: [],
  }
  requests.set(request.id, request)
  requestOrder.push(request.id)
  evictOldestRequests()
  broadcast({ type: 'request:start', request: cloneRequest(request) })
  return request
}

function ensureVisible(requestId: string): RequestEvent | null {
  const existing = requests.get(requestId)
  if (existing) return existing
  const p = pending.get(requestId)
  if (!p) return null
  return startRequest(p)
}

export function finishRequest(input: {
  id: string
  statusCode: number
  durationMs: number
}): RequestEvent | null {
  // No SQL → never show this request (e.g. HTML page with no DB)
  if (pending.has(input.id)) {
    pending.delete(input.id)
    return null
  }

  const request = requests.get(input.id)
  if (!request) return null
  request.statusCode = input.statusCode
  request.durationMs = input.durationMs
  const cloned = cloneRequest(request)
  broadcast({ type: 'request:finish', request: cloned })
  return cloned
}

export function recordQuery(input: {
  requestId: string | null
  sql: string
  params: unknown[]
  durationMs: number
  error?: string
}): SqlQueryEvent {
  const query: SqlQueryEvent = {
    id: randomUUID(),
    requestId: input.requestId,
    sql: input.sql,
    params: sanitizeParams(input.params),
    durationMs: input.durationMs,
    timestamp: Date.now(),
    error: input.error,
  }

  if (input.requestId) {
    ensureVisible(input.requestId)
  }

  if (input.requestId && requests.has(input.requestId)) {
    const request = requests.get(input.requestId)!
    if (request.queries.length < MAX_QUERIES_PER_REQUEST) {
      request.queries.push(query)
    }
  } else {
    backgroundQueries.push(query)
    while (backgroundQueries.length > MAX_BACKGROUND_QUERIES) {
      backgroundQueries.shift()
    }
  }

  broadcast({ type: 'sql', query: { ...query, params: [...query.params] } })
  return query
}

export function getSnapshot(): InspectorSnapshot {
  return {
    requests: requestOrder
      .map((id) => requests.get(id))
      .filter((r): r is RequestEvent => !!r)
      .map(cloneRequest)
      .reverse(),
    backgroundQueries: backgroundQueries.map((q) => ({
      ...q,
      params: [...q.params],
    })),
  }
}

export function clearStore() {
  requests.clear()
  pending.clear()
  requestOrder.length = 0
  backgroundQueries.length = 0
  broadcast({ type: 'cleared' })
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
