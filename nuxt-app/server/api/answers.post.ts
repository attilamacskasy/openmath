import { z } from "zod"
import { createError, readBody } from "h3"
import { submitAnswer } from "~~/layers/db/server/db/queries"

const answerSchema = z.object({
  questionId: z.string().uuid(),
  value: z.number().int(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = answerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request payload" })
  }

  const result = await submitAnswer(parsed.data.questionId, parsed.data.value)

  if (!result) {
    throw createError({ statusCode: 404, statusMessage: "Question not found" })
  }

  return result
})
