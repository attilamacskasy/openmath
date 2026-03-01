import { asc, desc, eq, inArray, sql } from "drizzle-orm"
import { db, typedDb } from "./client"
import { answers, questions, quizSessions, quizTypes, students } from "./schema"
import { calculatePercent } from "../../../core/server/logic/scoring"
import type { Difficulty } from "../../../core/server/logic/types"
import type { GeneratedQuestion } from "../../../core/server/logic/generator"

export const DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"

export const statsTableNames = ["quiz_types", "students", "quiz_sessions", "questions", "answers"] as const
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
  const [quizTypesCountResult, studentsCountResult, sessionsCountResult, questionsCountResult, answersCountResult] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(quizTypes),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(students),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(quizSessions),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(questions),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(answers),
  ])

  return {
    quiz_types: quizTypesCountResult[0]?.count ?? 0,
    students: studentsCountResult[0]?.count ?? 0,
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

  if (table === "students") {
    return typedDb.query.students.findMany({
      orderBy: [desc(students.createdAt)],
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
    await tx.delete(students)
  })
}

export async function listStudents() {
  return db
    .select({
      id: students.id,
      name: students.name,
    })
    .from(students)
    .orderBy(asc(students.name), desc(students.createdAt))
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
  studentId?: string
  studentName?: string
  quizTypeCode?: string
}) {
  let studentId: string | null = null
  const quizTypeId = await getQuizTypeIdByCode(params.quizTypeCode ?? DEFAULT_QUIZ_TYPE_CODE)

  if (params.studentId) {
    const existingStudent = await typedDb.query.students.findFirst({
      where: eq(students.id, params.studentId),
      columns: { id: true },
    })

    if (existingStudent) {
      studentId = existingStudent.id
    }
  } else if (params.studentName && params.studentName.trim().length > 0) {
    const insertedStudents = await db.insert(students).values({ name: params.studentName.trim() }).returning({ id: students.id })
    const student = insertedStudents[0]
    if (student) {
      studentId = student.id
    }
  }

  const insertedSessions = await db
    .insert(quizSessions)
    .values({
      studentId,
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

  return session
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
      difficulty: quizSessions.difficulty,
      totalQuestions: quizSessions.totalQuestions,
      scorePercent: quizSessions.scorePercent,
      startedAt: quizSessions.startedAt,
      finishedAt: quizSessions.finishedAt,
      studentName: students.name,
      quizTypeCode: quizTypes.code,
    })
    .from(quizSessions)
    .leftJoin(students, eq(quizSessions.studentId, students.id))
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

  const student = session.studentId
    ? await typedDb.query.students.findFirst({
        where: eq(students.id, session.studentId),
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
      studentName: student?.name ?? null,
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
