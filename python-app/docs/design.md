# Design Overview

## Architecture Goals
- Replicate Nuxt web app behavior in a console-first interaction model.
- Keep PostgreSQL as the single source of truth.
- Separate rendering/input concerns from business and data access logic.

## Suggested Module Layout
- `src/main.py`
	- App bootstrap and main menu loop
	- Navigation orchestration
- `src/views.py`
	- Terminal rendering and input prompts
	- Table/list formatting and pagination helpers
- `src/db.py`
	- PostgreSQL connection pool/session factory
	- Transaction helper context managers
- `src/repositories.py`
	- SQL queries and persistence operations
	- Entity fetch/list/update operations
- `src/services.py`
	- Domain workflows:
		- session creation
		- question generation
		- answer submission + scoring recompute
		- student performance aggregation
		- database statistics + reset
- `src/types.py`
	- Dataclasses/typed dicts/enums for DTO contracts

## Core Runtime State
In-process state should be minimal:
- `active_student_id` (nullable)
- current menu context

All domain state must come from DB reads:
- students
- quiz types
- sessions
- questions
- answers

## Domain Services

### Difficulty Service
Defines allowed values and focus sets:
- low: `[1, 5, 10]`
- medium: `[1, 2, 3, 4, 5, 6, 10]`
- hard: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`

### Learned Timetables Normalization
`sanitize_learned_timetables(values)`:
- keep integer values in `[1..10]`
- deduplicate
- fallback to full `[1..10]` set if empty/invalid

### Question Generator
Input: `difficulty`, `total_questions`, `quiz_type_code`, `learned_timetables`.

Algorithm parity:
1. `learned_set = sanitize(...)`
2. `difficulty_set = map[difficulty]`
3. `focus_set = difficulty_set ∩ learned_set`
4. `effective_focus = focus_set if not empty else learned_set`
5. For each position:
	 - `pick_factors` selects one from `effective_focus`, one from `learned_set`, random swap
	 - multiplication quiz: one pair
	 - sum-products quiz: two pairs (`a,b,c,d`)

### Scoring Service
`submit_answer(question_id, value)` flow:
1. Load question by id
2. Compute `is_correct = value == question.correct`
3. Insert answer only if none exists for question (idempotent)
4. Recompute session metrics from stored answers
5. Update `quiz_sessions`:
	 - `correct_count`
	 - `wrong_count`
	 - `score_percent` rounded to 2 decimals
	 - `finished_at` when answered count reaches total

## Console UX Flows

### Start Quiz
- Select quiz type from DB
- Select difficulty
- Enter question count
- Resolve student context:
	- use active student when set
	- otherwise capture new student profile inputs
- Create session + questions in transaction
- Enter quiz runner

### Resume Quiz
- List unfinished sessions (`finished_at is null`)
- Optionally filter by active student
- Continue unanswered questions

### History
- Load sessions and quiz types
- Group sessions by quiz type
- Optional active-student filtering
- Show duration metrics and in-progress markers

### Session Detail
- Load session + all questions + associated answers
- Display per-question status and summary metrics

### Profile
- Requires active student
- Load profile + aggregated performance buckets
- Edit and persist profile fields

### Database Statistics
- Show table counts and browse rows
- Provide refresh operation

### Danger Zone
- Require exact confirmation phrase `DELETE ALL DATA`
- Delete `answers`, `questions`, `quiz_sessions`, `students`
- Preserve `quiz_types`

## Transaction Boundaries
- Session creation + question insertion: single transaction
- Answer submit + session aggregate update: single transaction
- Full reset: single transaction

## Error Handling Strategy
- User input errors: human-readable message + re-prompt
- DB/connection errors: concise error + return to safe menu state
- Missing entities: explicit not-found message
- App should never crash on expected validation issues

## Time and Duration Formatting
For history/detail summaries:
- invalid or non-positive duration -> `0s`
- `<60` seconds -> `Ns`
- `<3600` seconds -> `mm:ss`
- `>=3600` seconds -> `hh:mm:ss`

## Extensibility
- Quiz types are data-driven from `quiz_types` and service branching by code.
- New quiz types should be added by:
	- DB seed row
	- generator/scoring render branch
	- CLI prompt/format support
