import { beforeAll, describe, expect, it } from 'vitest'

globalThis.__sqlInspectorRuntimeConfig = () => ({
  sqlInspector: {
    maxRequests: 200,
    enabled: true,
    forceEnableInProduction: true,
    path: '/__sql_queries',
    apiBase: '/api/__sql_queries',
  },
})

const {
  clearStore,
  getSnapshot,
  recordQuery,
  startRequest,
  trackRequest,
  finishRequest,
} = await import('../src/runtime/server/utils/store')
const {
  ABSOLUTE_MAX_REQUESTS,
  clampMaxRequests,
  DEFAULT_MAX_REQUESTS,
  resolveSqlInspectorEnabled,
} = await import('../src/runtime/server/utils/config')

describe('inspector store', () => {
  beforeAll(() => {
    clearStore()
  })

  it('evicts oldest requests past maxRequests and associates SQL', () => {
    clearStore()
    for (let i = 0; i < 205; i++) {
      startRequest({
        id: `r-${i}`,
        method: 'GET',
        path: `/api/t/${i}`,
        startedAt: Date.now(),
      })
    }
    const snap = getSnapshot()
    expect(snap.requests).toHaveLength(200)
    expect(snap.requests.some((r) => r.id === 'r-0')).toBe(false)
    expect(snap.requests.some((r) => r.id === 'r-204')).toBe(true)

    recordQuery({
      requestId: 'r-204',
      sql: 'SELECT 1',
      params: [],
      durationMs: 1,
    })
    const newest = getSnapshot().requests.find((r) => r.id === 'r-204')
    expect(newest?.queries).toHaveLength(1)
    expect(newest?.queries[0]?.requestId).toBe('r-204')
    clearStore()
  })

  it('only lists a tracked request after the first SQL query', () => {
    clearStore()
    trackRequest({
      id: 'pending-1',
      method: 'GET',
      path: '/ssr-demo',
      startedAt: Date.now(),
    })
    expect(getSnapshot().requests).toHaveLength(0)

    finishRequest({ id: 'pending-1', statusCode: 200, durationMs: 1 })
    expect(getSnapshot().requests).toHaveLength(0)

    trackRequest({
      id: 'pending-2',
      method: 'GET',
      path: '/server-demo',
      startedAt: Date.now(),
    })
    recordQuery({
      requestId: 'pending-2',
      sql: 'SELECT 1',
      params: [],
      durationMs: 1,
    })
    expect(getSnapshot().requests).toHaveLength(1)
    expect(getSnapshot().requests[0]?.path).toBe('/server-demo')
    expect(getSnapshot().requests[0]?.queries).toHaveLength(1)
    clearStore()
  })
})

describe('clampMaxRequests', () => {
  it('defaults, clamps to 1…1000', () => {
    expect(clampMaxRequests()).toBe(DEFAULT_MAX_REQUESTS)
    expect(clampMaxRequests(50)).toBe(50)
    expect(clampMaxRequests(0)).toBe(1)
    expect(clampMaxRequests(-10)).toBe(1)
    expect(clampMaxRequests(99999)).toBe(ABSOLUTE_MAX_REQUESTS)
    expect(clampMaxRequests(Number.NaN)).toBe(DEFAULT_MAX_REQUESTS)
  })
})

describe('resolveSqlInspectorEnabled', () => {
  it('defaults to isDev and blocks production without force', () => {
    expect(resolveSqlInspectorEnabled({ isDev: true })).toBe(true)
    expect(resolveSqlInspectorEnabled({ isDev: false })).toBe(false)
    expect(resolveSqlInspectorEnabled({ enabled: true, isDev: false })).toBe(false)
    expect(resolveSqlInspectorEnabled({
      enabled: true,
      forceEnableInProduction: true,
      isDev: false,
    })).toBe(true)
    expect(resolveSqlInspectorEnabled({
      enabled: false,
      forceEnableInProduction: true,
      isDev: true,
    })).toBe(false)
  })
})
