import { eq, sql } from 'drizzle-orm'
import { users } from '../../utils/schema'
import { useDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const kind = getRouterParam(event, 'kind')
  const db = useDb()

  if (kind === 'n-plus-one') {
    const rows = []
    for (const id of [1, 2, 3, 4]) {
      rows.push(await db.select().from(users).where(eq(users.id, id)))
    }
    return { kind, hint: 'Same SELECT ×4 — look for ×4', rows }
  }

  if (kind === 'parallel') {
    await Promise.all([
      db.execute(sql`select pg_sleep(0.08)`),
      db.execute(sql`select pg_sleep(0.08)`),
    ])
    return { kind, hint: 'Overlapping waterfall bars; both ≥50ms (amber)' }
  }

  if (kind === 'sequential') {
    await db.execute(sql`select pg_sleep(0.08)`)
    await db.execute(sql`select pg_sleep(0.08)`)
    return { kind, hint: 'Stepped waterfall — second bar starts after the first' }
  }

  if (kind === 'slow') {
    await db.execute(sql`select pg_sleep(0.12)`)
    await db.execute(sql`select pg_sleep(0.12)`)
    return { kind, hint: 'SQL total ≥200ms — request SQL column is amber' }
  }

  throw createError({
    statusCode: 404,
    statusMessage: `Unknown demo: ${kind}. Try n-plus-one, parallel, sequential, slow`,
  })
})
