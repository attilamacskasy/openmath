<template>
  <main class="page">
    <h1>Quiz History</h1>
    <SessionTable v-if="sessions.length > 0" :sessions="sessions" />
    <p v-else>No sessions yet.</p>
    <NuxtLink to="/">Back to start</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const api = useApi()
const sessions = ref<Array<{ id: string; difficulty: string; total_questions: number; score_percent: number; started_at: string; finished_at: string | null; student_name: string | null }>>([])

onMounted(async () => {
  sessions.value = await api.listSessions()
})
</script>

<style scoped>
.page {
  max-width: 60rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  gap: 1rem;
}
</style>
