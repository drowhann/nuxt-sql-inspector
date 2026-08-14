# Changelog

## Unreleased

Record SQL on checked-out pool clients (`pg` `pool.connect()`, mysql2 `pool.getConnection()`), including transactions. `pool.query` still records once (not doubled via the inner checkout).

Inspector UI: `×N` badge for duplicate SQL on a request, query waterfall (overlap vs sequential), slow highlight (50ms query / 200ms request SQL).

## 0.1.2

Remove `definePageMeta` from the inspector page (compile-time macro, not available at runtime in published `dist/`). Layout disabled via `meta: { layout: false }` in `extendPages` instead. Import `NuxtLink` explicitly from `#components`.

## 0.1.1

Fix runtime errors in published `dist/` when auto-imports are unavailable in `node_modules`:

- Server: explicit `h3` and `nitropack/runtime` imports (fixes `defineEventHandler is not defined`, etc.)
- App page: explicit `vue` and `nuxt/app` imports (fixes `onMounted is not defined`)
- App middleware: explicit `h3` and `nuxt/app` imports

## 0.1.0

Initial release.

- Dev-only Nuxt module: API/server requests + SQL at `/__sql_queries` and a Nuxt DevTools tab
- Drivers: `pg` / node-postgres, `postgres.js`, `mysql2`, `@libsql/client` (optional peers; noop when disabled)
- Postgres-compatible clients via `/node-postgres` (Neon Pool, Vercel createPool, Netlify pool, PGlite, etc.)
- Bind param redaction by default (`redactParams`); route `include` / `exclude`; request filters and sort in the UI
- Production requires both `enabled` and `forceEnableInProduction` (not recommended)
