export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['../src/module'],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },
  sqlInspector: {},
})
