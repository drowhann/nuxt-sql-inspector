import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleBetterSqlite3 } from 'drizzle-orm/better-sqlite3'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import { createDatabase } from 'db0'
import sqliteConnector from 'db0/connectors/better-sqlite3'
import Database from 'better-sqlite3'
import mysql from 'mysql2/promise'
import { Client, Pool } from 'pg'
import postgres from 'postgres'
import { inspectSql as inspectPg } from 'nuxt-sql-inspector/node-postgres'
import { inspectSql as inspectPostgresJs } from 'nuxt-sql-inspector/postgres-js'
import { inspectSql as inspectMysql2 } from 'nuxt-sql-inspector/mysql2'
import { inspectSql as inspectLibsql } from 'nuxt-sql-inspector/libsql'
import { inspectSql as inspectBetterSqlite3 } from 'nuxt-sql-inspector/better-sqlite3'
import { inspectSql as inspectDb0 } from 'nuxt-sql-inspector/db0'
import * as schema from './schema'

export type DbDialect = 'pg' | 'mysql' | 'sqlite'

function databaseUrl() {
  return useRuntimeConfig().databaseUrl as string
}

function mysqlUrl() {
  const url = useRuntimeConfig().mysqlDatabaseUrl as string | undefined
  if (!url) throw new Error('MYSQL_DATABASE_URL is not set')
  return url
}

function sqliteFile(fileName: string) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../.data')
  mkdirSync(dir, { recursive: true })
  return join(dir, fileName)
}

function libsqlUrl(fileName = 'playground.db') {
  const configured = useRuntimeConfig().libsqlUrl as string | undefined
  if (configured) return configured
  return `file:${sqliteFile(fileName)}`
}

function nFromRows(rows: unknown): number {
  const r = rows as any
  const row = r?.rows?.[0] ?? (Array.isArray(r?.[0]) ? r[0][0] : r?.[0])
  return Number(row?.n ?? 1)
}

async function runPgProbe(db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }) {
  return nFromRows(await db.execute(sql`select 1::int as n`))
}

async function runMysqlProbe(db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }) {
  return nFromRows(await db.execute(sql`select 1 as n`))
}

async function runSqliteProbe(db: { get: (q: ReturnType<typeof sql>) => unknown }) {
  return nFromRows(await db.get(sql`select 1 as n`))
}

async function runDb0Probe(db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<unknown> }) {
  return nFromRows(await db.sql`select 1 as n`)
}

// ponytail: drizzle Pool/Client overloads don't share one ReturnType
type PgDb = NodePgDatabase<typeof schema> & { $client: Pool | Client }
type PostgresJsDb = ReturnType<typeof drizzlePostgresJs<typeof schema>>

// --- node-postgres ----------------------------------------------------------

let pgPool: Pool | null = null
let dbPgPool: PgDb | null = null

/** `new Pool` → inspectSql → `drizzle({ client })` */
export function useDbPgPool() {
  if (!dbPgPool) {
    pgPool = inspectPg(
      new Pool({ connectionString: databaseUrl() }),
    )
    dbPgPool = drizzlePg({ client: pgPool, schema })
  }
  return dbPgPool!
}

let pgClient: Client | null = null
let pgClientReady: Promise<Client> | null = null
let dbPgClient: PgDb | null = null

/** `new Client` → connect → inspectSql → `drizzle({ client })` */
export async function useDbPgClient() {
  if (!dbPgClient) {
    if (!pgClientReady) {
      pgClientReady = (async () => {
        const client = new Client({ connectionString: databaseUrl() })
        await client.connect()
        pgClient = inspectPg(client)
        return pgClient
      })()
    }
    const client = await pgClientReady
    dbPgClient = drizzlePg({ client, schema })
  }
  return dbPgClient!
}

let dbPgUrl: PgDb | null = null

/** `drizzle(url)` then `inspectSql(db.$client)` */
export function useDbPgUrl() {
  if (!dbPgUrl) {
    dbPgUrl = drizzlePg(databaseUrl(), { schema })
    inspectPg(dbPgUrl.$client)
  }
  return dbPgUrl!
}

let dbPgConnection: PgDb | null = null

/** `drizzle({ connection })` then `inspectSql(db.$client)` */
export function useDbPgConnection() {
  if (!dbPgConnection) {
    dbPgConnection = drizzlePg({
      connection: { connectionString: databaseUrl() },
      schema,
    })
    inspectPg(dbPgConnection.$client)
  }
  return dbPgConnection!
}

// --- postgres.js ------------------------------------------------------------

let postgresJsSql: ReturnType<typeof postgres> | null = null
let dbPostgresJs: PostgresJsDb | null = null

/** `postgres(url)` → inspectSql → `drizzle({ client })` */
export function useDbPostgresJs() {
  if (!dbPostgresJs) {
    postgresJsSql = inspectPostgresJs(
      postgres(databaseUrl(), { max: 1 }),
    )
    dbPostgresJs = drizzlePostgresJs({ client: postgresJsSql, schema })
  }
  return dbPostgresJs!
}

let dbPostgresJsUrl: PostgresJsDb | null = null

/** `drizzle(url)` (postgres-js) then `inspectSql(db.$client)` */
export function useDbPostgresJsUrl() {
  if (!dbPostgresJsUrl) {
    dbPostgresJsUrl = drizzlePostgresJs(databaseUrl(), { schema })
    inspectPostgresJs(dbPostgresJsUrl.$client)
  }
  return dbPostgresJsUrl!
}

let dbPostgresJsConnection: PostgresJsDb | null = null

/** `drizzle({ connection })` (postgres-js) then `inspectSql(db.$client)` */
export function useDbPostgresJsConnection() {
  if (!dbPostgresJsConnection) {
    dbPostgresJsConnection = drizzlePostgresJs({
      connection: { url: databaseUrl() },
      schema,
    })
    inspectPostgresJs(dbPostgresJsConnection.$client)
  }
  return dbPostgresJsConnection!
}

// --- mysql2 -----------------------------------------------------------------

let mysqlPool: mysql.Pool | null = null
let dbMysqlPool: ReturnType<typeof drizzleMysql<Record<string, never>, mysql.Pool>> | null = null

function useMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = inspectMysql2(mysql.createPool({ uri: mysqlUrl() }))
  }
  return mysqlPool
}

/** `createPool` → inspectSql → `drizzle({ client })` */
export function useDbMysqlPool() {
  if (!dbMysqlPool) {
    dbMysqlPool = drizzleMysql({ client: useMysqlPool() })
  }
  return dbMysqlPool!
}

let mysqlConnReady: Promise<mysql.Connection> | null = null
let dbMysqlConn: ReturnType<typeof drizzleMysql<Record<string, never>, mysql.Connection>> | null = null

/** `createConnection` → inspectSql → `drizzle({ client })` */
export async function useDbMysqlConnection() {
  if (!dbMysqlConn) {
    if (!mysqlConnReady) {
      mysqlConnReady = (async () => {
        const conn = await mysql.createConnection({ uri: mysqlUrl() })
        return inspectMysql2(conn)
      })()
    }
    dbMysqlConn = drizzleMysql({ client: await mysqlConnReady })
  }
  return dbMysqlConn!
}

async function runMysqlCheckout() {
  const conn = await useMysqlPool().getConnection()
  try {
    const [rows] = await conn.execute('SELECT 1 AS n')
    return nFromRows(rows)
  }
  finally {
    conn.release()
  }
}

// --- libsql -----------------------------------------------------------------

let libsqlClient: ReturnType<typeof createClient> | null = null
let dbLibsql: ReturnType<typeof drizzleLibsql> | null = null

function useLibsqlClient() {
  if (!libsqlClient) {
    libsqlClient = inspectLibsql(createClient({ url: libsqlUrl() }))
  }
  return libsqlClient
}

/** `createClient` → inspectSql → `drizzle({ client })` */
export function useDbLibsql() {
  if (!dbLibsql) {
    dbLibsql = drizzleLibsql({ client: useLibsqlClient() })
  }
  return dbLibsql
}

let dbLibsqlUrl: ReturnType<typeof drizzleLibsql> | null = null

/** `drizzle(url)` then `inspectSql(db.$client)` */
export function useDbLibsqlUrl() {
  if (!dbLibsqlUrl) {
    dbLibsqlUrl = drizzleLibsql(libsqlUrl('playground-drizzle.db'))
    inspectLibsql(dbLibsqlUrl.$client)
  }
  return dbLibsqlUrl
}

async function runLibsqlBatch() {
  await useLibsqlClient().batch(['SELECT 1 AS n', 'SELECT 1 AS n'])
  return 1
}

// --- better-sqlite3 ---------------------------------------------------------

let betterSqlite: Database.Database | null = null
let dbBetterSqlite: ReturnType<typeof drizzleBetterSqlite3> | null = null

function useBetterSqlite() {
  if (!betterSqlite) {
    betterSqlite = inspectBetterSqlite3(new Database(sqliteFile('playground-better-sqlite3.sqlite3')))
  }
  return betterSqlite!
}

/** `new Database` → inspectSql → `drizzle({ client })` */
export function useDbBetterSqlite3() {
  if (!dbBetterSqlite) {
    dbBetterSqlite = drizzleBetterSqlite3({ client: useBetterSqlite() })
  }
  return dbBetterSqlite!
}

let dbBetterSqliteUrl: ReturnType<typeof drizzleBetterSqlite3> | null = null

/** `drizzle(path)` then `inspectSql(db.$client)` */
export function useDbBetterSqlite3Path() {
  if (!dbBetterSqliteUrl) {
    dbBetterSqliteUrl = drizzleBetterSqlite3(sqliteFile('playground-better-sqlite3-drizzle.sqlite3'))
    inspectBetterSqlite3(dbBetterSqliteUrl.$client)
  }
  return dbBetterSqliteUrl!
}

// --- db0 --------------------------------------------------------------------

let db0Db: ReturnType<typeof createDatabase> | null = null

/** `createDatabase` (better-sqlite3 connector) → inspectSql */
export function useDb0() {
  if (!db0Db) {
    db0Db = inspectDb0(createDatabase(sqliteConnector({
      path: sqliteFile('playground-db0.sqlite3'),
    })))
  }
  return db0Db!
}

/** Default demo DB (node-postgres Pool). Used by /api/users. */
export function useDb() {
  return useDbPgPool()
}

export const dbExamples = [
  { id: 'pg-pool', label: 'node-postgres Pool + drizzle({ client })', dialect: 'pg' as const, run: async () => runPgProbe(useDbPgPool()) },
  { id: 'pg-client', label: 'node-postgres Client + drizzle({ client })', dialect: 'pg' as const, run: async () => runPgProbe(await useDbPgClient()) },
  { id: 'pg-url', label: 'node-postgres drizzle(url) + db.$client', dialect: 'pg' as const, run: async () => runPgProbe(useDbPgUrl()) },
  { id: 'pg-connection', label: 'node-postgres drizzle({ connection }) + db.$client', dialect: 'pg' as const, run: async () => runPgProbe(useDbPgConnection()) },
  { id: 'postgresjs-client', label: 'postgres.js client + drizzle({ client })', dialect: 'pg' as const, run: async () => runPgProbe(useDbPostgresJs()) },
  { id: 'postgresjs-url', label: 'postgres.js drizzle(url) + db.$client', dialect: 'pg' as const, run: async () => runPgProbe(useDbPostgresJsUrl()) },
  { id: 'postgresjs-connection', label: 'postgres.js drizzle({ connection }) + db.$client', dialect: 'pg' as const, run: async () => runPgProbe(useDbPostgresJsConnection()) },
  { id: 'mysql-pool', label: 'mysql2 Pool + drizzle({ client })', dialect: 'mysql' as const, run: async () => runMysqlProbe(useDbMysqlPool()) },
  { id: 'mysql-connection', label: 'mysql2 Connection + drizzle({ client })', dialect: 'mysql' as const, run: async () => runMysqlProbe(await useDbMysqlConnection()) },
  { id: 'mysql-checkout', label: 'mysql2 pool.getConnection()', dialect: 'mysql' as const, run: () => runMysqlCheckout() },
  { id: 'libsql-client', label: 'libsql createClient + drizzle({ client })', dialect: 'sqlite' as const, run: async () => runSqliteProbe(useDbLibsql()) },
  { id: 'libsql-url', label: 'libsql drizzle(url) + db.$client', dialect: 'sqlite' as const, run: async () => runSqliteProbe(useDbLibsqlUrl()) },
  { id: 'libsql-batch', label: 'libsql client.batch()', dialect: 'sqlite' as const, run: () => runLibsqlBatch() },
  { id: 'better-sqlite3-client', label: 'better-sqlite3 Database + drizzle({ client })', dialect: 'sqlite' as const, run: async () => runSqliteProbe(useDbBetterSqlite3()) },
  { id: 'better-sqlite3-path', label: 'better-sqlite3 drizzle(path) + db.$client', dialect: 'sqlite' as const, run: async () => runSqliteProbe(useDbBetterSqlite3Path()) },
  { id: 'db0', label: 'db0 createDatabase + sql tagged', dialect: 'sqlite' as const, run: async () => runDb0Probe(useDb0()) },
] as const
