declare module '#sql-inspector' {
  import type { Pool } from 'pg'
  export function instrumentSqlInspector<T extends Pool | void = void>(
    pool?: T,
  ): T extends Pool ? Pool : void
  export function instrumentPg(): void
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
