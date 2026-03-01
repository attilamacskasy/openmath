<template>
  <main class="page">
    <h1>Quiz History</h1>

    <section v-if="historyGroups.length > 0" v-for="group in historyGroups" :key="group.code" class="group-card">
      <h2>{{ group.description }}</h2>
      <p class="muted">Quiz type: {{ group.code }}</p>
      <SessionTable :sessions="group.sessions" />
      <p v-if="group.sessions.length === 0" class="muted">No sessions yet for this quiz type.</p>
    </section>

    <p v-else>No quiz types available.</p>

    <NuxtLink to="/">Back to start</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const api = useApi()
type SessionItem = {
  id: string
  difficulty: string
  total_questions: number
  score_percent: number
  started_at: string
  finished_at: string | null
  student_name: string | null
  quiz_type_code: string | null
}

const sessions = ref<SessionItem[]>([])
const quizTypes = ref<Array<{ id: string; code: string; description: string }>>([])

const historyGroups = computed(() => {
  return quizTypes.value.map((quizType) => ({
    code: quizType.code,
    description: quizType.description,
    sessions: sessions.value.filter((session) => session.quiz_type_code === quizType.code),
  }))
})

onMounted(async () => {
  const [sessionList, quizTypeList] = await Promise.all([api.listSessions(), api.listQuizTypes()])
  sessions.value = sessionList
  quizTypes.value = quizTypeList
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

.group-card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  display: grid;
  gap: 0.75rem;
}

.muted {
  color: #64748b;
}
</style>
