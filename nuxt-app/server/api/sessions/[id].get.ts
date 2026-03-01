import { createError } from "h3"
import { getSessionById } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Session id is required" })
  }

  const data = await getSessionById(id)

  if (!data) {
    throw createError({ statusCode: 404, statusMessage: "Session not found" })
  }

  return data
})
