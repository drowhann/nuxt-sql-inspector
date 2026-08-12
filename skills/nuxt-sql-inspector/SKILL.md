---
name: nuxt-sql-inspector
description: >-
  Add the nuxt-sql-inspector module to a Nuxt app. Use when installing SQL query
  inspection, wrapping pg or postgres.js for Drizzle, or wiring /__sql_queries.
---

# nuxt-sql-inspector

Dev-only Nuxt module: API requests + PostgreSQL queries at `/__sql_queries`.

## Install

```bash
pnpm add -D nuxt-sql-inspector
```

```ts
export default defineNuxtConfig({
  modules: ['nuxt-sql-inspector'],
})
```

## Instrument the client (required)

```ts
import { instrumentSqlInspector } from '#nuxt-sql-inspector'

const pool = instrumentSqlInspector(new Pool({ connectionString }))
// or postgres.js: instrumentSqlInspector(postgres(url))
// or after drizzle(url): instrumentSqlInspector(db.$client)
```

Do not auto-patch. Call once at pool/client creation.

## Open

`http://localhost:3000/__sql_queries` in development only.

## Options

`sqlInspector.enabled` (default: `nuxt.options.dev`), `path`, `apiBase`, `maxRequests`.
