<script setup lang="ts">
const name = ref('Ada Lovelace')
const email = ref('ada@example.com')
const result = ref('')
const busy = ref(false)

const pgExamples = [
  { id: 'pg-pool', label: 'pg Pool + client' },
  { id: 'pg-client', label: 'pg Client + client' },
  { id: 'pg-url', label: 'pg drizzle(url)' },
  { id: 'pg-connection', label: 'pg drizzle({ connection })' },
  { id: 'postgresjs-client', label: 'postgres.js + client' },
  { id: 'postgresjs-url', label: 'postgres.js drizzle(url)' },
  { id: 'postgresjs-connection', label: 'postgres.js drizzle({ connection })' },
]

const mysqlExamples = [
  { id: 'mysql-pool', label: 'mysql2 Pool + client' },
  { id: 'mysql-connection', label: 'mysql2 Connection + client' },
  { id: 'mysql-checkout', label: 'mysql2 getConnection()' },
]

const libsqlExamples = [
  { id: 'libsql-client', label: 'libsql createClient + client' },
  { id: 'libsql-url', label: 'libsql drizzle(url)' },
  { id: 'libsql-batch', label: 'libsql batch()' },
]

const betterSqliteExamples = [
  { id: 'better-sqlite3-client', label: 'better-sqlite3 + client' },
  { id: 'better-sqlite3-path', label: 'better-sqlite3 drizzle(path)' },
]

const db0Examples = [
  { id: 'db0', label: 'db0 createDatabase + sql' },
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

function runInspectorDemo(kind: string) {
  return call(`/api/demo/${kind}`)
}
</script>

<template>
  <main style="font-family: ui-monospace, monospace; max-width: 820px; margin: 2rem auto; padding: 0 1rem;">
    <h1>Nuxt SQL Inspector Demo</h1>
    <p>
      Demo APIs for every first-class wrap:
      <code>pg</code> / <code>postgres.js</code>, <code>mysql2</code>,
      <code>@libsql/client</code>, <code>better-sqlite3</code>, and <code>db0</code>.
      Open the inspector at
      <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink>.
      SSR test:
      <NuxtLink to="/ssr-demo">/ssr-demo</NuxtLink>
      · non-api route:
      <a href="/server-demo">/server-demo</a>
      (inspector lists routes only once they run SQL).
    </p>

    <h2>Users (useDb / pg Pool)</h2>
    <p style="color: #555; font-size: 0.9rem;">
      Needs <code>DATABASE_URL</code> (Postgres).
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

    <h2>Inspector checks</h2>
    <p style="color: #555; font-size: 0.9rem;">
      Postgres-only (<code>pg_sleep</code>). Open
      <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink>
      first, then hit these. Use
      <code>pnpm dev:src</code>
      so the playground loads this checkout’s inspector UI (not published
      <code>dist/</code>).
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button :disabled="busy" @click="runInspectorDemo('n-plus-one')">
        N+1 (×4 same SELECT)
      </button>
      <button :disabled="busy" @click="runInspectorDemo('parallel')">
        Parallel (overlap)
      </button>
      <button :disabled="busy" @click="runInspectorDemo('sequential')">
        Sequential (stepped)
      </button>
      <button :disabled="busy" @click="runInspectorDemo('slow')">
        Slow (SQL ≥200ms)
      </button>
    </div>

    <h2>useDb* configurations</h2>
    <p style="color: #555; font-size: 0.9rem;">
      Each button runs <code>select 1</code> through that setup.
      Then check <NuxtLink to="/__sql_queries">/__sql_queries</NuxtLink> for SQL on that request.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button :disabled="busy" @click="runAllDbExamples">
        Run all useDb* (GET /api/db-examples)
      </button>
    </div>

    <h3>Postgres (<code>pg</code> / postgres.js)</h3>
    <p style="color: #555; font-size: 0.9rem;">Needs <code>DATABASE_URL</code>.</p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button
        v-for="ex in pgExamples"
        :key="ex.id"
        :disabled="busy"
        @click="runDbExample(ex.id)"
      >
        {{ ex.label }}
      </button>
    </div>

    <h3>mysql2</h3>
    <p style="color: #555; font-size: 0.9rem;">
      Needs <code>MYSQL_DATABASE_URL</code>. Buttons return an error if it is unset.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button
        v-for="ex in mysqlExamples"
        :key="ex.id"
        :disabled="busy"
        @click="runDbExample(ex.id)"
      >
        {{ ex.label }}
      </button>
    </div>

    <h3>libSQL / SQLite</h3>
    <p style="color: #555; font-size: 0.9rem;">
      File DB under <code>playground/.data</code> (no extra service). Override with
      <code>LIBSQL_URL</code>.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button
        v-for="ex in libsqlExamples"
        :key="ex.id"
        :disabled="busy"
        @click="runDbExample(ex.id)"
      >
        {{ ex.label }}
      </button>
    </div>

    <h3>better-sqlite3</h3>
    <p style="color: #555; font-size: 0.9rem;">
      File DB under <code>playground/.data</code>. Wrap the Database, not db0, on the same client.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button
        v-for="ex in betterSqliteExamples"
        :key="ex.id"
        :disabled="busy"
        @click="runDbExample(ex.id)"
      >
        {{ ex.label }}
      </button>
    </div>

    <h3>db0 (Nitro <code>useDatabase</code>)</h3>
    <p style="color: #555; font-size: 0.9rem;">
      <code>createDatabase</code> + better-sqlite3 connector. Wrap the db0 Database
      (<code>nuxt-sql-inspector/db0</code>), not the inner sqlite instance.
    </p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0;">
      <button
        v-for="ex in db0Examples"
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
