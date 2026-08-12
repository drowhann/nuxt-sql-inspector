import { randomUUID } from 'node:crypto'
import { defineNitroPlugin } from 'nitropack/runtime'
import { requestAls } from './utils/context'
import { getSqlInspectorConfig, isSqlInspectorEnabled } from './utils/enabled'
import { shouldMonitor } from './utils/should-monitor'
import { finishRequest, trackRequest } from './utils/store'

function normalizePath(path: string) {
  const q = path.indexOf('?')
  return q === -1 ? path : path.slice(0, q)
}

export default defineNitroPlugin((nitroApp) => {
  if (!isSqlInspectorEnabled()) return

  nitroApp.hooks.hook('request', (event) => {
    const {
      apiBase = '/api/__sql_queries',
      path: uiPath = '/__sql_queries',
      include,
      exclude,
    } = getSqlInspectorConfig()
    const path = normalizePath(event.path || '/')
    if (!shouldMonitor(path, { apiBase, uiPath, include, exclude })) return

    const requestId = randomUUID()
    const startedAt = Date.now()
    const startedPerf = performance.now()

    event.context.sqlInspector = {
      requestId,
      startedAt,
      startedPerf,
    }

    requestAls.enterWith({ requestId })

    trackRequest({
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
