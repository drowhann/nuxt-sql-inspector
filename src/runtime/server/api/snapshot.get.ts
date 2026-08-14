import { createError, defineEventHandler } from 'h3'
import { isSqlInspectorEnabled } from '../utils/enabled'
import { getSnapshot } from '../utils/store'

export default defineEventHandler(() => {
  if (!isSqlInspectorEnabled()) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  return getSnapshot()
})
