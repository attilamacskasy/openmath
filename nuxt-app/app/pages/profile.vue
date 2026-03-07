<template>
  <main class="page">
    <h1>Profile</h1>

    <section class="card">
      <p v-if="!selectedUserId" class="hint">Select an active user in the top bar to edit profile preferences.</p>

      <template v-if="selectedUserId">
        <label>
          Name
          <BaseInput v-model="name" type="text" />
        </label>

        <label>
          Age
          <BaseInput v-model.number="age" type="number" min="4" max="120" />
        </label>

        <label>
          Gender
          <select v-model="gender" class="input">
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>

        <fieldset class="tables-fieldset">
          <legend>Learned timetables (1–10)</legend>
          <div class="tables-grid">
            <label v-for="table in timetableOptions" :key="table" class="table-option">
              <input v-model="learnedTimetables" type="checkbox" :value="table" />
              <span>{{ table }}</span>
            </label>
          </div>
        </fieldset>

        <BaseButton type="button" :disabled="saving" @click="saveProfile">
          {{ saving ? "Saving..." : "Save profile" }}
        </BaseButton>

        <section class="stats-block">
          <h2>Performance (All quizzes)</h2>
          <div class="stats-grid">
            <p><strong>Sessions:</strong> {{ profileStats.overall.sessions }}</p>
            <p><strong>Completed:</strong> {{ profileStats.overall.completed_sessions }}</p>
            <p><strong>In progress:</strong> {{ profileStats.overall.in_progress_sessions }}</p>
            <p><strong>Total questions:</strong> {{ profileStats.overall.total_questions }}</p>
            <p><strong>Correct / Wrong:</strong> {{ profileStats.overall.correct_answers }} / {{ profileStats.overall.wrong_answers }}</p>
            <p><strong>Average score:</strong> {{ formatPercent(profileStats.overall.average_score_percent) }}</p>
            <p><strong>Total time spent:</strong> {{ formatDuration(profileStats.overall.total_time_seconds) }}</p>
          </div>
        </section>

        <section class="stats-block">
          <h2>Performance by quiz type</h2>
          <table v-if="profileStats.by_quiz_type.length > 0" class="stats-table">
            <thead>
              <tr>
                <th>Quiz type</th>
                <th>Sessions</th>
                <th>Completed</th>
                <th>In progress</th>
                <th>Avg score</th>
                <th>Total time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in profileStats.by_quiz_type" :key="row.quiz_type_code">
                <td>{{ row.quiz_type_description }} ({{ row.quiz_type_code }})</td>
                <td>{{ row.sessions }}</td>
                <td>{{ row.completed_sessions }}</td>
                <td>{{ row.in_progress_sessions }}</td>
                <td>{{ formatPercent(row.average_score_percent) }}</td>
                <td>{{ formatDuration(row.total_time_seconds) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="hint">No quiz data yet.</p>
        </section>
      </template>

      <p v-if="message" :class="messageType === 'error' ? 'error' : 'success'">{{ message }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
const api = useApi()

const selectedUserId = useState<string>("currentUserId", () => "")
const usersDirectory = useState<Array<{ id: string; name: string }>>("usersDirectory", () => [])
const name = ref("")
const age = ref<number | null>(null)
const gender = ref<"female" | "male" | "other" | "prefer_not_say" | "">("")
const learnedTimetables = ref<number[]>([])
const saving = ref(false)
const message = ref("")
const messageType = ref<"success" | "error">("success")
const profileStats = ref({
  overall: {
    quiz_type_code: "all",
    quiz_type_description: "All quiz types",
    sessions: 0,
    completed_sessions: 0,
    in_progress_sessions: 0,
    total_questions: 0,
    correct_answers: 0,
    wrong_answers: 0,
    average_score_percent: 0,
    total_time_seconds: 0,
  },
  by_quiz_type: [] as Array<{
    quiz_type_code: string
    quiz_type_description: string
    sessions: number
    completed_sessions: number
    in_progress_sessions: number
    total_questions: number
    correct_answers: number
    wrong_answers: number
    average_score_percent: number
    total_time_seconds: number
  }>,
})
const timetableOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return "0s"
  }

  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${pad2(minutes)}:${pad2(seconds)}`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

async function onUserChange() {
  message.value = ""

  if (!selectedUserId.value) {
    name.value = ""
    age.value = null
    gender.value = ""
    learnedTimetables.value = []
    profileStats.value = {
      overall: {
        quiz_type_code: "all",
        quiz_type_description: "All quiz types",
        sessions: 0,
        completed_sessions: 0,
        in_progress_sessions: 0,
        total_questions: 0,
        correct_answers: 0,
        wrong_answers: 0,
        average_score_percent: 0,
        total_time_seconds: 0,
      },
      by_quiz_type: [],
    }
    return
  }

  try {
    const profile = await api.getUserProfile(selectedUserId.value)
    name.value = profile.name
    age.value = profile.age
    gender.value = profile.gender ?? ""
    learnedTimetables.value = profile.learned_timetables
    profileStats.value = profile.stats
  } catch {
    messageType.value = "error"
    message.value = "Could not load user profile."
  }
}

watch(selectedUserId, () => {
  onUserChange()
}, { immediate: true })

async function saveProfile() {
  if (!selectedUserId.value) {
    return
  }

  if (name.value.trim().length === 0) {
    messageType.value = "error"
    message.value = "Name is required."
    return
  }

  if (learnedTimetables.value.length === 0) {
    messageType.value = "error"
    message.value = "Select at least one learned timetable."
    return
  }

  saving.value = true
  message.value = ""

  try {
    const updated = await api.updateUserProfile(selectedUserId.value, {
      name: name.value.trim(),
      age: age.value,
      gender: gender.value || null,
      learned_timetables: learnedTimetables.value,
    })

    name.value = updated.name
    age.value = updated.age
    gender.value = updated.gender ?? ""
    learnedTimetables.value = updated.learned_timetables

    usersDirectory.value = usersDirectory.value.map((user) =>
      user.id === updated.id ? { ...user, name: updated.name } : user
    )

    messageType.value = "success"
    message.value = "Profile saved."
  } catch {
    messageType.value = "error"
    message.value = "Could not save profile."
  } finally {
    saving.value = false
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

.card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}

.input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.55rem 0.7rem;
  font-size: 1rem;
  background: #fff;
}

.hint {
  color: #475569;
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

.error {
  color: #dc2626;
}

.success {
  color: #166534;
}

.stats-block {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.75rem;
  display: grid;
  gap: 0.75rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
}

.stats-table th,
.stats-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 0.5rem;
  text-align: left;
}
</style>
