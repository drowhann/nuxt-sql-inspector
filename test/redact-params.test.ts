import { beforeEach, describe, expect, it, vi } from 'vitest'
import { redactParam, redactParams } from '../src/runtime/server/utils/redact-params'

describe('redactParam', () => {
  it('describes types without raw values', () => {
    expect(redactParam(null)).toEqual({ type: 'null' })
    expect(redactParam('secret')).toEqual({ type: 'string', length: 6 })
    expect(redactParam(42)).toEqual({ type: 'number' })
    expect(redactParam(true)).toEqual({ type: 'boolean' })
    expect(redactParam([1, 2])).toEqual({ type: 'array', length: 2 })
    expect(redactParam({ a: 1 })).toEqual({ type: 'object' })
    expect(redactParam(new Date('2020-01-01'))).toEqual({ type: 'date' })
    expect(redactParams(['ab', 1])).toEqual([
      { type: 'string', length: 2 },
      { type: 'number' },
    ])
  })
})

describe('recordQuery param sanitization', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('redacts by default', async () => {
    globalThis.__sqlInspectorRuntimeConfig = () => ({
      sqlInspector: {
        enabled: true,
        forceEnableInProduction: true,
        redactParams: true,
        maxRequests: 200,
        path: '/__sql_queries',
        apiBase: '/api/__sql_queries',
      },
    })
    const { clearStore, getSnapshot, recordQuery, startRequest } = await import(
      '../src/runtime/server/utils/store'
    )
    clearStore()
    startRequest({ id: 'r1', method: 'GET', path: '/api/x', startedAt: Date.now() })
    recordQuery({
      requestId: 'r1',
      sql: 'SELECT $1',
      params: ['password'],
      durationMs: 1,
    })
    expect(getSnapshot().requests[0]?.queries[0]?.params).toEqual([
      { type: 'string', length: 8 },
    ])
    clearStore()
  })

  it('keeps raw values when redactParams is false', async () => {
    globalThis.__sqlInspectorRuntimeConfig = () => ({
      sqlInspector: {
        enabled: true,
        forceEnableInProduction: true,
        redactParams: false,
        maxRequests: 200,
        path: '/__sql_queries',
        apiBase: '/api/__sql_queries',
      },
    })
    const { clearStore, getSnapshot, recordQuery, startRequest } = await import(
      '../src/runtime/server/utils/store'
    )
    clearStore()
    startRequest({ id: 'r2', method: 'GET', path: '/api/x', startedAt: Date.now() })
    recordQuery({
      requestId: 'r2',
      sql: 'SELECT $1',
      params: ['password'],
      durationMs: 1,
    })
    expect(getSnapshot().requests[0]?.queries[0]?.params).toEqual(['password'])
    clearStore()
  })
})
