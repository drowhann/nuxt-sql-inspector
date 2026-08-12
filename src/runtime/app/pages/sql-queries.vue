<script setup lang="ts">
definePageMeta({ layout: false })

type SqlQueryEvent = {
  id: string
  requestId: string | null
  sql: string
  params: unknown[]
  durationMs: number
  timestamp: number
  error?: string
}

type RequestEvent = {
  id: string
  method: string
  path: string
  statusCode: number | null
  startedAt: number
  durationMs: number | null
  queries: SqlQueryEvent[]
}

type InspectorBusEvent =
  | { type: 'request:start'; request: RequestEvent }
  | { type: 'sql'; query: SqlQueryEvent }
  | { type: 'request:finish'; request: RequestEvent }
  | { type: 'cleared' }

const pub = useRuntimeConfig().public.sqlInspector as { apiBase?: string; path?: string }
const apiBase = (pub?.apiBase || '/api/__sql_queries').replace(/\/$/, '')

const requests = ref<RequestEvent[]>([])
const backgroundQueries = ref<SqlQueryEvent[]>([])
const selectedId = ref<string | null>(null)
const connected = ref(false)
const error = ref('')

const pathFilter = ref('')
const methodFilter = ref('')
const statusFilter = ref('')
type SortKey = 'request' | 'sql' | 'queries' | 'time'
const sortKey = ref<SortKey>('time')
const sortDir = ref<'asc' | 'desc'>('desc')

const selected = computed(() =>
  requests.value.find((r) => r.id === selectedId.value) || null,
)

const methodOptions = computed(() =>
  [...new Set(requests.value.map((r) => r.method))].sort(),
)

const filteredRequests = computed(() => {
  const pathQ = pathFilter.value.trim().toLowerCase()
  const method = methodFilter.value
  const status = statusFilter.value.trim()

  let list = requests.value.filter((r) => {
    if (pathQ && !r.path.toLowerCase().includes(pathQ)) return false
    if (method && r.method !== method) return false
    if (status) {
      if (r.statusCode == null) return false
      if (!String(r.statusCode).startsWith(status)) return false
    }
    return true
  })

  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    let av = 0
    let bv = 0
    if (sortKey.value === 'request') {
      av = a.durationMs ?? -1
      bv = b.durationMs ?? -1
    } else if (sortKey.value === 'sql') {
      av = sqlTotalMs(a)
      bv = sqlTotalMs(b)
    } else if (sortKey.value === 'queries') {
      av = a.queries.length
      bv = b.queries.length
    } else {
      av = a.startedAt
      bv = b.startedAt
    }
    return (av - bv) * dir
  })
})

const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|ON|INTO|VALUES|SET|ORDER|BY|GROUP|LIMIT|OFFSET|RETURNING|AS|COUNT|DISTINCT|NULL|TRUE|FALSE|ASC|DESC|IN|NOT|IS|LIKE|ILIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|WITH|UNION|ALL|CREATE|TABLE|PRIMARY|KEY|DEFAULT|SERIAL|TEXT|TIMESTAMP)\b/gi

function highlightSql(sql: string) {
  const escaped = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(SQL_KEYWORDS, (m) => `<span class="kw">${m}</span>`)
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

function formatMs(ms: number | null) {
  if (ms == null) return '…'
  return `${ms.toFixed(1)}ms`
}

function sqlTotalMs(req: RequestEvent) {
  return req.queries.reduce((sum, q) => sum + q.durationMs, 0)
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function sortMark(key: SortKey) {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

function upsertRequest(req: RequestEvent) {
  const idx = requests.value.findIndex((r) => r.id === req.id)
  if (idx === -1) {
    requests.value.unshift(req)
  } else {
    requests.value[idx] = req
  }
}

function applyBusEvent(event: InspectorBusEvent | { type: 'ping' }) {
  if (event.type === 'ping') return
  if (event.type === 'cleared') {
    requests.value = []
    backgroundQueries.value = []
    selectedId.value = null
    return
  }
  if (event.type === 'request:start' || event.type === 'request:finish') {
    upsertRequest(event.request)
    const id = event.request.id
    const orphans = backgroundQueries.value.filter((q) => q.requestId === id)
    if (orphans.length) {
      backgroundQueries.value = backgroundQueries.value.filter((q) => q.requestId !== id)
      const req = requests.value.find((r) => r.id === id)
      if (req) {
        for (const q of orphans) {
          if (!req.queries.some((x) => x.id === q.id)) {
            req.queries = [...req.queries, q]
          }
        }
      }
    }
    return
  }
  if (event.type === 'sql') {
    const q = event.query
    if (!q.requestId) {
      backgroundQueries.value = [q, ...backgroundQueries.value].slice(0, 100)
      return
    }
    const req = requests.value.find((r) => r.id === q.requestId)
    if (!req) {
      // request:start may arrive later — keep as background until then
      backgroundQueries.value = [q, ...backgroundQueries.value].slice(0, 100)
      return
    }
    if (!req.queries.some((x) => x.id === q.id)) {
      req.queries = [...req.queries, q]
    }
  }
}

async function loadSnapshot() {
  const res = await fetch(apiBase)
  if (!res.ok) {
    error.value = `Inspector unavailable (${res.status})`
    return
  }
  const data = await res.json()
  requests.value = data.requests || []
  backgroundQueries.value = data.backgroundQueries || []
  if (!selectedId.value && requests.value[0]) {
    selectedId.value = requests.value[0].id
  }
}

async function clearLogs() {
  await fetch(`${apiBase}/clear`, { method: 'POST' })
}

let es: EventSource | null = null

onMounted(async () => {
  await loadSnapshot()
  es = new EventSource(`${apiBase}/stream`)
  es.onopen = () => {
    connected.value = true
    error.value = ''
  }
  es.onerror = () => {
    connected.value = false
  }
  es.onmessage = (msg) => {
    try {
      applyBusEvent(JSON.parse(msg.data))
    } catch {
      // ignore malformed
    }
  }
})

onBeforeUnmount(() => {
  es?.close()
})
</script>

<template>
  <main class="page">
    <header class="bar">
      <div>
        <h1>SQL Queries</h1>
        <p class="meta">
          <NuxtLink to="/">home</NuxtLink>
          ·
          <span :class="connected ? 'ok' : 'bad'">{{ connected ? 'live' : 'disconnected' }}</span>
          · {{ filteredRequests.length }}/{{ requests.length }} requests
        </p>
      </div>
      <button type="button" @click="clearLogs">Clear logs</button>
    </header>

    <p v-if="error" class="bad">{{ error }}</p>

    <div class="filters">
      <label>
        Path
        <input v-model="pathFilter" type="search" placeholder="/api/…" />
      </label>
      <label>
        Method
        <select v-model="methodFilter">
          <option value="">All</option>
          <option v-for="m in methodOptions" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>
      <label>
        Status
        <input v-model="statusFilter" type="search" placeholder="200, 4…" />
      </label>
    </div>

    <div class="layout">
      <section class="list">
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th class="sortable" @click="toggleSort('request')">Request{{ sortMark('request') }}</th>
              <th class="sortable" @click="toggleSort('sql')">SQL{{ sortMark('sql') }}</th>
              <th class="sortable" @click="toggleSort('queries')">Queries{{ sortMark('queries') }}</th>
              <th class="sortable" @click="toggleSort('time')">Time{{ sortMark('time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="req in filteredRequests"
              :key="req.id"
              :class="{ active: req.id === selectedId }"
              @click="selectedId = req.id"
            >
              <td>{{ req.method }}</td>
              <td class="path">{{ req.path }}</td>
              <td>{{ req.statusCode ?? '…' }}</td>
              <td>{{ formatMs(req.durationMs) }}</td>
              <td>{{ formatMs(sqlTotalMs(req)) }}</td>
              <td>{{ req.queries.length }}</td>
              <td>{{ formatTime(req.startedAt) }}</td>
            </tr>
            <tr v-if="!filteredRequests.length">
              <td colspan="7" class="empty">{{ requests.length ? 'No matching requests.' : 'No API requests yet.' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="selected" class="detail">
        <h2>{{ selected.method }} {{ selected.path }}</h2>
        <dl>
          <dt>Status</dt><dd>{{ selected.statusCode ?? 'pending' }}</dd>
          <dt>Request</dt><dd>{{ formatMs(selected.durationMs) }}</dd>
          <dt>SQL</dt><dd>{{ formatMs(sqlTotalMs(selected)) }}</dd>
          <dt>Request ID</dt><dd class="mono">{{ selected.id }}</dd>
          <dt>Time</dt><dd>{{ formatTime(selected.startedAt) }}</dd>
          <dt>SQL count</dt><dd>{{ selected.queries.length }}</dd>
        </dl>

        <h3>SQL Queries</h3>
        <article v-for="(q, i) in selected.queries" :key="q.id" class="query">
          <header>
            <strong>#{{ i + 1 }}</strong>
            <span>{{ formatMs(q.durationMs) }}</span>
            <span v-if="q.error" class="bad">ERROR</span>
          </header>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <pre class="sql" v-html="highlightSql(q.sql)" />
          <pre class="params">Params: {{ JSON.stringify(q.params) }}</pre>
          <pre v-if="q.error" class="bad">{{ q.error }}</pre>
        </article>
      </section>
    </div>

    <section v-if="backgroundQueries.length" class="bg">
      <h3>Background queries (no HTTP request)</h3>
      <article v-for="q in backgroundQueries" :key="q.id" class="query">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre class="sql" v-html="highlightSql(q.sql)" />
        <pre class="params">{{ formatMs(q.durationMs) }} · {{ JSON.stringify(q.params) }}</pre>
      </article>
    </section>
  </main>
</template>

<style scoped>
.page {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  color: #1a1a1a;
  background: #f6f4ef;
  min-height: 100vh;
  padding: 1rem 1.25rem 3rem;
}
.bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}
h1, h2, h3 { margin: 0 0 0.35rem; font-weight: 700; }
.meta { margin: 0; color: #555; }
.ok { color: #0a7a32; }
.bad { color: #b00020; }
button {
  font: inherit;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  border: 1px solid #333;
  background: #fff;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  margin-bottom: 0.75rem;
  align-items: flex-end;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  color: #555;
  font-size: 11px;
}
.filters input,
.filters select {
  font: inherit;
  font-size: 13px;
  padding: 0.3rem 0.45rem;
  border: 1px solid #ccc;
  background: #fff;
  min-width: 8rem;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1rem;
}
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
}
.list {
  overflow: auto;
  border: 1px solid #ccc;
  background: #fff;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th, td {
  text-align: left;
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}
th { background: #efeee9; position: sticky; top: 0; }
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { background: #e4e3dd; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: #f3f7ff; }
tbody tr.active { background: #e6eefc; }
.path { max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.empty { color: #777; white-space: normal; }
.detail {
  border: 1px solid #ccc;
  background: #fff;
  padding: 0.85rem;
}
dl {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.25rem 0.5rem;
  margin: 0 0 1rem;
}
dt { color: #666; }
dd { margin: 0; }
.mono { word-break: break-all; }
.query {
  border-top: 1px solid #eee;
  padding: 0.75rem 0;
}
.query header {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.sql, .params {
  margin: 0.25rem 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.sql { background: #111; color: #e8e8e8; padding: 0.65rem; }
.params { color: #444; }
.bg { margin-top: 1.5rem; }
:deep(.kw) { color: #7dd3fc; font-weight: 700; }
</style>
