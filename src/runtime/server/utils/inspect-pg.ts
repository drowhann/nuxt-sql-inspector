import type { QueryResult, QueryResultRow } from 'pg'
import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const PG_INSPECTED = Symbol.for('sql-inspector.pg-query')

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

/**
 * Wrap the Pool/Client instance `.query` (not Client.prototype).
 * Pool.query is invoked while still in the Nitro request context; the
 * internal Client checkout runs later and would lose useEvent()/ALS.
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || typeof c.query !== 'function' || c[PG_INSPECTED]) return client

  const originalQuery = c.query.bind(c)

  c.query = function inspectedQuery(...args: any[]) {
    if (!isSqlInspectorEnabled()) {
      return originalQuery(...args)
    }

    // Capture before Pool does async client checkout
    const requestId = getCurrentRequestId()
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

  c[PG_INSPECTED] = true
  return client
}
