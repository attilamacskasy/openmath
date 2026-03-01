<template>
  <input ref="inputEl" class="base-input" v-bind="$attrs" :value="modelValue" @input="onInput" />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    modelModifiers?: {
      number?: boolean
    }
  }>(),
  {
    modelValue: "",
    modelModifiers: () => ({}),
  }
)

const emit = defineEmits<{
  (event: "update:modelValue", value: string | number): void
}>()

const inputEl = ref<HTMLInputElement | null>(null)

function focus() {
  inputEl.value?.focus()
}

function select() {
  inputEl.value?.select()
}

defineExpose({
  focus,
  select,
})

function onInput(event: Event) {
  const inputValue = (event.target as HTMLInputElement).value

  if (props.modelModifiers.number) {
    const numericValue = Number(inputValue)
    emit("update:modelValue", Number.isNaN(numericValue) ? inputValue : numericValue)
    return
  }

  emit("update:modelValue", inputValue)
}
</script>

<style scoped>
.base-input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.55rem 0.7rem;
  font-size: 1rem;
}
</style>
