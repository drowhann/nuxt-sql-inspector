import type { QueryResult, QueryResultRow } from 'pg'
import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const PG_INSPECTED = Symbol.for('sql-inspector.pg-query')
const PINNED_REQUEST_ID = Symbol.for('sql-inspector.pinned-request-id')

function extractSqlAndParams(args: unknown[]): { sql: string; params: unknown[] } {
  const first = args[0]
  const second = args[1]
  if (typeof first === 'string') {
    const params = Array.isArray(second) ? (second as unknown[]) : []
    return { sql: first, params }
  }
  if (first && typeof first === 'object') {
    const q = first as { text?: string; values?: unknown[] }
    const params = Array.isArray(second)
      ? (second as unknown[])
      : Array.isArray(q.values)
        ? q.values
        : []
    return {
      sql: q.text ?? String(first),
      params,
    }
  }
  return { sql: String(first), params: [] }
}

function isQueryable(value: unknown): value is { query: (...args: any[]) => unknown } {
  return !!value && typeof (value as { query?: unknown }).query === 'function'
}

function requestIdFor(c: any): string | null {
  return PINNED_REQUEST_ID in c ? c[PINNED_REQUEST_ID] : getCurrentRequestId()
}

function attachCheckout(client: any, requestId: string | null) {
  client[PINNED_REQUEST_ID] = requestId
  inspectSql(client)
  return client
}

function wrapQuery(c: any) {
  const originalQuery = c.query.bind(c)

  c.query = function inspectedQuery(...args: any[]) {
    if (!isSqlInspectorEnabled()) {
      return originalQuery(...args)
    }

    const requestId = requestIdFor(c)
    const { sql, params } = extractSqlAndParams(args)
    const start = performance.now()
    const maybeCallback = typeof args[args.length - 1] === 'function'
      ? (args[args.length - 1] as (err: Error, result: QueryResult<QueryResultRow>) => void)
      : undefined

    if (maybeCallback) {
      const wrappedArgs = args.slice(0, -1)
      wrappedArgs.push((err: Error, result: QueryResult<QueryResultRow>) => {
        recordQuery({
          requestId,
          sql,
          params,
          durationMs: performance.now() - start,
          error: err ? err.message : undefined,
        })
        maybeCallback(err, result)
      })
      return originalQuery(...wrappedArgs)
    }

    const result = originalQuery(...args)
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).then(
        (value) => {
          recordQuery({
            requestId,
            sql,
            params,
            durationMs: performance.now() - start,
          })
          return value
        },
        (err: Error) => {
          recordQuery({
            requestId,
            sql,
            params,
            durationMs: performance.now() - start,
            error: err?.message ?? String(err),
          })
          throw err
        },
      )
    }

    recordQuery({
      requestId,
      sql,
      params,
      durationMs: performance.now() - start,
    })
    return result
  }
}

function wrapConnect(c: any) {
  const originalConnect = c.connect.bind(c)

  c.connect = function inspectedConnect(...args: any[]) {
    const requestId = getCurrentRequestId()
    const maybeCallback = typeof args[args.length - 1] === 'function'
      ? (args[args.length - 1] as (err: Error | null, client?: unknown, ...rest: unknown[]) => void)
      : undefined

    if (maybeCallback) {
      const wrappedArgs = args.slice(0, -1)
      wrappedArgs.push((err: Error | null, client?: unknown, ...rest: unknown[]) => {
        if (!err && isQueryable(client)) attachCheckout(client, requestId)
        maybeCallback(err, client, ...rest)
      })
      return originalConnect(...wrappedArgs)
    }

    const result = originalConnect(...args)
    if (result && typeof result.then === 'function') {
      return Promise.resolve(result).then((value) => {
        if (isQueryable(value)) return attachCheckout(value, requestId)
        return value
      })
    }
    if (isQueryable(result)) return attachCheckout(result, requestId)
    return result
  }
}

/**
 * Wrap the Pool/Client instance `.query` (not Client.prototype).
 * Pool.query is left unwrapped: it checkouts via `.connect`, and the
 * checked-out client records (request id pinned at connect() entry, before
 * async checkout would lose useEvent()/ALS).
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || c[PG_INSPECTED]) return client
  if (typeof c.query !== 'function' && typeof c.connect !== 'function') return client

  // ponytail: pg.Pool exposes idleCount/totalCount; Client does not. Ceiling:
  // a Pool-like without those getters wraps .query too and can double-count.
  const isPool = typeof c.connect === 'function' && ('idleCount' in c || 'totalCount' in c)

  if (!isPool) wrapQuery(c)
  if (typeof c.connect === 'function') wrapConnect(c)

  c[PG_INSPECTED] = true
  return client
}
