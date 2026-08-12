import { addCustomTab } from '@nuxt/devtools-kit'
import {
  addRouteMiddleware,
  addServerHandler,
  addServerPlugin,
  createResolver,
  defineNuxtModule,
  extendPages,
} from '@nuxt/kit'
import {
  clampMaxRequests,
  DEFAULT_MAX_REQUESTS,
  resolveSqlInspectorEnabled,
} from './runtime/server/utils/enabled'

export interface ModuleOptions {
  /**
   * When omitted, defaults to `nuxt.options.dev`.
   * Set `false` to disable even in development.
   * In production builds, also requires `forceEnableInProduction: true`.
   */
  enabled?: boolean
  /**
   * Allow the inspector when not in `nuxt.options.dev` (production / test builds).
   * Default: false. Required together with `enabled: true` outside development.
   */
  forceEnableInProduction?: boolean
  /** UI route path. Default: `/__sql_queries` */
  path?: string
  /** API base path. Default: `/api/__sql_queries` */
  apiBase?: string
  /**
   * Max retained HTTP request records (ring buffer).
   * Default: 200. Clamped to 1…1000.
   */
  maxRequests?: number
  /**
   * Glob patterns of paths to monitor (`*` one segment, `**` any depth).
   * When omitted or empty, all paths are eligible (minus built-in denylist / `exclude`).
   */
  include?: string[]
  /**
   * Glob patterns always skipped (in addition to inspector UI/API and static assets).
   */
  exclude?: string[]
  /**
   * When true (default), store param type/length only — not raw bind values.
   * Set `false` to keep raw params (strings still truncated).
   */
  redactParams?: boolean
}

export type SqlInspectorModuleOptions = ModuleOptions

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-sql-inspector',
    configKey: 'sqlInspector',
  },
  defaults: {
    path: '/__sql_queries',
    apiBase: '/api/__sql_queries',
    maxRequests: DEFAULT_MAX_REQUESTS,
    redactParams: true,
  },
  setup(options, nuxt) {
    const forceEnableInProduction = options.forceEnableInProduction === true
    const enabled = resolveSqlInspectorEnabled({
      enabled: options.enabled,
      forceEnableInProduction,
      isDev: nuxt.options.dev,
    })
    const resolver = createResolver(import.meta.url)
    const path = options.path || '/__sql_queries'
    const apiBase = (options.apiBase || '/api/__sql_queries').replace(/\/$/, '')
    const maxRequests = clampMaxRequests(options.maxRequests)
    const include = options.include?.length ? [...options.include] : undefined
    const exclude = options.exclude?.length ? [...options.exclude] : undefined
    const redactParams = options.redactParams !== false

    // Alias package subpaths so imports resolve in Nuxt/Nitro (and to noop when disabled).
    // Do not use `#…` — Node treats those as package.json "imports" and Nitro may leave them external.
    const inspectNoop = resolver.resolve('./runtime/server/utils/inspect-noop')
    const inspectPg = enabled
      ? resolver.resolve('./runtime/server/utils/inspect-pg')
      : inspectNoop
    const inspectPostgresJs = enabled
      ? resolver.resolve('./runtime/server/utils/inspect-postgresjs')
      : inspectNoop

    nuxt.options.alias ||= {}
    nuxt.options.alias['nuxt-sql-inspector/node-postgres'] = inspectPg
    nuxt.options.alias['nuxt-sql-inspector/postgres-js'] = inspectPostgresJs

    nuxt.options.nitro ||= {}
    nuxt.options.nitro.alias ||= {}
    nuxt.options.nitro.alias['nuxt-sql-inspector/node-postgres'] = inspectPg
    nuxt.options.nitro.alias['nuxt-sql-inspector/postgres-js'] = inspectPostgresJs

    nuxt.options.runtimeConfig.sqlInspector = {
      ...(nuxt.options.runtimeConfig.sqlInspector as object | undefined),
      enabled,
      forceEnableInProduction,
      path,
      apiBase,
      maxRequests,
      include,
      exclude,
      redactParams,
    }

    nuxt.options.runtimeConfig.public ||= {}
    ;(nuxt.options.runtimeConfig.public as any).sqlInspector = {
      ...((nuxt.options.runtimeConfig.public as any).sqlInspector || {}),
      path,
      apiBase,
      allowAccess: enabled,
    }

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolver.resolve('./runtime/types.d.ts') })
    })

    if (!enabled) return

    nuxt.options.experimental ||= {}
    nuxt.options.experimental.asyncContext = true

    addServerPlugin(resolver.resolve('./runtime/server/plugin'))

    addServerHandler({
      route: apiBase,
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/snapshot.get'),
    })
    addServerHandler({
      route: `${apiBase}/clear`,
      method: 'post',
      handler: resolver.resolve('./runtime/server/api/clear.post'),
    })
    addServerHandler({
      route: `${apiBase}/stream`,
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/stream.get'),
    })

    extendPages((pages) => {
      pages.push({
        name: 'nuxt-sql-inspector',
        path,
        file: resolver.resolve('./runtime/app/pages/sql-queries.vue'),
      })
    })

    addRouteMiddleware({
      name: 'sql-inspector-dev-only',
      path: resolver.resolve('./runtime/app/middleware/sql-inspector-dev-only'),
      global: true,
    })

    const devtools = nuxt.options.devtools
    const devtoolsEnabled = devtools !== false
      && (typeof devtools !== 'object' || (devtools as { enabled?: boolean }).enabled !== false)
    if (devtoolsEnabled) {
      addCustomTab({
        name: 'nuxt-sql-inspector',
        title: 'SQL Inspector',
        icon: 'carbon:data-base',
        view: {
          type: 'iframe',
          src: path,
        },
      })
    }
  },
})
