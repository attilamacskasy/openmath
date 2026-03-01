# Multiplication Practice — Full-Stack Web App SPEC (React + Laravel + PostgreSQL + Chakra UI)

## 1) Goal (v3)
Create a modern web app for Grade 2 multiplication practice with:
- Difficulty selection (`low`, `medium`, `hard`)
- Quiz sessions with stored questions + answers + scoring
- History and session detail views (audit trail)

Tech stack:
- **React** (frontend)
- **Chakra UI** (frontend component library)
- **Laravel** (backend API)
- **PostgreSQL** (database)

## 2) Recommended UI Controls / Component Library
Use **Chakra UI** for React:
- Accessible-by-default primitives, strong theming system, and clean developer experience.
- Fits this app well with ready components for forms, feedback, layout, and tables.
- Easy to keep a kid-friendly visual style with custom color tokens and component variants.

Suggested components:
- Layout: `Container`, `Box`, `Stack`, `Flex`, `Heading`
- Start screen: `RadioGroup` (difficulty), `Input` (name), `Slider` or `Select` (question count), `Button`
- Quiz: `Card` (or `Box` + style recipe), `Text`, numeric `Input`, `Button`, `Progress` (progress), `Toast` (feedback)
- Results: `Card`/`Box`, `Alert`, `CircularProgress` (score visualization)
- History: `Table`, `Badge` (difficulty badge)

Optional alternatives include MUI or Ant Design, but this spec standardizes on Chakra UI.

## 3) Core Features
### Student
- Start quiz: choose difficulty + number of questions (default 10) + optional name
- Answer questions one-by-one
- Final summary: correct/wrong + percent score

### History / Review
- List previous quiz sessions
- Session detail: each question + correct value + student answer + correctness

## 4) Key Decisions
- Backend generates questions and stores them for replay/audit.
- A quiz is a **session** with N **questions**; each question has max 1 **answer** (v3).
- Difficulty is enforced by question generation rules.

## 5) Repository / Folder Structure (monorepo style)
```
.
├─ frontend/                  # React app
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ Home.tsx          # start screen
│  │  │  ├─ Quiz.tsx          # /quiz/:sessionId
│  │  │  ├─ History.tsx       # sessions list
│  │  │  └─ Session.tsx       # session detail
│  │  ├─ components/
│  │  │  ├─ DifficultySelect.tsx
│  │  │  ├─ QuestionCard.tsx
│  │  │  ├─ ResultSummary.tsx
│  │  │  └─ SessionTable.tsx
│  │  ├─ api/
│  │  │  └─ client.ts         # fetch/axios wrapper
│  │  ├─ hooks/
│  │  │  └─ useSession.ts
│  │  └─ routes.tsx
│  └─ package.json
│
├─ backend/                   # Laravel app
│  ├─ app/
│  │  ├─ Http/
│  │  │  ├─ Controllers/
│  │  │  │  ├─ SessionController.php
│  │  │  │  └─ AnswerController.php
│  │  │  └─ Requests/
│  │  │     ├─ CreateSessionRequest.php
│  │  │     └─ SubmitAnswerRequest.php
│  │  ├─ Models/
│  │  │  ├─ Student.php
│  │  │  ├─ QuizSession.php
│  │  │  ├─ Question.php
│  │  │  └─ Answer.php
│  │  └─ Services/
│  │     ├─ Difficulty.php
│  │     ├─ QuestionGenerator.php
│  │     └─ ScoringService.php
│  ├─ database/
│  │  ├─ migrations/
│  │  └─ seeders/            # optional
│  ├─ routes/
│  │  └─ api.php
│  └─ composer.json
│
└─ docker-compose.yml         # optional (postgres + apps)
```

## 6) Database Model (PostgreSQL)
Same traceable model as the Nuxt version.

### SQL Schema (reference)
```sql
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
  correct    INT NOT NULL,
  position   INT NOT NULL CHECK (position >= 1),
  UNIQUE (session_id, position)
);

CREATE TABLE answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  value       INT NOT NULL,
  is_correct  BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

CREATE INDEX idx_questions_session ON questions(session_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_sessions_started ON quiz_sessions(started_at DESC);
```

## 7) Laravel API (routes + payloads)
Base: `/api`

### Create session + questions
`POST /api/sessions`
Request:
```json
{ "difficulty": "low", "totalQuestions": 10, "studentName": "Anna" }
```
Response:
```json
{
  "sessionId": "uuid",
  "questions": [
    { "id": "uuid", "a": 5, "b": 7, "position": 1 }
  ]
}
```

### Submit answer
`POST /api/answers`
Request:
```json
{ "questionId": "uuid", "value": 35 }
```
Response:
```json
{
  "isCorrect": true,
  "correctValue": 35,
  "session": { "correct": 3, "wrong": 1, "percent": 75 }
}
```

### History list
`GET /api/sessions`
Response: array of `{ id, difficulty, score_percent, started_at, finished_at }`

### Session detail
`GET /api/sessions/{id}`
Response: session + questions + answer rows

## 8) Backend Services (Laravel)
Keep controllers thin; put logic in services:
- `Difficulty.php`: defines sets:
  - low => {1,5,10}
  - medium => {2,3,4,6}
  - hard => {7,8,9}
- `QuestionGenerator.php`: builds N questions, persists them with positions
- `ScoringService.php`: updates counters + percent; finalizes session when complete

## 9) React Pages (UI behavior)
- **Home**:
  - `RadioGroup` difficulty
  - `Slider` (e.g. 5–30) question count
  - `Input` optional name
  - Start button → calls `POST /sessions`, navigates to `/quiz/:sessionId`
- **Quiz**:
  - Displays current question in `Card`
  - Numeric `Input` + submit
  - `Progress` (answered / total)
  - Optional `Toast` feedback
- **History**:
  - `Table` listing sessions + score + date, click row → details
- **Session**:
  - `Table` of questions with user answer and correctness (`Badge`/`Icon`)

## 10) Acceptance Criteria (v3)
- Questions are generated server-side according to difficulty.
- Each submitted answer is stored and correctness is computed from stored `questions.correct`.
- Session stats (correct/wrong/percent) update reliably and are consistent with stored answers.
- History + session detail screens can reproduce past quizzes exactly.

