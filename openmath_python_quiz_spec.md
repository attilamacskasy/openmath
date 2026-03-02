# OpenMath — Python CLI SPEC (Implementation-Faithful, PostgreSQL Source of Truth)

## 1) Purpose
Define a **menu-driven interactive Python console application** that replicates the currently implemented Nuxt web app behavior.

Primary rule:
- **PostgreSQL is the single source of truth** for all persistent state.
- No local files/JSON/in-memory-only persistence for sessions, students, questions, or answers.

This spec is designed so the CLI can be generated in another language/runtime without losing behavior parity.

---

## 2) Scope Parity With Current Web App
The CLI must support the same functional scope as the current web app:
- Quiz session creation and answering
- Multiple quiz types
- Difficulty + learned-timetable-aware generation
- Student profiles (name, age, gender, learned timetables)
- Session history and session detail review
- Resume unfinished sessions
- Database statistics and row browsing
- Full data reset flow (with confirmation phrase)

Implemented quiz types:
1. `multiplication_1_10`
   - Question format: `a x b`
   - Correct formula: `a * b`
2. `sum_products_1_10`
   - Question format: `(a x b) + (c x d)`
   - Correct formula: `(a * b) + (c * d)`

Implemented difficulty values:
- `low`
- `medium`
- `hard`

Current generator difficulty sets (must match existing behavior):
- `low`: `[1, 5, 10]`
- `medium`: `[1, 2, 3, 4, 5, 6, 10]`
- `hard`: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`

---

## 3) CLI Information Architecture (Menu-Driven UX)
## 3.1 Main Menu
Show continuously until exit:

1. Start quiz
2. Resume in-progress quiz
3. History
4. Session detail
5. Active student
6. Profile
7. User guide
8. Database statistics
9. Danger zone (delete data)
0. Exit

Global context in CLI session:
- `active_student_id` (nullable)

Behavior:
- The active student context influences Start/History/Profile, same as web app.
- If selected student no longer exists in DB, clear `active_student_id`.

## 3.2 Active Student Menu
Options:
- Show current active student
- Select from students (`id`, `name`)
- Clear active student (`No student`)

Data source:
- `students` table only (no cached directory as source of truth)

## 3.3 Start Quiz Flow
Prompt sequence:
1. Select quiz type from `quiz_types`
2. Select difficulty: `low|medium|hard`
3. Enter total question count (UI clamp behavior: 1..30 default 10)
4. Student context:
   - If `active_student_id` is set: reuse it
   - Else prompt to create new student profile:
     - `student_name` (required in this mode)
     - `student_age` (optional, 4..120)
     - `student_gender` (`female|male|other|prefer_not_say`, default `prefer_not_say`)
     - `learned_timetables` (choose 1..10, at least one)

Validation and messages:
- Missing new student name -> fail with clear prompt and re-enter
- Empty learned timetable set for new student -> fail and re-enter
- Difficulty outside enum -> invalid
- Question count outside range -> invalid

On successful start:
- Create session
- Generate + persist all questions immediately
- Enter quiz runner for that new session

## 3.4 Quiz Runner Flow
For a session, show:
- Quiz type code
- Progress (`answered / total`)
- Current prompt

Prompt formats:
- Multiplication: `What is a x b?`
- Sum-products: `What is (a x b) + (c x d)?`

Answer input:
- Must be integer
- Non-integer: show `Please type a number.` and re-ask same question

On submit:
- Persist answer if not already present
- Recompute session counters from DB answers
- Show feedback:
  - `Correct!`
  - `Wrong, correct answer is <value>.`

Completion:
- When answered count reaches `total_questions`, session gets `finished_at`
- Then show session summary and option to return to main menu

## 3.5 Resume In-Progress Flow
List sessions where:
- `finished_at IS NULL`
- Optional filter by `active_student_id` if set

User picks one session id:
- Load unanswered questions only
- Continue as in quiz runner

## 3.6 History Flow
List sessions grouped by quiz type, matching web behavior:
- For each quiz type from `quiz_types`:
  - Group title: description + code
  - Group rows: sessions where `quiz_type_code` matches

Include toggle behavior in CLI prompt:
- `Show only active student results? [Y/n]` (default yes)

Row fields per session:
- session id
- student name
- difficulty
- total questions
- score percent
- started at
- finished at or `In progress`
- time spent
- avg / question

Duration formatting parity:
- invalid/<=0 => `0s`
- `<60s` => `Ns`
- `<3600s` => `mm:ss`
- `>=3600s` => `hh:mm:ss`

## 3.7 Session Detail Flow
Input: session id

Display:
- session id
- student name (or `-`)
- summary: correct, wrong, percent, average time/question
- all questions table-like output:
  - position
  - question text
  - correct value
  - student answer (`—` if missing)
  - status (`Correct|Wrong|Pending`)

## 3.8 Profile Flow
Requires active student.

If none selected:
- Show same semantic message as web app (select active student first)

If active student exists:
- Load profile + aggregated stats from DB
- Show editable fields:
  - name (required)
  - age (nullable 4..120)
  - gender (nullable enum)
  - learned timetables (>=1)
- Save updates to DB

Show performance stats:
- overall bucket
- by quiz type buckets

## 3.9 User Guide Flow
Show static instructions (console-friendly) covering:
- workflow
- student management
- taking tests
- history metrics
- meaning of each menu item

## 3.10 Database Statistics Flow
Display counts for:
- `quiz_types`
- `students`
- `quiz_sessions`
- `questions`
- `answers`

Allow selecting a table name to print rows (paginated output recommended).

## 3.11 Danger Zone Flow
Destructive action must require exact phrase:
- `DELETE ALL DATA`

On success:
- delete from `answers`, `questions`, `quiz_sessions`, `students`
- keep `quiz_types`
- print `All data deleted.`

---

## 4) PostgreSQL Is the Single Source of Truth
The CLI must directly use PostgreSQL for all reads/writes.

Allowed volatile runtime state:
- current in-memory input buffers
- current process `active_student_id`

Not allowed as persistent source:
- local files
- JSON snapshots
- sqlite fallback
- replay logs as authoritative data

If DB is unavailable:
- show clear connection error and return to main menu (or exit with non-zero code in non-interactive mode).

---

## 5) Database Schema Requirements (must match existing app)
## 5.1 `quiz_types`
- `id UUID PK default gen_random_uuid()`
- `code TEXT UNIQUE NOT NULL`
- `description TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL default now()`

Seed rows:
- `multiplication_1_10` / `Multiplication quiz with factors between 1 and 10`
- `sum_products_1_10` / `Sum of products quiz: (a × b) + (c × d) with factors 1..10`

## 5.2 `students`
- `id UUID PK`
- `name TEXT NOT NULL`
- `age INT NULL` with check 4..120
- `gender TEXT NULL` in `female|male|other|prefer_not_say`
- `learned_timetables INT[] NOT NULL default [1..10]`
- `created_at TIMESTAMPTZ NOT NULL default now()`

## 5.3 `quiz_sessions`
- `id UUID PK`
- `student_id UUID NULL FK students(id) ON DELETE SET NULL`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `difficulty TEXT NOT NULL` in `low|medium|hard`
- `total_questions INT NOT NULL (>0)`
- `correct_count INT NOT NULL default 0`
- `wrong_count INT NOT NULL default 0`
- `score_percent NUMERIC(5,2) NOT NULL default 0`
- `started_at TIMESTAMPTZ NOT NULL default now()`
- `finished_at TIMESTAMPTZ NULL`

## 5.4 `questions`
- `id UUID PK`
- `session_id UUID NOT NULL FK quiz_sessions(id) ON DELETE CASCADE`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `a INT NOT NULL` (1..10)
- `b INT NOT NULL` (1..10)
- `c INT NULL` (null or 1..10)
- `d INT NULL` (null or 1..10)
- `correct INT NOT NULL`
- `position INT NOT NULL` (>=1)
- unique `(session_id, position)`

## 5.5 `answers`
- `id UUID PK`
- `question_id UUID NOT NULL FK questions(id) ON DELETE CASCADE`
- `quiz_type_id UUID NOT NULL FK quiz_types(id)`
- `value INT NOT NULL`
- `is_correct BOOLEAN NOT NULL`
- `answered_at TIMESTAMPTZ NOT NULL default now()`
- unique `(question_id)`

---

## 6) Domain Logic Parity (must be exact)
## 6.1 Learned timetables sanitization
Given input list:
- keep integers between 1 and 10
- remove duplicates
- if none remain: fallback `[1,2,3,4,5,6,7,8,9,10]`

## 6.2 Session creation semantics
Input:
- `difficulty`
- `total_questions`
- optional `student_id`
- optional `student_name`, `student_age`, `student_gender`, `learned_timetables`
- optional `quiz_type_code` (default `multiplication_1_10`)

Behavior:
1. Resolve quiz type id by code (error if missing)
2. Student handling:
   - if `student_id` exists and found -> use that student + stored learned timetables
   - else if trimmed `student_name` present -> create student
   - else student remains null
3. Insert session
4. Generate and insert all questions with `position` 1..N

## 6.3 Question generation parity
Given `(difficulty, total_questions, quiz_type_code, learned_timetables)`:
- `focusSet = difficultySet ∩ learnedSet`
- `effectiveFocus = focusSet if not empty else learnedSet`
- `pickFactors`:
  - one factor from `effectiveFocus`
  - one from `learnedSet`
  - random swap order
- for `sum_products_1_10`: run `pickFactors` twice, store `c,d`

## 6.4 Answer submit + scoring parity
Given `(question_id, value)`:
1. load question; if missing -> not found
2. `is_correct = value == question.correct`
3. insert answer only if question has no answer yet
4. load all question ids for the session
5. load all answers for those question ids
6. recompute:
   - `correct_count`
   - `wrong_count`
   - `percent = round((correct_count / total_questions) * 100, 2)`
7. set `finished_at = now` if answered count >= total_questions else null

Return payload equivalent:
- `isCorrect`
- `correctValue`
- `session.correct|wrong|percent`

## 6.5 Student performance aggregation parity
For selected student:
- Build `overall` bucket + `by_quiz_type` buckets
- `completed_sessions` = sessions with `finished_at`
- `in_progress_sessions` = no `finished_at`
- duration per session = `(finished_at or now) - started_at` in floor seconds
- average score computed only from completed sessions, rounded to 2 decimals

---

## 7) Console Output Contracts (minimum)
The exact visual styling can differ from web, but these semantics must be preserved:
- clear progress indicator while answering
- correctness feedback after each answer
- summary at completion (correct, wrong, percent)
- history includes in-progress marker and time metrics
- profile includes overall + by-type performance metrics
- destructive reset requires explicit typed confirmation text

Recommended stable messages:
- invalid number input: `Please type a number.`
- profile save success: `Profile saved.`
- delete success: `All data deleted.`

---

## 8) Python Application Structure (recommended)
Not mandatory filenames, but responsibilities should be separated.

- `src/main.py` -> app loop + menu routing
- `src/db.py` -> DB connection and transaction helpers
- `src/repositories.py` -> SQL data access functions
- `src/services.py` -> generation/scoring/profile aggregation logic
- `src/views.py` -> console rendering and input helpers
- `src/types.py` -> typed DTOs/dataclasses/enums

Use transactions for:
- session create + question insert
- answer submit + session score update
- full reset

---

## 9) Environment and Dependencies
Required env:
- `DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz`

Python:
- Python 3.11+

Recommended packages:
- `psycopg[binary]` (or equivalent PostgreSQL driver)
- Optional: `pydantic` for validation, `rich` for better terminal tables

No ORM is required; raw SQL is acceptable if behavior parity is maintained.

---

## 10) Acceptance Criteria (CLI parity)
The CLI is accepted only if all are true:

1. Supports both quiz types with correct prompt/answer formula behavior.
2. Difficulty + learned timetable interaction matches existing generator semantics.
3. Session creation reuses active student profile when selected.
4. New student creation from Start works with age/gender/learned timetable fields.
5. Answering stores data in PostgreSQL and recomputes counters exactly.
6. In-progress sessions can be resumed and completed.
7. History grouping by quiz type works, including active-student filtering option.
8. Session detail reproduces stored questions/answers with pending/correct/wrong statuses.
9. Profile editing + performance stats behave like current web app.
10. Database stats and table row browsing are available from CLI.
11. Full reset requires exact `DELETE ALL DATA` and preserves `quiz_types`.
12. App remains functional after restart because DB is the only persistent state.

---

## 11) Known Nuances To Preserve
1. Web API allows `totalQuestions` up to 50, while Start UI limits to 30; CLI should follow web UX and use 30 unless deliberately changed.
2. Difficulty sets include `1` in all levels and broaden by level.
3. Session score average in profile stats uses completed sessions only.
4. Reset deletes all user/session/question/answer data but keeps quiz type definitions.

If changing any nuance, document it explicitly as a product decision.
