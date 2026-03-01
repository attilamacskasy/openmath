# Multiplication Practice — Full-Stack Web App SPEC (Nuxt 4 + Nitro + PostgreSQL)

## 1) Goal (v2)
Create a **modern web app** that provides multiplication practice (Grade 2) with:
- Difficulty selection (`low`, `medium`, `hard`)
- Persistent storage of **attempts, answers, scoring, and history**
- Teacher/parent can review results over time

Tech stack:
- **Nuxt 4** (Vue)
- **Nitro** (server routes / API)
- **PostgreSQL** as the database

## 2) Core Features
### Student
- Start a quiz (choose difficulty + number of questions)
- Answer questions one-by-one
- See final results (correct/wrong + %)

### History / Review
- See previous quiz sessions with score and details
- Drill down into a session to see each question + student answer + correctness

### Admin/Parent (optional v2)
- View aggregated stats (by difficulty, by table, by time)

## 3) Key Decisions
- **Server generates questions** and stores them in DB for replay/auditability.
- Each quiz is a **session** with many **questions** and **answers** (1 per question).
- Difficulty is enforced by how questions are generated (tables/operands).

## 4) Directory Structure (Nuxt 4 + Nitro)
```
.
├─ app/
│  ├─ pages/
│  │  ├─ index.vue                # start screen (difficulty + quiz length)
│  │  ├─ quiz/[sessionId].vue      # quiz runner UI
│  │  └─ history/
│  │     ├─ index.vue             # sessions list
│  │     └─ [sessionId].vue       # session details
│  ├─ components/
│  │  ├─ DifficultySelect.vue
│  │  ├─ QuestionCard.vue
│  │  └─ ResultSummary.vue
│  └─ composables/
│     ├─ useApi.ts                # tiny API wrapper (fetch)
│     └─ useSession.ts            # client session helpers
│
├─ server/
│  ├─ api/
│  │  ├─ sessions.post.ts         # create quiz session + generated questions
│  │  ├─ sessions.get.ts          # list sessions (history)
│  │  ├─ sessions/[id].get.ts     # session details (questions+answers)
│  │  └─ answers.post.ts          # submit an answer for a question
│  ├─ db/
│  │  ├─ index.ts                 # db client (pool)
│  │  ├─ schema.sql               # SQL schema (or migrations)
│  │  └─ queries.ts               # small query helpers
│  └─ logic/
│     ├─ difficulty.ts            # defines difficulty sets
│     ├─ generator.ts             # question generation
│     └─ scoring.ts               # scoring % + summary
│
├─ .env                           # DATABASE_URL=postgres://...
└─ package.json
```

## 5) Database Model (PostgreSQL)
### Entities
- **students** (optional; allow anonymous sessions by keeping nullable `student_id`)
- **quiz_sessions** (one quiz run)
- **questions** (generated question per session)
- **answers** (student answer per question)

### SQL Schema (traceable + replayable)
```sql
-- Enable gen_random_uuid() (one-time):
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE students (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NULL REFERENCES students(id) ON DELETE SET NULL,
  difficulty      TEXT NOT NULL CHECK (difficulty IN ('low','medium','hard')),
  total_questions INT NOT NULL CHECK (total_questions > 0),
  correct_count   INT NOT NULL DEFAULT 0,
  wrong_count     INT NOT NULL DEFAULT 0,
  score_percent   NUMERIC(5,2) NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ NULL
);

CREATE TABLE questions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  a          INT NOT NULL CHECK (a BETWEEN 1 AND 10),
  b          INT NOT NULL CHECK (b BETWEEN 1 AND 10),
  correct    INT NOT NULL,                 -- store a*b for audit
  position   INT NOT NULL CHECK (position >= 1),
  UNIQUE (session_id, position)
);

CREATE TABLE answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  value       INT NOT NULL,
  is_correct  BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)                     -- one answer per question (v2)
);

CREATE INDEX idx_questions_session ON questions(session_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_sessions_started ON quiz_sessions(started_at DESC);
```

## 6) Difficulty Logic (Server-side)
Table sets:
- `low` => `{1, 5, 10}`
- `medium` => `{2, 3, 4, 6}` (may mix in some low)
- `hard` => `{7, 8, 9}` (may mix in all)

Generation rule (simple):
- pick `a` from the selected set (or weighted mix)
- pick `b` uniformly from `1..10`
- save `(a, b, correct=a*b, position)` into `questions`

## 7) API Contract (Nitro)
### Create session + questions
`POST /api/sessions`
```json
{ "difficulty": "low", "totalQuestions": 10, "studentName": "Anna" }
```
Returns:
```json
{ "sessionId": "...", "questions": [{ "id": "...", "a": 5, "b": 7, "position": 1 }] }
```

### Submit answer
`POST /api/answers`
```json
{ "questionId": "...", "value": 35 }
```
Returns:
```json
{ "isCorrect": true, "correctValue": 35, "session": { "correct": 3, "wrong": 1, "percent": 75 } }
```

### History + details
- `GET /api/sessions` -> list sessions (id, difficulty, score_percent, started_at)
- `GET /api/sessions/:id` -> session + questions + answers

## 8) Scoring & Finalization
- On each submitted answer:
  - compute `is_correct` using stored `questions.correct`
  - update `quiz_sessions.correct_count/wrong_count`
  - recompute `score_percent = correct_count / total_questions * 100`
- When answered count == total_questions → set `finished_at`.

## 9) UI Pages
- `/` start: difficulty + question count + optional name
- `/quiz/:sessionId`: show questions in order, submit answers
- `/history`: list past sessions
- `/history/:sessionId`: audit view of Q/A per question

## 10) Acceptance Criteria (v2)
- All sessions, questions, answers are stored and retrievable (full audit trail).
- Difficulty selection changes the generated questions.
- Score percent is correct and consistent with stored answers.
- History screens match DB records.
