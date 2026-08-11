export default defineNuxtRouteMiddleware((to) => {
  const cfg = useRuntimeConfig().public.sqlInspector as { path?: string } | undefined
  const path = cfg?.path || '/__sql_queries'
  if (to.path !== path) return
  if (import.meta.dev) return
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
})
