# nuxt-sql-inspector

Dev-only Nuxt module that shows each API request and the SQL queries it triggered. Works with **`pg`** / **`postgres.js`** (and pg-compatible clients), **`mysql2`**, and **`@libsql/client`** (SQLite / Turso). See [compatibility](docs/usage.md#compatibility).

```bash
pnpm add -D nuxt-sql-inspector
```

```ts
export default defineNuxtConfig({
  modules: ['nuxt-sql-inspector'],
})
```

Wrap your client once, using the import that matches the driver:

```ts
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'
const pool = inspectSql(new Pool({ connectionString }))

import { inspectSql } from 'nuxt-sql-inspector/postgres-js'
const sql = inspectSql(postgres(process.env.DATABASE_URL!))

import { inspectSql } from 'nuxt-sql-inspector/mysql2'
const mysqlPool = inspectSql(mysql.createPool({ uri }))

import { inspectSql } from 'nuxt-sql-inspector/libsql'
const db = inspectSql(createClient({ url }))
```

Open `/__sql_queries` in development, or the **SQL** tab in Nuxt DevTools when DevTools is enabled. Production requires both `enabled: true` and `forceEnableInProduction: true` (not recommended). Bind params are redacted by default (`redactParams: false` to show raw values).

- [Installation](docs/installation.md)
- [Usage](docs/usage.md) (drivers, ORMs, [compatibility](docs/usage.md#compatibility))

## Local development

Point `DATABASE_URL` at a local Postgres (see `playground/.env.example`), then:

```bash
pnpm install
pnpm dev
```

`pnpm dev` pushes the playground schema and starts Nuxt.

Playground: http://localhost:3000 — inspector: http://localhost:3000/__sql_queries
