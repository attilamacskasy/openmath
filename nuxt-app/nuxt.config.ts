import { readFileSync } from 'fs'
import { resolve } from 'path'

function readVersion(): string {
  try {
    const data = JSON.parse(readFileSync(resolve(__dirname, '..', 'version.json'), 'utf-8'))
    return data.components['nuxt-app'] || data.app.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: true },
  extends: ["./layers/core", "./layers/db", "./layers/ui"],
  components: [
    "~/components",
    "~~/layers/ui/components",
    "~~/layers/ui/reka",
  ],
  runtimeConfig: {
    public: {
      appVersion: readVersion(),
    },
    databaseUrl: process.env.DATABASE_URL || "",
  },
})
