<template>
  <div class="layout">
    <header class="nav">
      <NuxtLink to="/" class="brand" aria-label="OpenMath home">
        <OpenMathLogo class="brand-logo" />
        <span class="brand-text">OpenMath</span>
      </NuxtLink>

      <NuxtLink to="/">Start</NuxtLink>
      <NuxtLink to="/profile">Profile</NuxtLink>
      <NuxtLink to="/history">History</NuxtLink>
      <NuxtLink to="/user-guide">User Guide</NuxtLink>
      <NuxtLink to="/database-stats">Database Statistics</NuxtLink>

      <label class="user-label">
        Active user
        <select v-model="currentUserId" class="user-select">
          <option value="">No user</option>
          <option v-for="user in usersDirectory" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
      </label>
    </header>
    <NuxtPage />

    <footer class="footer">
      <div class="footer-main">
        <span>OpenMath v1.5</span>
        <a href="https://github.com/attilamacskasy/openmath" target="_blank" rel="noreferrer noopener">GitHub Source</a>
      </div>
      <div class="footer-meta">Attila Macskasy · March 2026</div>
      <div class="footer-stack">Nuxt 4 + Nitro · Drizzle (PostgreSQL) · Reka UI · PNPM + Docker</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const api = useApi()

const currentUserId = useState<string>("currentUserId", () => "")
const usersDirectory = useState<Array<{ id: string; name: string }>>("usersDirectory", () => [])

onMounted(async () => {
  usersDirectory.value = await api.listUsers()

  if (currentUserId.value && !usersDirectory.value.some((user) => user.id === currentUserId.value)) {
    currentUserId.value = ""
  }
})
</script>

<style scoped>
.layout {
  display: grid;
  gap: 1rem;
  min-height: 100vh;
  grid-template-rows: auto 1fr auto;
}

.nav {
  max-width: 60rem;
  margin: 1rem auto 0;
  padding: 0 1rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
  color: inherit;
  margin-right: 0.25rem;
}

.brand-logo {
  width: 1.9rem;
  height: 1.9rem;
  display: block;
}

.brand-text {
  font-weight: 700;
}

.user-label {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.user-select {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
  background: #fff;
}

.footer {
  max-width: 60rem;
  width: 100%;
  margin: 0 auto 1rem;
  padding: 0.8rem 1rem 0;
  border-top: 1px solid #e2e8f0;
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  color: #475569;
  text-align: center;
}

.footer a {
  color: inherit;
  text-decoration: underline;
}

.footer-main {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.footer-meta {
  font-size: 0.95rem;
}

.footer-stack {
  font-size: 0.8rem;
  opacity: 0.9;
}
</style>
