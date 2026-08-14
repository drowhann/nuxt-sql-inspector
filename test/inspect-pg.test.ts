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
// Force ALS path (Pool.query must capture id before async checkout)
globalThis.__sqlInspectorUseEvent = () => {
  throw new Error('no event')
}

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
      async query(_q: { text: string; values?: unknown[] }) {
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
    expect(q?.params).toEqual([{ type: 'number' }])
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

  it('records queries on a client from pool.connect()', async () => {
    startRequest({
      id: 'req-c1',
      method: 'GET',
      path: '/api/tx',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        return { rows: [], sql }
      },
      release() {},
    }
    const pool = {
      idleCount: 0,
      async connect() {
        await new Promise((r) => setTimeout(r, 10))
        return inner
      },
      async query() {
        throw new Error('pool.query should not record when connect exists')
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-c1' }, async () => {
      const client = await wrapped.connect()
      await client.query('SELECT 1')
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-c1')
    expect(req?.queries).toHaveLength(1)
    expect(req?.queries[0]?.sql).toBe('SELECT 1')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records queries from callback pool.connect(err, client, release)', async () => {
    startRequest({
      id: 'req-cb',
      method: 'GET',
      path: '/api/tx',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        return { rows: [], sql }
      },
      release() {},
    }
    const pool = {
      idleCount: 0,
      connect(cb: (err: Error | null, client?: typeof inner, release?: () => void) => void) {
        queueMicrotask(() => cb(null, inner, () => {}))
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-cb' }, async () => {
      await new Promise<void>((resolve, reject) => {
        wrapped.connect((err: Error | null, client?: typeof inner) => {
          if (err || !client) {
            reject(err ?? new Error('no client'))
            return
          }
          client.query('BEGIN').then(() => resolve(), reject)
        })
      })
    })

    const req = getSnapshot().requests.find((r) => r.id === 'req-cb')
    expect(req?.queries).toHaveLength(1)
    expect(req?.queries[0]?.sql).toBe('BEGIN')
  })

  it('re-pins request id on a reused pool client', async () => {
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
      async query(sql: string) {
        return { rows: [], sql }
      },
      release() {},
    }
    const pool = {
      idleCount: 0,
      async connect() {
        return inner
      },
    }
    const wrapped = inspectSql(pool)

    await requestAls.run({ requestId: 'req-a' }, async () => {
      const client = await wrapped.connect()
      await client.query('SELECT a')
    })
    await requestAls.run({ requestId: 'req-b' }, async () => {
      const client = await wrapped.connect()
      await client.query('SELECT b')
    })

    expect(getSnapshot().requests.find((r) => r.id === 'req-a')?.queries[0]?.sql).toBe('SELECT a')
    expect(getSnapshot().requests.find((r) => r.id === 'req-b')?.queries[0]?.sql).toBe('SELECT b')
    expect(getSnapshot().backgroundQueries).toHaveLength(0)
  })

  it('records pool.query once when it internally connect()s', async () => {
    startRequest({
      id: 'req-pq',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const inner = {
      async query(sql: string) {
        await new Promise((r) => setTimeout(r, 10))
        return { rows: [], sql }
      },
      release() {},
    }
    const pool = {
      idleCount: 0,
      async connect() {
        return inner
      },
      async query(this: { connect: () => Promise<typeof inner> }, sql: string) {
        const client = await this.connect()
        try {
          return await client.query(sql)
        }
        finally {
          client.release()
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

  it('still records on Client.query when Client.connect is TCP (no checkout)', async () => {
    startRequest({
      id: 'req-tcp',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const client = {
      async connect() {},
      async query(sql: string) {
        return { rows: [], sql }
      },
    }
    const wrapped = inspectSql(client)

    await requestAls.run({ requestId: 'req-tcp' }, async () => {
      await wrapped.connect()
      await wrapped.query('SELECT 1')
    })

    expect(getSnapshot().requests.find((r) => r.id === 'req-tcp')?.queries).toHaveLength(1)
  })
})
