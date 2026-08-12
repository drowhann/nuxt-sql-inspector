declare module 'nuxt-sql-inspector/node-postgres' {
  export function inspectSql<T>(client: T): T
}

declare module 'nuxt-sql-inspector/postgres-js' {
  export function inspectSql<T>(sql: T): T
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    sqlInspector: {
      path: string
      apiBase: string
    }
  }
  interface RuntimeConfig {
    sqlInspector: {
      enabled: boolean
      path: string
      apiBase: string
      maxRequests: number
    }
  }
}

export {}
