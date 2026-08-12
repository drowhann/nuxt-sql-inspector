import { sql } from 'drizzle-orm'
import { dbExamples } from '../../utils/db'

/**
 * Runs a trivial query through every useDb* configuration.
 * Check /__sql_queries afterward — each request path should show SQL.
 *
 * Also available per-config: GET /api/db-examples/:id
 */
export default defineEventHandler(async () => {
  const results: Array<{
    id: string
    label: string
    ok: boolean
    n?: number
    error?: string
  }> = []

  for (const example of dbExamples) {
    try {
      const db = await example.use()
      const rows = await db.execute(sql`select 1::int as n`)
      const n = Number((rows as any)?.rows?.[0]?.n ?? (rows as any)?.[0]?.n ?? 1)
      results.push({ id: example.id, label: example.label, ok: true, n })
    } catch (err: any) {
      results.push({
        id: example.id,
        label: example.label,
        ok: false,
        error: err?.message ?? String(err),
      })
    }
  }

  return {
    hint: 'Open /__sql_queries — you should see one monitored request with several SQL queries (or hit each /api/db-examples/:id separately for clearer grouping).',
    results,
    allOk: results.every((r) => r.ok),
  }
})
