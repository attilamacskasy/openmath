export type Difficulty = "low" | "medium" | "hard"

export type QuestionPayload = {
  id: string
  a: number
  b: number
  position: number
}

export type SessionStats = {
  correct: number
  wrong: number
  percent: number
}
