import { createError } from "h3"
import { getStudentPerformanceStats, getStudentProfile } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Student id is required" })
  }

  const student = await getStudentProfile(id)

  if (!student) {
    throw createError({ statusCode: 404, statusMessage: "Student not found" })
  }

  const stats = await getStudentPerformanceStats(id)

  return {
    id: student.id,
    name: student.name,
    age: student.age,
    gender: student.gender,
    learned_timetables: student.learnedTimetables,
    stats,
  }
})
