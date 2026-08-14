export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['../../../dist/module'],
  sqlInspector: {
    enabled: true,
    // Fixture builds without nuxt.options.dev — escape hatch required.
    forceEnableInProduction: true,
  },
})
