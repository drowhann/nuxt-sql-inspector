import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('useRuntimeConfig', () => ({
  sqlInspector: {
    maxRequests: 200,
    enabled: true,
    forceEnableInProduction: true,
    path: '/__sql_queries',
    apiBase: '/api/__sql_queries',
  },
}))
// Force ALS path (Pool.query must capture id before async checkout)
vi.stubGlobal('useEvent', () => {
  throw new Error('no event')
})

const { requestAls } = await import('../src/runtime/server/utils/context')
const { inspectSql } = await import('../src/runtime/server/utils/inspect-pg')
const {
  clearStore,
  getSnapshot,
  startRequest,
} = await import('../src/runtime/server/utils/store')

describe('inspectSql (node-postgres)', () => {
  beforeEach(() => {
    clearStore()
  })

  it('records SQL on the request id captured before async query settles', async () => {
    startRequest({
      id: 'req-1',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const client = {
      async query(sql: string) {
        // Simulate Pool checkout delay after query() is entered
        await new Promise((r) => setTimeout(r, 10))
        return { rows: [{ ok: true }], sql }
      },
    }

    const wrapped = inspectSql(client)

    await requestAls.run({ requestId: 'req-1' }, async () => {
      await wrapped.query('SELECT 1')
    })

    // ALS exited; recording still used the captured id
    const req = getSnapshot().requests.find((r) => r.id === 'req-1')
    expect(req?.queries).toHaveLength(1)
    expect(req?.queries[0]?.sql).toBe('SELECT 1')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('is idempotent and extracts text/values query shape', async () => {
    startRequest({
      id: 'req-2',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const client = {
      async query(q: { text: string; values?: unknown[] }) {
        return { rows: [] }
      },
    }
    const once = inspectSql(client)
    const twice = inspectSql(once)
    expect(twice).toBe(once)

    await requestAls.run({ requestId: 'req-2' }, async () => {
      await once.query({ text: 'SELECT $1', values: [42] })
    })

    const q = getSnapshot().requests.find((r) => r.id === 'req-2')?.queries[0]
    expect(q?.sql).toBe('SELECT $1')
    expect(q?.params).toEqual([42])
  })

  it('sends unmatched queries to background when no request id', async () => {
    const client = {
      async query() {
        return { rows: [] }
      },
    }
    const wrapped = inspectSql(client)
    await wrapped.query('SELECT 2')

    expect(getSnapshot().backgroundQueries).toHaveLength(1)
    expect(getSnapshot().backgroundQueries[0]?.sql).toBe('SELECT 2')
  })
})
