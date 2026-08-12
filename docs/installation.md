# Installation

```bash
pnpm add -D nuxt-sql-inspector
```

`pg` and/or `postgres` stay in your app — they are optional peers of this module.

## Nuxt config

```ts
export default defineNuxtConfig({
  modules: ['nuxt-sql-inspector'],
  sqlInspector: {
    // enabled: true,              // default: nuxt.options.dev
    // path: '/__sql_queries',
    // apiBase: '/api/__sql_queries',
    // maxRequests: 200,           // default 200, max 1000
  },
})
```

The module is a no-op in production unless you set `sqlInspector.enabled: true` (not recommended).

## Next

See [usage](./usage.md) to wrap your Drizzle / PostgreSQL client.
