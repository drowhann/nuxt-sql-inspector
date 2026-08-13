import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const LIBSQL_INSPECTED = Symbol.for('sql-inspector.libsql')

function extractExecute(
  stmt: unknown,
  args?: unknown,
): { sql: string; params: unknown[] } {
  if (typeof stmt === 'string') {
    return {
      sql: stmt,
      params: Array.isArray(args) ? args : [],
    }
  }
  if (stmt && typeof stmt === 'object') {
    const s = stmt as { sql?: string; args?: unknown[] }
    return {
      sql: s.sql ?? String(stmt),
      params: Array.isArray(s.args) ? s.args : [],
    }
  }
  return { sql: String(stmt), params: [] }
}

function trackPromise(
  result: Promise<unknown>,
  meta: { requestId: string | null; sql: string; params: unknown[]; start: number },
) {
  return result.then(
    (value) => {
      recordQuery({
        requestId: meta.requestId,
        sql: meta.sql,
        params: meta.params,
        durationMs: performance.now() - meta.start,
      })
      return value
    },
    (err: Error) => {
      recordQuery({
        requestId: meta.requestId,
        sql: meta.sql,
        params: meta.params,
        durationMs: performance.now() - meta.start,
        error: err?.message ?? String(err),
      })
      throw err
    },
  )
}

/**
 * Wrap an `@libsql/client` client `.execute` and `.batch`.
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || typeof c.execute !== 'function' || c[LIBSQL_INSPECTED]) return client

  const originalExecute = c.execute.bind(c)
  c.execute = function inspectedExecute(stmt: unknown, args?: unknown) {
    if (!isSqlInspectorEnabled()) {
      return originalExecute(stmt, args)
    }
    const requestId = getCurrentRequestId()
    const { sql, params } = extractExecute(stmt, args)
    const start = performance.now()
    const result = originalExecute(stmt, args)
    if (result && typeof result.then === 'function') {
      return trackPromise(Promise.resolve(result), { requestId, sql, params, start })
    }
    recordQuery({
      requestId,
      sql,
      params,
      durationMs: performance.now() - start,
    })
    return result
  }

  if (typeof c.batch === 'function') {
    const originalBatch = c.batch.bind(c)
    c.batch = function inspectedBatch(stmts: unknown[], ...rest: unknown[]) {
      if (!isSqlInspectorEnabled()) {
        return originalBatch(stmts, ...rest)
      }
      const requestId = getCurrentRequestId()
      const start = performance.now()
      const items = Array.isArray(stmts)
        ? stmts.map((s) => extractExecute(s))
        : []
      const result = originalBatch(stmts, ...rest)
      if (result && typeof result.then === 'function') {
        return Promise.resolve(result).then(
          (value) => {
            for (const item of items) {
              recordQuery({
                requestId,
                sql: item.sql,
                params: item.params,
                durationMs: performance.now() - start,
              })
            }
            return value
          },
          (err: Error) => {
            for (const item of items) {
              recordQuery({
                requestId,
                sql: item.sql,
                params: item.params,
                durationMs: performance.now() - start,
                error: err?.message ?? String(err),
              })
            }
            throw err
          },
        )
      }
      for (const item of items) {
        recordQuery({
          requestId,
          sql: item.sql,
          params: item.params,
          durationMs: performance.now() - start,
        })
      }
      return result
    }
  }

  c[LIBSQL_INSPECTED] = true
  return client
}
