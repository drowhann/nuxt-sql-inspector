import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { instrumentSqlInspector } from '#sql-inspector'
import * as schema from './schema'

let pool: Pool | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getPool() {
  if (!pool) {
    const config = useRuntimeConfig()
    pool = instrumentSqlInspector(
      new Pool({
        connectionString: config.databaseUrl,
      }),
    )
  }
  return pool
}

export function useDb() {
  if (!db) {
    db = drizzle(getPool(), { schema })
  }
  return db
}
