<script setup lang="ts">
const name = ref('Ada Lovelace')
const email = ref('ada@example.com')
const result = ref('')
const busy = ref(false)

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
</script>

<template>
  <main style="font-family: ui-monospace, monospace; max-width: 720px; margin: 2rem auto; padding: 0 1rem;">
    <h1>SQL Inspector POC</h1>
    <p>
      Demo APIs that hit PostgreSQL via Drizzle.
      Open the inspector at
      <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink>.
    </p>

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

    <pre v-if="result" style="background: #111; color: #ddd; padding: 1rem; overflow: auto;">{{ result }}</pre>
  </main>
</template>
