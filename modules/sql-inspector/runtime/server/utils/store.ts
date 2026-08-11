import { randomUUID } from 'node:crypto'
import { getSqlInspectorConfig } from './enabled'
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

const requests = new Map<string, RequestEvent>()
const requestOrder: string[] = []
const backgroundQueries: SqlQueryEvent[] = []
const listeners = new Set<Listener>()

function maxRequests() {
  return getSqlInspectorConfig().maxRequests ?? 200
}

function truncateParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (typeof p === 'string' && p.length > MAX_PARAM_STRING) {
      return `${p.slice(0, MAX_PARAM_STRING)}…`
    }
    return p
  })
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

export function startRequest(input: {
  id: string
  method: string
  path: string
  startedAt: number
}): RequestEvent {
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

export function finishRequest(input: {
  id: string
  statusCode: number
  durationMs: number
}): RequestEvent | null {
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
    params: truncateParams(input.params),
    durationMs: input.durationMs,
    timestamp: Date.now(),
    error: input.error,
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
