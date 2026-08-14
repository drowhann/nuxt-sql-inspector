import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const MYSQL2_INSPECTED = Symbol.for('sql-inspector.mysql2')
const PINNED_REQUEST_ID = Symbol.for('sql-inspector.pinned-request-id')

function extractSqlAndParams(args: unknown[]): { sql: string; params: unknown[] } {
  const first = args[0]
  const second = args[1]
  if (typeof first === 'string') {
    const params = Array.isArray(second) ? (second as unknown[]) : []
    return { sql: first, params }
  }
  if (first && typeof first === 'object') {
    const q = first as { sql?: string; values?: unknown[] }
    return {
      sql: q.sql ?? String(first),
      params: Array.isArray(q.values) ? q.values : [],
    }
  }
  return { sql: String(first), params: [] }
}

function isQueryable(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as { query?: unknown; execute?: unknown }
  return typeof v.query === 'function' || typeof v.execute === 'function'
}

function requestIdFor(c: any): string | null {
  return PINNED_REQUEST_ID in c ? c[PINNED_REQUEST_ID] : getCurrentRequestId()
}

function attachCheckout(conn: any, requestId: string | null) {
  conn[PINNED_REQUEST_ID] = requestId
  inspectSql(conn)
  return conn
}

function wrapMethod(c: any, method: 'query' | 'execute') {
  if (typeof c[method] !== 'function') return
  const original = c[method].bind(c)

  c[method] = function inspectedMethod(...args: any[]) {
    if (!isSqlInspectorEnabled()) {
      return original(...args)
    }

    const requestId = requestIdFor(c)
    const { sql, params } = extractSqlAndParams(args)
    const start = performance.now()
    const maybeCallback = typeof args[args.length - 1] === 'function'
      ? (args[args.length - 1] as (err: Error | null, ...rest: unknown[]) => void)
      : undefined

    if (maybeCallback) {
      const wrappedArgs = args.slice(0, -1)
      wrappedArgs.push((err: Error | null, ...rest: unknown[]) => {
        recordQuery({
          requestId,
          sql,
          params,
          durationMs: performance.now() - start,
          error: err ? err.message : undefined,
        })
        maybeCallback(err, ...rest)
      })
      return original(...wrappedArgs)
    }

    const result = original(...args)
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

function wrapGetConnection(c: any) {
  const originalGetConnection = c.getConnection.bind(c)

  c.getConnection = function inspectedGetConnection(...args: any[]) {
    const requestId = getCurrentRequestId()
    const maybeCallback = typeof args[args.length - 1] === 'function'
      ? (args[args.length - 1] as (err: Error | null, conn?: unknown, ...rest: unknown[]) => void)
      : undefined

    if (maybeCallback) {
      const wrappedArgs = args.slice(0, -1)
      wrappedArgs.push((err: Error | null, conn?: unknown, ...rest: unknown[]) => {
        if (!err && isQueryable(conn)) attachCheckout(conn, requestId)
        maybeCallback(err, conn, ...rest)
      })
      return originalGetConnection(...wrappedArgs)
    }

    const result = originalGetConnection(...args)
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
 * Wrap a mysql2 pool/connection `.query` and `.execute` (instance methods).
 * Pool.query is left unwrapped: it checkouts via `.getConnection`, and the
 * checked-out connection records (request id pinned at getConnection() entry).
 * Does not wrap Connection `.connect` (TCP).
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || c[MYSQL2_INSPECTED]) return client
  if (
    typeof c.query !== 'function'
    && typeof c.execute !== 'function'
    && typeof c.getConnection !== 'function'
  ) {
    return client
  }

  const isPool = typeof c.getConnection === 'function'

  if (!isPool) {
    wrapMethod(c, 'query')
    wrapMethod(c, 'execute')
  }
  if (isPool) wrapGetConnection(c)

  c[MYSQL2_INSPECTED] = true
  return client
}
