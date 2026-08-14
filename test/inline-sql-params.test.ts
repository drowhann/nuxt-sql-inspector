import { describe, expect, it } from 'vitest'
import { formatSqlForCopy } from '../src/runtime/server/utils/inline-sql-params'

describe('formatSqlForCopy', () => {
  it('inlines $1 and $2', () => {
    expect(formatSqlForCopy('SELECT $1, $2', ['a', 2])).toBe("SELECT 'a', 2")
  })

  it('replaces $10 before $1', () => {
    const params = Array.from({ length: 10 }, (_, i) => i + 1)
    expect(formatSqlForCopy('SELECT $1, $10', params)).toBe('SELECT 1, 10')
  })

  it('inlines ? placeholders left to right', () => {
    expect(formatSqlForCopy('SELECT ? FROM t WHERE id = ?', ['x', 9])).toBe(
      "SELECT 'x' FROM t WHERE id = 9",
    )
  })

  it('escapes quotes and inlines NULL', () => {
    expect(formatSqlForCopy("SELECT $1, $2", ["o'reilly", null])).toBe(
      "SELECT 'o''reilly', NULL",
    )
  })

  it('returns parameterized SQL when params are redacted', () => {
    expect(
      formatSqlForCopy('SELECT $1', [{ type: 'string', length: 3 }]),
    ).toBe('SELECT $1')
  })

  it('returns SQL as-is when params are empty', () => {
    expect(formatSqlForCopy('SELECT 1', [])).toBe('SELECT 1')
  })
})
