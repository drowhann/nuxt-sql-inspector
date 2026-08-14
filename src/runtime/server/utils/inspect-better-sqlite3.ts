import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const SQLITE_INSPECTED = Symbol.for('sql-inspector.better-sqlite3')
const BOUND_PARAMS = Symbol.for('sql-inspector.bound-params')

function flattenParams(args: unknown[]): unknown[] {
  if (args.length === 0) return []
  if (args.length === 1) {
    const a = args[0]
    return Array.isArray(a) ? a : [a]
  }
  const out: unknown[] = []
  for (const a of args) {
    if (Array.isArray(a)) out.push(...a)
    else out.push(a)
  }
  return out
}

function paramsFor(stmt: any, args: unknown[]): unknown[] {
  if (args.length > 0) return flattenParams(args)
  const bound = stmt[BOUND_PARAMS]
  return Array.isArray(bound) ? bound : []
}

function recordSync(
  sql: string,
  params: unknown[],
  fn: () => unknown,
) {
  const requestId = getCurrentRequestId()
  const start = performance.now()
  try {
    const result = fn()
    recordQuery({
      requestId,
      sql,
      params,
      durationMs: performance.now() - start,
    })
    return result
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

function wrapStatement(stmt: any, sql: string) {
  if (!stmt || stmt[SQLITE_INSPECTED]) return stmt
  stmt[SQLITE_INSPECTED] = true

  if (typeof stmt.bind === 'function') {
    const originalBind = stmt.bind.bind(stmt)
    stmt.bind = function inspectedBind(...args: unknown[]) {
      stmt[BOUND_PARAMS] = flattenParams(args)
      const result = originalBind(...args)
      return result ?? stmt
    }
  }

  for (const method of ['run', 'get', 'all'] as const) {
    if (typeof stmt[method] !== 'function') continue
    const original = stmt[method].bind(stmt)
    stmt[method] = function inspectedMethod(...args: unknown[]) {
      if (!isSqlInspectorEnabled()) return original(...args)
      return recordSync(sql, paramsFor(stmt, args), () => original(...args))
    }
  }

  if (typeof stmt.iterate === 'function') {
    const originalIterate = stmt.iterate.bind(stmt)
    stmt.iterate = function inspectedIterate(...args: unknown[]) {
      if (!isSqlInspectorEnabled()) return originalIterate(...args)
      return recordSync(sql, paramsFor(stmt, args), () => originalIterate(...args))
    }
  }

  return stmt
}

/**
 * Wrap a better-sqlite3 Database `.prepare` / `.exec` / `.pragma`
 * and Statement `.run` / `.get` / `.all` / `.iterate`.
 * Does not wrap `.transaction()` (inner statements record).
 */
export function inspectSql<T>(client: T): T {
  if (!isSqlInspectorEnabled()) return client

  const c = client as any
  if (!c || c[SQLITE_INSPECTED]) return client
  if (
    typeof c.prepare !== 'function'
    && typeof c.exec !== 'function'
    && typeof c.pragma !== 'function'
  ) {
    return client
  }

  if (typeof c.prepare === 'function') {
    const originalPrepare = c.prepare.bind(c)
    c.prepare = function inspectedPrepare(sql: string, ...rest: unknown[]) {
      const stmt = originalPrepare(sql, ...rest)
      return wrapStatement(stmt, sql)
    }
  }

  if (typeof c.exec === 'function') {
    const originalExec = c.exec.bind(c)
    c.exec = function inspectedExec(sql: string, ...rest: unknown[]) {
      if (!isSqlInspectorEnabled()) return originalExec(sql, ...rest)
      return recordSync(String(sql), [], () => originalExec(sql, ...rest))
    }
  }

  if (typeof c.pragma === 'function') {
    const originalPragma = c.pragma.bind(c)
    c.pragma = function inspectedPragma(source: string, ...rest: unknown[]) {
      if (!isSqlInspectorEnabled()) return originalPragma(source, ...rest)
      return recordSync(String(source), [], () => originalPragma(source, ...rest))
    }
  }

  c[SQLITE_INSPECTED] = true
  return client
}
