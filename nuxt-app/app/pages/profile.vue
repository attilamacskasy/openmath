<template>
  <main class="page">
    <h1>Profile</h1>

    <section class="card">
      <p v-if="!selectedStudentId" class="hint">Select an active student in the top bar to edit profile preferences.</p>

      <template v-if="selectedStudentId">
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
      </template>

      <p v-if="message" :class="messageType === 'error' ? 'error' : 'success'">{{ message }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
const api = useApi()

const selectedStudentId = useState<string>("currentStudentId", () => "")
const studentsDirectory = useState<Array<{ id: string; name: string }>>("studentsDirectory", () => [])
const name = ref("")
const age = ref<number | null>(null)
const gender = ref<"female" | "male" | "other" | "prefer_not_say" | "">("")
const learnedTimetables = ref<number[]>([])
const saving = ref(false)
const message = ref("")
const messageType = ref<"success" | "error">("success")
const timetableOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

async function onStudentChange() {
  message.value = ""

  if (!selectedStudentId.value) {
    name.value = ""
    age.value = null
    gender.value = ""
    learnedTimetables.value = []
    return
  }

  try {
    const profile = await api.getStudentProfile(selectedStudentId.value)
    name.value = profile.name
    age.value = profile.age
    gender.value = profile.gender ?? ""
    learnedTimetables.value = profile.learned_timetables
  } catch {
    messageType.value = "error"
    message.value = "Could not load student profile."
  }
}

watch(selectedStudentId, () => {
  onStudentChange()
}, { immediate: true })

async function saveProfile() {
  if (!selectedStudentId.value) {
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
    const updated = await api.updateStudentProfile(selectedStudentId.value, {
      name: name.value.trim(),
      age: age.value,
      gender: gender.value || null,
      learned_timetables: learnedTimetables.value,
    })

    name.value = updated.name
    age.value = updated.age
    gender.value = updated.gender ?? ""
    learnedTimetables.value = updated.learned_timetables

    studentsDirectory.value = studentsDirectory.value.map((student) =>
      student.id === updated.id ? { ...student, name: updated.name } : student
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
</style>
