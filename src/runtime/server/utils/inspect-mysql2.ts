import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const MYSQL2_INSPECTED = Symbol.for('sql-inspector.mysql2')

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

function wrapMethod(c: any, method: 'query' | 'execute') {
  if (typeof c[method] !== 'function') return
  const original = c[method].bind(c)

  c[method] = function inspectedMethod(...args: any[]) {
    if (!isSqlInspectorEnabled()) {
      return original(...args)
    }

    const requestId = getCurrentRequestId()
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

/**
 * Wrap a mysql2 pool/connection `.query` and `.execute` (instance methods).
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || c[MYSQL2_INSPECTED]) return client
  if (typeof c.query !== 'function' && typeof c.execute !== 'function') return client

  wrapMethod(c, 'query')
  wrapMethod(c, 'execute')

  c[MYSQL2_INSPECTED] = true
  return client
}
