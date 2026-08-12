declare module '#sql-inspector' {
  export function instrumentSqlInspector<T = void>(client?: T): T
  export function instrumentPg(): void
  export function instrumentPostgresJs<T>(sql: T): T
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
