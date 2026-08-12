import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const PGJS_INSPECTED = Symbol.for('sql-inspector.postgresjs')

function extractTaggedTemplate(args: unknown[]): { sql: string; params: unknown[] } {
  const strings = args[0] as TemplateStringsArray | undefined
  if (!strings || !Array.isArray(strings)) {
    return { sql: '(postgres.js query)', params: [] }
  }
  const params = args.slice(1)
  let sql = ''
  for (let i = 0; i < strings.length; i++) {
    sql += strings[i]
    if (i < params.length) sql += `$${i + 1}`
  }
  return { sql, params }
}

function trackThenable(
  result: any,
  meta: { sql: string; params: unknown[]; requestId: string | null; start: number },
) {
  if (!result || typeof result.then !== 'function') {
    recordQuery({
      requestId: meta.requestId,
      sql: meta.sql,
      params: meta.params,
      durationMs: performance.now() - meta.start,
    })
    return result
  }

  Promise.resolve(result).then(
    () => {
      recordQuery({
        requestId: meta.requestId,
        sql: meta.sql,
        params: meta.params,
        durationMs: performance.now() - meta.start,
      })
    },
    (err: Error) => {
      recordQuery({
        requestId: meta.requestId,
        sql: meta.sql,
        params: meta.params,
        durationMs: performance.now() - meta.start,
        error: err?.message ?? String(err),
      })
    },
  )
  return result
}

function isPostgresJsClient(client: unknown): client is ((...args: any[]) => any) & {
  unsafe: (...args: any[]) => any
  begin?: (...args: any[]) => any
} {
  return (
    typeof client === 'function'
    && typeof (client as any).unsafe === 'function'
  )
}

/**
 * Wrap a postgres.js client so queries appear in the inspector.
 * Drizzle postgres-js uses `client.unsafe(query, params)`.
 */
export function inspectSql<T>(sql: T): T {
  if (!isSqlInspectorEnabled()) return sql
  if (!isPostgresJsClient(sql)) return sql

  const client = sql as any
  if (client[PGJS_INSPECTED]) return sql

  const originalUnsafe = client.unsafe.bind(client)
  client.unsafe = function inspectedUnsafe(query: string, params?: unknown[], opts?: unknown) {
    if (!isSqlInspectorEnabled()) {
      return originalUnsafe(query, params, opts)
    }
    const requestId = getCurrentRequestId()
    const start = performance.now()
    const result = originalUnsafe(query, params, opts)
    return trackThenable(result, {
      sql: query,
      params: Array.isArray(params) ? params : [],
      requestId,
      start,
    })
  }

  if (typeof client.begin === 'function') {
    const originalBegin = client.begin.bind(client)
    client.begin = function inspectedBegin(...args: any[]) {
      const fnIndex = typeof args[0] === 'function' ? 0 : 1
      const userFn = args[fnIndex]
      if (typeof userFn !== 'function') {
        return originalBegin(...args)
      }
      const wrappedArgs = args.slice()
      wrappedArgs[fnIndex] = async (tx: unknown) => {
        const wrappedTx = inspectSql(tx)
        return userFn(wrappedTx)
      }
      return originalBegin(...wrappedArgs)
    }
  }

  client[PGJS_INSPECTED] = true

  return new Proxy(client, {
    apply(target, thisArg, argArray) {
      if (!isSqlInspectorEnabled()) {
        return Reflect.apply(target, thisArg, argArray)
      }
      const { sql: text, params } = extractTaggedTemplate(argArray)
      const requestId = getCurrentRequestId()
      const start = performance.now()
      const result = Reflect.apply(target, thisArg, argArray)
      return trackThenable(result, { sql: text, params, requestId, start })
    },
    get(target, prop, receiver) {
      if (prop === PGJS_INSPECTED) return true
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as T
}
