import { isRedactedParam } from './redact-params'

export function canInlineParams(params: unknown[]): boolean {
  return params.length > 0 && !params.some(isRedactedParam)
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (Array.isArray(value)) return `ARRAY[${value.map(toSqlLiteral).join(', ')}]`
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `'\\x${value.toString('hex')}'`
  }
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`
}

/**
 * Parameterized SQL, or psql-ready SQL with bind values inlined when params are raw.
 * ponytail: naive `$n` / `?` replace (no SQL parser). Fine for driver-captured
 * placeholders; upgrade if queries contain `?` inside string literals.
 */
export function formatSqlForCopy(sql: string, params: unknown[]): string {
  if (!canInlineParams(params)) return sql

  if (/\$\d+/.test(sql)) {
    let out = sql
    for (let i = params.length; i >= 1; i--) {
      out = out.replaceAll(`$${i}`, toSqlLiteral(params[i - 1]))
    }
    return out
  }

  let q = 0
  return sql.replace(/\?/g, () => (q < params.length ? toSqlLiteral(params[q++]) : '?'))
}
