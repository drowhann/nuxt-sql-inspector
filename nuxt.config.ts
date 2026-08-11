// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Local module under modules/sql-inspector is auto-registered.
  // For another project: modules: ['/absolute/or/relative/path/to/modules/sql-inspector']
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sql_inspector',
  },
  sqlInspector: {
    // enabled defaults to nuxt.options.dev
  },
})
