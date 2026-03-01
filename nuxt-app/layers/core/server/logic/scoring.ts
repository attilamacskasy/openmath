export function calculatePercent(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) {
    return 0
  }

  return Number(((correctCount / totalQuestions) * 100).toFixed(2))
}
