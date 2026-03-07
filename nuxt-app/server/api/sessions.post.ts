import { z } from "zod"
import { createError, readBody } from "h3"
import { createSession, insertQuestions, DEFAULT_QUIZ_TYPE_CODE } from "~~/layers/db/server/db/queries"
import { generateQuestions } from "~~/layers/core/server/logic/generator"
import { isDifficulty } from "~~/layers/core/server/logic/difficulty"

const sessionSchema = z.object({
  difficulty: z.string(),
  totalQuestions: z.number().int().min(1).max(50).default(10),
  userId: z.string().uuid().optional(),
  userName: z.string().optional(),
  userAge: z.number().int().min(4).max(120).optional(),
  userGender: z.enum(["female", "male", "other", "prefer_not_say"]).optional(),
  learnedTimetables: z.array(z.number().int().min(1).max(10)).optional(),
  quizTypeCode: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = sessionSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: "Invalid request payload" })
  }

  const { difficulty, totalQuestions, userId, userName, userAge, userGender, learnedTimetables, quizTypeCode } = parsed.data

  if (!isDifficulty(difficulty)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid difficulty" })
  }

  const effectiveQuizTypeCode = quizTypeCode ?? DEFAULT_QUIZ_TYPE_CODE

  const session = await createSession({
    difficulty,
    totalQuestions,
    userId,
    userName,
    userAge,
    userGender,
    learnedTimetables,
    quizTypeCode: effectiveQuizTypeCode,
  })

  const generated = generateQuestions(difficulty, totalQuestions, effectiveQuizTypeCode, session.learnedTimetables)
  const questions = await insertQuestions(session.id, session.quizTypeId, generated)

  return {
    sessionId: session.id,
    quizTypeCode: effectiveQuizTypeCode,
    questions,
  }
})
