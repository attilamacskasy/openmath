<template>
  <main class="page">
    <h1>OpenMath</h1>
    <p>Multiplication is the first quiz type students can run.</p>
    <form class="card" @submit.prevent="startQuiz">
      <label>
        Quiz type
        <select v-model="selectedQuizTypeCode" class="student-select">
          <option v-for="quizType in quizTypes" :key="quizType.id" :value="quizType.code">
            {{ quizType.description }} ({{ quizType.code }})
          </option>
        </select>
      </label>

      <DifficultySelect v-model="difficulty" />

      <label>
        Student
        <select v-model="selectedStudent" class="student-select">
          <option value="">No student</option>
          <option v-for="student in students" :key="student.id" :value="student.id">{{ student.name }}</option>
          <option value="__new__">Add new student</option>
        </select>
      </label>

      <label v-if="selectedStudent === '__new__'">
        New student name
        <BaseInput v-model="studentName" type="text" placeholder="Anna" />
      </label>

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
const students = ref<Array<{ id: string; name: string }>>([])
const quizTypes = ref<Array<{ id: string; code: string; description: string }>>([])
const selectedQuizTypeCode = ref("multiplication_1_10")
const selectedStudent = ref("")
const studentName = ref("")
const pending = ref(false)
const errorMessage = ref("")

const activeQuiz = useState<{
  sessionId: string
  quizTypeCode: string
  questions: Array<{ id: string; a: number; b: number; c: number | null; d: number | null; position: number }>
} | null>("activeQuiz", () => null)

async function startQuiz() {
  pending.value = true
  errorMessage.value = ""

  if (selectedStudent.value === "__new__" && studentName.value.trim().length === 0) {
    errorMessage.value = "Please enter a new student name."
    pending.value = false
    return
  }

  try {
    const response = await api.createSession({
      difficulty: difficulty.value,
      totalQuestions: totalQuestions.value,
      studentId: selectedStudent.value && selectedStudent.value !== "__new__" ? selectedStudent.value : undefined,
      studentName: selectedStudent.value === "__new__" ? studentName.value.trim() : undefined,
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
  const [studentList, quizTypeList] = await Promise.all([api.listStudents(), api.listQuizTypes()])

  students.value = studentList
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
.student-select {
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
</style>
