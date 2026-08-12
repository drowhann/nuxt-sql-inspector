import { describe, expect, it } from 'vitest'
import { inspectSql } from '../src/runtime/server/utils/inspect-noop'

describe('inspectSql noop', () => {
  it('returns the same client', () => {
    const client = { query: () => null }
    expect(inspectSql(client)).toBe(client)
  })
})
