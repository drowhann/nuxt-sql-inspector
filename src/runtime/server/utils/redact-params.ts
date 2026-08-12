export type RedactedParam =
  | { type: 'null' }
  | { type: 'string'; length: number }
  | { type: 'number' }
  | { type: 'boolean' }
  | { type: 'bigint' }
  | { type: 'array'; length: number }
  | { type: 'object' }
  | { type: 'buffer'; length: number }
  | { type: 'date' }
  | { type: 'unknown' }

/** Type/length descriptor only — no raw bind values. */
export function redactParam(value: unknown): RedactedParam {
  if (value === null || value === undefined) return { type: 'null' }
  if (typeof value === 'string') return { type: 'string', length: value.length }
  if (typeof value === 'number') return { type: 'number' }
  if (typeof value === 'boolean') return { type: 'boolean' }
  if (typeof value === 'bigint') return { type: 'bigint' }
  if (Array.isArray(value)) return { type: 'array', length: value.length }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return { type: 'buffer', length: value.length }
  }
  if (value instanceof Date) return { type: 'date' }
  if (typeof value === 'object') return { type: 'object' }
  return { type: 'unknown' }
}

export function redactParams(params: unknown[]): RedactedParam[] {
  return params.map(redactParam)
}
