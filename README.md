# SQL Inspector (Nuxt module)

Dev-only Nuxt module that shows API requests and their PostgreSQL queries at `/__sql_queries`.

This repo is a **demo app** that consumes the local module at [`modules/sql-inspector`](modules/sql-inspector).

## Use in this demo

```bash
docker compose up -d
cp .env.example .env
pnpm install
# apply schema when the DB is empty, e.g. drizzle-kit push
pnpm dev
```

- App: http://localhost:3000  
- Inspector: http://localhost:3000/__sql_queries  

## Use in any Nuxt project

1. Copy `modules/sql-inspector` into the target project (or point at it by path).

2. Register the module (local `modules/` is auto-registered; otherwise):

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['~/modules/sql-inspector'],
  sqlInspector: {
    // enabled: true,              // default: nuxt.options.dev
    // path: '/__sql_queries',
    // apiBase: '/api/__sql_queries',
    // maxRequests: 200,
  },
})
```

3. Wrap your driver client **once** with `instrumentSqlInspector` (required — the module does not auto-patch).

### node-postgres ([Drizzle docs](https://orm.drizzle.team/docs/get-started-postgresql))

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { instrumentSqlInspector } from '#sql-inspector'

// Pool / Client
const pool = instrumentSqlInspector(new Pool({ connectionString: process.env.DATABASE_URL }))
const db = drizzle({ client: pool })

// Or drizzle created the pool internally:
const db2 = drizzle(process.env.DATABASE_URL!)
instrumentSqlInspector(db2.$client)
```

### postgres.js ([Drizzle docs](https://orm.drizzle.team/docs/get-started-postgresql#postgresjs))

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { instrumentSqlInspector } from '#sql-inspector'

const sql = instrumentSqlInspector(postgres(process.env.DATABASE_URL!))
const db = drizzle({ client: sql })

// Or drizzle created the client internally:
const db2 = drizzle(process.env.DATABASE_URL!)
instrumentSqlInspector(db2.$client)
```

`postgres` is **optional** — only needed if you use postgres.js. `pg` is needed for the node-postgres path.

4. Open `/__sql_queries` in development.

### Try every `useDb*` config

With the demo running:

- `GET /api/db-examples` — runs all configurations in one request
- `GET /api/db-examples/:id` — one config (`pg-pool`, `pg-client`, `pg-url`, `pg-connection`, `postgresjs-client`, `postgresjs-url`, `postgresjs-connection`)
- Home page buttons for each

Defined in [`server/utils/db.ts`](server/utils/db.ts): `useDbPgPool`, `useDbPgClient`, `useDbPgUrl`, `useDbPgConnection`, `useDbPostgresJs`, `useDbPostgresJsUrl`, `useDbPostgresJsConnection` (`useDb` aliases the Pool setup for `/api/users`).
