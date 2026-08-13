# Changelog

## 0.1.0

Initial release.

- Dev-only Nuxt module: API/server requests + SQL at `/__sql_queries` and a Nuxt DevTools tab
- Drivers: `pg` / node-postgres, `postgres.js`, `mysql2`, `@libsql/client` (optional peers; noop when disabled)
- Postgres-compatible clients via `/node-postgres` (Neon Pool, Vercel createPool, Netlify pool, PGlite, etc.)
- Bind param redaction by default (`redactParams`); route `include` / `exclude`; request filters and sort in the UI
- Production requires both `enabled` and `forceEnableInProduction` (not recommended)
