import { sql } from 'drizzle-orm'
import { users } from '../utils/schema'
import { useDb } from '../utils/db'

/** Non-/api server route demo: GET /server-demo */
export default defineEventHandler(async () => {
  const db = useDb()
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
  return { ok: true, count: countRows[0]?.count ?? 0 }
})
