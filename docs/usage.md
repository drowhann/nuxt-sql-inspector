# Usage

Call `inspectSql` **once** when you create the driver client. Import it from the subpath that matches the driver. The module does not auto-patch.

Then open `/__sql_queries` in development, or the **SQL** tab in Nuxt DevTools when DevTools is enabled. Any server request can be tracked (`/api/**`, `server/routes/*`, etc.); it only appears in the list after at least one SQL query (so empty page renders stay hidden). In the playground, try `/ssr-demo` (SSR → `/api/users`) or `GET /server-demo`.

## node-postgres

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

## postgres.js

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { inspectSql } from 'nuxt-sql-inspector/postgres-js'

const sql = inspectSql(postgres(process.env.DATABASE_URL!))
const db = drizzle({ client: sql })

const db2 = drizzle(process.env.DATABASE_URL!)
inspectSql(db2.$client)
```

`nuxt-sql-inspector/node-postgres` and `nuxt-sql-inspector/postgres-js` are aliased by the module (and match the package exports). Server-only. When the inspector is disabled, those aliases resolve to a no-op `inspectSql`.
