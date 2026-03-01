import { z } from "zod"
import { createError, readBody } from "h3"
import { deleteAllSchemaData } from "~~/layers/db/server/db/queries"

const resetSchema = z.object({
  confirmation: z.literal("DELETE ALL DATA"),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = resetSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid confirmation" })
  }

  await deleteAllSchemaData()

  return { success: true }
})