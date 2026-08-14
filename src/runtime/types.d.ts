declare module 'nuxt-sql-inspector/node-postgres' {
  export function inspectSql<T>(client: T): T
}

declare module 'nuxt-sql-inspector/postgres-js' {
  export function inspectSql<T>(sql: T): T
}

declare module 'nuxt-sql-inspector/mysql2' {
  export function inspectSql<T>(client: T): T
}

declare module 'nuxt-sql-inspector/libsql' {
  export function inspectSql<T>(client: T): T
}

declare module 'nuxt-sql-inspector/better-sqlite3' {
  export function inspectSql<T>(client: T): T
}

declare module 'nuxt-sql-inspector/db0' {
  export function inspectSql<T>(client: T): T
}

declare module '@nuxt/schema' {
  interface PublicRuntimeConfig {
    sqlInspector: {
      path: string
      apiBase: string
      allowAccess: boolean
    }
  }
  interface RuntimeConfig {
    sqlInspector: {
      enabled: boolean
      forceEnableInProduction: boolean
      path: string
      apiBase: string
      maxRequests: number
      include?: string[]
      exclude?: string[]
      redactParams: boolean
    }
  }
}

export {}
