<template>
  <main class="page">
    <h1>OpenMath</h1>
    <p>Multiplication is the first quiz type students can run.</p>
    <form class="card" @submit.prevent="startQuiz">
      <label>
        Quiz type
        <select v-model="selectedQuizTypeCode" class="user-select">
          <option v-for="quizType in quizTypes" :key="quizType.id" :value="quizType.code">
            {{ quizType.description }} ({{ quizType.code }})
          </option>
        </select>
      </label>

      <DifficultySelect v-model="difficulty" />

      <label v-if="!currentUserId">
        New user name
        <BaseInput v-model="userName" type="text" placeholder="Anna" />
      </label>

      <label v-if="!currentUserId">
        Age
        <BaseInput v-model.number="userAge" type="number" min="4" max="120" />
      </label>

      <label v-if="!currentUserId">
        Gender
        <select v-model="userGender" class="user-select">
          <option value="">Prefer not to say</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </select>
      </label>

      <fieldset v-if="!currentUserId" class="tables-fieldset">
        <legend>Learned timetables (1–10)</legend>
        <div class="tables-grid">
          <label v-for="table in timetableOptions" :key="table" class="table-option">
            <input v-model="learnedTimetables" type="checkbox" :value="table" />
            <span>{{ table }}</span>
          </label>
        </div>
      </fieldset>

      <label>
        Total questions
        <BaseInput v-model.number="totalQuestions" type="number" min="1" max="30" />
      </label>

      <BaseButton type="submit" :disabled="pending">{{ pending ? "Starting..." : "Start Quiz" }}</BaseButton>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    </form>

    <NuxtLink to="/history">View history</NuxtLink>
  </main>
</template>

<script setup lang="ts">
const api = useApi()
const router = useRouter()
const difficulty = ref<"low" | "medium" | "hard">("low")
const totalQuestions = ref(10)
const quizTypes = ref<Array<{ id: string; code: string; description: string }>>([])
const selectedQuizTypeCode = ref("multiplication_1_10")
const userName = ref("")
const userAge = ref<number | null>(null)
const userGender = ref<"female" | "male" | "other" | "prefer_not_say" | "">("")
const learnedTimetables = ref<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
const pending = ref(false)
const errorMessage = ref("")
const timetableOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const currentUserId = useState<string>("currentUserId", () => "")

const activeQuiz = useState<{
  sessionId: string
  quizTypeCode: string
  questions: Array<{ id: string; a: number; b: number; c: number | null; d: number | null; position: number }>
} | null>("activeQuiz", () => null)

async function startQuiz() {
  pending.value = true
  errorMessage.value = ""

  if (!currentUserId.value && userName.value.trim().length === 0) {
    errorMessage.value = "Please enter a new user name."
    pending.value = false
    return
  }

  if (!currentUserId.value && learnedTimetables.value.length === 0) {
    errorMessage.value = "Please select at least one learned timetable."
    pending.value = false
    return
  }

  try {
    const response = await api.createSession({
      difficulty: difficulty.value,
      totalQuestions: totalQuestions.value,
      userId: currentUserId.value || undefined,
      userName: !currentUserId.value ? userName.value.trim() : undefined,
      userAge: !currentUserId.value ? userAge.value ?? undefined : undefined,
      userGender: !currentUserId.value ? (userGender.value || "prefer_not_say") : undefined,
      learnedTimetables: !currentUserId.value ? learnedTimetables.value : undefined,
      quizTypeCode: selectedQuizTypeCode.value,
    })

    activeQuiz.value = {
      sessionId: response.sessionId,
      quizTypeCode: response.quizTypeCode,
      questions: response.questions,
    }

    await router.push(`/quiz/${response.sessionId}`)
  } catch (error) {
    errorMessage.value = "Could not start quiz."
  } finally {
    pending.value = false
  }
}

onMounted(async () => {
  const quizTypeList = await api.listQuizTypes()
  quizTypes.value = quizTypeList

  if (quizTypeList.length > 0 && !quizTypeList.some((item) => item.code === selectedQuizTypeCode.value)) {
    selectedQuizTypeCode.value = quizTypeList[0]?.code ?? "multiplication_1_10"
  }
})
</script>

<style scoped>
.page {
  max-width: 40rem;
  margin: 2rem auto;
  padding: 0 1rem;
  display: grid;
  gap: 1rem;
}
.card {
  display: grid;
  gap: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
}
.user-select {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.55rem 0.7rem;
  font-size: 1rem;
  background: #fff;
}
.error {
  color: #dc2626;
}

.tables-fieldset {
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.75rem;
  display: grid;
  gap: 0.5rem;
}

.tables-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem;
}

.table-option {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
