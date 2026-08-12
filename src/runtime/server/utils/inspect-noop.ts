/** Identity wrap used when the inspector is disabled (e.g. production builds). */
export function inspectSql<T>(client: T): T {
  return client
}
