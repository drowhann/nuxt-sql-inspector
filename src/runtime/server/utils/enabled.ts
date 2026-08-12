export const DEFAULT_MAX_REQUESTS = 200
/** Hard ceiling for `sqlInspector.maxRequests` (memory bound). */
export const ABSOLUTE_MAX_REQUESTS = 1000

export function clampMaxRequests(n?: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : DEFAULT_MAX_REQUESTS
  return Math.min(ABSOLUTE_MAX_REQUESTS, Math.max(1, v))
}

/** Build-time / config rule: production needs `forceEnableInProduction`. */
export function resolveSqlInspectorEnabled(opts: {
  enabled?: boolean
  forceEnableInProduction?: boolean
  isDev: boolean
}): boolean {
  const wantsOn = opts.enabled ?? opts.isDev
  return Boolean(wantsOn) && (opts.isDev || opts.forceEnableInProduction === true)
}

export type SqlInspectorRuntimeConfig = {
  enabled?: boolean
  forceEnableInProduction?: boolean
  path?: string
  apiBase?: string
  maxRequests?: number
  include?: string[]
  exclude?: string[]
}

export function isSqlInspectorEnabled() {
  try {
    const cfg = useRuntimeConfig().sqlInspector as SqlInspectorRuntimeConfig | undefined
    if (cfg?.enabled !== true) return false
    if (import.meta.dev) return true
    return cfg.forceEnableInProduction === true
  } catch {
    // outside request / before runtime ready
  }
  return import.meta.dev === true
}

export function getSqlInspectorConfig(): SqlInspectorRuntimeConfig & { maxRequests: number } {
  try {
    const raw = (useRuntimeConfig().sqlInspector || {}) as SqlInspectorRuntimeConfig
    return {
      ...raw,
      maxRequests: clampMaxRequests(raw.maxRequests),
    }
  } catch {
    return {
      enabled: true,
      forceEnableInProduction: false,
      path: '/__sql_queries',
      apiBase: '/api/__sql_queries',
      maxRequests: DEFAULT_MAX_REQUESTS,
    }
  }
}
