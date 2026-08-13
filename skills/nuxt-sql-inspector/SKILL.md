---
name: nuxt-sql-inspector
description: >-
  Add the nuxt-sql-inspector module to a Nuxt app. Use when installing SQL query
  inspection for pg or postgres.js (raw, Drizzle, Prisma adapter), or wiring
  /__sql_queries.
---

# nuxt-sql-inspector

Dev-only Nuxt module: API requests + PostgreSQL queries at `/__sql_queries`. Wraps the **drivers** (`pg` / `postgres.js`), not a specific ORM.

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

// Drizzle after drizzle(url):
inspectSql(db.$client)

// Prisma: only with @prisma/adapter-pg — wrap the Pool, then pass it to PrismaPg
const pool = inspectSql(new Pool({ connectionString }))
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
```

Default Prisma Client (no driver adapter) does not go through `pg` and will not be captured.

Do not auto-patch. Call once at pool/client creation. When the module is disabled (production), the same imports resolve to a no-op `inspectSql`.

## Open

`http://localhost:3000/__sql_queries` in development only.

## Options

`sqlInspector.enabled` (default: `nuxt.options.dev`), `forceEnableInProduction` (required with `enabled` outside dev), `path`, `apiBase`, `maxRequests` (default 200, max 1000), `redactParams` (default true), optional `include` / `exclude` path globs.
