import { dbExamples } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const example = dbExamples.find(e => e.id === id)
  if (!example) {
    throw createError({
      statusCode: 404,
      statusMessage: `Unknown db example: ${id}. Try: ${dbExamples.map(e => e.id).join(', ')}`,
    })
  }

  const n = await example.run()

  return {
    id: example.id,
    label: example.label,
    dialect: example.dialect,
    ok: true,
    n,
    hint: 'Check /__sql_queries for this request’s SQL.',
  }
})
