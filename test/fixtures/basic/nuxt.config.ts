export default defineNuxtConfig({
  modules: ['../../../dist/module'],
  sqlInspector: {
    enabled: true,
    // Fixture builds without nuxt.options.dev — escape hatch required.
    forceEnableInProduction: true,
  },
})
