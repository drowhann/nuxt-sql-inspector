import { describe, expect, it } from 'vitest'
import {
  duplicateCounts,
  fingerprintSql,
  maxDuplicateCount,
} from '../src/runtime/server/utils/sql-fingerprint'

describe('fingerprintSql', () => {
  it('treats $n and ? as the same bind, ignores case and extra whitespace', () => {
    expect(fingerprintSql('SELECT $1')).toBe(fingerprintSql('select ?'))
    expect(fingerprintSql('  SELECT   id\nFROM users  WHERE id = $2  ')).toBe(
      fingerprintSql('select id from users where id = ?'),
    )
    expect(fingerprintSql('SELECT $1, $2')).toBe(fingerprintSql('select ?, ?'))
  })
})

describe('duplicateCounts / maxDuplicateCount', () => {
  it('counts fingerprints and reports max only when ≥ 2', () => {
    const sqls = [
      'SELECT $1',
      'select ?',
      'INSERT INTO t VALUES ($1)',
    ]
    const counts = duplicateCounts(sqls)
    expect(counts.get(fingerprintSql('SELECT $1'))).toBe(2)
    expect(counts.get(fingerprintSql('INSERT INTO t VALUES ($1)'))).toBe(1)
    expect(maxDuplicateCount(sqls)).toBe(2)
    expect(maxDuplicateCount(['SELECT 1', 'SELECT 2'])).toBe(0)
    expect(maxDuplicateCount([])).toBe(0)
  })
})
