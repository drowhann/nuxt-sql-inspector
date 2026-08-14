/** Normalize SQL so `$1` / `$2` and `?` fingerprint as the same query. */
export function fingerprintSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').replace(/\$\d+/g, '?').toLowerCase()
}

export function duplicateCounts(sqls: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const sql of sqls) {
    const fp = fingerprintSql(sql)
    counts.set(fp, (counts.get(fp) ?? 0) + 1)
  }
  return counts
}

/** Largest group size if any fingerprint appears ≥ 2 times; otherwise 0. */
export function maxDuplicateCount(sqls: string[]): number {
  let max = 0
  for (const n of duplicateCounts(sqls).values()) {
    if (n > max) max = n
  }
  return max >= 2 ? max : 0
}
