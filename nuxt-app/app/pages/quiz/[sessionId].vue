<template>
  <main class="page">
    <h1>Quiz</h1>

    <QuestionCard
      v-if="currentQuestion"
      :a="currentQuestion.a"
      :b="currentQuestion.b"
      :position="currentIndex + 1"
      :total="questions.length"
    >
      <form class="answer-form" @submit.prevent="submitCurrent">
        <BaseInput v-model.number="currentAnswer" type="number" placeholder="Your answer" required />
        <BaseButton type="submit" :disabled="pending">Submit</BaseButton>
      </form>
      <p v-if="feedbackMessage" class="feedback">{{ feedbackMessage }}</p>
    </QuestionCard>

    <ResultSummary v-else-if="result" :correct="result.correct" :wrong="result.wrong" :percent="result.percent" />

    <p v-else>Loading...</p>

    <NuxtLink to="/history">View history</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const route = useRoute()
const api = useApi()

const activeQuiz = useState<{
  sessionId: string
  questions: Array<{ id: string; a: number; b: number; position: number }>
} | null>("activeQuiz", () => null)

const questions = ref<Array<{ id: string; a: number; b: number; position: number }>>([])
const currentIndex = ref(0)
const currentAnswer = ref<number | null>(null)
const pending = ref(false)
const feedbackMessage = ref("")
const result = ref<{ correct: number; wrong: number; percent: number } | null>(null)

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)

onMounted(async () => {
  const sessionId = route.params.sessionId as string

  if (activeQuiz.value?.sessionId === sessionId) {
    questions.value = activeQuiz.value.questions
    return
  }

  const detail = await api.getSession(sessionId)
  questions.value = detail.questions.map((row: any) => ({
    id: row.id,
    a: row.a,
    b: row.b,
    position: row.position,
  }))
})

async function submitCurrent() {
  if (!currentQuestion.value || currentAnswer.value === null) {
    return
  }

  pending.value = true

  try {
    const response = await api.submitAnswer({
      questionId: currentQuestion.value.id,
      value: Number(currentAnswer.value),
    })

    feedbackMessage.value = response.isCorrect
      ? "Correct!"
      : `Wrong, correct answer is ${response.correctValue}.`

    result.value = response.session
    currentAnswer.value = null

    if (currentIndex.value < questions.value.length - 1) {
      currentIndex.value += 1
    } else {
      activeQuiz.value = null
    }
  } finally {
    pending.value = false
  }
}
</script>

<style scoped>
.page {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  gap: 1rem;
}
.answer-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.8rem;
}
.feedback {
  margin-top: 0.75rem;
  color: #334155;
}
</style>
