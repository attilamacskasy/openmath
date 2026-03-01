import { z } from "zod"
import { createError, readBody } from "h3"
import { createSession, insertQuestions } from "~~/layers/db/server/db/queries"
import { generateQuestions } from "~~/layers/core/server/logic/generator"
import { isDifficulty } from "~~/layers/core/server/logic/difficulty"

const sessionSchema = z.object({
  difficulty: z.string(),
  totalQuestions: z.number().int().min(1).max(50).default(10),
  studentId: z.string().uuid().optional(),
  studentName: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = sessionSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request payload" })
  }

  const { difficulty, totalQuestions, studentId, studentName } = parsed.data

  if (!isDifficulty(difficulty)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid difficulty" })
  }

  const session = await createSession({
    difficulty,
    totalQuestions,
    studentId,
    studentName,
  })

  const generated = generateQuestions(difficulty, totalQuestions)
  const questions = await insertQuestions(session.id, generated)

  return {
    sessionId: session.id,
    questions,
  }
})
