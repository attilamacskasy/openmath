import { asc, desc, eq, inArray, sql } from "drizzle-orm"
import { db, typedDb } from "./client"
import { answers, questions, quizSessions, quizTypes, users } from "./schema"
import { calculatePercent } from "../../../core/server/logic/scoring"
import type { Difficulty } from "../../../core/server/logic/types"
import type { GeneratedQuestion } from "../../../core/server/logic/generator"

export const DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"
const DEFAULT_LEARNED_TIMETABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function sanitizeLearnedTimetables(values: number[] | undefined) {
  if (!values || values.length === 0) {
    return DEFAULT_LEARNED_TIMETABLES
  }

  const filtered = values.filter((item) => Number.isInteger(item) && item >= 1 && item <= 10)
  if (filtered.length === 0) {
    return DEFAULT_LEARNED_TIMETABLES
  }

  return [...new Set(filtered)]
}

export const statsTableNames = ["quiz_types", "users", "quiz_sessions", "questions", "answers"] as const
export type StatsTableName = (typeof statsTableNames)[number]

async function getQuizTypeIdByCode(code: string) {
  const quizType = await typedDb.query.quizTypes.findFirst({
    where: eq(quizTypes.code, code),
    columns: { id: true },
  })

  if (!quizType) {
    throw new Error(`Quiz type not found: ${code}`)
  }

  return quizType.id
}

export async function getDatabaseStatistics() {
  const [quizTypesCountResult, usersCountResult, sessionsCountResult, questionsCountResult, answersCountResult] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(quizTypes),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(quizSessions),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(questions),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(answers),
  ])

  return {
    quiz_types: quizTypesCountResult[0]?.count ?? 0,
    users: usersCountResult[0]?.count ?? 0,
    quiz_sessions: sessionsCountResult[0]?.count ?? 0,
    questions: questionsCountResult[0]?.count ?? 0,
    answers: answersCountResult[0]?.count ?? 0,
  }
}

export async function getDatabaseTableRows(table: StatsTableName) {
  if (table === "quiz_types") {
    return typedDb.query.quizTypes.findMany({
      orderBy: [asc(quizTypes.code)],
    })
  }

  if (table === "users") {
    return typedDb.query.users.findMany({
      orderBy: [desc(users.createdAt)],
    })
  }

  if (table === "quiz_sessions") {
    return typedDb.query.quizSessions.findMany({
      orderBy: [desc(quizSessions.startedAt)],
    })
  }

  if (table === "questions") {
    return typedDb.query.questions.findMany({
      orderBy: [asc(questions.position)],
    })
  }

  return typedDb.query.answers.findMany({
    orderBy: [desc(answers.answeredAt)],
  })
}

export async function deleteAllSchemaData() {
  await db.transaction(async (tx) => {
    await tx.delete(answers)
    await tx.delete(questions)
    await tx.delete(quizSessions)
    await tx.delete(users)
  })
}

export async function listUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .orderBy(asc(users.name), desc(users.createdAt))
}

export async function getUserProfile(userId: string) {
  return typedDb.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      name: true,
      age: true,
      gender: true,
      learnedTimetables: true,
    },
  })
}

type UserPerformanceBucket = {
  quiz_type_code: string
  quiz_type_description: string
  sessions: number
  completed_sessions: number
  in_progress_sessions: number
  total_questions: number
  correct_answers: number
  wrong_answers: number
  average_score_percent: number
  total_time_seconds: number
}

function createPerformanceBucket(quizTypeCode: string, quizTypeDescription: string): UserPerformanceBucket {
  return {
    quiz_type_code: quizTypeCode,
    quiz_type_description: quizTypeDescription,
    sessions: 0,
    completed_sessions: 0,
    in_progress_sessions: 0,
    total_questions: 0,
    correct_answers: 0,
    wrong_answers: 0,
    average_score_percent: 0,
    total_time_seconds: 0,
  }
}

export async function getUserPerformanceStats(userId: string) {
  const sessionRows = await db
    .select({
      quizTypeCode: quizTypes.code,
      quizTypeDescription: quizTypes.description,
      totalQuestions: quizSessions.totalQuestions,
      correctCount: quizSessions.correctCount,
      wrongCount: quizSessions.wrongCount,
      scorePercent: quizSessions.scorePercent,
      startedAt: quizSessions.startedAt,
      finishedAt: quizSessions.finishedAt,
    })
    .from(quizSessions)
    .leftJoin(quizTypes, eq(quizSessions.quizTypeId, quizTypes.id))
    .where(eq(quizSessions.userId, userId))

  const overall = createPerformanceBucket("all", "All quiz types")
  const byQuizTypeMap = new Map<string, UserPerformanceBucket>()
  let overallScoreSum = 0
  let overallScoreCount = 0
  const byQuizTypeScore = new Map<string, { sum: number; count: number }>()

  for (const row of sessionRows) {
    const quizTypeCode = row.quizTypeCode ?? "unknown"
    const quizTypeDescription = row.quizTypeDescription ?? "Unknown"

    if (!byQuizTypeMap.has(quizTypeCode)) {
      byQuizTypeMap.set(quizTypeCode, createPerformanceBucket(quizTypeCode, quizTypeDescription))
      byQuizTypeScore.set(quizTypeCode, { sum: 0, count: 0 })
    }

    const byQuizType = byQuizTypeMap.get(quizTypeCode)
    const scoreTracker = byQuizTypeScore.get(quizTypeCode)

    if (!byQuizType || !scoreTracker) {
      continue
    }

    const isCompleted = !!row.finishedAt
    const startMs = row.startedAt ? new Date(row.startedAt).getTime() : NaN
    const endMs = row.finishedAt ? new Date(row.finishedAt).getTime() : Date.now()
    const durationSeconds = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.floor((endMs - startMs) / 1000)
      : 0

    overall.sessions += 1
    overall.completed_sessions += isCompleted ? 1 : 0
    overall.in_progress_sessions += isCompleted ? 0 : 1
    overall.total_questions += row.totalQuestions
    overall.correct_answers += row.correctCount
    overall.wrong_answers += row.wrongCount
    overall.total_time_seconds += durationSeconds

    byQuizType.sessions += 1
    byQuizType.completed_sessions += isCompleted ? 1 : 0
    byQuizType.in_progress_sessions += isCompleted ? 0 : 1
    byQuizType.total_questions += row.totalQuestions
    byQuizType.correct_answers += row.correctCount
    byQuizType.wrong_answers += row.wrongCount
    byQuizType.total_time_seconds += durationSeconds

    if (isCompleted) {
      const score = Number(row.scorePercent)

      overallScoreSum += score
      overallScoreCount += 1

      scoreTracker.sum += score
      scoreTracker.count += 1
    }
  }

  overall.average_score_percent = overallScoreCount > 0 ? Number((overallScoreSum / overallScoreCount).toFixed(2)) : 0

  const by_quiz_type = Array.from(byQuizTypeMap.values())
    .map((item) => {
      const tracker = byQuizTypeScore.get(item.quiz_type_code)
      const average = tracker && tracker.count > 0 ? Number((tracker.sum / tracker.count).toFixed(2)) : 0

      return {
        ...item,
        average_score_percent: average,
      }
    })
    .sort((a, b) => a.quiz_type_description.localeCompare(b.quiz_type_description))

  return {
    overall,
    by_quiz_type,
  }
}

export async function updateUserProfile(
  userId: string,
  payload: {
    name: string
    age?: number
    gender?: "female" | "male" | "other" | "prefer_not_say"
    learnedTimetables: number[]
  }
) {
  const updatedRows = await db
    .update(users)
    .set({
      name: payload.name.trim(),
      age: payload.age ?? null,
      gender: payload.gender ?? null,
      learnedTimetables: sanitizeLearnedTimetables(payload.learnedTimetables),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      age: users.age,
      gender: users.gender,
      learnedTimetables: users.learnedTimetables,
    })

  return updatedRows[0] ?? null
}

export async function listQuizTypes() {
  return db
    .select({
      id: quizTypes.id,
      code: quizTypes.code,
      description: quizTypes.description,
    })
    .from(quizTypes)
    .orderBy(asc(quizTypes.code))
}

export async function createSession(params: {
  difficulty: Difficulty
  totalQuestions: number
  userId?: string
  userName?: string
  userAge?: number
  userGender?: "female" | "male" | "other" | "prefer_not_say"
  learnedTimetables?: number[]
  quizTypeCode?: string
}) {
  let userId: string | null = null
  let learnedTimetables = DEFAULT_LEARNED_TIMETABLES
  const quizTypeId = await getQuizTypeIdByCode(params.quizTypeCode ?? DEFAULT_QUIZ_TYPE_CODE)

  if (params.userId) {
    const existingUser = await typedDb.query.users.findFirst({
      where: eq(users.id, params.userId),
      columns: { id: true, learnedTimetables: true },
    })

    if (existingUser) {
      userId = existingUser.id
      learnedTimetables = sanitizeLearnedTimetables(existingUser.learnedTimetables)
    }
  } else if (params.userName && params.userName.trim().length > 0) {
    learnedTimetables = sanitizeLearnedTimetables(params.learnedTimetables)

    const insertedUsers = await db
      .insert(users)
      .values({
        name: params.userName.trim(),
        age: params.userAge,
        gender: params.userGender,
        learnedTimetables,
      })
      .returning({ id: users.id, learnedTimetables: users.learnedTimetables })
    const user = insertedUsers[0]
    if (user) {
      userId = user.id
      learnedTimetables = sanitizeLearnedTimetables(user.learnedTimetables)
    }
  }

  const insertedSessions = await db
    .insert(quizSessions)
    .values({
      userId,
      quizTypeId,
      difficulty: params.difficulty,
      totalQuestions: params.totalQuestions,
    })
    .returning({
      id: quizSessions.id,
      quizTypeId: quizSessions.quizTypeId,
      difficulty: quizSessions.difficulty,
      totalQuestions: quizSessions.totalQuestions,
    })

  const session = insertedSessions[0]
  if (!session) {
    throw new Error("Failed to create session")
  }

  return {
    ...session,
    learnedTimetables,
  }
}

export async function insertQuestions(sessionId: string, quizTypeId: string, generated: GeneratedQuestion[]) {
  await db.insert(questions).values(
    generated.map((item) => ({
      sessionId,
      quizTypeId,
      a: item.a,
      b: item.b,
      c: item.c,
      d: item.d,
      correct: item.correct,
      position: item.position,
    }))
  )

  return typedDb.query.questions.findMany({
    where: eq(questions.sessionId, sessionId),
    orderBy: [asc(questions.position)],
    columns: {
      id: true,
      a: true,
      b: true,
      c: true,
      d: true,
      position: true,
    },
  })
}

export async function listSessions() {
  return db
    .select({
      id: quizSessions.id,
      userId: quizSessions.userId,
      difficulty: quizSessions.difficulty,
      totalQuestions: quizSessions.totalQuestions,
      scorePercent: quizSessions.scorePercent,
      startedAt: quizSessions.startedAt,
      finishedAt: quizSessions.finishedAt,
      userName: users.name,
      quizTypeCode: quizTypes.code,
    })
    .from(quizSessions)
    .leftJoin(users, eq(quizSessions.userId, users.id))
    .leftJoin(quizTypes, eq(quizSessions.quizTypeId, quizTypes.id))
    .orderBy(desc(quizSessions.startedAt))
}

export async function getSessionById(sessionId: string) {
  const session = await typedDb.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  })

  if (!session) {
    return null
  }

  const user = session.userId
    ? await typedDb.query.users.findFirst({
        where: eq(users.id, session.userId),
        columns: { name: true },
      })
    : null

  const sessionQuestions = await typedDb.query.questions.findMany({
    where: eq(questions.sessionId, sessionId),
    orderBy: [asc(questions.position)],
  })

  const answerRows = await typedDb.query.answers.findMany({
    where: inArray(
      answers.questionId,
      sessionQuestions.map((q) => q.id)
    ),
  })

  return {
    session: {
      ...session,
      userName: user?.name ?? null,
      quizTypeCode: (
        await typedDb.query.quizTypes.findFirst({
          where: eq(quizTypes.id, session.quizTypeId),
          columns: { code: true },
        })
      )?.code ?? null,
    },
    questions: sessionQuestions.map((question) => ({
      ...question,
      answer: answerRows.find((row) => row.questionId === question.id) || null,
    })),
  }
}

export async function submitAnswer(questionId: string, value: number) {
  const question = await typedDb.query.questions.findFirst({
    where: eq(questions.id, questionId),
  })

  if (!question) {
    return null
  }

  const isCorrect = value === question.correct

  const existing = await typedDb.query.answers.findFirst({
    where: eq(answers.questionId, questionId),
  })

  if (!existing) {
    await db.insert(answers).values({
      questionId,
      quizTypeId: question.quizTypeId,
      value,
      isCorrect,
    })
  }

  const sessionId = question.sessionId
  const allQuestions = await typedDb.query.questions.findMany({
    where: eq(questions.sessionId, sessionId),
    columns: { id: true },
  })

  const allAnswers = await typedDb.query.answers.findMany({
    where: inArray(
      answers.questionId,
      allQuestions.map((row) => row.id)
    ),
    columns: { isCorrect: true },
  })

  const correctCount = allAnswers.filter((row) => row.isCorrect).length
  const wrongCount = allAnswers.length - correctCount

  const session = await typedDb.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  })

  if (!session) {
    return null
  }

  const percent = calculatePercent(correctCount, session.totalQuestions)
  const finishedAt = allAnswers.length >= session.totalQuestions ? new Date() : null

  const updatedRows = await db
    .update(quizSessions)
    .set({
      correctCount,
      wrongCount,
      scorePercent: String(percent),
      finishedAt,
    })
    .where(eq(quizSessions.id, sessionId))
    .returning({
      correctCount: quizSessions.correctCount,
      wrongCount: quizSessions.wrongCount,
      scorePercent: quizSessions.scorePercent,
    })

  const updated = updatedRows[0]
  if (!updated) {
    throw new Error("Failed to update session score")
  }

  return {
    isCorrect,
    correctValue: question.correct,
    session: {
      correct: updated.correctCount,
      wrong: updated.wrongCount,
      percent: Number(updated.scorePercent),
    },
  }
}
