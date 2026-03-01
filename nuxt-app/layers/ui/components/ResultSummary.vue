<template>
  <section class="result-summary">
    <h2>Session Summary</h2>
    <p>Correct: {{ correct }}</p>
    <p>Wrong: {{ wrong }}</p>
    <p>Score: {{ percent }}%</p>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  correct: number
  wrong: number
  percent: number
}>()
</script>

<style scoped>
.result-summary {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  background: #f8fafc;
}
</style>
