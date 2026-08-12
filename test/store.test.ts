import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('useRuntimeConfig', () => ({
  sqlInspector: { maxRequests: 200, enabled: true, path: '/__sql_queries', apiBase: '/api/__sql_queries' },
}))

const {
  clearStore,
  getSnapshot,
  recordQuery,
  startRequest,
} = await import('../src/runtime/server/utils/store')
const {
  ABSOLUTE_MAX_REQUESTS,
  clampMaxRequests,
  DEFAULT_MAX_REQUESTS,
} = await import('../src/runtime/server/utils/enabled')

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
