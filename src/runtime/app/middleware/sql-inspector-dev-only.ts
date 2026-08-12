export default defineNuxtRouteMiddleware((to) => {
  const cfg = useRuntimeConfig().public.sqlInspector as {
    path?: string
    allowAccess?: boolean
  } | undefined
  const path = cfg?.path || '/__sql_queries'
  if (to.path !== path) return
  if (cfg?.allowAccess === true || import.meta.dev) return
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
