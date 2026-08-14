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

  it('records queries on a connection from pool.getConnection()', async () => {
    startRequest({
      id: 'req-gc1',
      method: 'GET',
      path: '/api/tx',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        return [[], sql]
      },
      async execute(sql: string) {
        return [[], sql]
      },
      release() {},
    }
    const pool = {
      async getConnection() {
        await new Promise((r) => setTimeout(r, 10))
        return inner
      },
      async query() {
        throw new Error('pool.query should not record when getConnection exists')
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-gc1' }, async () => {
      const conn = await wrapped.getConnection()
      await conn.query('SELECT 1')
      await conn.execute('SELECT 2')
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-gc1')
    expect(req?.queries).toHaveLength(2)
    expect(req?.queries[0]?.sql).toBe('SELECT 1')
    expect(req?.queries[1]?.sql).toBe('SELECT 2')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records queries from callback pool.getConnection(err, conn)', async () => {
    startRequest({
      id: 'req-gccb',
      method: 'GET',
      path: '/api/tx',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        return [[], sql]
      },
      release() {},
    }
    const pool = {
      getConnection(cb: (err: Error | null, conn?: typeof inner) => void) {
        queueMicrotask(() => cb(null, inner))
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-gccb' }, async () => {
      await new Promise<void>((resolve, reject) => {
        wrapped.getConnection((err: Error | null, conn?: typeof inner) => {
          if (err || !conn) {
            reject(err ?? new Error('no conn'))
            return
          }
          conn.query('BEGIN').then(() => resolve(), reject)
        })
      })
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-gccb')
    expect(req?.queries).toHaveLength(1)
    expect(req?.queries[0]?.sql).toBe('BEGIN')
  })

  it('re-pins request id on a reused pool connection', async () => {
    startRequest({
      id: 'req-a',
      method: 'GET',
      path: '/api/a',
      startedAt: Date.now(),
    })
    startRequest({
      id: 'req-b',
      method: 'GET',
      path: '/api/b',
      startedAt: Date.now(),
    })

    const inner = {
      async execute(sql: string) {
        return [[], sql]
      },
      release() {},
    }
    const pool = {
      async getConnection() {
        return inner
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-a' }, async () => {
      const conn = await wrapped.getConnection()
      await conn.execute('SELECT a')
    })
    await requestAls.run({ requestId: 'req-b' }, async () => {
      const conn = await wrapped.getConnection()
      await conn.execute('SELECT b')
    })

    expect(getSnapshot().requests.find((r) => r.id === 'req-a')?.queries[0]?.sql).toBe('SELECT a')
    expect(getSnapshot().requests.find((r) => r.id === 'req-b')?.queries[0]?.sql).toBe('SELECT b')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records pool.query once when it internally getConnection()s', async () => {
    startRequest({
      id: 'req-pq',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        await new Promise((r) => setTimeout(r, 10))
        return [[], sql]
      },
      release() {},
    }
    const pool = {
      async getConnection() {
        return inner
      },
      async query(this: { getConnection: () => Promise<typeof inner> }, sql: string) {
        const conn = await this.getConnection()
        try {
          return await conn.query(sql)
        }
        finally {
          conn.release()
        }
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-pq' }, async () => {
      await wrapped.query('SELECT 1')
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-pq')
    expect(req?.queries).toHaveLength(1)
    expect(req?.queries[0]?.sql).toBe('SELECT 1')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })
})
