<template>
  <div v-if="open" class="dialog-backdrop" role="dialog" aria-modal="true">
    <div class="dialog-panel">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
}>()
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 1rem;
}
.dialog-panel {
  width: min(32rem, 100%);
  background: #fff;
  border-radius: 0.75rem;
  padding: 1rem;
}
</style>
