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
    dialect: string
    ok: boolean
    n?: number
    error?: string
  }> = []

  for (const example of dbExamples) {
    try {
      const n = await example.run()
      results.push({
        id: example.id,
        label: example.label,
        dialect: example.dialect,
        ok: true,
        n,
      })
    }
    catch (err: any) {
      results.push({
        id: example.id,
        label: example.label,
        dialect: example.dialect,
        ok: false,
        error: err?.message ?? String(err),
      })
    }
  }

  return {
    hint: 'Open /__sql_queries — you should see one monitored request with several SQL queries (or hit each /api/db-examples/:id separately for clearer grouping).',
    results,
    allOk: results.every(r => r.ok),
  }
})
