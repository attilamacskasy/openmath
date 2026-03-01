import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

const pool = new Pool({
  connectionString: databaseUrl,
})

export const db = drizzle(pool)

export const typedDb = drizzle(pool, {
  schema,
})
