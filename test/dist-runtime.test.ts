import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const distRuntime = join(import.meta.dirname, '../dist/runtime')

function readDist(rel: string) {
  return readFileSync(join(distRuntime, rel), 'utf8')
}

describe('published dist/runtime (no auto-imports)', () => {
  it('server API handlers import h3', () => {
    for (const file of [
      'server/api/clear.post.js',
      'server/api/snapshot.get.js',
      'server/api/stream.get.js',
    ]) {
      const src = readDist(file)
      expect(src, file).toContain('from "h3"')
      expect(src, file).toContain('defineEventHandler')
    }
  })

  it('server nitro utils import nitropack/runtime', () => {
    for (const file of [
      'server/utils/enabled.js',
      'server/utils/context.js',
      'server/plugin.js',
    ]) {
      const src = readDist(file)
      expect(src, file).toContain('from "nitropack/runtime"')
    }
  })

  it('app middleware imports nuxt/app and h3', () => {
    const src = readDist('app/middleware/sql-inspector-dev-only.js')
    expect(src).toContain('from "nuxt/app"')
    expect(src).toContain('from "h3"')
    expect(src).not.toContain('#imports')
  })

  it('inspector page imports vue/nuxt/app and avoids compile-time macros', () => {
    const src = readDist('app/pages/sql-queries.vue')
    expect(src).toContain('from "vue"')
    expect(src).toContain('from "nuxt/app"')
    expect(src).toContain('from "#components"')
    expect(src).toContain('NuxtLink')
    expect(src).not.toContain('definePageMeta')
  })
})
