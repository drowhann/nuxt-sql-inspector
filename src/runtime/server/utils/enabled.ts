export const DEFAULT_MAX_REQUESTS = 200
/** Hard ceiling for `sqlInspector.maxRequests` (memory bound). */
export const ABSOLUTE_MAX_REQUESTS = 1000

export function clampMaxRequests(n?: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : DEFAULT_MAX_REQUESTS
  return Math.min(ABSOLUTE_MAX_REQUESTS, Math.max(1, v))
}

export function isSqlInspectorEnabled() {
  try {
    const cfg = useRuntimeConfig().sqlInspector as { enabled?: boolean } | undefined
    if (cfg?.enabled === true) return true
    if (cfg?.enabled === false) return false
  } catch {
    // outside request / before runtime ready
  }
  return import.meta.dev === true || import.meta.dev === true
}

export function getSqlInspectorConfig() {
  try {
    const raw = (useRuntimeConfig().sqlInspector || {}) as {
      enabled?: boolean
      path?: string
      apiBase?: string
      maxRequests?: number
    }
    return {
      ...raw,
      maxRequests: clampMaxRequests(raw.maxRequests),
    }
  } catch {
    return {
      enabled: true,
      path: '/__sql_queries',
      apiBase: '/api/__sql_queries',
      maxRequests: DEFAULT_MAX_REQUESTS,
    }
  }
}
