<template>
  <table class="session-table">
    <thead>
      <tr>
        <th>Student</th>
        <th>Difficulty</th>
        <th>Questions</th>
        <th>Time Spent</th>
        <th>Avg / Question</th>
        <th>Score</th>
        <th>Started</th>
        <th>Finished</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in sessions" :key="row.id">
        <td>{{ row.student_name || "-" }}</td>
        <td>
          <NuxtLink :to="`/history/${row.id}`">{{ row.difficulty }}</NuxtLink>
        </td>
        <td>{{ row.total_questions }}</td>
        <td>{{ formatDuration(row.started_at, row.finished_at) }}</td>
        <td>{{ formatAverageTimePerQuestion(row.started_at, row.finished_at, row.total_questions) }}</td>
        <td>{{ row.score_percent }}%</td>
        <td>{{ formatDate(row.started_at) }}</td>
        <td>
          <NuxtLink v-if="!row.finished_at" :to="`/quiz/${row.id}`">In progress</NuxtLink>
          <span v-else>{{ formatDate(row.finished_at) }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
defineProps<{
  sessions: Array<{
    id: string
    difficulty: string
    total_questions: number
    score_percent: number
    started_at: string
    finished_at: string | null
    student_name: string | null
  }>
}>()

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const startMs = new Date(startedAt).getTime()
  const endMs = finishedAt ? new Date(finishedAt).getTime() : Date.now()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "0s"
  }

  const totalSeconds = Math.floor((endMs - startMs) / 1000)

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${pad2(minutes)}:${pad2(seconds)}`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

function formatAverageTimePerQuestion(startedAt: string, finishedAt: string | null, totalQuestions: number): string {
  if (totalQuestions <= 0) {
    return "0s"
  }

  const startMs = new Date(startedAt).getTime()
  const endMs = finishedAt ? new Date(finishedAt).getTime() : Date.now()

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "0s"
  }

  const avgSeconds = Math.floor((endMs - startMs) / 1000 / totalQuestions)

  if (avgSeconds < 60) {
    return `${avgSeconds}s`
  }

  if (avgSeconds < 3600) {
    const minutes = Math.floor(avgSeconds / 60)
    const seconds = avgSeconds % 60
    return `${pad2(minutes)}:${pad2(seconds)}`
  }

  const hours = Math.floor(avgSeconds / 3600)
  const minutes = Math.floor((avgSeconds % 3600) / 60)
  const seconds = avgSeconds % 60

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}
</script>

<style scoped>
.session-table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.65rem;
  text-align: left;
}
</style>
