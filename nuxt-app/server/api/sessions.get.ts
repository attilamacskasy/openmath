import { listSessions } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  const sessions = await listSessions()
  return sessions.map((session: {
    id: string
    userId: string | null
    difficulty: string
    totalQuestions: number
    scorePercent: string | number
    startedAt: Date
    finishedAt: Date | null
    userName: string | null
    quizTypeCode: string | null
  }) => ({
    id: session.id,
    user_id: session.userId,
    difficulty: session.difficulty,
    total_questions: session.totalQuestions,
    score_percent: Number(session.scorePercent),
    started_at: session.startedAt,
    finished_at: session.finishedAt,
    user_name: session.userName,
    quiz_type_code: session.quizTypeCode,
  }))
})
