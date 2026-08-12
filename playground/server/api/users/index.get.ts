import { sql } from 'drizzle-orm'
import { users } from '../../utils/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db.select().from(users).orderBy(users.id)
  // second query on purpose so the inspector shows multi-query grouping
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
  return { users: rows, count }
})
