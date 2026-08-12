import { sql } from 'drizzle-orm'
import { users } from '../utils/schema'
import { useDb } from '../utils/db'

/** Non-/api server route demo: GET /server-demo */
export default defineEventHandler(async () => {
  const db = useDb()
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
  return { ok: true, count }
})
