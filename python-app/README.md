# OpenMath Python CLI App

Menu-driven interactive console application that targets feature parity with the currently implemented Nuxt web app, using PostgreSQL as the single source of truth.

## Scope

The CLI target includes:
- Start quiz (multi-quiz-type, difficulty-based generation)
- Resume in-progress sessions
- History grouped by quiz type
- Session detail review (question + answer audit)
- Active student selection
- Student profile editing and performance statistics
- Database statistics and row browsing
- Danger zone reset with explicit typed confirmation

Reference source-of-truth spec:
- `../openmath_python_quiz_spec.md`

## Data and Runtime Model

- PostgreSQL is authoritative for persisted state.
- The app should not use local files for domain persistence.
- Global in-process context keeps only interactive state such as active student selection.

## Tech Expectations

- Python 3.11+
- PostgreSQL reachable through `DATABASE_URL`
- Suggested DB driver: `psycopg` (or equivalent)

## Environment

Set at least:

- `DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz`

If you use the repository-level Docker Compose, PostgreSQL defaults are compatible with the example URL above.

## Run

From the `python-app` directory:

1. Create/activate virtual environment (recommended)
2. Install dependencies from `requirements.txt`
3. Start application:

   `python src/main.py`

## Documentation

- Requirements: `docs/requirements.md`
- Design: `docs/design.md`
- Tasks: `docs/tasks.md`

All three docs are aligned to the CLI parity target and should be kept in sync with `openmath_python_quiz_spec.md`.