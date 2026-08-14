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
const { inspectSql } = await import('../src/runtime/server/utils/inspect-better-sqlite3')
const {
  clearStore,
  getSnapshot,
  startRequest,
} = await import('../src/runtime/server/utils/store')

function mockDb() {
  return {
    prepare(sql: string) {
      return {
        sql,
        run(..._args: unknown[]) {
          return { changes: 1 }
        },
        get(..._args: unknown[]) {
          return { n: 1 }
        },
        all(..._args: unknown[]) {
          return [{ n: 1 }]
        },
        iterate(..._args: unknown[]) {
          return [{ n: 1 }][Symbol.iterator]()
        },
        bind(..._args: unknown[]) {
          return this
        },
      }
    },
    exec(_sql: string) {
      return this
    },
    pragma(_source: string) {
      return [{ journal_mode: 'wal' }]
    },
  }
}

describe('inspectSql (better-sqlite3)', () => {
  beforeEach(() => {
    clearStore()
  })

  it('records prepare get/run/all and exec', () => {
    startRequest({
      id: 'req-s1',
      method: 'GET',
      path: '/api/users',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb())
    expect(inspectSql(wrapped)).toBe(wrapped)

    requestAls.run({ requestId: 'req-s1' }, () => {
      wrapped.prepare('SELECT ?').get(1)
      wrapped.prepare('INSERT INTO t VALUES (?)').run(['x'])
      wrapped.prepare('SELECT 1').all()
      wrapped.exec('CREATE TABLE t (id INTEGER)')
    })

    const req = getSnapshot().requests.find(r => r.id === 'req-s1')
    expect(req?.queries).toHaveLength(4)
    expect(req?.queries[0]?.sql).toBe('SELECT ?')
    expect(req?.queries[0]?.params).toEqual([{ type: 'number' }])
    expect(req?.queries[1]?.sql).toBe('INSERT INTO t VALUES (?)')
    expect(req?.queries[1]?.params).toEqual([{ type: 'string', length: 1 }])
    expect(req?.queries[2]?.sql).toBe('SELECT 1')
    expect(req?.queries[3]?.sql).toBe('CREATE TABLE t (id INTEGER)')
  })

  it('records iterate once, not per row', () => {
    startRequest({
      id: 'req-s2',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb())
    requestAls.run({ requestId: 'req-s2' }, () => {
      const it = wrapped.prepare('SELECT id FROM t').iterate()
      for (const _row of it) { /* consume */ }
    })

    expect(getSnapshot().requests.find(r => r.id === 'req-s2')?.queries).toHaveLength(1)
    expect(getSnapshot().requests.find(r => r.id === 'req-s2')?.queries[0]?.sql).toBe('SELECT id FROM t')
  })

  it('uses bind params when all() has no args', () => {
    startRequest({
      id: 'req-s3',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb())
    requestAls.run({ requestId: 'req-s3' }, () => {
      wrapped.prepare('SELECT ?').bind('ab').all()
    })

    const q = getSnapshot().requests.find(r => r.id === 'req-s3')?.queries[0]
    expect(q?.sql).toBe('SELECT ?')
    expect(q?.params).toEqual([{ type: 'string', length: 2 }])
  })

  it('records sync throw on get', () => {
    startRequest({
      id: 'req-s4',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const db = {
      prepare() {
        return {
          get() {
            throw new Error('sqlite fail')
          },
        }
      },
    }
    const wrapped = inspectSql(db)

    requestAls.run({ requestId: 'req-s4' }, () => {
      expect(() => wrapped.prepare('SELECT 1').get()).toThrow('sqlite fail')
    })

    const q = getSnapshot().requests.find(r => r.id === 'req-s4')?.queries[0]
    expect(q?.sql).toBe('SELECT 1')
    expect(q?.error).toBe('sqlite fail')
  })

  it('records pragma', () => {
    startRequest({
      id: 'req-s5',
      method: 'GET',
      path: '/api/x',
      startedAt: Date.now(),
    })

    const wrapped = inspectSql(mockDb())
    requestAls.run({ requestId: 'req-s5' }, () => {
      wrapped.pragma('journal_mode = WAL')
    })

    expect(getSnapshot().requests.find(r => r.id === 'req-s5')?.queries[0]?.sql).toBe('journal_mode = WAL')
  })

  it('sends unmatched queries to background', () => {
    const wrapped = inspectSql(mockDb())
    wrapped.prepare('SELECT 1').get()
    expect(getSnapshot().backgroundQueries[0]?.sql).toBe('SELECT 1')
  })
})
