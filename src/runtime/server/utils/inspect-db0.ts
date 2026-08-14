import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const DB0_INSPECTED = Symbol.for('sql-inspector.db0')

function isTemplateStringsArray(
  strings: unknown,
): strings is TemplateStringsArray {
  return Array.isArray(strings) && 'raw' in strings && Array.isArray((strings as any).raw)
}

/** Local copy of db0 sqlTemplate — `?` placeholders + `{${static}}` interpolation. */
function sqlTemplate(
  strings: TemplateStringsArray,
  values: unknown[],
): { sql: string; params: unknown[] } {
  const staticIndexes: number[] = []
  let result = strings[0] || ''
  for (let i = 1; i < strings.length; i++) {
    if (result.endsWith('{') && strings[i].startsWith('}')) {
      result = result.slice(0, -1) + String(values[i - 1]) + strings[i].slice(1)
      staticIndexes.push(i - 1)
      continue
    }
    result += `?${strings[i] ?? ''}`
  }
  const params = values.filter((_, i) => !staticIndexes.includes(i))
  return { sql: result.trim(), params }
}

function track(
  result: unknown,
  meta: { requestId: string | null; sql: string; params: unknown[]; start: number },
) {
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    return Promise.resolve(result).then(
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

  recordQuery({
    requestId: meta.requestId,
    sql: meta.sql,
    params: meta.params,
    durationMs: performance.now() - meta.start,
  })
  return result
}

function wrapStatement(stmt: any, sql: string) {
  if (!stmt || stmt[DB0_INSPECTED]) return stmt
  stmt[DB0_INSPECTED] = true

  for (const method of ['all', 'run', 'get'] as const) {
    if (typeof stmt[method] !== 'function') continue
    const original = stmt[method].bind(stmt)
    stmt[method] = function inspectedMethod(...args: unknown[]) {
      if (!isSqlInspectorEnabled()) return original(...args)
      const requestId = getCurrentRequestId()
      const start = performance.now()
      try {
        return track(original(...args), {
          requestId,
          sql,
          params: args,
          start,
        })
      }
      catch (err: any) {
        recordQuery({
          requestId,
          sql,
          params: args,
          durationMs: performance.now() - start,
          error: err?.message ?? String(err),
        })
        throw err
      }
    }
  }

  return stmt
}

/**
 * Wrap a db0 Database (`createDatabase` / Nitro `useDatabase()`):
 * tagged `.sql`, `.exec`, and `.prepare` statement `.all` / `.run` / `.get`.
 * Duck-typed — no db0 import. Do not also wrap the underlying better-sqlite3
 * instance (double-count).
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || c[DB0_INSPECTED]) return client
  if (typeof c.sql !== 'function' || typeof c.prepare !== 'function') return client

  const originalSql = c.sql.bind(c)
  c.sql = function inspectedSql(strings: TemplateStringsArray, ...values: unknown[]) {
    if (!isSqlInspectorEnabled()) return originalSql(strings, ...values)
    const requestId = getCurrentRequestId()
    const start = performance.now()
    const { sql, params } = isTemplateStringsArray(strings)
      ? sqlTemplate(strings, values)
      : { sql: String(strings), params: values }
    try {
      return track(originalSql(strings, ...values), { requestId, sql, params, start })
    }
    catch (err: any) {
      recordQuery({
        requestId,
        sql,
        params,
        durationMs: performance.now() - start,
        error: err?.message ?? String(err),
      })
      throw err
    }
  }

  if (typeof c.exec === 'function') {
    const originalExec = c.exec.bind(c)
    c.exec = function inspectedExec(sql: string, ...rest: unknown[]) {
      if (!isSqlInspectorEnabled()) return originalExec(sql, ...rest)
      const requestId = getCurrentRequestId()
      const start = performance.now()
      try {
        return track(originalExec(sql, ...rest), {
          requestId,
          sql: String(sql),
          params: [],
          start,
        })
      }
      catch (err: any) {
        recordQuery({
          requestId,
          sql: String(sql),
          params: [],
          durationMs: performance.now() - start,
          error: err?.message ?? String(err),
        })
        throw err
      }
    }
  }

  const originalPrepare = c.prepare.bind(c)
  c.prepare = function inspectedPrepare(sql: string, ...rest: unknown[]) {
    const stmt = originalPrepare(sql, ...rest)
    return wrapStatement(stmt, sql)
  }

  c[DB0_INSPECTED] = true
  return client
}
