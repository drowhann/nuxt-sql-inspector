import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('serves inspector snapshot when enabled', async () => {
    const data = await $fetch('/api/__sql_queries')
    expect(data).toMatchObject({
      requests: [],
      backgroundQueries: [],
    })
  })

  it('does not record page document requests', async () => {
    await $fetch('/')
    const data = await $fetch<{
      requests: { path: string }[]
    }>('/api/__sql_queries')
    expect(data.requests.some((r) => r.path === '/')).toBe(false)
  })
})
