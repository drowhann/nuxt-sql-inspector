import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

type Snapshot = {
  requests: {
    id: string
    path: string
    queries: { requestId: string | null; sql: string }[]
  }[]
  backgroundQueries: { sql: string }[]
}

describe('module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('serves inspector snapshot when enabled', async () => {
    const data = await $fetch<Snapshot>('/api/__sql_queries')
    expect(Array.isArray(data.requests)).toBe(true)
    expect(Array.isArray(data.backgroundQueries)).toBe(true)
  })

  it('records SQL on the request that issued it', async () => {
    await $fetch('/api/__sql_queries/clear', { method: 'POST' })
    await $fetch('/api/ping')

    const data = await $fetch<Snapshot>('/api/__sql_queries')
    const req = data.requests.find((r) => r.path === '/api/ping')
    expect(req).toBeTruthy()
    expect(req!.queries.length).toBeGreaterThanOrEqual(1)
    expect(req!.queries[0]?.sql).toContain('SELECT 1')
    expect(req!.queries.every((q) => q.requestId === req!.id)).toBe(true)
    expect(data.backgroundQueries.some((q) => q.sql.includes('SELECT 1'))).toBe(false)
  })

  it('serves inspector UI', async () => {
    const html = await $fetch<string>('/__sql_queries')
    expect(html).toContain('html')
  })

  it('does not record page document requests', async () => {
    await $fetch('/')
    const data = await $fetch<Snapshot>('/api/__sql_queries')
    expect(data.requests.some((r) => r.path === '/')).toBe(false)
  })
})
