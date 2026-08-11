/**
 * Runnable store self-check (no test framework).
 * Usage: node --import tsx scripts/self-check.mjs
 * Or after build: node scripts/self-check.mjs with the compiled logic inlined below.
 */

const MAX_REQUESTS = 200
const requests = new Map()
const requestOrder = []

function startRequest(id) {
  requests.set(id, { id, queries: [] })
  requestOrder.push(id)
  while (requestOrder.length > MAX_REQUESTS) {
    const oldest = requestOrder.shift()
    requests.delete(oldest)
  }
}

for (let i = 0; i < 205; i++) startRequest(`r-${i}`)

if (requestOrder.length !== MAX_REQUESTS) {
  throw new Error(`expected ${MAX_REQUESTS}, got ${requestOrder.length}`)
}
if (requests.has('r-0') || requests.has('r-4')) {
  throw new Error('oldest should be evicted')
}
if (!requests.has('r-204')) {
  throw new Error('newest missing')
}

requests.get('r-204').queries.push({ requestId: 'r-204', sql: 'SELECT 1' })
if (requests.get('r-204').queries[0].requestId !== 'r-204') {
  throw new Error('association failed')
}

console.log('self-check ok')
