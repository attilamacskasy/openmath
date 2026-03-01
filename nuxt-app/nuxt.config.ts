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
    databaseUrl: process.env.DATABASE_URL || "",
  },
})
