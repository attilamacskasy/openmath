import type { Difficulty } from "./types"

export const difficultySets: Record<Difficulty, number[]> = {
  low: [1, 5, 10],
  medium: [1, 2, 3, 4, 5, 6, 10],
  hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

export function isDifficulty(value: string): value is Difficulty {
  return value === "low" || value === "medium" || value === "hard"
}
