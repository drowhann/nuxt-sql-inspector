# Usage

The inspector wraps **SQL drivers** (`pg`, `postgres.js`, `mysql2`, `@libsql/client`), not a specific ORM. Call `inspectSql` **once** when you create the pool or client. Import it from the subpath that matches the driver. The module does not auto-patch.

Then open `/__sql_queries` in development, or the **SQL** tab in Nuxt DevTools when DevTools is enabled. Any server request can be tracked (`/api/**`, `server/routes/*`, etc.); it only appears in the list after at least one SQL query (so empty page renders stay hidden). Limit paths with `sqlInspector.include` / `exclude` (see [installation](./installation.md)). Params are redacted by default. In the playground, try `/ssr-demo` (SSR → `/api/users`) or `GET /server-demo`.

Driver subpaths (`node-postgres`, `postgres-js`, `mysql2`, `libsql`) are aliased by the module (and match the package exports). Server-only. When the inspector is disabled, those aliases resolve to a no-op `inspectSql`.

## Compatibility

If SQL goes through a wrapped driver method below, it shows up; otherwise it does not.

### Supported

| Stack | How to wrap |
| --- | --- |
| `pg` Pool / Client | `inspectSql` from `nuxt-sql-inspector/node-postgres` |
| `postgres` (postgres.js) | `inspectSql` from `nuxt-sql-inspector/postgres-js` |
| `mysql2` pool / connection | `inspectSql` from `nuxt-sql-inspector/mysql2` (`.query` + `.execute`) |
| `@libsql/client` (local SQLite + Turso) | `inspectSql` from `nuxt-sql-inspector/libsql` (`.execute` + `.batch`) |
| Neon `@neondatabase/serverless` **Pool / Client** (WebSocket) | same as `pg` → `/node-postgres` |
| `@vercel/postgres` **`createPool` / `createClient`** | wrap the pool/client → `/node-postgres` |
| `@netlify/database` **`db.pool`** (or `pg.Pool` from `getConnectionString()`) | wrap that pool → `/node-postgres` |
| `@electric-sql/pglite` | wrap the `PGlite` instance → `/node-postgres` (has `.query`) |
| `@effect/sql-pg` | only if you inject a wrapped `pg` Pool/client into Effect |
| Drizzle on `pg`, `postgres.js`, `mysql2`, or libsql | wrap the underlying client / `$client` |
| Prisma with `@prisma/adapter-pg` | wrap the `Pool`, then pass it to `PrismaPg` |
| Other ORMs with an injectable supported driver client | wrap that underlying client |

Turso-branded packages that re-export / use `@libsql/client` the same way: wrap that client with `/libsql`.

### Not supported

| Stack | Why |
| --- | --- |
| Neon HTTP `neon()` / tagged `sql` from `@neondatabase/serverless` | not the `pg` `.query` API |
| `@vercel/postgres` **`sql` tagged** alone (without a wrapped pool) | prefer `inspectSql(createPool(…))` and query through that pool |
| Default Prisma Client (no driver adapter) | own engine; does not use `pg` |
| `@effect/sql-pg` with connection string only (Effect owns the pool) | no injectable client to wrap |
| Supabase JS client | PostgREST / HTTP, not a SQL driver |
| `@tidbcloud/serverless` | MySQL-over-HTTP `.execute` — not the mysql2 socket API |
| Bun `SQL` (Postgres / MySQL / SQLite) | native tagged API — not wrapped yet |
| `@aws-sdk/client-rds-data` | Data API HTTP, not a SQL socket driver |
| `@sqlitecloud/drivers` | different driver API — not wrapped yet |
| `better-sqlite3` / `bun:sqlite` / other sync SQLite | sync `prepare` / `run` / `get` — not wrapped yet |

## node-postgres (raw)

```ts
import { Pool, Client } from 'pg'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const pool = inspectSql(new Pool({ connectionString: process.env.DATABASE_URL }))
const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [1])

// or a single Client:
const client = inspectSql(new Client({ connectionString: process.env.DATABASE_URL }))
await client.connect()
```

### Postgres-compatible clients

Same `/node-postgres` wrap whenever the client exposes pg-style `.query`:

```ts
import { Pool } from '@neondatabase/serverless'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const pool = inspectSql(new Pool({ connectionString: process.env.DATABASE_URL }))
```

```ts
import { createPool } from '@vercel/postgres'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const pool = inspectSql(createPool({ connectionString: process.env.POSTGRES_URL }))
```

```ts
import { getDatabase } from '@netlify/database'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const db = getDatabase()
inspectSql(db.pool)
```

```ts
import { PGlite } from '@electric-sql/pglite'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const db = inspectSql(new PGlite())
await db.query('SELECT 1')
```

## postgres.js (raw)

```ts
import postgres from 'postgres'
import { inspectSql } from 'nuxt-sql-inspector/postgres-js'

const sql = inspectSql(postgres(process.env.DATABASE_URL!))
const rows = await sql`SELECT * FROM users WHERE id = ${1}`
```

## Drizzle

Wrap the underlying driver client (or `db.$client` when Drizzle created it):

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const pool = inspectSql(new Pool({ connectionString: process.env.DATABASE_URL }))
const db = drizzle({ client: pool })

// drizzle created the pool:
const db2 = drizzle(process.env.DATABASE_URL!)
inspectSql(db2.$client)
```

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { inspectSql } from 'nuxt-sql-inspector/postgres-js'

const sql = inspectSql(postgres(process.env.DATABASE_URL!))
const db = drizzle({ client: sql })

const db2 = drizzle(process.env.DATABASE_URL!)
inspectSql(db2.$client)
```

## Prisma

Default Prisma Client uses its own engine and does **not** go through `pg`, so queries are not captured. Use a **driver adapter** and wrap the pool first:

```ts
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { inspectSql } from 'nuxt-sql-inspector/node-postgres'

const pool = inspectSql(new Pool({ connectionString: process.env.DATABASE_URL }))
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
```

## mysql2

```ts
import mysql from 'mysql2/promise'
import { inspectSql } from 'nuxt-sql-inspector/mysql2'

const pool = inspectSql(mysql.createPool({ uri: process.env.DATABASE_URL }))
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [1])
```

## libSQL / Turso

```ts
import { createClient } from '@libsql/client'
import { inspectSql } from 'nuxt-sql-inspector/libsql'

const db = inspectSql(createClient({ url: process.env.LIBSQL_URL! }))
await db.execute('SELECT * FROM users WHERE id = ?', [1])
```
