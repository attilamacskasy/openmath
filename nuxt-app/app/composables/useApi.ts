export function useApi() {
  type StatsTableName = "quiz_types" | "students" | "quiz_sessions" | "questions" | "answers"

  const createSession = (payload: {
    difficulty: string
    totalQuestions: number
    studentId?: string
    studentName?: string
    studentAge?: number
    studentGender?: "female" | "male" | "other" | "prefer_not_say"
    learnedTimetables?: number[]
    quizTypeCode?: string
  }) => {
    return $fetch<{
      sessionId: string
      quizTypeCode: string
      questions: Array<{ id: string; a: number; b: number; c: number | null; d: number | null; position: number }>
    }>("/api/sessions", {
      method: "POST",
      body: payload,
    })
  }

  const listStudents = () => {
    return $fetch<Array<{ id: string; name: string }>>("/api/students")
  }

  const getStudentProfile = (id: string) => {
    return $fetch<{
      id: string
      name: string
      age: number | null
      gender: "female" | "male" | "other" | "prefer_not_say" | null
      learned_timetables: number[]
    }>(`/api/students/${id}`)
  }

  const updateStudentProfile = (
    id: string,
    payload: {
      name: string
      age: number | null
      gender: "female" | "male" | "other" | "prefer_not_say" | null
      learned_timetables: number[]
    }
  ) => {
    return $fetch<{
      id: string
      name: string
      age: number | null
      gender: "female" | "male" | "other" | "prefer_not_say" | null
      learned_timetables: number[]
    }>(`/api/students/${id}`, {
      method: "PATCH",
      body: payload,
    })
  }

  const listQuizTypes = () => {
    return $fetch<Array<{ id: string; code: string; description: string }>>("/api/quiz-types")
  }

  const submitAnswer = (payload: { questionId: string; value: number }) => {
    return $fetch<{ isCorrect: boolean; correctValue: number; session: { correct: number; wrong: number; percent: number } }>(
      "/api/answers",
      {
        method: "POST",
        body: payload,
      }
    )
  }

  const listSessions = () => {
    return $fetch<
      Array<{
        id: string
        difficulty: string
        total_questions: number
        score_percent: number
        started_at: string
        finished_at: string | null
        student_name: string | null
        quiz_type_code: string | null
      }>
    >(
      "/api/sessions"
    )
  }

  const getSession = (id: string) => {
    return $fetch(`/api/sessions/${id}`)
  }

  const getDatabaseStats = () => {
    return $fetch<{ quiz_types: number; students: number; quiz_sessions: number; questions: number; answers: number }>("/api/stats")
  }

  const getDatabaseTableRows = (table: StatsTableName) => {
    return $fetch<{ table: StatsTableName; rows: Array<Record<string, unknown>> }>(`/api/stats/${table}`)
  }

  const deleteAllSchemaData = (confirmation: string) => {
    return $fetch<{ success: boolean }>("/api/stats/reset", {
      method: "POST",
      body: { confirmation },
    })
  }

  return {
    createSession,
    listStudents,
    getStudentProfile,
    updateStudentProfile,
    listQuizTypes,
    submitAnswer,
    listSessions,
    getSession,
    getDatabaseStats,
    getDatabaseTableRows,
    deleteAllSchemaData,
  }
}
