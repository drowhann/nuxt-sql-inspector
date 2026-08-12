const STATIC_EXT = /\.\w{1,8}$/

export type MonitorRules = {
  apiBase: string
  uiPath: string
  include?: string[]
  exclude?: string[]
}

/** Simple path glob: `*` = one segment, `**` = any depth. */
export function matchPath(path: string, pattern: string): boolean {
  const normPath = path.replace(/\/+$/, '') || '/'
  const normPat = pattern.replace(/\/+$/, '') || '/'
  const escape = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const re = escape(normPat)
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
  return new RegExp(`^${re}$`).test(normPath)
}

function matchesAny(path: string, patterns: string[] | undefined): boolean {
  if (!patterns?.length) return false
  return patterns.some((p) => matchPath(path, p))
}

/**
 * Built-in denylist, then user `exclude`, then optional `include`.
 * Empty `include` → all paths allowed (minus denylist/exclude).
 */
export function shouldMonitor(path: string, rules: MonitorRules): boolean {
  const { apiBase, uiPath, include, exclude } = rules
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
  if (matchesAny(path, exclude)) return false
  if (include?.length) return matchesAny(path, include)
  return true
}
