import { difficultySets } from "./difficulty"
import type { Difficulty } from "./types"

export type GeneratedQuestion = {
  a: number
  b: number
  correct: number
  position: number
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function generateQuestions(difficulty: Difficulty, totalQuestions: number): GeneratedQuestion[] {
  const focusSet = difficultySets[difficulty]

  return Array.from({ length: totalQuestions }, (_, index) => {
    const focusFactor = focusSet[randomInt(0, focusSet.length - 1)] ?? 1
    const otherFactor = randomInt(1, 10)
    const swap = Math.random() >= 0.5
    const a = swap ? otherFactor : focusFactor
    const b = swap ? focusFactor : otherFactor

    return {
      a,
      b,
      correct: a * b,
      position: index + 1,
    }
  })
}
