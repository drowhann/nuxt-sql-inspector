import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
  },
  dirs: {
    src: ['./playground'],
  },
}).append({
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
  },
}).append({
  files: ['**/pages/**'],
  rules: {
    'vue/multi-word-component-names': 'off',
  },
}).append({
  // Published dist/ has no Nuxt auto-imports — catch bare globals in module runtime source.
  files: ['src/runtime/**/*.{ts,vue}'],
  rules: {
    'no-restricted-globals': ['error',
      { name: 'defineEventHandler', message: 'Import from h3 (published dist has no auto-imports).' },
      { name: 'createError', message: 'Import from h3 or nuxt/app.' },
      { name: 'createEventStream', message: 'Import from h3.' },
      { name: 'readBody', message: 'Import from h3.' },
      { name: 'getRouterParam', message: 'Import from h3.' },
      { name: 'setResponseStatus', message: 'Import from h3.' },
      { name: 'defineNitroPlugin', message: 'Import from nitropack/runtime.' },
      { name: 'useRuntimeConfig', message: 'Import from nitropack/runtime or nuxt/app.' },
      { name: 'useEvent', message: 'Import from nitropack/runtime.' },
      { name: 'definePageMeta', message: 'Use extendPages meta in module.ts (compile-time macro).' },
      { name: 'defineNuxtRouteMiddleware', message: 'Import from nuxt/app.' },
      { name: 'ref', message: 'Import from vue.' },
      { name: 'computed', message: 'Import from vue.' },
      { name: 'onMounted', message: 'Import from vue.' },
      { name: 'onBeforeUnmount', message: 'Import from vue.' },
      { name: 'watch', message: 'Import from vue.' },
      { name: 'watchEffect', message: 'Import from vue.' },
    ],
  },
})
