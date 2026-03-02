# Requirements

## Goal
Build a menu-driven Python console application that replicates the currently implemented Nuxt web app functionality, using PostgreSQL as the single source of truth.

## Functional

### Core Menus
- Main menu includes:
	- Start quiz
	- Resume in-progress quiz
	- History
	- Session detail
	- Active student
	- Profile
	- User guide
	- Database statistics
	- Danger zone (reset)
	- Exit

### Quiz Types
- Support both quiz types stored in `quiz_types`:
	- `multiplication_1_10`: `a x b`
	- `sum_products_1_10`: `(a x b) + (c x d)`

### Difficulty and Generation
- Difficulty options: `low`, `medium`, `hard`.
- Use current implemented focus sets:
	- low: `[1, 5, 10]`
	- medium: `[1, 2, 3, 4, 5, 6, 10]`
	- hard: `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
- Integrate `learned_timetables` into generation:
	- sanitize to unique integers in `[1..10]`
	- fallback to `[1..10]` if empty/invalid
	- pick one factor from difficulty-focused set intersected with learned set when possible

### Session Lifecycle
- Create session with:
	- selected quiz type
	- difficulty
	- total questions (default 10, CLI guard 1..30)
	- student context (active existing or newly created)
- Persist generated questions immediately.
- Submit answers one by one and persist each answer.
- Recompute session counters from stored answers:
	- `correct_count`, `wrong_count`, `score_percent`
- Mark `finished_at` when answer count reaches `total_questions`.

### Student Context
- Maintain in-process `active_student_id`.
- Allow selecting or clearing active student from DB list.
- When active student is selected, Start flow reuses student profile and learned timetables.

### Profile
- Load and edit student fields:
	- `name` (required)
	- `age` (nullable, 4..120)
	- `gender` (nullable enum: female|male|other|prefer_not_say)
	- `learned_timetables` (at least one item)
- Show student performance stats:
	- overall bucket
	- by quiz type buckets

### History and Session Detail
- History grouped by quiz type.
- Optional filter to active student.
- Display per-session metrics:
	- score percent
	- started/finished timestamps
	- time spent
	- average time per question
- Session detail shows all questions, student answers, correctness status, and summary.

### Resume
- List unfinished sessions (`finished_at is null`).
- Resume by session id and continue unanswered questions.

### Database Statistics
- Show counts for `quiz_types`, `students`, `quiz_sessions`, `questions`, `answers`.
- Allow viewing raw rows for each table.

### Danger Zone Reset
- Require exact typed confirmation: `DELETE ALL DATA`.
- Delete data from `answers`, `questions`, `quiz_sessions`, `students`.
- Keep `quiz_types` intact.

### Input Validation
- Invalid integer answer shows: `Please type a number.` and re-prompts same question.
- Invalid menu choices and field constraints must re-prompt without crashing.

## Data/Database Requirements
- PostgreSQL is authoritative for all persistent state.
- No file-based persistence for domain entities.
- Schema behavior must match current web implementation:
	- `students`, `quiz_types`, `quiz_sessions`, `questions`, `answers`
	- same uniqueness, foreign keys, and check constraints

## Non-Functional
- Python 3.11+.
- Clear and readable terminal output.
- Modular code structure (menu, services, repositories, rendering).
- Safe DB transaction boundaries for session create, answer submit, and reset operations.

## Acceptance
- CLI reproduces current web app behavior for quiz flow, profile/history/statistics, and DB-backed persistence.
