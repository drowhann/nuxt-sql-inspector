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
vi.stubGlobal('useEvent', () => {
  throw new Error('no event')
})

const { requestAls } = await import('../src/runtime/server/utils/context')
const { inspectSql } = await import('../src/runtime/server/utils/inspect-libsql')
const {
  clearStore,
  getSnapshot,
  startRequest,
} = await import('../src/runtime/server/utils/store')

describe('inspectSql (libsql)', () => {
  beforeEach(() => {
    clearStore()
  })

  it('records execute string and object forms', async () => {
    startRequest({
      id: 'req-l1',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const client = {
      async execute(_stmt: unknown, _args?: unknown[]) {
        return { rows: [] }
      },
      async batch(stmts: unknown[]) {
        return stmts.map(() => ({ rows: [] }))
      },
    }
    const wrapped = inspectSql(client)
    expect(inspectSql(wrapped)).toBe(wrapped)

    await requestAls.run({ requestId: 'req-l1' }, async () => {
      await wrapped.execute('SELECT ?', [1])
      await wrapped.execute({ sql: 'SELECT ?', args: ['ab'] })
      await wrapped.batch(['SELECT 1', { sql: 'SELECT 2', args: [] }])
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-l1')
    expect(req?.queries).toHaveLength(4)
    expect(req?.queries[0]?.sql).toBe('SELECT ?')
    expect(req?.queries[0]?.params).toEqual([{ type: 'number' }])
    expect(req?.queries[1]?.sql).toBe('SELECT ?')
    expect(req?.queries[1]?.params).toEqual([{ type: 'string', length: 2 }])
    expect(req?.queries[2]?.sql).toBe('SELECT 1')
    expect(req?.queries[3]?.sql).toBe('SELECT 2')
  })

  it('captures request id before async execute settles', async () => {
    startRequest({
      id: 'req-l2',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const client = {
      async execute() {
        await new Promise((r) => setTimeout(r, 10))
        return { rows: [] }
      },
    }
    const wrapped = inspectSql(client)

    await requestAls.run({ requestId: 'req-l2' }, async () => {
      await wrapped.execute('SELECT 1')
    })

    expect(getSnapshot().requests.find((r) => r.id === 'req-l2')?.queries).toHaveLength(1)
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records execute errors', async () => {
    startRequest({
      id: 'req-l3',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const client = {
      async execute() {
        throw new Error('libsql fail')
      },
    }
    const wrapped = inspectSql(client)

    await requestAls.run({ requestId: 'req-l3' }, async () => {
      await expect(wrapped.execute('SELECT 1')).rejects.toThrow('libsql fail')
    })

    const q = getSnapshot().requests.find((r) => r.id === 'req-l3')?.queries[0]
    expect(q?.sql).toBe('SELECT 1')
    expect(q?.error).toBe('libsql fail')
  })

  it('records batch errors on each statement', async () => {
    startRequest({
      id: 'req-l4',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const client = {
      async execute() {
        return { rows: [] }
      },
      async batch() {
        throw new Error('batch fail')
      },
    }
    const wrapped = inspectSql(client)

    await requestAls.run({ requestId: 'req-l4' }, async () => {
      await expect(wrapped.batch(['A', 'B'])).rejects.toThrow('batch fail')
    })

    const queries = getSnapshot().requests.find((r) => r.id === 'req-l4')?.queries
    expect(queries).toHaveLength(2)
    expect(queries?.[0]?.sql).toBe('A')
    expect(queries?.[0]?.error).toBe('batch fail')
    expect(queries?.[1]?.sql).toBe('B')
    expect(queries?.[1]?.error).toBe('batch fail')
  })

  it('sends unmatched execute to background', async () => {
    const client = {
      async execute() {
        return { rows: [] }
      },
    }
    const wrapped = inspectSql(client)
    await wrapped.execute('SELECT 1')
    expect(getSnapshot().backgroundQueries[0]?.sql).toBe('SELECT 1')
  })
})
