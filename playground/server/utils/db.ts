import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js'
import { Client, Pool } from 'pg'
import postgres from 'postgres'
import { inspectSql as inspectPg } from 'nuxt-sql-inspector/node-postgres'
import { inspectSql as inspectPostgresJs } from 'nuxt-sql-inspector/postgres-js'
import * as schema from './schema'

function databaseUrl() {
  return useRuntimeConfig().databaseUrl as string
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

/** Default demo DB (node-postgres Pool). Used by /api/users. */
export function useDb() {
  return useDbPgPool()
}

export const dbExamples = [
  { id: 'pg-pool', label: 'node-postgres Pool + drizzle({ client })', use: async () => useDbPgPool() },
  { id: 'pg-client', label: 'node-postgres Client + drizzle({ client })', use: () => useDbPgClient() },
  { id: 'pg-url', label: 'node-postgres drizzle(url) + db.$client', use: async () => useDbPgUrl() },
  { id: 'pg-connection', label: 'node-postgres drizzle({ connection }) + db.$client', use: async () => useDbPgConnection() },
  { id: 'postgresjs-client', label: 'postgres.js client + drizzle({ client })', use: async () => useDbPostgresJs() },
  { id: 'postgresjs-url', label: 'postgres.js drizzle(url) + db.$client', use: async () => useDbPostgresJsUrl() },
  { id: 'postgresjs-connection', label: 'postgres.js drizzle({ connection }) + db.$client', use: async () => useDbPostgresJsConnection() },
] as const
