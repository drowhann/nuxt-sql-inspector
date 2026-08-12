const STATIC_EXT = /\.\w{1,8}$/

/**
 * Track any request except inspector UI/API, Nuxt internals, and static assets.
 * Empty (no-SQL) requests stay invisible via the store’s pending promotion.
 */
export function shouldMonitor(path: string, apiBase: string, uiPath: string) {
  if (path === apiBase || path.startsWith(`${apiBase}/`)) return false
  if (path === uiPath || path.startsWith(`${uiPath}/`)) return false
  if (
    path.startsWith('/_nuxt')
    || path.startsWith('/__nuxt')
    || path.startsWith('/_ipx')
    || path.startsWith('/__vite')
  ) {
    return false
  }
  if (STATIC_EXT.test(path)) return false
  return true
}
