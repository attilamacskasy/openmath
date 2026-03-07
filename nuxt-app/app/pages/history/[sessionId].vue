<template>
  <main class="page" v-if="sessionDetail">
    <h1>Session {{ sessionDetail.session.id }}</h1>
    <p><strong>User:</strong> {{ sessionDetail.session.userName || "-" }}</p>
    <ResultSummary
      :correct="sessionDetail.session.correctCount"
      :wrong="sessionDetail.session.wrongCount"
      :percent="Number(sessionDetail.session.scorePercent)"
      :average-time-per-question-seconds="averageTimePerQuestionSeconds"
    />

    <table class="detail-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Question</th>
          <th>Correct</th>
          <th>User</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in sessionDetail.questions" :key="row.id">
          <td>{{ row.position }}</td>
          <td>{{ row.c !== null && row.d !== null ? `(${row.a} x ${row.b}) + (${row.c} x ${row.d})` : `${row.a} x ${row.b}` }}</td>
          <td>{{ row.correct }}</td>
          <td>{{ row.answer?.value ?? "—" }}</td>
          <td>{{ row.answer?.isCorrect ? "Correct" : row.answer ? "Wrong" : "Pending" }}</td>
        </tr>
      </tbody>
    </table>

    <NuxtLink to="/history">Back to history</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const api = useApi()
const sessionDetail = ref<any | null>(null)

const averageTimePerQuestionSeconds = computed(() => {
  const session = sessionDetail.value?.session

  if (!session || !session.startedAt || !session.totalQuestions || session.totalQuestions <= 0) {
    return null
  }

  const startMs = new Date(session.startedAt).getTime()
  const endMs = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0
  }

  return Math.floor((endMs - startMs) / 1000 / session.totalQuestions)
})

onMounted(async () => {
  sessionDetail.value = await api.getSession(route.params.sessionId as string)
})
</script>

<style scoped>
.page {
  max-width: 65rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  gap: 1rem;
}
.detail-table {
  border-collapse: collapse;
  width: 100%;
}
th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.6rem;
  text-align: left;
}
</style>
