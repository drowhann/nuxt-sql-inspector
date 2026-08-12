import {
  addRouteMiddleware,
  addServerHandler,
  addServerImports,
  addServerPlugin,
  createResolver,
  defineNuxtModule,
  extendPages,
} from '@nuxt/kit'

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
  /** Max retained HTTP request records. Default: 200 */
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
    maxRequests: 200,
  },
  setup(options, nuxt) {
    const enabled = options.enabled ?? nuxt.options.dev
    if (!enabled) return

    const resolver = createResolver(import.meta.url)
    const path = options.path || '/__sql_queries'
    const apiBase = (options.apiBase || '/api/__sql_queries').replace(/\/$/, '')
    const maxRequests = options.maxRequests ?? 200

    nuxt.options.experimental ||= {}
    nuxt.options.experimental.asyncContext = true

    nuxt.options.runtimeConfig.sqlInspector = {
      ...(nuxt.options.runtimeConfig.sqlInspector as object | undefined),
      enabled: true,
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

    const instrumentPath = resolver.resolve('./runtime/server/utils/instrument')
    nuxt.options.alias ||= {}
    nuxt.options.alias['#nuxt-sql-inspector'] = instrumentPath

    nuxt.options.nitro ||= {}
    nuxt.options.nitro.alias ||= {}
    nuxt.options.nitro.alias['#nuxt-sql-inspector'] = instrumentPath

    addServerImports([
      {
        name: 'instrumentSqlInspector',
        from: instrumentPath,
      },
    ])

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

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolver.resolve('./runtime/types.d.ts') })
    })
  },
})
