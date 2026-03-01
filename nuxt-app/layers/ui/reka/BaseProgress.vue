<template>
  <div class="progress-wrap">
    <ProgressRoot class="progress-root" :model-value="safeValue" :max="safeMax" aria-label="Quiz progress">
      <ProgressIndicator class="progress-indicator" :style="{ width: `${percent}%` }" />
    </ProgressRoot>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ProgressIndicator, ProgressRoot } from "reka-ui"

const props = withDefaults(
  defineProps<{
    value: number
    max: number
  }>(),
  {
    value: 0,
    max: 100,
  }
)

const safeMax = computed(() => (props.max > 0 ? props.max : 1))
const safeValue = computed(() => {
  if (props.value < 0) {
    return 0
  }

  if (props.value > safeMax.value) {
    return safeMax.value
  }

  return props.value
})

const percent = computed(() => Math.round((safeValue.value / safeMax.value) * 100))
</script>

<style scoped>
.progress-wrap {
  display: grid;
  gap: 0.25rem;
}

.progress-root {
  position: relative;
  overflow: hidden;
  background: #e2e8f0;
  border-radius: 9999px;
  width: 100%;
  height: 0.75rem;
}

.progress-indicator {
  background: #4f46e5;
  height: 100%;
  width: 0;
  transition: width 180ms ease;
}
</style>
