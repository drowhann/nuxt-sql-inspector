---
name: nuxt-sql-inspector
description: >-
  Add the nuxt-sql-inspector module to a Nuxt 3 or Nuxt 4 app. Use when installing SQL query
  inspection for pg, postgres.js, mysql2, or @libsql/client (Neon Pool,
  Vercel/Netlify/PGlite, Drizzle, Prisma adapter), or wiring /__sql_queries.
---

# nuxt-sql-inspector

Dev-only Nuxt module (Nuxt 3 and Nuxt 4): API requests + SQL queries at `/__sql_queries`. Wraps drivers (`pg` / `postgres.js` / `mysql2` / `@libsql/client`), not a specific ORM.

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

import { inspectSql } from 'nuxt-sql-inspector/mysql2'
const mysqlPool = inspectSql(mysql.createPool({ uri }))

import { inspectSql } from 'nuxt-sql-inspector/libsql'
const db = inspectSql(createClient({ url }))

// Drizzle after drizzle(url):
inspectSql(db.$client)

// Prisma: only with @prisma/adapter-pg — wrap the Pool, then pass it to PrismaPg
const pool = inspectSql(new Pool({ connectionString }))
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
```

Default Prisma Client (no driver adapter) does not go through `pg` and will not be captured.

Postgres-compatible `.query` clients use `/node-postgres` (Neon Pool, Vercel createPool, Netlify `db.pool`, PGlite). Neon HTTP `neon()`, Bun `SQL`, TiDB serverless, sync SQLite (`better-sqlite3`) are **not** supported. Full list: project `docs/usage.md` Compatibility section.

Wrapping a pg Pool also records `pool.connect()` / checked-out `client.query`. Wrapping a mysql2 pool also records `getConnection()`. Do not auto-patch. Call once at pool/client creation. When the module is disabled (production), the same imports resolve to a no-op `inspectSql`.

## Open

`http://localhost:3000/__sql_queries` in development only.

## Options

`sqlInspector.enabled` (default: `nuxt.options.dev`), `forceEnableInProduction` (required with `enabled` outside dev), `path`, `apiBase`, `maxRequests` (default 200, max 1000), `redactParams` (default true), optional `include` / `exclude` path globs.
