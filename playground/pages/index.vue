<script setup lang="ts">
const name = ref('Ada Lovelace')
const email = ref('ada@example.com')
const result = ref('')
const busy = ref(false)

const examples = [
  { id: 'pg-pool', label: 'pg Pool + client' },
  { id: 'pg-client', label: 'pg Client + client' },
  { id: 'pg-url', label: 'pg drizzle(url)' },
  { id: 'pg-connection', label: 'pg drizzle({ connection })' },
  { id: 'postgresjs-client', label: 'postgres.js + client' },
  { id: 'postgresjs-url', label: 'postgres.js drizzle(url)' },
  { id: 'postgresjs-connection', label: 'postgres.js drizzle({ connection })' },
]

async function call(path: string, init?: RequestInit) {
  busy.value = true
  try {
    const res = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      ...init,
    })
    const body = await res.json().catch(() => ({}))
    result.value = `${res.status} ${path}\n${JSON.stringify(body, null, 2)}`
  } catch (err: any) {
    result.value = String(err?.message || err)
  } finally {
    busy.value = false
  }
}

function listUsers() {
  return call('/api/users')
}

function getUser() {
  return call('/api/users/1')
}

function createUser() {
  return call('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: name.value, email: email.value }),
  })
}

function runAllDbExamples() {
  return call('/api/db-examples')
}

function runDbExample(id: string) {
  return call(`/api/db-examples/${id}`)
}
</script>

<template>
  <main style="font-family: ui-monospace, monospace; max-width: 820px; margin: 2rem auto; padding: 0 1rem;">
    <h1>Nuxt SQL Inspector Demo</h1>
    <p>
      Demo APIs that hit PostgreSQL via Drizzle.
      Open the inspector at
      <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink>.
      SSR test:
      <NuxtLink to="/ssr-demo">/ssr-demo</NuxtLink>
      · non-api route:
      <a href="/server-demo">/server-demo</a>
      (inspector lists routes only once they run SQL).
    </p>

    <h2>Users (useDb / pg Pool)</h2>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button :disabled="busy" @click="listUsers">GET /api/users</button>
      <button :disabled="busy" @click="getUser">GET /api/users/1</button>
    </div>

    <form style="display: grid; gap: 0.5rem; margin: 1rem 0;" @submit.prevent="createUser">
      <label>
        name
        <input v-model="name" required>
      </label>
      <label>
        email
        <input v-model="email" type="email" required>
      </label>
      <button :disabled="busy" type="submit">POST /api/users</button>
    </form>

    <h2>useDb* configurations</h2>
    <p style="color: #555; font-size: 0.9rem;">
      Each button runs <code>select 1</code> through that setup.
      Then check <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink> for SQL on that request.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button :disabled="busy" @click="runAllDbExamples">
        Run all useDb* (GET /api/db-examples)
      </button>
      <button
        v-for="ex in examples"
        :key="ex.id"
        :disabled="busy"
        @click="runDbExample(ex.id)"
      >
        {{ ex.label }}
      </button>
    </div>

    <pre v-if="result" style="background: #111; color: #ddd; padding: 1rem; overflow: auto;">{{ result }}</pre>
  </main>
</template>
