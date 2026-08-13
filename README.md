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

Open `/__sql_queries` in development, or the **SQL** tab in Nuxt DevTools when DevTools is enabled. Bind params are redacted by default (`redactParams: false` to show raw values).

- [Installation](docs/installation.md)
- [Usage](docs/usage.md) (drivers, ORMs, [compatibility](docs/usage.md#compatibility))
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Security](SECURITY.md)
- [License](LICENSE) (MIT)

## Security

This module is meant for **local development**.

- **Off in production by default.** Outside `nuxt.options.dev`, both `sqlInspector.enabled: true` and `sqlInspector.forceEnableInProduction: true` are required. Do not turn those on for a public or shared deployment.
- **No authentication.** When enabled, the UI and APIs (`/api/__sql_queries` snapshot, SSE stream, and clear) only check that the inspector is on (otherwise 404). Anyone who can reach the app can read captured request/SQL metadata and clear logs.
- **Params are redacted by default** (`redactParams: true` stores type/length only). SQL text itself may still contain sensitive literals if your app embeds them in queries.
- Treat an enabled inspector like an open debug console: fine on localhost, unsafe on the internet.

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## Local development

Point `DATABASE_URL` at a local Postgres (see `playground/.env.example`), then:

```bash
pnpm install
pnpm dev
```

`pnpm dev` pushes the playground schema and starts Nuxt.

Playground: http://localhost:3000 — inspector: http://localhost:3000/__sql_queries

The Cursor agent skill under [`skills/nuxt-sql-inspector`](skills/nuxt-sql-inspector/SKILL.md) lives in this GitHub repo (it is not part of the npm package `files` list).
