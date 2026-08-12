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
} from './runtime/server/utils/enabled'

export interface ModuleOptions {
  /**
   * When omitted, defaults to `nuxt.options.dev`.
   * Set `false` to disable even in development.
   */
  enabled?: boolean
  /** UI route path. Default: `/__sql_queries` */
  path?: string
  /** API base path. Default: `/api/__sql_queries` */
  apiBase?: string
  /**
   * Max retained HTTP request records (ring buffer).
   * Default: 200. Clamped to 1…1000.
   */
  maxRequests?: number
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
  },
  setup(options, nuxt) {
    const enabled = options.enabled ?? nuxt.options.dev
    const resolver = createResolver(import.meta.url)
    const path = options.path || '/__sql_queries'
    const apiBase = (options.apiBase || '/api/__sql_queries').replace(/\/$/, '')
    const maxRequests = clampMaxRequests(options.maxRequests)

    // Always alias so `inspectSql` imports resolve in production / Cloudflare builds.
    // When disabled, point at a noop that does not import pg / node:async_hooks.
    const inspectNoop = resolver.resolve('./runtime/server/utils/inspect-noop')
    const inspectPg = enabled
      ? resolver.resolve('./runtime/server/utils/inspect-pg')
      : inspectNoop
    const inspectPostgresJs = enabled
      ? resolver.resolve('./runtime/server/utils/inspect-postgresjs')
      : inspectNoop

    nuxt.options.alias ||= {}
    nuxt.options.alias['#nuxt-sql-inspector/node-postgres'] = inspectPg
    nuxt.options.alias['#nuxt-sql-inspector/postgres-js'] = inspectPostgresJs

    nuxt.options.nitro ||= {}
    nuxt.options.nitro.alias ||= {}
    nuxt.options.nitro.alias['#nuxt-sql-inspector/node-postgres'] = inspectPg
    nuxt.options.nitro.alias['#nuxt-sql-inspector/postgres-js'] = inspectPostgresJs

    nuxt.options.runtimeConfig.sqlInspector = {
      ...(nuxt.options.runtimeConfig.sqlInspector as object | undefined),
      enabled,
      path,
      apiBase,
      maxRequests,
    }

    nuxt.options.runtimeConfig.public ||= {}
    ;(nuxt.options.runtimeConfig.public as any).sqlInspector = {
      ...((nuxt.options.runtimeConfig.public as any).sqlInspector || {}),
      path,
      apiBase,
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
