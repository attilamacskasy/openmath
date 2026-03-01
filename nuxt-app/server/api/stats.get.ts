import { getDatabaseStatistics } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  return getDatabaseStatistics()
})