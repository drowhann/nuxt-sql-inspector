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
  redactParams?: boolean
}
