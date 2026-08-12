import { describe, expect, it } from 'vitest'
import { matchPath, shouldMonitor } from '../src/runtime/server/utils/should-monitor'

const base = {
  apiBase: '/api/__sql_queries',
  uiPath: '/__sql_queries',
}

describe('matchPath', () => {
  it('matches * and ** globs', () => {
    expect(matchPath('/api/users', '/api/*')).toBe(true)
    expect(matchPath('/api/users/1', '/api/*')).toBe(false)
    expect(matchPath('/api/users/1', '/api/**')).toBe(true)
    expect(matchPath('/server-demo', '/server-demo')).toBe(true)
  })
})

describe('shouldMonitor', () => {
  it('defaults to allowing app routes', () => {
    expect(shouldMonitor('/api/users', base)).toBe(true)
    expect(shouldMonitor('/server-demo', base)).toBe(true)
    expect(shouldMonitor('/ssr-demo', base)).toBe(true)
  })

  it('skips inspector, framework, and static paths', () => {
    expect(shouldMonitor(base.apiBase, base)).toBe(false)
    expect(shouldMonitor(`${base.apiBase}/stream`, base)).toBe(false)
    expect(shouldMonitor(base.uiPath, base)).toBe(false)
    expect(shouldMonitor('/_nuxt/entry.js', base)).toBe(false)
    expect(shouldMonitor('/favicon.ico', base)).toBe(false)
  })

  it('honors include (allowlist)', () => {
    const rules = { ...base, include: ['/api/**', '/server-demo'] }
    expect(shouldMonitor('/api/users', rules)).toBe(true)
    expect(shouldMonitor('/server-demo', rules)).toBe(true)
    expect(shouldMonitor('/ssr-demo', rules)).toBe(false)
    expect(shouldMonitor('/other', rules)).toBe(false)
  })

  it('honors exclude on top of defaults', () => {
    const rules = { ...base, exclude: ['/api/webhooks/**'] }
    expect(shouldMonitor('/api/users', rules)).toBe(true)
    expect(shouldMonitor('/api/webhooks/stripe', rules)).toBe(false)
  })

  it('applies exclude even when path matches include', () => {
    const rules = {
      ...base,
      include: ['/api/**'],
      exclude: ['/api/webhooks/**'],
    }
    expect(shouldMonitor('/api/users', rules)).toBe(true)
    expect(shouldMonitor('/api/webhooks/x', rules)).toBe(false)
  })
})
