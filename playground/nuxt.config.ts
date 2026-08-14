// ponytail: default loads published dist (same as npm); use `pnpm dev:src` for src/module iteration
const moduleEntry = process.env.NUXT_SQL_INSPECTOR_SRC === '1'
  ? '../src/module'
  : '../dist/module'

export default defineNuxtConfig({
  // Nuxt 4 behavior (works on Nuxt 3 and Nuxt 4)
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [moduleEntry],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    mysqlDatabaseUrl: process.env.MYSQL_DATABASE_URL,
    libsqlUrl: process.env.LIBSQL_URL,
  },
  sqlInspector: {},
})
