# OpenMath — Implementation-Faithful SPEC (React + Laravel + PostgreSQL + Chakra UI)

## 1) Purpose
This spec captures the **currently implemented behavior** of the Nuxt 4 + Nitro + Drizzle + PostgreSQL + Reka UI app and translates it into an exact target blueprint for a **React + Laravel + PostgreSQL + Chakra UI** implementation.

Goal: when generating the React/Laravel version, it should reproduce the same:
- Data model and constraints
- API contracts and validation behavior
- Quiz generation/scoring logic
- UI flows, page behavior, and user-visible states

---

## 2) Current Product Scope (as implemented)
OpenMath is a quiz platform centered on multiplication practice, with student profiles and session history.

### Implemented quiz types
1. `multiplication_1_10`
   - Question shape: `a x b`
   - Correct answer: `a * b`
2. `sum_products_1_10`
   - Question shape: `(a x b) + (c x d)`
   - Correct answer: `(a * b) + (c * d)`

### Implemented difficulty labels
- `low`
- `medium`
- `hard`

### Difficulty sets currently used by generator
> Important: this reflects current code exactly (not an idealized mapping)

- `low`: `[1, 5, 10]`
- `medium`: `[1, 2, 3, 4, 5, 6, 10]`
- `hard`: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`

### Main user areas
- Start page (create session)
- Quiz page (answer pending questions)
- History list (grouped by quiz type)
- Session detail page
- Student profile page
- User guide page
- Database statistics/admin page

---

## 3) UX and Navigation Behavior
## 3.1 Global layout
Header navigation links:
- Start (`/`)
- Profile (`/profile`)
- History (`/history`)
- User Guide (`/user-guide`)
- Database Statistics (`/database-stats`)

Global state in UI:
- `currentStudentId` (active student selector in header)
- `studentsDirectory` (`id`, `name` list)

Header student selector:
- Option `"No student"` (`""` value)
- All known students from `GET /api/students`
- If persisted selected student no longer exists, reset to `""`

Footer shows static app metadata (`OpenMath v1.5`, source link, stack text).

## 3.2 Start page (`/`)
Fields:
- Quiz type select (`quizTypeCode`)
- Difficulty radio (`low|medium|hard`)
- New student fields (shown only when no active student selected):
  - `studentName` (required in this mode)
  - `studentAge` (optional, 4..120)
  - `studentGender` (`female|male|other|prefer_not_say`)
  - `learnedTimetables` checkboxes (1..10, at least one in this mode)
- `totalQuestions` number input (`min=1`, `max=30`, default `10`)

Behavior:
- If no active student and empty name -> show: `Please enter a new student name.`
- If no active student and no timetable selected -> show: `Please select at least one learned timetable.`
- On submit, call `POST /api/sessions`
- Store returned quiz in local app state (`activeQuiz`):
  - `sessionId`, `quizTypeCode`, `questions`
- Navigate to `/quiz/:sessionId`
- On API failure -> `Could not start quiz.`

Initialization:
- Loads quiz types via `GET /api/quiz-types`
- Defaults selected quiz type to `multiplication_1_10` unless absent, then first available type

## 3.3 Quiz page (`/quiz/:sessionId`)
Displayed:
- `Quiz type: <quizTypeCode>` (if known)
- Progress bar: `answeredCount / total`
- Current question card and numeric input

Session bootstrap rules:
1. If `activeQuiz.sessionId` matches route:
   - Use in-memory questions directly
   - `initialAnsweredCount = 0`
   - `totalQuestionCount = questions.length`
2. Else load full session detail from `GET /api/sessions/:id`:
   - Keep only unanswered questions (`row.answer == null`) as pending queue
   - `initialAnsweredCount = totalQuestions - unansweredCount`
   - `totalQuestionCount = total questions in session`
   - Seed summary from stored session counts

Answer submit behavior:
- Call `POST /api/answers` with `{ questionId, value }`
- Feedback text:
  - Correct: `Correct!`
  - Wrong: `Wrong, correct answer is X.`
- Update result summary from API response session stats
- If more pending questions: advance index
- If last question submitted: clear `activeQuiz` and navigate to `/history/:sessionId`

Focus UX:
- Answer input is auto-focused and selected on mount and on question index change

## 3.4 History page (`/history`)
Data loaded in parallel:
- `GET /api/sessions`
- `GET /api/quiz-types`

Features:
- Toggle: `Show only active student results` (default `true`)
- If toggle on and active student exists, filter sessions by `session.student_id === currentStudentId`
- Group sessions by quiz type list order, showing:
  - Group title = quiz type description
  - Group subtitle = quiz type code
  - `SessionTable` rows for that group
- If group empty: `No sessions yet for this quiz type.`
- If no quiz types at all: `No quiz types available.`

`SessionTable` columns:
- Student
- Difficulty (linked to session detail)
- Questions
- Time Spent (from started->finished or started->now)
- Avg / Question
- Score
- Started
- Finished

In-progress behavior:
- If `finished_at` is null, last column is link `In progress` to `/quiz/:id` (resume flow)

Duration formatting logic (shared style):
- <= 0 duration or invalid dates -> `0s`
- `<60s` -> `Ns`
- `<3600s` -> `mm:ss`
- `>=3600s` -> `hh:mm:ss`

## 3.5 Session detail page (`/history/:sessionId`)
Loads `GET /api/sessions/:id`.

Displays:
- Session id
- Student name (`-` fallback)
- `ResultSummary` with:
  - correct
  - wrong
  - percent
  - `averageTimePerQuestionSeconds`

Question detail table columns:
- Position
- Question text (`a x b` OR `(a x b) + (c x d)`)
- Correct value
- Student answer (`—` if none)
- Status (`Correct|Wrong|Pending`)

Average time per question:
- Computed from `(finishedAt or now) - startedAt`, divided by `totalQuestions`, floored seconds
- Null if session missing required fields

## 3.6 Profile page (`/profile`)
Requires active student selection.

If no active student:
- Hint: `Select an active student in the top bar to edit profile preferences.`

If student selected:
- Load via `GET /api/students/:id`
- Editable fields:
  - `name` (required)
  - `age` (nullable, 4..120)
  - `gender` (nullable enum)
  - `learned_timetables` (must contain >=1 item)
- Save via `PATCH /api/students/:id`

Local behaviors:
- On save success:
  - Update form values from API response
  - Update `studentsDirectory` name in global list
  - Message: `Profile saved.`
- Save failures:
  - `Name is required.`
  - `Select at least one learned timetable.`
  - API/load error messages for load/save failures

Stats shown (from profile API):
- Overall bucket
- Per quiz type table
- Includes counts, average score, and total time formatting

## 3.7 User guide page (`/user-guide`)
Static instructional content with:
- Workflow
- Student management
- Taking tests
- History review metrics
- Menu descriptions

## 3.8 Database stats/admin page (`/database-stats`)
Top-level stats cards/buttons for:
- `quiz_types`
- `students`
- `quiz_sessions`
- `questions`
- `answers`

Actions:
- Refresh all counts (+ current opened table)
- Open table rows for selected table (dynamic columns from first row keys)
- Full deletion flow (danger zone):
  - Open modal
  - Require exact typed confirmation `DELETE ALL DATA`
  - Call `POST /api/stats/reset`
  - On success clear selected table and refresh stats

Deletion scope in current implementation:
- Deletes all rows in `answers`, `questions`, `quiz_sessions`, `students`
- Leaves `quiz_types` intact

---

## 4) Backend API Contracts (must match)
Base path: `/api`

## 4.1 `GET /api/quiz-types`
Response:
```json
[
  {
    "id": "uuid",
    "code": "multiplication_1_10",
    "description": "Multiplication quiz with factors between 1 and 10"
  }
]
```

## 4.2 `GET /api/students`
Response:
```json
[
  { "id": "uuid", "name": "Anna" }
]
```

## 4.3 `GET /api/students/{id}`
Errors:
- `400` if id missing
- `404` if student not found

Response:
```json
{
  "id": "uuid",
  "name": "Anna",
  "age": 9,
  "gender": "female",
  "learned_timetables": [1,2,3,4,5],
  "stats": {
    "overall": {
      "quiz_type_code": "all",
      "quiz_type_description": "All quiz types",
      "sessions": 4,
      "completed_sessions": 3,
      "in_progress_sessions": 1,
      "total_questions": 40,
      "correct_answers": 31,
      "wrong_answers": 9,
      "average_score_percent": 77.5,
      "total_time_seconds": 523
    },
    "by_quiz_type": [
      {
        "quiz_type_code": "multiplication_1_10",
        "quiz_type_description": "Multiplication quiz with factors between 1 and 10",
        "sessions": 3,
        "completed_sessions": 2,
        "in_progress_sessions": 1,
        "total_questions": 30,
        "correct_answers": 22,
        "wrong_answers": 8,
        "average_score_percent": 73.33,
        "total_time_seconds": 401
      }
    ]
  }
}
```

## 4.4 `PATCH /api/students/{id}`
Request validation:
- `name`: trimmed string, min length 1
- `age`: nullable int 4..120 (optional)
- `gender`: nullable enum `female|male|other|prefer_not_say` (optional)
- `learned_timetables`: int array, each 1..10, at least one item

Example request:
```json
{
  "name": "Anna",
  "age": 10,
  "gender": "female",
  "learned_timetables": [1,2,3,4,5,10]
}
```

Response:
```json
{
  "id": "uuid",
  "name": "Anna",
  "age": 10,
  "gender": "female",
  "learned_timetables": [1,2,3,4,5,10]
}
```

Errors:
- `400` invalid payload
- `404` student not found

## 4.5 `POST /api/sessions`
Request validation:
- `difficulty`: string and must pass custom guard (`low|medium|hard`)
- `totalQuestions`: int 1..50 (default 10)
- `studentId`: optional UUID
- `studentName`: optional string
- `studentAge`: optional int 4..120
- `studentGender`: optional enum
- `learnedTimetables`: optional int[] each 1..10
- `quizTypeCode`: optional string (defaults to `multiplication_1_10`)

Behavior:
- If `studentId` provided and found:
  - Reuse that student and its stored `learned_timetables`
- Else if non-empty `studentName` provided:
  - Create student with provided profile + sanitized learned timetables
- Else session can exist with `student_id = null` (API allows it)

Response:
```json
{
  "sessionId": "uuid",
  "quizTypeCode": "multiplication_1_10",
  "questions": [
    {
      "id": "uuid",
      "a": 5,
      "b": 7,
      "c": null,
      "d": null,
      "position": 1
    }
  ]
}
```

Errors:
- `400` invalid payload or invalid difficulty

## 4.6 `POST /api/answers`
Request:
```json
{ "questionId": "uuid", "value": 35 }
```
Validation:
- `questionId`: UUID
- `value`: int

Response:
```json
{
  "isCorrect": true,
  "correctValue": 35,
  "session": {
    "correct": 3,
    "wrong": 1,
    "percent": 75
  }
}
```

Errors:
- `400` invalid payload
- `404` question not found

Important behavior:
- If answer for question already exists, **no new answer is inserted** (idempotent insert)
- Session counters are recomputed from all stored answers each submit

## 4.7 `GET /api/sessions`
Response item shape:
```json
{
  "id": "uuid",
  "student_id": "uuid-or-null",
  "difficulty": "low",
  "total_questions": 10,
  "score_percent": 80,
  "started_at": "2026-03-02T10:00:00.000Z",
  "finished_at": null,
  "student_name": "Anna",
  "quiz_type_code": "multiplication_1_10"
}
```

Ordering:
- `started_at DESC`

## 4.8 `GET /api/sessions/{id}`
Errors:
- `400` missing id
- `404` session not found

Response:
```json
{
  "session": {
    "id": "uuid",
    "studentId": "uuid-or-null",
    "quizTypeId": "uuid",
    "difficulty": "low",
    "totalQuestions": 10,
    "correctCount": 6,
    "wrongCount": 2,
    "scorePercent": "60.00",
    "startedAt": "...",
    "finishedAt": null,
    "studentName": "Anna",
    "quizTypeCode": "multiplication_1_10"
  },
  "questions": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "quizTypeId": "uuid",
      "a": 2,
      "b": 3,
      "c": null,
      "d": null,
      "correct": 6,
      "position": 1,
      "answer": {
        "id": "uuid",
        "questionId": "uuid",
        "quizTypeId": "uuid",
        "value": 6,
        "isCorrect": true,
        "answeredAt": "..."
      }
    }
  ]
}
```

## 4.9 `GET /api/stats`
Response:
```json
{
  "quiz_types": 2,
  "students": 5,
  "quiz_sessions": 12,
  "questions": 120,
  "answers": 88
}
```

## 4.10 `GET /api/stats/{table}`
Allowed table names:
- `quiz_types`
- `students`
- `quiz_sessions`
- `questions`
- `answers`

Response:
```json
{
  "table": "students",
  "rows": [
    { "id": "...", "name": "Anna", "age": 10, "gender": "female", "learnedTimetables": [1,2,3] }
  ]
}
```

Error:
- `400` invalid table name

## 4.11 `POST /api/stats/reset`
Request:
```json
{ "confirmation": "DELETE ALL DATA" }
```
Response:
```json
{ "success": true }
```
Error:
- `400` if confirmation text mismatches

---

## 5) Domain and Business Logic
## 5.1 Learned timetables sanitization
Used during student create/update and generation.

Rules:
- Accept only integers in `[1..10]`
- Remove duplicates
- If missing/empty/fully invalid -> fallback to `[1,2,3,4,5,6,7,8,9,10]`

## 5.2 Question generation
Inputs:
- `difficulty`
- `totalQuestions`
- `quizTypeCode`
- `learnedTimetables`

Algorithm summary:
1. Compute `learnedSet` (sanitized)
2. Compute `difficultySet` from mapping
3. `focusSet = difficultySet ∩ learnedSet`
4. `effectiveFocus = focusSet` if non-empty, else `learnedSet`
5. For each position 1..N:
   - Randomly pick factors via helper:
     - one factor from `effectiveFocus`
     - one factor from `learnedSet`
     - random swap order
   - For `sum_products_1_10`, generate two such pairs

Generated record persisted fields:
- Multiplication: `a,b,c=null,d=null,correct,position`
- Sum-products: `a,b,c,d,correct,position`

## 5.3 Scoring
On each answer submit:
- Determine correctness by strict equality to stored `questions.correct`
- Insert answer if absent
- Recompute:
  - `correctCount`
  - `wrongCount`
  - `scorePercent = round((correctCount / totalQuestions) * 100, 2)`
- Set `finishedAt = now` when answer count reaches total questions, else null

Percent helper output type:
- Number with two-decimal rounding (stored as numeric string in DB layer update)

## 5.4 Student performance aggregation
Profile stats include:
- `overall` bucket (`quiz_type_code = all`)
- `by_quiz_type` buckets keyed by quiz type code

For each session:
- Determine completed/in-progress by `finishedAt`
- Duration seconds:
  - `floor((end-start)/1000)` where end is `finishedAt` or `now`
- Accumulate session and answer counters
- Average score uses **completed sessions only**, rounded to 2 decimals

---

## 6) PostgreSQL Schema (target must preserve)
## 6.1 Tables
### `quiz_types`
- `id UUID PK default gen_random_uuid()`
- `code TEXT UNIQUE NOT NULL`
- `description TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL default now()`

Seeded rows:
- `multiplication_1_10`
- `sum_products_1_10`

### `students`
- `id UUID PK default gen_random_uuid()`
- `name TEXT NOT NULL`
- `age INT NULL` with check `age is null or age between 4 and 120`
- `gender TEXT NULL` with check in `('female','male','other','prefer_not_say')`
- `learned_timetables INT[] NOT NULL default [1..10]`
- `created_at TIMESTAMPTZ NOT NULL default now()`

Additional check:
- learned_timetables must contain >=1 and values subset of `[1..10]`

### `quiz_sessions`
- `id UUID PK`
- `student_id UUID NULL FK students(id) ON DELETE SET NULL`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `difficulty TEXT NOT NULL` check in `('low','medium','hard')`
- `total_questions INT NOT NULL` check `>0`
- `correct_count INT NOT NULL default 0`
- `wrong_count INT NOT NULL default 0`
- `score_percent NUMERIC(5,2) NOT NULL default 0`
- `started_at TIMESTAMPTZ NOT NULL default now()`
- `finished_at TIMESTAMPTZ NULL`

Indexes:
- `idx_sessions_quiz_type (quiz_type_id)`
- `idx_sessions_started (started_at)`

### `questions`
- `id UUID PK`
- `session_id UUID NOT NULL FK quiz_sessions(id) ON DELETE CASCADE`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `a INT NOT NULL` check 1..10
- `b INT NOT NULL` check 1..10
- `c INT NULL` check null or 1..10
- `d INT NULL` check null or 1..10
- `correct INT NOT NULL`
- `position INT NOT NULL` check `>=1`
- unique `(session_id, position)`

Indexes:
- `idx_questions_quiz_type (quiz_type_id)`
- `idx_questions_session (session_id)`

### `answers`
- `id UUID PK`
- `question_id UUID NOT NULL FK questions(id) ON DELETE CASCADE`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `value INT NOT NULL`
- `is_correct BOOLEAN NOT NULL`
- `answered_at TIMESTAMPTZ NOT NULL default now()`
- unique `(question_id)`

Indexes:
- `idx_answers_quiz_type (quiz_type_id)`
- `idx_answers_question (question_id)`

## 6.2 Migration sequence equivalence
Target Laravel migrations should preserve this logical order:
1. Core tables (`students`, `quiz_sessions`, `questions`, `answers`)
2. Add `quiz_types` and backfill `quiz_type_id` into existing tables
3. Add `sum_products_1_10` quiz type and `questions.c/d` columns + checks
4. Add student profile fields and checks (`age`, `gender`, `learned_timetables`)

---

## 7) React + Chakra UI Target Component Mapping
Nuxt/Reka conceptual component -> React/Chakra equivalent:

- `BaseButton` -> `Button`
- `BaseInput` -> `Input`
- `BaseProgress` -> `Progress`
- `BaseDialog` -> `Modal` (or `AlertDialog` for destructive action)
- `DifficultySelect` -> `RadioGroup` + `Radio`
- `QuestionCard` -> `Card` (or `Box` styled as card)
- `ResultSummary` -> `Card` + text metrics
- `SessionTable` -> `Table` (+ conditional links/badges)

Preserve these UX traits:
- Numeric answer input with enter submit
- Disabled/loading states on async buttons
- Conditional rendering for missing student selection
- Resume in-progress sessions from history
- Time formatting behavior and summary metrics

---

## 8) Laravel Implementation Blueprint
## 8.1 Suggested Laravel structure
- `app/Models`: `QuizType`, `Student`, `QuizSession`, `Question`, `Answer`
- `app/Http/Controllers/Api`:
  - `QuizTypeController`
  - `StudentController`
  - `SessionController`
  - `AnswerController`
  - `StatsController`
- `app/Http/Requests`:
  - `CreateSessionRequest`
  - `SubmitAnswerRequest`
  - `UpdateStudentProfileRequest`
  - `ResetStatsRequest`
- `app/Services`:
  - `DifficultyService`
  - `QuestionGeneratorService`
  - `ScoringService`
  - `StudentStatsService`

## 8.2 API route parity (`routes/api.php`)
Must expose:
- `GET /quiz-types`
- `GET /students`
- `GET /students/{id}`
- `PATCH /students/{id}`
- `POST /sessions`
- `GET /sessions`
- `GET /sessions/{id}`
- `POST /answers`
- `GET /stats`
- `GET /stats/{table}`
- `POST /stats/reset`

## 8.3 Response field naming parity
Keep the same mixed conventions currently used:
- snake_case for list/history payloads and some profile fields
- camelCase inside nested `session` object from `GET /sessions/{id}`

This is required for strict frontend behavior compatibility unless you also normalize the React client contract everywhere.

---

## 9) React Frontend Blueprint
## 9.1 Routes
- `/` Start
- `/quiz/:sessionId`
- `/history`
- `/history/:sessionId`
- `/profile`
- `/user-guide`
- `/database-stats`

## 9.2 Shared client state
Use context/store for:
- `currentStudentId`
- `studentsDirectory`
- `activeQuiz` (`sessionId`, `quizTypeCode`, generated question list)

## 9.3 API client methods (same signatures as current behavior)
- `createSession(payload)`
- `listStudents()`
- `getStudentProfile(id)`
- `updateStudentProfile(id, payload)`
- `listQuizTypes()`
- `submitAnswer(payload)`
- `listSessions()`
- `getSession(id)`
- `getDatabaseStats()`
- `getDatabaseTableRows(table)`
- `deleteAllSchemaData(confirmation)`

---

## 10) Environment / Runtime Equivalence
Required env:
- `DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz`

Docker local services currently used:
- PostgreSQL 16 (`quiz/quiz/quiz` defaults)
- Adminer on `:8080`

---

## 11) Acceptance Criteria for React + Laravel Port
The port is accepted only if all are true:

1. Supports both quiz types with identical question rendering and correctness logic.
2. Difficulty and learned-timetable interaction matches current generator behavior.
3. Session creation rules match current student handling (existing student reuse vs new create).
4. Answer submission remains idempotent per question and session counters recompute correctly.
5. In-progress sessions resume correctly from history and quiz route.
6. Profile stats (`overall`, `by_quiz_type`) match current aggregation semantics.
7. Database stats page supports table browsing + destructive reset with exact confirmation phrase.
8. Payload keys and endpoint contracts are compatible with the documented current behavior.
9. DB constraints/checks/indexes and seed data are equivalent to current schema/migrations.

---

## 12) Known Implementation Nuances (must be consciously preserved or intentionally changed)
1. `totalQuestions` API validation allows up to 50, while Start UI input has max 30.
2. Difficulty sets include `1` in all levels and broaden by level (`hard` includes all 1..10).
3. `GET /sessions/{id}` returns `scorePercent` as stored numeric/string-style field inside nested `session`.
4. Session score average in profile stats counts only completed sessions.
5. Database reset endpoint does **not** wipe `quiz_types`.

If any nuance is changed in the React/Laravel implementation, document the change explicitly as a product decision, not an accidental divergence.
