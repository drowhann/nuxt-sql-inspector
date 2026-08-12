import { sql } from 'drizzle-orm'
import { dbExamples } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const example = dbExamples.find((e) => e.id === id)
  if (!example) {
    throw createError({
      statusCode: 404,
      statusMessage: `Unknown db example: ${id}. Try: ${dbExamples.map((e) => e.id).join(', ')}`,
    })
  }

  const db = await example.use()
  const rows = await db.execute(sql`select 1::int as n`)
  const n = Number((rows as any)?.rows?.[0]?.n ?? (rows as any)?.[0]?.n ?? 1)

  return {
    id: example.id,
    label: example.label,
    ok: true,
    n,
    hint: 'Check /__sql_queries for this request’s SQL.',
  }
})
