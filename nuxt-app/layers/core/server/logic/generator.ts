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

function pickFactors(focusSet: number[], learnedSet: number[]) {
  const focusFactor = focusSet[randomInt(0, focusSet.length - 1)] ?? learnedSet[0] ?? 1
  const otherFactor = learnedSet[randomInt(0, learnedSet.length - 1)] ?? 1
  const swap = Math.random() >= 0.5

  return {
    a: swap ? otherFactor : focusFactor,
    b: swap ? focusFactor : otherFactor,
  }
}

function normalizeLearnedTimetables(learnedTimetables: number[]) {
  const valid = learnedTimetables.filter((item) => Number.isInteger(item) && item >= 1 && item <= 10)

  if (valid.length === 0) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  }

  return [...new Set(valid)]
}

export function generateQuestions(
  difficulty: Difficulty,
  totalQuestions: number,
  quizTypeCode: string,
  learnedTimetables: number[]
): GeneratedQuestion[] {
  const learnedSet = normalizeLearnedTimetables(learnedTimetables)
  const difficultySet = difficultySets[difficulty]
  const focusSet = difficultySet.filter((item) => learnedSet.includes(item))
  const effectiveFocus = focusSet.length > 0 ? focusSet : learnedSet

  return Array.from({ length: totalQuestions }, (_, index) => {
    if (quizTypeCode === "sum_products_1_10") {
      const first = pickFactors(effectiveFocus, learnedSet)
      const second = pickFactors(effectiveFocus, learnedSet)

      return {
        a: first.a,
        b: first.b,
        c: second.a,
        d: second.b,
        correct: first.a * first.b + second.a * second.b,
        position: index + 1,
      }
    }

    const first = pickFactors(effectiveFocus, learnedSet)

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
