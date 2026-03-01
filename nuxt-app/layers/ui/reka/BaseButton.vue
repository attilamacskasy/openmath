<template>
  <button :type="type" class="base-button" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: "button" | "submit" | "reset"
  }>(),
  {
    type: "button",
  }
)
</script>

<style scoped>
.base-button {
  border: none;
  border-radius: 0.5rem;
  padding: 0.6rem 1rem;
  background: #4f46e5;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
