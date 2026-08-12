export default defineNuxtConfig({
  modules: ['../../../src/module'],
  sqlInspector: {
    enabled: true,
    // Fixture builds without nuxt.options.dev — escape hatch required.
    forceEnableInProduction: true,
  },
})
