# nuxt-sql-inspector

Dev-only Nuxt module that shows each API request and the PostgreSQL queries it triggered.

```bash
pnpm add -D nuxt-sql-inspector
```

```ts
export default defineNuxtConfig({
  modules: ['nuxt-sql-inspector'],
})
```

Wrap your client once:

```ts
import { instrumentSqlInspector } from '#nuxt-sql-inspector'
const pool = instrumentSqlInspector(new Pool({ connectionString }))
```

Open `/__sql_queries` in development.

- [Installation](docs/installation.md)
- [Usage](docs/usage.md) (node-postgres and postgres.js)

## Local development

Point `DATABASE_URL` at a local Postgres (see `playground/.env.example`), then:

```bash
pnpm install
pnpm dev
```

`pnpm dev` pushes the playground schema and starts Nuxt.

Playground: http://localhost:3000 — inspector: http://localhost:3000/__sql_queries
