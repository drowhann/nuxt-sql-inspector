import { users } from '../../utils/schema'
import { useDb } from '../../utils/db'

type Body = {
  name?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  if (!body?.name || !body?.email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'name and email are required',
    })
  }

  const db = useDb()
  const [created] = await db
    .insert(users)
    .values({ name: body.name, email: body.email })
    .returning()

  setResponseStatus(event, 201)
  return { user: created }
})
