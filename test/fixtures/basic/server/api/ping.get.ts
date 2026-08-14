import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const db = inspectSql({
  async query(sql: string) {
    return { rows: [{ ok: 1 }], sql }
  },
})

export default defineEventHandler(async () => {
  await db.query('SELECT 1')
  return { ok: true }
})
