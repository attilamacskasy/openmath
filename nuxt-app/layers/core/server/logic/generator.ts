import { difficultySets } from "./difficulty"
import type { Difficulty } from "./types"

export type GeneratedQuestion = {
  a: number
  b: number
  c: number | null
  d: number | null
  correct: number
  position: number
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickFactors(focusSet: number[]) {
  const focusFactor = focusSet[randomInt(0, focusSet.length - 1)] ?? 1
  const otherFactor = randomInt(1, 10)
  const swap = Math.random() >= 0.5

  return {
    a: swap ? otherFactor : focusFactor,
    b: swap ? focusFactor : otherFactor,
  }
}

export function generateQuestions(difficulty: Difficulty, totalQuestions: number, quizTypeCode: string): GeneratedQuestion[] {
  const focusSet = difficultySets[difficulty]

  return Array.from({ length: totalQuestions }, (_, index) => {
    if (quizTypeCode === "sum_products_1_10") {
      const first = pickFactors(focusSet)
      const second = pickFactors(focusSet)

      return {
        a: first.a,
        b: first.b,
        c: second.a,
        d: second.b,
        correct: first.a * first.b + second.a * second.b,
        position: index + 1,
      }
    }

    const first = pickFactors(focusSet)

    return {
      a: first.a,
      b: first.b,
      c: null,
      d: null,
      correct: first.a * first.b,
      position: index + 1,
    }
  })
}
