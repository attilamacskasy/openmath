# openmath

<p align="center">
  <img src="nuxt-app/public/openmath-logo.svg" alt="OpenMath logo" width="120" />
</p>

`openmath` is a learning-focused project for building fun, practical math tools for kids, starting with multiplication and expanding into a broader quiz platform.

## Purpose

- Build a child-friendly **OpenMath** quiz platform that improves both correctness and speed.
- Start with multiplication as the first quiz type, then expand with additional quiz formats.
- Keep development spec-driven for consistent implementation and easier iteration.
- Compare multiple stack implementations over the same product domain.

## Project Update (March 2026)

### Architecture decision

- I made a strategic tech decision to replace the planned `React + Laravel` stack with `Angular + Python FastAPI`, while keeping **PostgreSQL** as the shared database foundation.
- The project keeps a **shared PostgreSQL DB model** across implementations for consistent data behavior and cross-stack parity.

### Team and collaboration note

- I officially welcome my pro developer peer **Hajnalka**, who has strong Angular expertise, to support this new stack direction.

### Maintenance strategy going forward

- Keep `nuxt-app/` (`Nuxt + Nitro`) as a working and supported implementation.
- Keep `python-app/` as a lightweight CLI application for quick testing, learning flows, and DB-driven diagnostics.
- Introduce `Angular + FastAPI` as the new **primary maintained feature stack** for upcoming product enhancements.

## User Guide (Start Here)

### Objective

The student goal is simple: **get the highest correct score in the least amount of time**.

### Main workflow

1. Select an active student in the top navigation (or keep `No student` to create one when starting).
2. Open **Start**, choose quiz type, difficulty, and question count.
3. Complete the quiz (keyboard-friendly flow with focused answer input).
4. Review results in **History** and session detail.
5. Improve profile and learned timetables in **Profile**, then repeat.

### Menu guide

- **Start** — create and launch a new quiz session.
- **Profile** — edit student preferences and view performance stats.
- **History** — review sessions, resume `In progress` sessions, compare speed/accuracy metrics.
- **User Guide** — usage instructions for students and teachers.
- **Database Statistics** — admin diagnostics: table counts, table row viewer, and danger-zone reset.
- **Active student selector (top bar)** — sets current student context across pages.

## Release Status

- **Nuxt release:** `v1.5` (working)
- **Current working web app:** `nuxt-app/` (Nuxt 4 + Nitro + Drizzle + PostgreSQL)
- **Python console app:** available in `python-app/` (lightweight CLI)
- **Primary maintained next stack:** `Angular + Python FastAPI + PostgreSQL` (new feature direction)

## What’s New (Nuxt v1.5)

This section summarizes everything added after `v1.0`.

### 1) Platform and navigation improvements

- Added a global **Active student** selector in the top navigation.
- Student context now persists while navigating pages.
- Added a dedicated **User Guide** page and menu item.
- Rebranded content to OpenMath as a multi-quiz platform (multiplication-first).

### 2) Quiz architecture and content expansion

- Introduced `quiz_types` domain model and DB relationships.
- Added quiz type selection on Start page.
- Added quiz type visibility during quiz and grouped history by quiz type.
- Added new quiz type: `sum_products_1_10` with question pattern `(a x b) + (c x d)`.
- Persisted `c` and `d` terms in questions for full session replay and review.

### 3) Student model and adaptive generation

- Added student profile fields: `age`, `gender`, `learned_timetables` (1..10).
- Generation now respects learned timetables for better personalization.
- Added full profile edit page for active student preferences.

### 4) Quiz UX and flow improvements

- Improved keyboard-only quiz flow with answer input auto-focus between questions.
- Added visual progress bar during quiz.
- Added automatic redirect to session summary after quiz completion.
- Added resume flow from History for unfinished sessions (`In progress` link).
- Resume now starts from first unanswered question and preserves progress correctly.

### 5) History and performance analytics

- History now includes: `Student`, `Questions`, `Time Spent`, `Avg / Question`.
- Added active-student-only filter in History (default ON).
- Session summary now includes average time per question.
- Profile includes aggregated performance metrics:
  - all quizzes combined
  - by quiz type
  - total time spent (overall and by type)

### 6) Database admin and safety tools

- Database Statistics page now supports:
  - per-table record counts
  - row browsing by table
  - refresh actions
- Added **Danger Zone** reset with confirmation phrase `DELETE ALL DATA`.

### 7) Dev tooling and migration workflow

- Added PowerShell migration script and integrated DB migration into `dev.ps1`.
- Added Nuxt start/stop modes in `dev.ps1` with visible server logs.
- Fixed assistant menu exit behavior and script robustness issues.
- Hardened SQL migrations for safer reruns and PostgreSQL compatibility.

## What’s New (Python CLI v1.5)

This section summarizes the Python console app improvements aligned with the v1.5 OpenMath domain model.

### 1) Full menu-driven CLI application

- Replaced the minimal quiz script with a complete interactive menu system.
- Added top-level workflows: Start, Resume, History, Session Detail, Active Student, Profile, User Guide, DB Statistics, Danger Zone.
- Added startup integrity checks for required quiz types.

### 2) Multi-quiz parity with Nuxt app

- Added support for both quiz types:
  - `multiplication_1_10`
  - `sum_products_1_10`
- CLI generation logic now follows the same difficulty and learned-timetable-aware behavior.

### 3) PostgreSQL-first persistence model

- CLI now uses PostgreSQL as the single source of truth.
- Added repository/service layers for sessions, questions, answers, students, and stats.
- Implemented transactional write flows for session creation, answer submission, and resets.

### 4) Student context and profile support

- Added active student selection in CLI.
- Main menu now shows active student **name** (not UUID).
- Added profile editing (name, age, gender, learned timetables) and performance stats output.

### 5) Session continuity and review

- Added resume support for unfinished sessions.
- Added detailed session audit output with question-by-question correctness.
- Added grouped history output with score/time/avg-per-question metrics.

### 6) Admin and quality-of-life tools

- Added DB statistics view and row browser.
- Added confirmation-gated Danger Zone reset (`DELETE ALL DATA`).
- Added launcher scripts for clean Windows terminal startup:
  - `scripts/start-python-cli.ps1`
  - `scripts/start-python-cli.cmd`

## v1.5 Screenshots CLI

### Main menu

![OpenMath CLI main menu showing all v1.5 menu options and footer.](assets/images/v1.5_CLI/main_menu.JPG)

*OpenMath CLI main menu showing all v1.5 menu options and footer.*

### Start quiz flow

![CLI start quiz flow showing quiz type, difficulty, and setup prompts.](assets/images/v1.5_CLI/start_quiz.JPG)

*CLI start quiz flow showing quiz type, difficulty, and setup prompts.*

### Active student selection

![CLI active student menu showing student list and selection options.](assets/images/v1.5_CLI/active_student.JPG)

*CLI active student menu showing student list and selection options.*

### History view

![CLI history output grouped by quiz type with session metrics.](assets/images/v1.5_CLI/history.JPG)

*CLI history output grouped by quiz type with session metrics.*

### Profile view

![CLI profile view showing student fields and performance statistics.](assets/images/v1.5_CLI/profile.JPG)

*CLI profile view showing student fields and performance statistics.*

## v1.5 Screenshots

### Start page

![OpenMath Start page showing quiz setup with quiz type, difficulty, student selection, and start button.](assets/images/v1.5/main.JPG)

*OpenMath Start page showing quiz setup with quiz type, difficulty, student selection, and start button.*

### Nuxt / Nitro / Vite / Vue runtime

![Terminal or app runtime view showing Nuxt, Nitro, Vite, and Vue development execution details.](assets/images/v1.5/nuxt_nitro_vite_vue.JPG)

*Terminal or app runtime view showing Nuxt, Nitro, Vite, and Vue development execution details.*

### Session Summary detail

![Session detail page showing question-by-question results, correctness status, and session summary metrics.](assets/images/v1.5/history_session.JPG)

*Session detail page showing question-by-question results, correctness status, and session summary metrics.*

### Quiz History

![Quiz History page grouped by quiz type with session rows, time spent, average time per question, and status links.](assets/images/v1.5/history.JPG)

*Quiz History page grouped by quiz type with session rows, time spent, average time per question, and status links.*

### Profile page

![Profile page showing active student preferences such as name, age, gender, learned timetables, and performance statistics.](assets/images/v1.5/profile.JPG)

*Profile page showing active student preferences such as name, age, gender, learned timetables, and performance statistics.*

### Database Statistics

![Database Statistics page showing table record counts, row viewer, refresh controls, and admin data tools.](assets/images/v1.5/dbstats.JPG)

*Database Statistics page showing table record counts, row viewer, refresh controls, and admin data tools.*

### pgAdmin database view

![pgAdmin interface showing OpenMath PostgreSQL schema, tables, and stored quiz data.](assets/images/v1.5/pgadmin.JPG)

*pgAdmin interface showing OpenMath PostgreSQL schema, tables, and stored quiz data.*

### Docker stack

![Docker environment view showing running services used by OpenMath development stack.](assets/images/v1.5/docker.JPG)

*Docker environment view showing running services used by OpenMath development stack.*

### Dev assistant script

![PowerShell dev assistant output showing guided commands for Nuxt workflow, validation, build, and migrations.](assets/images/v1.5/dev.JPG)

*PowerShell dev assistant output showing guided commands for Nuxt workflow, validation, build, and migrations.*

## v2.0 Screenshots — Angular + FastAPI + PrimeNG + PostgreSQL

Of all the implementations in this repository, **v2.0 is by far the most polished**. The Angular + PrimeNG combination produces a clean, professional UI that feels fast and intentional — the Lara Light Blue theme, fluid PrimeFlex layouts, and reactive signal-based state give it a coherence the other stacks simply don't match visually. On the backend side, FastAPI with asyncpg is rock solid: clean structured logs, near-instant responses, and a fully auto-generated Swagger UI that makes the API a pleasure to work with and inspect. This stack is the one I'd confidently put in front of a real user.

### Frontend — Angular 18 + PrimeNG 17

#### Start page

![OpenMath v2.0 Start page with quiz type selector, difficulty radio group, learned timetables checkboxes, and question count input built with PrimeNG components.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_start.JPG)

*Start page — quiz type selector, difficulty radio group, timetables checkboxes, and question count. PrimeNG Lara Light Blue theme throughout.*

#### Quiz page

![OpenMath v2.0 Quiz page showing a multiplication question with progress bar, answer input auto-focused, and PrimeNG card layout.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_quiz.JPG)

*Quiz page — progress bar, question card, auto-focused answer input. Keyboard-first flow.*

#### Session detail

![OpenMath v2.0 Session detail page showing question-by-question results with correct/wrong status badges and session summary metrics.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_session.JPG)

*Session detail — per-question status badges, score summary, and session metadata in a clean PrimeNG table.*

#### History

![OpenMath v2.0 History page showing quiz sessions grouped by quiz type with student name, score badge, time and avg per question columns.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_history.JPG)

*History — sessions grouped by quiz type, color-coded score tags, time spent and avg/question columns.*

#### Profile page

![OpenMath v2.0 Profile page showing editable student fields, learned timetables checkboxes, and aggregated performance statistics by quiz type.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_profile.JPG)

*Profile — editable student fields, timetable selection, and aggregated performance stats per quiz type.*

#### User Guide

![OpenMath v2.0 User Guide page with instructional content in a PrimeNG card layout.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_guide.JPG)

*User Guide — clean card-based instructional layout.*

#### Admin page

![OpenMath v2.0 Admin page showing database row count stats cards, table row browser dropdown, and danger zone reset with confirmation dialog.](assets/images/v2.0_Angular_FastAPI_PrimeNG/fe_admin.JPG)

*Admin — stats cards, table row browser, and confirmation-gated danger zone reset.*

---

### Backend — FastAPI + asyncpg

#### Swagger UI (auto-generated docs)

![FastAPI Swagger UI at /docs showing all OpenMath API endpoints: quiz-types, students, sessions, answers, stats with request/response schemas.](assets/images/v2.0_Angular_FastAPI_PrimeNG/be_api_swagger.JPG)

*FastAPI auto-generated Swagger UI — all endpoints documented with live request/response testing. The backend is clean, well-typed, and immediately inspectable.*

---

### Database — PostgreSQL 16 + JSONB

#### Questions table with JSONB prompt column

![PostgreSQL questions table row showing JSONB prompt payload with template kind, render string, and answer type fields stored alongside legacy columns.](assets/images/v2.0_Angular_FastAPI_PrimeNG/db_question.JPG)

*Questions table — JSONB `prompt` column stores template kind, render string, and answer type. Legacy columns maintained for backwards compatibility.*

#### Answers table with JSONB response column

![PostgreSQL answers table row showing JSONB response payload with raw input, parsed answer type and value stored alongside legacy value column.](assets/images/v2.0_Angular_FastAPI_PrimeNG/db_answer.JPG)

*Answers table — JSONB `response` stores raw input and parsed answer. GIN indexes enable fast JSONB queries at scale.*

---

### Dev tooling

#### dev.ps1 — Win11 dev assistant

![PowerShell dev.ps1 assistant menu showing Angular and FastAPI menu options alongside existing Nuxt entries for parallel stack management.](assets/images/v2.0_Angular_FastAPI_PrimeNG/dev_ps1.JPG)

*dev.ps1 updated with Angular + FastAPI menu items — both stacks managed side by side from a single assistant.*

#### Angular dev server (ng serve)

![Angular ng serve terminal output showing Vite-based build completing and dev server running on localhost:4200.](assets/images/v2.0_Angular_FastAPI_PrimeNG/dev_ng_serve.JPG)

*Angular dev server — Vite-based build, hot reload, running on port 4200.*

#### FastAPI uvicorn logs

![FastAPI uvicorn dev server logs showing startup and clean HTTP request log lines with 200 OK responses.](assets/images/v2.0_Angular_FastAPI_PrimeNG/dev_api_logs.JPG)

*FastAPI uvicorn with `--reload` — clean structured logs, instant restarts on code changes, port 8000.*

---

## Current Scope (Implemented)

This repository contains two working implementations:

- `python-app/` — multiplication quiz for grade 2 practice (console)
- `nuxt-app/` — full-stack OpenMath app with PostgreSQL persistence

### Python app supports

- Difficulty selection: `low`, `medium`, `hard`
- 10-question quiz flow
- Integer input validation (`Please type a number.` on invalid input)
- Correct/wrong tracking and final percentage score

### Nuxt app supports

- Multi-quiz OpenMath platform (multiplication-first)
- Active student context across pages
- Student profile and learned timetable preferences
- Quiz types, progress tracking, and resumable sessions
- History analytics with speed + accuracy metrics
- Database statistics and admin reset tools

## Planned Scope

This repo hosts multiple full-stack implementations of the same domain:

- `angular-app/` + `python-api/` — **Angular + FastAPI (v2.0, primary maintained stack)** ✅
- `nuxt-app/` — Nuxt 4 + Drizzle ORM (v1.5, maintained) ✅
- `python-app/` — Python CLI (v1.5, maintained) ✅

All implementations share the same PostgreSQL database schema via canonical SQL migrations in `db/migrations/`.

## Repository Documentation

### Python app docs

- `python-app/README.md`
- `python-app/AI_INSTRUCTIONS.md`
- `python-app/docs/requirements.md`
- `python-app/docs/design.md`
- `python-app/docs/tasks.md`

### Cross-project specs

- `openmath_python_quiz_spec.md` — OpenMath Python console quiz spec (multiplication-first)
- `openmath_nuxt4_drizzle_reka_spec.md` — OpenMath Nuxt full-stack spec + Reka UI spec
- `openmath_react_laravel_chakra_spec.md` — legacy React + Laravel spec (replaced by Angular + FastAPI direction)
- `multiproject_repo_spec.md` — monorepo strategy and shared DB guidance
- `win11_dev_assistant_nuxt4_spec.md` — Win11 visibility-first assistant spec for Nuxt workflows

## Nuxt Quick Start

From repository root:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath\nuxt-app"
pnpm install
pnpm dev
```

Then open the Nuxt URL shown in terminal (typically `http://localhost:3000`).

## Dev Assistant (Win11)

Use root script `dev.ps1` to run visible, prompt-driven workflows.

### Common modes

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1
.\dev.ps1 doctor
.\dev.ps1 migrate-db
.\dev.ps1 validate-nuxt
.\dev.ps1 build-nuxt
.\dev.ps1 up-nuxt
```

For non-interactive diagnostics:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 doctor -AutoApprove
```

### Logs and run artifacts

Each run writes to:

- `.dev-assistant/logs/<timestamp>/run.log`
- `.dev-assistant/logs/<timestamp>/errors.log`
- `.dev-assistant/logs/<timestamp>/summary.json`

## Quick Start (Python App)

Use Python 3 from repository root:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath\python-app"
python src/main.py
```

## License

This project is licensed under the **MIT License**. See `LICENSE`.
