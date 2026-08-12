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

## Wrap the client (required)

Import `inspectSql` from the subpath that matches the driver. Do not auto-import it.

```ts
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'
const pool = inspectSql(new Pool({ connectionString }))

import { inspectSql } from 'nuxt-sql-inspector/postgres-js'
const sql = inspectSql(postgres(url))

// after drizzle(url):
inspectSql(db.$client)
```

Do not auto-patch. Call once at pool/client creation. When the module is disabled (production), the same imports resolve to a no-op `inspectSql`.

## Open

`http://localhost:3000/__sql_queries` in development only.

## Options

`sqlInspector.enabled` (default: `nuxt.options.dev`), `forceEnableInProduction` (required with `enabled` outside dev), `path`, `apiBase`, `maxRequests` (default 200, max 1000), `redactParams` (default true), optional `include` / `exclude` path globs.
