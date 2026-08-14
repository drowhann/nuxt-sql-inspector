// ponytail: default loads published dist (same as npm); use `pnpm dev:src` for src/module iteration
const moduleEntry = process.env.NUXT_SQL_INSPECTOR_SRC === '1'
  ? '../src/module'
  : '../dist/module'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: [moduleEntry],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },
  sqlInspector: {},
})
