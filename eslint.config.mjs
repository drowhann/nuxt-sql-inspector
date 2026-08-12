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
})
