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
    // forceEnableInProduction: true, // required with enabled outside development
    // path: '/__sql_queries',
    // apiBase: '/api/__sql_queries',
    // maxRequests: 200,           // default 200, max 1000
    // include: ['/api/**'],       // optional allowlist (omit = all eligible routes)
    // exclude: ['/api/webhooks/**'],
    // redactParams: true,         // default: type/length only; false = raw bind values
  },
})
```

The module is a no-op in production unless you set **both** `sqlInspector.enabled: true` and `sqlInspector.forceEnableInProduction: true` (not recommended). `enabled: true` alone is ignored outside development. Bind params are **redacted by default** (`redactParams: true`); set `redactParams: false` to store raw values. `nuxt-sql-inspector/node-postgres` and `nuxt-sql-inspector/postgres-js` still resolve to an identity `inspectSql` when disabled, so production / Cloudflare builds that keep those imports do not break.

## Next

See [usage](./usage.md) to wrap `pg` or `postgres.js` (raw, Drizzle, Prisma adapter, etc.).
