<template>
  <div class="layout">
    <header class="nav">
      <NuxtLink to="/">Start</NuxtLink>
      <NuxtLink to="/profile">Profile</NuxtLink>
      <NuxtLink to="/history">History</NuxtLink>
      <NuxtLink to="/user-guide">User Guide</NuxtLink>
      <NuxtLink to="/database-stats">Database Statistics</NuxtLink>

      <label class="student-label">
        Active student
        <select v-model="currentStudentId" class="student-select">
          <option value="">No student</option>
          <option v-for="student in studentsDirectory" :key="student.id" :value="student.id">{{ student.name }}</option>
        </select>
      </label>
    </header>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const api = useApi()

const currentStudentId = useState<string>("currentStudentId", () => "")
const studentsDirectory = useState<Array<{ id: string; name: string }>>("studentsDirectory", () => [])

onMounted(async () => {
  studentsDirectory.value = await api.listStudents()

  if (currentStudentId.value && !studentsDirectory.value.some((student) => student.id === currentStudentId.value)) {
    currentStudentId.value = ""
  }
})
</script>

<style scoped>
.layout {
  display: grid;
  gap: 1rem;
}

.nav {
  max-width: 60rem;
  margin: 1rem auto 0;
  padding: 0 1rem;
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.student-label {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.student-select {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.35rem 0.6rem;
  background: #fff;
}
</style>
