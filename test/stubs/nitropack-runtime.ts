/** Vitest stub — real nitropack/runtime resolves only in consumer Nitro builds. */
type RuntimeConfig = {
  sqlInspector?: Record<string, unknown>
}

type RuntimeStub = () => RuntimeConfig

declare global {
  // ponytail: test-only hook; vitest alias replaces nitropack/runtime
  var __sqlInspectorRuntimeConfig: RuntimeStub | undefined
  var __sqlInspectorUseEvent: (() => unknown) | undefined
}

export function useRuntimeConfig(): RuntimeConfig {
  if (globalThis.__sqlInspectorRuntimeConfig) {
    return globalThis.__sqlInspectorRuntimeConfig()
  }
  return {
    sqlInspector: {
      enabled: true,
      forceEnableInProduction: true,
      redactParams: true,
      maxRequests: 200,
      path: '/__sql_queries',
      apiBase: '/api/__sql_queries',
    },
  }
}

export function useEvent(): unknown {
  if (globalThis.__sqlInspectorUseEvent) {
    return globalThis.__sqlInspectorUseEvent()
  }
  throw new Error('useEvent: no Nitro event in unit test')
}

export function defineNitroPlugin<T>(def: T): T {
  return def
}
