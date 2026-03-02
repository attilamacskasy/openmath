# OpenMath Python CLI App

OpenMath Python is a menu-driven, interactive console application that mirrors the implemented Nuxt web app behavior in a simplified CLI experience.

It uses PostgreSQL as the single source of truth and keeps the same core product flows: quiz session creation, answering, scoring, history, session audit trail, student profile, and database statistics/reset actions.

## How it mirrors the Nuxt web app

The CLI keeps parity with the web app in these areas:

- Same quiz types (`multiplication_1_10`, `sum_products_1_10`)
- Same difficulty model (`low`, `medium`, `hard`) and generation logic
- Same persisted entities (`students`, `quiz_types`, `quiz_sessions`, `questions`, `answers`)
- Same session lifecycle (create -> answer -> recompute score -> finish)
- Same review model (history groups + session detail with per-question correctness)
- Same profile data (`name`, `age`, `gender`, `learned_timetables`) and performance stats
- Same destructive reset confirmation phrase: `DELETE ALL DATA`

What is simplified in CLI form:

- No web UI components/routing; all actions are driven through numbered menus
- Focused text rendering instead of visual cards/tables/progress widgets
- Single-process interactive workflow rather than browser + API client split

## Main menu features

When the app starts, you get:

1. Start quiz
2. Resume in-progress quiz
3. History
4. Session detail
5. Active student
6. Profile
7. User guide
8. Database statistics
9. Danger zone
10. Ensure quiz types
0. Exit

## Prerequisites

- Python 3.11+
- PostgreSQL database with OpenMath schema/migrations applied
- `DATABASE_URL` pointing to your PostgreSQL instance

Example:

- `DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz`

Note:
- The app will also try to load `DATABASE_URL` from `python-app/.env` and repository root `.env` if it is not exported in the shell.

## Setup

From the `python-app` directory:

1. Create venv (optional but recommended)
2. Activate venv
3. Install dependencies

Windows PowerShell example:

- `python -m venv .venv`
- `.\.venv\Scripts\Activate.ps1`
- `pip install -r requirements.txt`

## Start the application

From `python-app`:

- `python src/main.py`

On startup, the app runs a quiz type integrity check and can seed required quiz type rows if they are missing.

## How to use (quick walkthrough)

1. Open the app and choose `5. Active student` (optional).
2. Choose `1. Start quiz`.
3. Select quiz type, difficulty, and total question count.
4. If no active student is selected, enter new student details.
5. Answer questions one-by-one; each answer is saved immediately.
6. Review summary at the end (correct/wrong/percent).
7. Use `3. History` and `4. Session detail` for replay/audit.
8. Use `6. Profile` to edit student data and inspect performance stats.

## Troubleshooting

- `DATABASE_URL is required`
   - Set env var in shell, or add it to `python-app/.env`.

- PostgreSQL auth error (`password authentication failed`)
   - Verify credentials in `DATABASE_URL`.
   - If using Docker, confirm container DB user/password match your URL.

- No quiz types available
   - Run menu option `10. Ensure quiz types`.

## Related docs

- [openmath_python_quiz_spec.md](../openmath_python_quiz_spec.md)
- [docs/requirements.md](docs/requirements.md)
- [docs/design.md](docs/design.md)
- [docs/tasks.md](docs/tasks.md)