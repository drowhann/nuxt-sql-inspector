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
const { inspectSql } = await import('../src/runtime/server/utils/inspect-db0')
const {
  clearStore,
  getSnapshot,
  startRequest,
} = await import('../src/runtime/server/utils/store')

function mockDb0() {
  return {
    async sql(_strings: TemplateStringsArray, ..._values: unknown[]) {
      return { rows: [], success: true }
    },
    prepare(sql: string) {
      return {
        sql,
        async all(..._args: unknown[]) {
          return []
        },
        async run(..._args: unknown[]) {
          return { success: true }
        },
        async get(..._args: unknown[]) {
          return undefined
        },
      }
    },
    async exec(_sql: string) {
      return undefined
    },
  }
}

describe('inspectSql (db0)', () => {
  beforeEach(() => {
    clearStore()
  })

  it('records tagged sql, prepare.all, and exec', async () => {
    startRequest({
      id: 'req-d1',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb0())
    expect(inspectSql(wrapped)).toBe(wrapped)

    await requestAls.run({ requestId: 'req-d1' }, async () => {
      await wrapped.sql`SELECT * FROM users WHERE id = ${1}`
      await wrapped.prepare('SELECT ?').all('ab')
      await wrapped.exec('CREATE TABLE t (id INTEGER)')
    })

    const req = getSnapshot().requests.find(r => r.id === 'req-d1')
    expect(req?.queries).toHaveLength(3)
    expect(req?.queries[0]?.sql).toBe('SELECT * FROM users WHERE id = ?')
    expect(req?.queries[0]?.params).toEqual([{ type: 'number' }])
    expect(req?.queries[1]?.sql).toBe('SELECT ?')
    expect(req?.queries[1]?.params).toEqual([{ type: 'string', length: 2 }])
    expect(req?.queries[2]?.sql).toBe('CREATE TABLE t (id INTEGER)')
  })

  it('interpolates static {${name}} segments', async () => {
    startRequest({
      id: 'req-d2',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb0())
    const table = 'users'
    await requestAls.run({ requestId: 'req-d2' }, async () => {
      await wrapped.sql`SELECT * FROM {${table}} WHERE id = ${9}`
    })

    const q = getSnapshot().requests.find(r => r.id === 'req-d2')?.queries[0]
    expect(q?.sql).toBe('SELECT * FROM users WHERE id = ?')
    expect(q?.params).toEqual([{ type: 'number' }])
  })

  it('records statement errors', async () => {
    startRequest({
      id: 'req-d3',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const db = {
      sql() {
        return Promise.resolve({ rows: [] })
      },
      prepare() {
        return {
          async all() {
            throw new Error('db0 fail')
          },
        }
      },
      exec() {},
    }
    const wrapped = inspectSql(db)

    await requestAls.run({ requestId: 'req-d3' }, async () => {
      await expect(wrapped.prepare('SELECT 1').all()).rejects.toThrow('db0 fail')
    })

    const q = getSnapshot().requests.find(r => r.id === 'req-d3')?.queries[0]
    expect(q?.sql).toBe('SELECT 1')
    expect(q?.error).toBe('db0 fail')
  })

  it('sends unmatched sql to background', async () => {
    const wrapped = inspectSql(mockDb0())
    await wrapped.sql`SELECT 1`
    expect(getSnapshot().backgroundQueries[0]?.sql).toBe('SELECT 1')
  })
})
