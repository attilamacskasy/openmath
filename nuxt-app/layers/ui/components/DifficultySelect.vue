<template>
  <fieldset class="difficulty-select">
    <legend>Difficulty</legend>
    <label v-for="option in options" :key="option" class="difficulty-option">
      <input :value="option" type="radio" :checked="modelValue === option" @change="$emit('update:modelValue', option)" />
      <span>{{ option }}</span>
    </label>
  </fieldset>
</template>

<script setup lang="ts">
const options = ["low", "medium", "hard"] as const

defineProps<{
  modelValue: "low" | "medium" | "hard"
}>()

defineEmits<{
  "update:modelValue": [value: "low" | "medium" | "hard"]
}>()
</script>

<style scoped>
.difficulty-select {
  display: grid;
  gap: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.75rem;
}
.difficulty-option {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  text-transform: capitalize;
}
</style>
