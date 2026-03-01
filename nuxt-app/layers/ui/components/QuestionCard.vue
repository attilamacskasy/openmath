<template>
  <section class="question-card">
    <p class="position">Question {{ position }} / {{ total }}</p>
    <h2>What is {{ a }} x {{ b }}?</h2>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  a: number
  b: number
  position: number
  total: number
}>()
</script>

<style scoped>
.question-card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  background: #fff;
}
.position {
  color: #475569;
  margin: 0 0 0.25rem;
}
</style>
