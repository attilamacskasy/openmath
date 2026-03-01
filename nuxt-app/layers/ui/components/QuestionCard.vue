<template>
  <section class="question-card">
    <p class="position">Question {{ position }} / {{ total }}</p>
    <h2>{{ prompt }}</h2>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  a: number
  b: number
  c?: number | null
  d?: number | null
  position: number
  total: number
}>()

const prompt = computed(() => {
  if (props.c !== null && props.c !== undefined && props.d !== null && props.d !== undefined) {
    return `What is (${props.a} x ${props.b}) + (${props.c} x ${props.d})?`
  }

  return `What is ${props.a} x ${props.b}?`
})
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
