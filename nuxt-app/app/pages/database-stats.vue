<template>
  <main class="page">
    <div class="header-row">
      <h1>Database Statistics</h1>
      <button class="refresh-button" type="button" :disabled="refreshing" @click="refreshAll">
        {{ refreshing ? "Refreshing..." : "Refresh" }}
      </button>
    </div>

    <section class="card" v-if="stats">
      <ul class="list">
        <li>
          <button class="table-button" type="button" @click="openTable('quiz_types')">
            <strong>quiz_types:</strong>
            <span>{{ stats.quiz_types }}</span>
          </button>
        </li>
        <li>
          <button class="table-button" type="button" @click="openTable('users')">
            <strong>users:</strong>
            <span>{{ stats.users }}</span>
          </button>
        </li>
        <li>
          <button class="table-button" type="button" @click="openTable('quiz_sessions')">
            <strong>quiz_sessions:</strong>
            <span>{{ stats.quiz_sessions }}</span>
          </button>
        </li>
        <li>
          <button class="table-button" type="button" @click="openTable('questions')">
            <strong>questions:</strong>
            <span>{{ stats.questions }}</span>
          </button>
        </li>
        <li>
          <button class="table-button" type="button" @click="openTable('answers')">
            <strong>answers:</strong>
            <span>{{ stats.answers }}</span>
          </button>
        </li>
      </ul>
    </section>

    <p v-else-if="loading">Loading statistics...</p>
    <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>

    <section class="card" v-if="selectedTable">
      <h2>{{ selectedTable }} rows</h2>
      <p v-if="tableLoading">Loading rows...</p>
      <p v-else-if="tableErrorMessage" class="error">{{ tableErrorMessage }}</p>
      <div v-else-if="tableRows.length === 0">No rows found.</div>
      <div v-else class="rows">
        <table>
          <thead>
            <tr>
              <th v-for="column in tableColumns" :key="column">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableRows" :key="index">
              <td v-for="column in tableColumns" :key="column">{{ formatValue(row[column]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card danger-zone">
      <h2>Danger Zone</h2>
      <p>Delete all data from users, quiz_sessions, questions, and answers.</p>
      <button class="delete-button" type="button" @click="isConfirmOpen = true">Delete all data</button>
      <p v-if="dangerMessage" :class="dangerError ? 'error' : 'success'">{{ dangerMessage }}</p>
    </section>

    <BaseDialog :open="isConfirmOpen">
      <div class="dialog-content">
        <h3>Confirm full data deletion</h3>
        <p>Type <strong>DELETE ALL DATA</strong> to confirm.</p>
        <BaseInput v-model="deleteConfirmation" type="text" placeholder="DELETE ALL DATA" />
        <div class="dialog-actions">
          <button type="button" class="refresh-button" @click="closeConfirm" :disabled="deleting">Cancel</button>
          <button
            type="button"
            class="delete-button"
            :disabled="deleting || deleteConfirmation !== 'DELETE ALL DATA'"
            @click="deleteAllData"
          >
            {{ deleting ? "Deleting..." : "Confirm delete" }}
          </button>
        </div>
      </div>
    </BaseDialog>
  </main>
</template>

<script setup lang="ts">
const api = useApi()
type StatsTableName = "quiz_types" | "users" | "quiz_sessions" | "questions" | "answers"
type TableRow = Record<string, unknown>

const loading = ref(true)
const errorMessage = ref("")
const stats = ref<{ quiz_types: number; users: number; quiz_sessions: number; questions: number; answers: number } | null>(null)
const selectedTable = ref<StatsTableName | null>(null)
const tableRows = ref<TableRow[]>([])
const tableColumns = ref<string[]>([])
const tableLoading = ref(false)
const tableErrorMessage = ref("")
const refreshing = ref(false)
const isConfirmOpen = ref(false)
const deleting = ref(false)
const deleteConfirmation = ref("")
const dangerMessage = ref("")
const dangerError = ref(false)

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "object") {
    return JSON.stringify(value)
  }

  return String(value)
}

async function openTable(table: StatsTableName) {
  selectedTable.value = table
  tableLoading.value = true
  tableErrorMessage.value = ""

  try {
    const response = await api.getDatabaseTableRows(table)
    tableRows.value = response.rows
    tableColumns.value = response.rows.length > 0 ? Object.keys(response.rows[0] ?? {}) : []
  } catch {
    tableRows.value = []
    tableColumns.value = []
    tableErrorMessage.value = "Could not load table rows."
  } finally {
    tableLoading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await api.getDatabaseStats()
    errorMessage.value = ""
  } catch {
    errorMessage.value = "Could not load database statistics."
  }
}

async function refreshAll() {
  refreshing.value = true

  try {
    await loadStats()

    if (selectedTable.value) {
      await openTable(selectedTable.value)
    }
  } finally {
    refreshing.value = false
  }
}

function closeConfirm() {
  isConfirmOpen.value = false
  deleteConfirmation.value = ""
}

async function deleteAllData() {
  if (deleteConfirmation.value !== "DELETE ALL DATA") {
    return
  }

  deleting.value = true
  dangerMessage.value = ""

  try {
    await api.deleteAllSchemaData(deleteConfirmation.value)
    closeConfirm()
    selectedTable.value = null
    tableRows.value = []
    tableColumns.value = []
    tableErrorMessage.value = ""
    await loadStats()
    dangerError.value = false
    dangerMessage.value = "All data deleted."
  } catch {
    dangerError.value = true
    dangerMessage.value = "Could not delete all data."
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await loadStats()
  loading.value = false
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

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.refresh-button {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.refresh-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
}

.danger-zone {
  border-color: #fecaca;
}

.delete-button {
  background: #b91c1c;
  border: none;
  color: #fff;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.delete-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.dialog-content {
  display: grid;
  gap: 0.75rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.list li {
  display: block;
}

.table-button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
}

.rows {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.error {
  color: #dc2626;
}

.success {
  color: #166534;
}
</style>