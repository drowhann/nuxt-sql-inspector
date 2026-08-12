# Usage

Call `instrumentSqlInspector` **once** when you create the driver client. The module does not auto-patch.

Then open `/__sql_queries` in development.

## node-postgres

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { instrumentSqlInspector } from '#sql-inspector'

const pool = instrumentSqlInspector(new Pool({ connectionString: process.env.DATABASE_URL }))
const db = drizzle({ client: pool })

// drizzle created the pool:
const db2 = drizzle(process.env.DATABASE_URL!)
instrumentSqlInspector(db2.$client)
```

## postgres.js

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { instrumentSqlInspector } from '#sql-inspector'

const sql = instrumentSqlInspector(postgres(process.env.DATABASE_URL!))
const db = drizzle({ client: sql })

const db2 = drizzle(process.env.DATABASE_URL!)
instrumentSqlInspector(db2.$client)
```

`#sql-inspector` is a Nitro alias registered by the module. It is available in server code only.
