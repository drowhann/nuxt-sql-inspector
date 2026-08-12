<script setup lang="ts">
const { data, error, pending } = await useAsyncData('ssr-demo-users', () => $fetch('/api/users'))
</script>

<template>
  <main style="font-family: ui-monospace, monospace; max-width: 820px; margin: 2rem auto; padding: 0 1rem;">
    <p>
      <NuxtLink to="/">← Home</NuxtLink>
      ·
      <NuxtLink to="/__sql_queries">Inspector</NuxtLink>
    </p>

    <h1>SSR demo</h1>
    <p style="color: #555; font-size: 0.9rem;">
      This page loads users via <code>GET /api/users</code> during SSR (and on client nav).
      Hard-reload, then open the inspector — you should see <code>GET /api/users</code> with the SQL
      (not the <code>/ssr-demo</code> page itself).
    </p>

    <p v-if="pending">Loading…</p>
    <p v-else-if="error" style="color: #b00;">{{ error }}</p>
    <template v-else-if="data">
      <p>count: {{ data.count }}</p>
      <pre style="background: #111; color: #ddd; padding: 1rem; overflow: auto;">{{ JSON.stringify(data.users, null, 2) }}</pre>
    </template>
  </main>
</template>
