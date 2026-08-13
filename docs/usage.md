# Usage

The inspector wraps the **PostgreSQL drivers** (`pg` / node-postgres and `postgres.js`), not a specific ORM. Call `inspectSql` **once** when you create the pool or client. Import it from the subpath that matches the driver. The module does not auto-patch.

Then open `/__sql_queries` in development, or the **SQL** tab in Nuxt DevTools when DevTools is enabled. Any server request can be tracked (`/api/**`, `server/routes/*`, etc.); it only appears in the list after at least one SQL query (so empty page renders stay hidden). Limit paths with `sqlInspector.include` / `exclude` (see [installation](./installation.md)). Params are redacted by default. In the playground, try `/ssr-demo` (SSR → `/api/users`) or `GET /server-demo`.

`nuxt-sql-inspector/node-postgres` and `nuxt-sql-inspector/postgres-js` are aliased by the module (and match the package exports). Server-only. When the inspector is disabled, those aliases resolve to a no-op `inspectSql`.

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
