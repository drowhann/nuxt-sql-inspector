import { describe, expect, it } from 'vitest'
import { shouldMonitor } from '../src/runtime/server/utils/should-monitor'

const apiBase = '/api/__sql_queries'
const uiPath = '/__sql_queries'

describe('shouldMonitor', () => {
  it('allows api and custom server routes', () => {
    expect(shouldMonitor('/api/users', apiBase, uiPath)).toBe(true)
    expect(shouldMonitor('/server-demo', apiBase, uiPath)).toBe(true)
    expect(shouldMonitor('/ssr-demo', apiBase, uiPath)).toBe(true)
  })

  it('skips inspector, framework, and static paths', () => {
    expect(shouldMonitor(apiBase, apiBase, uiPath)).toBe(false)
    expect(shouldMonitor(`${apiBase}/stream`, apiBase, uiPath)).toBe(false)
    expect(shouldMonitor(uiPath, apiBase, uiPath)).toBe(false)
    expect(shouldMonitor('/_nuxt/entry.js', apiBase, uiPath)).toBe(false)
    expect(shouldMonitor('/favicon.ico', apiBase, uiPath)).toBe(false)
  })
})
