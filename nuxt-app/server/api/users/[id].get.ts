import { createError } from "h3"
import { getUserPerformanceStats, getUserProfile } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "User id is required" })
  }

  const user = await getUserProfile(id)

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" })
  }

  const stats = await getUserPerformanceStats(id)

  return {
    id: user.id,
    name: user.name,
    age: user.age,
    gender: user.gender,
    learned_timetables: user.learnedTimetables,
    stats,
  }
})
