import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestAlsStore = {
  requestId: string
}

const ALS_KEY = '__nuxt_sql_inspector_als__'
const g = globalThis as typeof globalThis & {
  [ALS_KEY]?: AsyncLocalStorage<RequestAlsStore>
}

export const requestAls = g[ALS_KEY] ?? (g[ALS_KEY] = new AsyncLocalStorage<RequestAlsStore>())

export function getCurrentRequestId(): string | null {
  try {
    const event = useEvent()
    const ctx = event.context.sqlInspector as { requestId?: string } | undefined
    if (ctx?.requestId) return ctx.requestId
  } catch {
    // outside request event
  }

  return requestAls.getStore()?.requestId ?? null
}
