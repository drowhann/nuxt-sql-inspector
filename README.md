# SQL Inspector (Nuxt module)

Dev-only Nuxt module that shows API requests and their PostgreSQL queries at `/__sql_queries`.

This repo is a **demo app** that consumes the local module at [`modules/sql-inspector`](modules/sql-inspector).

## Use in this demo

```bash
docker compose up -d
cp .env.example .env
pnpm install
pnpm db:push   # apply schema yourself when the DB is empty
pnpm dev
```

- App: http://localhost:3000  
- Inspector: http://localhost:3000/__sql_queries  

Demo DB wiring calls the public API:

```ts
import { instrumentSqlInspector } from '#sql-inspector'
pool = instrumentSqlInspector(new Pool({ connectionString }))
```

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

3. Instrument your `pg` pool **once** when you create it (required — the module does not auto-patch):

```ts
import { Pool } from 'pg'
import { instrumentSqlInspector } from '#sql-inspector'

export const pool = instrumentSqlInspector(
  new Pool({ connectionString: process.env.DATABASE_URL }),
)
```

4. Open `/__sql_queries` in development.

Requires **`pg`**. Works with Drizzle (`drizzle-orm/node-postgres`) because instrumentation patches `Client.prototype.query`.

## Scripts

- `pnpm dev` — demo + inspector
- `pnpm db:push` — push Drizzle schema
- `pnpm self-check` — ring-buffer assert
