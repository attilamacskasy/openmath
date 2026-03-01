<template>
  <section class="result-summary">
    <h2>Session Summary</h2>
    <p>Correct: {{ correct }}</p>
    <p>Wrong: {{ wrong }}</p>
    <p>Score: {{ percent }}%</p>
    <p v-if="averageTimePerQuestionSeconds !== null && averageTimePerQuestionSeconds !== undefined">
      Avg time / question: {{ formatDuration(averageTimePerQuestionSeconds) }}
    </p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  correct: number
  wrong: number
  percent: number
  averageTimePerQuestionSeconds?: number | null
}>()

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return "0s"
  }

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
</script>

<style scoped>
.result-summary {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  background: #f8fafc;
}
</style>
