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
})
