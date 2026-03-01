<template>
  <div class="layout">
    <header class="nav">
      <NuxtLink to="/">Start</NuxtLink>
      <NuxtLink to="/history">History</NuxtLink>
      <NuxtLink to="/database-stats">Database Statistics</NuxtLink>
    </header>
    <NuxtPage />
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  gap: 1rem;
}

.nav {
  max-width: 60rem;
  margin: 1rem auto 0;
  padding: 0 1rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}
</style>
