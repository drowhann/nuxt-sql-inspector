import pg from 'pg'
import type { Pool, QueryResult, QueryResultRow } from 'pg'
import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const QUERY_INSTRUMENTED = Symbol.for('sql-inspector.client-query')

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
 * Patch `pg.Client.prototype.query` once so Pool.query and transactions are covered.
 * Call from your DB setup — the Nitro plugin does not auto-instrument.
 */
export function instrumentPg() {
  if (!isSqlInspectorEnabled()) return

  const proto = pg.Client.prototype as typeof pg.Client.prototype & {
    [QUERY_INSTRUMENTED]?: boolean
  }
  if (proto[QUERY_INSTRUMENTED]) return

  const originalQuery = proto.query

  proto.query = function instrumentedQuery(this: pg.Client, ...args: any[]) {
    if (!isSqlInspectorEnabled()) {
      return (originalQuery as any).apply(this, args)
    }

    const { sql, params } = extractSqlAndParams(args)
    const requestId = getCurrentRequestId()
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
      return (originalQuery as any).apply(this, wrappedArgs)
    }

    const result = (originalQuery as any).apply(this, args)
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
  } as typeof proto.query

  proto[QUERY_INSTRUMENTED] = true
}

/**
 * Public consumer API. Call once when creating your `pg` Pool / Client.
 *
 * @example
 * ```ts
 * import { instrumentSqlInspector } from '#sql-inspector'
 * const pool = instrumentSqlInspector(new Pool({ connectionString }))
 * ```
 */
export function instrumentSqlInspector<T extends Pool | void = void>(
  pool?: T,
): T extends Pool ? Pool : void {
  instrumentPg()
  return pool as any
}
