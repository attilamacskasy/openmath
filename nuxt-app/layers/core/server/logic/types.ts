export type Difficulty = "low" | "medium" | "hard"

export type QuestionPayload = {
  id: string
  a: number
  b: number
  c?: number | null
  d?: number | null
  position: number
}

export type SessionStats = {
  correct: number
  wrong: number
  percent: number
}
