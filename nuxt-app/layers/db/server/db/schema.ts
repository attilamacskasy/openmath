import { sql } from "drizzle-orm"
import { boolean, check, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"

export const quizTypes = pgTable(
  "quiz_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("quiz_types_code_unique").on(table.code)]
)

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  age: integer("age"),
  gender: text("gender"),
  learnedTimetables: integer("learned_timetables").array().notNull().default([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
  (table) => [
    check("users_age_check", sql`${table.age} is null or ${table.age} between 4 and 120`),
    check("users_gender_check", sql`${table.gender} is null or ${table.gender} in ('female', 'male', 'other', 'prefer_not_say')`),
  ])

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    quizTypeId: uuid("quiz_type_id").notNull().references(() => quizTypes.id),
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
    index("idx_sessions_quiz_type").on(table.quizTypeId),
    index("idx_sessions_started").on(table.startedAt),
  ]
)

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => quizSessions.id, { onDelete: "cascade" }),
    quizTypeId: uuid("quiz_type_id").notNull().references(() => quizTypes.id),
    a: integer("a").notNull(),
    b: integer("b").notNull(),
    c: integer("c"),
    d: integer("d"),
    correct: integer("correct").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    check("questions_a_check", sql`${table.a} between 1 and 10`),
    check("questions_b_check", sql`${table.b} between 1 and 10`),
    check("questions_c_check", sql`${table.c} is null or ${table.c} between 1 and 10`),
    check("questions_d_check", sql`${table.d} is null or ${table.d} between 1 and 10`),
    check("questions_position_check", sql`${table.position} >= 1`),
    unique("questions_session_position_unique").on(table.sessionId, table.position),
    index("idx_questions_quiz_type").on(table.quizTypeId),
    index("idx_questions_session").on(table.sessionId),
  ]
)

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    quizTypeId: uuid("quiz_type_id").notNull().references(() => quizTypes.id),
    value: integer("value").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique("answers_question_unique").on(table.questionId),
    index("idx_answers_quiz_type").on(table.quizTypeId),
    index("idx_answers_question").on(table.questionId),
  ]
)
