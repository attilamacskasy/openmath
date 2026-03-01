import { createError } from "h3"
import { getDatabaseTableRows, statsTableNames, type StatsTableName } from "~~/layers/db/server/db/queries"

function isStatsTableName(value: string): value is StatsTableName {
  return statsTableNames.includes(value as StatsTableName)
}

export default defineEventHandler(async (event) => {
  const table = getRouterParam(event, "table")

  if (!table || !isStatsTableName(table)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid table name" })
  }

  const rows = await getDatabaseTableRows(table)

  return {
    table,
    rows,
  }
})