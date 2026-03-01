import { listQuizTypes } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  const quizTypes = await listQuizTypes()

  return quizTypes.map((quizType) => ({
    id: quizType.id,
    code: quizType.code,
    description: quizType.description,
  }))
})