import { listSessions } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  const sessions = await listSessions()
  return sessions.map((session: {
    id: string
    studentId: string | null
    difficulty: string
    totalQuestions: number
    scorePercent: string | number
    startedAt: Date
    finishedAt: Date | null
    studentName: string | null
    quizTypeCode: string | null
  }) => ({
    id: session.id,
    student_id: session.studentId,
    difficulty: session.difficulty,
    total_questions: session.totalQuestions,
    score_percent: Number(session.scorePercent),
    started_at: session.startedAt,
    finished_at: session.finishedAt,
    student_name: session.studentName,
    quiz_type_code: session.quizTypeCode,
  }))
})
