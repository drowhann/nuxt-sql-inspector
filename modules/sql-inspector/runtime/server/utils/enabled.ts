export function isSqlInspectorEnabled() {
  try {
    const cfg = useRuntimeConfig().sqlInspector as { enabled?: boolean } | undefined
    if (cfg && cfg.enabled === false) return false
  } catch {
    // outside request / before runtime ready
  }
  return import.meta.dev === true || process.dev === true
}

export function getSqlInspectorConfig() {
  try {
    return (useRuntimeConfig().sqlInspector || {}) as {
      enabled?: boolean
      path?: string
      apiBase?: string
      maxRequests?: number
    }
  } catch {
    return {
      enabled: true,
      path: '/__sql_queries',
      apiBase: '/api/__sql_queries',
      maxRequests: 200,
    }
  }
}
