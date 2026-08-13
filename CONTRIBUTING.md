# Contributing

Thanks for helping with **nuxt-sql-inspector**.

## Setup

```bash
pnpm install
```

Requires Node 18+ and pnpm.

## Checks

```bash
pnpm lint
pnpm test
pnpm test:types
```

## Playground

Needs a local Postgres and `DATABASE_URL` (see [`playground/.env.example`](playground/.env.example)):

```bash
cp playground/.env.example playground/.env
# edit DATABASE_URL if needed
pnpm dev
```

Do **not** create or apply new Drizzle migrations unless maintainers ask — use the existing playground schema / `drizzle-kit push` via `pnpm dev`.

## Agent skill

[`skills/nuxt-sql-inspector`](skills/nuxt-sql-inspector/SKILL.md) is for Cursor and ships with the GitHub repo only (not published in the npm package `files`).

## Pull requests

- Keep diffs focused; match existing style.
- Add or update a unit test when changing inspect/store behavior.
- Update docs if you change config or driver support.
