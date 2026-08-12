import pg from 'pg'
import type { QueryResult, QueryResultRow } from 'pg'
import { getCurrentRequestId } from './context'
import { isSqlInspectorEnabled } from './enabled'
import { recordQuery } from './store'

const PG_INSTRUMENTED = Symbol.for('sql-inspector.client-query')
const PGJS_INSTRUMENTED = Symbol.for('sql-inspector.postgresjs')

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

  // Side-effect observers — keep the original thenable/API surface intact
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

/**
 * Patch `pg.Client.prototype.query` once so Pool.query and transactions are covered.
 */
export function instrumentPg() {
  if (!isSqlInspectorEnabled()) return

  const proto = pg.Client.prototype as typeof pg.Client.prototype & {
    [PG_INSTRUMENTED]?: boolean
  }
  if (proto[PG_INSTRUMENTED]) return

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

  proto[PG_INSTRUMENTED] = true
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
 * In-place wrap for postgres.js (and nested transaction clients).
 * Drizzle postgres-js uses `client.unsafe(query, params)`.
 */
export function instrumentPostgresJs<T>(sql: T): T {
  if (!isSqlInspectorEnabled()) return sql
  if (!isPostgresJsClient(sql)) return sql

  const client = sql as any
  if (client[PGJS_INSTRUMENTED]) return sql

  const originalUnsafe = client.unsafe.bind(client)
  client.unsafe = function instrumentedUnsafe(query: string, params?: unknown[], opts?: unknown) {
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
    client.begin = function instrumentedBegin(...args: any[]) {
      const fnIndex = typeof args[0] === 'function' ? 0 : 1
      const userFn = args[fnIndex]
      if (typeof userFn !== 'function') {
        return originalBegin(...args)
      }
      const wrappedArgs = args.slice()
      wrappedArgs[fnIndex] = async (tx: unknown) => {
        const wrappedTx = instrumentPostgresJs(tx)
        return userFn(wrappedTx)
      }
      return originalBegin(...wrappedArgs)
    }
  }

  client[PGJS_INSTRUMENTED] = true

  // Proxy so tagged-template calls (`sql`...``) are also timed when the
  // returned value is what the app uses. In-place .unsafe still covers
  // refs already held by Drizzle.
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
      if (prop === PGJS_INSTRUMENTED) return true
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as T
}

/**
 * Public consumer API. Wrap your driver client once when creating it.
 *
 * Supports:
 * - node-postgres `Pool` / `Client` (and anything using them, including Drizzle)
 * - postgres.js `sql` clients (Drizzle uses `.unsafe`)
 *
 * @example
 * ```ts
 * // node-postgres
 * const pool = instrumentSqlInspector(new Pool({ connectionString }))
 * const db = drizzle({ client: pool })
 *
 * // postgres.js
 * const sql = instrumentSqlInspector(postgres(process.env.DATABASE_URL!))
 * const db = drizzle({ client: sql })
 *
 * // drizzle created the client
 * const db = drizzle(process.env.DATABASE_URL!)
 * instrumentSqlInspector(db.$client)
 * ```
 */
export function instrumentSqlInspector<T = void>(client?: T): T {
  if (!isSqlInspectorEnabled()) {
    return client as T
  }

  if (client !== undefined && client !== null && isPostgresJsClient(client)) {
    return instrumentPostgresJs(client)
  }

  // node-postgres Pool / Client / db.$client from drizzle-orm/node-postgres
  instrumentPg()
  return client as T
}
