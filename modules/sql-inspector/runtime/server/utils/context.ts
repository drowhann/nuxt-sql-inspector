import { AsyncLocalStorage } from 'node:async_hooks'

export type RequestAlsStore = {
  requestId: string
}

export const requestAls = new AsyncLocalStorage<RequestAlsStore>()

export function getCurrentRequestId(): string | null {
  const fromAls = requestAls.getStore()?.requestId
  if (fromAls) return fromAls

  try {
    const event = useEvent()
    const ctx = event.context.sqlInspector as { requestId?: string } | undefined
    return ctx?.requestId ?? null
  } catch {
    return null
  }
}
