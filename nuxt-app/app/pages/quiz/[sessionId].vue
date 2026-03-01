<template>
  <main class="page">
    <h1>Quiz</h1>
    <p v-if="quizTypeCode"><strong>Quiz type:</strong> {{ quizTypeCode }}</p>

    <section v-if="questions.length > 0" class="progress-section" aria-live="polite">
      <p class="progress-label">Progress: {{ answeredCount }} / {{ progressMax }} answered</p>
      <BaseProgress :value="answeredCount" :max="progressMax" />
    </section>

    <QuestionCard
      v-if="currentQuestion"
      :a="currentQuestion.a"
      :b="currentQuestion.b"
      :c="currentQuestion.c"
      :d="currentQuestion.d"
      :position="currentIndex + 1"
      :total="questions.length"
    >
      <form class="answer-form" @submit.prevent="submitCurrent">
        <BaseInput ref="answerInputRef" v-model.number="currentAnswer" type="number" placeholder="Your answer" required />
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
const router = useRouter()
const api = useApi()

const activeQuiz = useState<{
  sessionId: string
  quizTypeCode: string
  questions: Array<{ id: string; a: number; b: number; c: number | null; d: number | null; position: number }>
} | null>("activeQuiz", () => null)

const questions = ref<Array<{ id: string; a: number; b: number; c: number | null; d: number | null; position: number }>>([])
const quizTypeCode = ref("")
const answerInputRef = ref<{ focus: () => void; select: () => void } | null>(null)
const currentIndex = ref(0)
const initialAnsweredCount = ref(0)
const totalQuestionCount = ref(0)
const currentAnswer = ref<number | null>(null)
const pending = ref(false)
const feedbackMessage = ref("")
const result = ref<{ correct: number; wrong: number; percent: number } | null>(null)

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)
const answeredCount = computed(() => initialAnsweredCount.value + currentIndex.value)
const progressMax = computed(() => totalQuestionCount.value || questions.value.length || 1)

async function focusAnswerInput() {
  await nextTick()
  answerInputRef.value?.focus()
  answerInputRef.value?.select()
}

onMounted(async () => {
  const sessionId = route.params.sessionId as string

  if (activeQuiz.value?.sessionId === sessionId) {
    questions.value = activeQuiz.value.questions
    quizTypeCode.value = activeQuiz.value.quizTypeCode
    initialAnsweredCount.value = 0
    totalQuestionCount.value = questions.value.length
    await focusAnswerInput()
    return
  }

  const detail = await api.getSession(sessionId)
  quizTypeCode.value = detail.session?.quizTypeCode ?? ""

  const unansweredQuestions = detail.questions.filter((row: any) => !row.answer)

  questions.value = unansweredQuestions.map((row: any) => ({
    id: row.id,
    a: row.a,
    b: row.b,
    c: row.c ?? null,
    d: row.d ?? null,
    position: row.position,
  }))

  totalQuestionCount.value = detail.questions.length
  initialAnsweredCount.value = Math.max(0, totalQuestionCount.value - questions.value.length)

  result.value = {
    correct: detail.session?.correctCount ?? 0,
    wrong: detail.session?.wrongCount ?? 0,
    percent: Number(detail.session?.scorePercent ?? 0),
  }

  await focusAnswerInput()
})

watch(currentIndex, async () => {
  await focusAnswerInput()
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
      await router.push(`/history/${route.params.sessionId as string}`)
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

.progress-section {
  display: grid;
  gap: 0.4rem;
}

.progress-label {
  margin: 0;
  color: #475569;
}
</style>
