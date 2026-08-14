import { createError, createEventStream, defineEventHandler } from 'h3'
import { isSqlInspectorEnabled } from '../utils/enabled'
import { subscribe } from '../utils/store'
import type { InspectorBusEvent } from '../utils/types'

export default defineEventHandler(async (event) => {
  if (!isSqlInspectorEnabled()) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const stream = createEventStream(event)

  const unsubscribe = subscribe((busEvent: InspectorBusEvent) => {
    stream.push(JSON.stringify(busEvent)).catch(() => {})
  })

  stream.onClosed(() => {
    unsubscribe()
  })

  const ping = setInterval(() => {
    stream.push(JSON.stringify({ type: 'ping' })).catch(() => {})
  }, 15000)

  stream.onClosed(() => {
    clearInterval(ping)
  })

  return stream.send()
})
