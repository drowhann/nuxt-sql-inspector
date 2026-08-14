import { useRuntimeConfig } from 'nitropack/runtime'
import {
  clampMaxRequests,
  DEFAULT_MAX_REQUESTS,
  type SqlInspectorRuntimeConfig,
} from './config'

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

export function getSqlInspectorConfig(): SqlInspectorRuntimeConfig & {
  maxRequests: number
  redactParams: boolean
} {
  try {
    const raw = (useRuntimeConfig().sqlInspector || {}) as SqlInspectorRuntimeConfig
    return {
      ...raw,
      maxRequests: clampMaxRequests(raw.maxRequests),
      redactParams: raw.redactParams !== false,
    }
  } catch {
    return {
      enabled: true,
      forceEnableInProduction: false,
      path: '/__sql_queries',
      apiBase: '/api/__sql_queries',
      maxRequests: DEFAULT_MAX_REQUESTS,
      redactParams: true,
    }
  }
}
