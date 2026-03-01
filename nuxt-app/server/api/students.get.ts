import { listStudents } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  const students = await listStudents()

  return students.map((student) => ({
    id: student.id,
    name: student.name,
  }))
})