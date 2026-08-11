import { eq, sql } from 'drizzle-orm'
import { users } from '../../utils/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid id' })
  }

  const db = useDb()
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'user not found' })
  }

  // companion query for grouping demo
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)

  return { user, totalUsers: total }
})
