import { z } from "zod"
import { createError, readBody } from "h3"
import { updateStudentProfile } from "~~/layers/db/server/db/queries"

const patchSchema = z.object({
  name: z.string().trim().min(1),
  age: z.number().int().min(4).max(120).nullable().optional(),
  gender: z.enum(["female", "male", "other", "prefer_not_say"]).nullable().optional(),
  learned_timetables: z.array(z.number().int().min(1).max(10)).min(1),
})

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Student id is required" })
  }

  const body = await readBody(event)
  const parsed = patchSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid student profile payload" })
  }

  const updated = await updateStudentProfile(id, {
    name: parsed.data.name,
    age: parsed.data.age ?? undefined,
    gender: parsed.data.gender ?? undefined,
    learnedTimetables: parsed.data.learned_timetables,
  })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: "Student not found" })
  }

  return {
    id: updated.id,
    name: updated.name,
    age: updated.age,
    gender: updated.gender,
    learned_timetables: updated.learnedTimetables,
  }
})
