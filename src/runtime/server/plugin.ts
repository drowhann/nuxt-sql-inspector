import { randomUUID } from 'node:crypto'
import { defineNitroPlugin } from 'nitropack/runtime'
import { requestAls } from './utils/context'
import { getSqlInspectorConfig, isSqlInspectorEnabled } from './utils/enabled'
import { finishRequest, startRequest } from './utils/store'

function normalizePath(path: string) {
  const q = path.indexOf('?')
  return q === -1 ? path : path.slice(0, q)
}

function shouldMonitor(path: string, apiBase: string) {
  if (!path.startsWith('/api/')) return false
  if (path === apiBase || path.startsWith(`${apiBase}/`)) return false
  return true
}

export default defineNitroPlugin((nitroApp) => {
  if (!isSqlInspectorEnabled()) return

  nitroApp.hooks.hook('request', (event) => {
    const { apiBase = '/api/__sql_queries' } = getSqlInspectorConfig()
    const path = normalizePath(event.path || '/')
    if (!shouldMonitor(path, apiBase)) return

    const requestId = randomUUID()
    const startedAt = Date.now()
    const startedPerf = performance.now()

    event.context.sqlInspector = {
      requestId,
      startedAt,
      startedPerf,
    }

    requestAls.enterWith({ requestId })

    startRequest({
      id: requestId,
      method: event.method || 'GET',
      path,
      startedAt,
    })
  })

  function finalize(event: any, fallbackStatus: number) {
    const ctx = event.context.sqlInspector as
      | { requestId: string; startedPerf: number; finished?: boolean }
      | undefined
    if (!ctx?.requestId || ctx.finished) return
    ctx.finished = true
    const statusCode = event.node?.res?.statusCode || fallbackStatus
    finishRequest({
      id: ctx.requestId,
      statusCode,
      durationMs: performance.now() - ctx.startedPerf,
    })
  }

  nitroApp.hooks.hook('beforeResponse', (event) => {
    finalize(event, 200)
  })

  nitroApp.hooks.hook('error', (_error, { event }) => {
    if (!event) return
    finalize(event, 500)
  })
})
