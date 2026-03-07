import { listUsers } from "~~/layers/db/server/db/queries"

export default defineEventHandler(async () => {
  const users = await listUsers()

  return users.map((user) => ({
    id: user.id,
    name: user.name,
  }))
})