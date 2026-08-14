import { beforeEach, describe, expect, it } from 'vitest'

globalThis.__sqlInspectorRuntimeConfig = () => ({
  sqlInspector: {
    maxRequests: 200,
    enabled: true,
    forceEnableInProduction: true,
    path: '/__sql_queries',
    apiBase: '/api/__sql_queries',
  },
})
globalThis.__sqlInspectorUseEvent = () => {
  throw new Error('no event')
}

const { requestAls } = await import('../src/runtime/server/utils/context')
const { inspectSql } = await import('../src/runtime/server/utils/inspect-mysql2')
const {
  clearStore,
  getSnapshot,
  startRequest,
} = await import('../src/runtime/server/utils/store')

describe('inspectSql (mysql2)', () => {
  beforeEach(() => {
    clearStore()
  })

  it('records query and execute on the request', async () => {
    startRequest({
      id: 'req-m1',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const pool = {
      async query(_sql: string, _params?: unknown[]) {
        return [[], []]
      },
      async execute(_sql: string, _params?: unknown[]) {
        return [[], []]
      },
    }
    const wrapped = inspectSql(pool)
    expect(inspectSql(wrapped)).toBe(wrapped)

    await requestAls.run({ requestId: 'req-m1' }, async () => {
      await wrapped.query('SELECT ?', [1])
      await wrapped.execute('SELECT ?', ['x'])
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-m1')
    expect(req?.queries).toHaveLength(2)
    expect(req?.queries[0]?.sql).toBe('SELECT ?')
    expect(req?.queries[0]?.params).toEqual([{ type: 'number' }])
    expect(req?.queries[1]?.sql).toBe('SELECT ?')
    expect(req?.queries[1]?.params).toEqual([{ type: 'string', length: 1 }])
  })

  it('captures request id before async settle and object sql/values', async () => {
    startRequest({
      id: 'req-m2',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const pool = {
      async execute(_q: { sql: string; values?: unknown[] }) {
        await new Promise((r) => setTimeout(r, 10))
        return [[], []]
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-m2' }, async () => {
      await wrapped.execute({ sql: 'SELECT ?', values: [9] })
    })

    const q = getSnapshot().requests.find((r) => r.id === 'req-m2')?.queries[0]
    expect(q?.sql).toBe('SELECT ?')
    expect(q?.params).toEqual([{ type: 'number' }])
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records callback-style query errors', async () => {
    startRequest({
      id: 'req-m3',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const pool = {
      query(sql: string, params: unknown[], cb: (err: Error | null, rows?: unknown) => void) {
        queueMicrotask(() => cb(new Error('boom')))
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-m3' }, async () => {
      await new Promise<void>((resolve) => {
        wrapped.query('SELECT 1', [], (err: Error | null) => {
          expect(err?.message).toBe('boom')
          resolve()
        })
      })
    })

    const q = getSnapshot().requests.find((r) => r.id === 'req-m3')?.queries[0]
    expect(q?.sql).toBe('SELECT 1')
    expect(q?.error).toBe('boom')
  })

  it('records promise rejection errors', async () => {
    startRequest({
      id: 'req-m4',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const pool = {
      async execute() {
        throw new Error('fail')
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-m4' }, async () => {
      await expect(wrapped.execute('SELECT 1')).rejects.toThrow('fail')
    })

    const q = getSnapshot().requests.find((r) => r.id === 'req-m4')?.queries[0]
    expect(q?.error).toBe('fail')
  })

  it('sends unmatched queries to background', async () => {
    const pool = {
      async query() {
        return [[], []]
      },
    }
    const wrapped = inspectSql(pool)
    await wrapped.query('SELECT 1')
    expect(getSnapshot().backgroundQueries[0]?.sql).toBe('SELECT 1')
  })
})
