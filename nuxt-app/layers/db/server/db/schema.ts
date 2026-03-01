import { sql } from "drizzle-orm"
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    difficulty: text("difficulty").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    correctCount: integer("correct_count").default(0).notNull(),
    wrongCount: integer("wrong_count").default(0).notNull(),
    scorePercent: numeric("score_percent", { precision: 5, scale: 2 }).default("0").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    check("quiz_sessions_difficulty_check", sql`${table.difficulty} in ('low', 'medium', 'hard')`),
    check("quiz_sessions_total_questions_check", sql`${table.totalQuestions} > 0`),
    index("idx_sessions_started").on(table.startedAt),
  ]
)

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => quizSessions.id, { onDelete: "cascade" }),
    a: integer("a").notNull(),
    b: integer("b").notNull(),
    correct: integer("correct").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    check("questions_a_check", sql`${table.a} between 1 and 10`),
    check("questions_b_check", sql`${table.b} between 1 and 10`),
    check("questions_position_check", sql`${table.position} >= 1`),
    unique("questions_session_position_unique").on(table.sessionId, table.position),
    index("idx_questions_session").on(table.sessionId),
  ]
)

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    value: integer("value").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("answers_question_unique").on(table.questionId),
    index("idx_answers_question").on(table.questionId),
  ]
)
