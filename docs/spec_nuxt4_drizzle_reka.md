# OpenMath — Full-Stack Web App SPEC (Nuxt 4 Layers + Nitro + Drizzle ORM + PostgreSQL + Reka UI)

## 0) Stack (updated)
- **Nuxt 4** app with **Nitro** server routes (single full-stack app)
- **Nuxt Layers** (`layers/`) to split concerns (auto-registered local layers) citeturn0search0turn0search13
- **PostgreSQL** database
- **Drizzle ORM + drizzle-kit** for typed schema + migrations and PG access citeturn0search2turn0search5turn0search15
- **Reka UI** for unstyled, fully accessible headless components (Vue port of Radix primitives) citeturn0search1turn0search10turn0search4

Dev workflow (recommended):
- Run Nuxt with **Vite dev server** (`pnpm dev`)
- Run PostgreSQL via **Docker** (single DB container)

### Required implementation skills (skills.sh)
Use these skills as the implementation playbook for this stack:

- Nuxt skill: https://skills.sh/antfu/skills/nuxt
- Drizzle ORM skill: https://skills.sh/bobmatnyc/claude-mpm-skills/drizzle-orm
- Reka UI skill: https://skills.sh/onmax/nuxt-skills/reka-ui

Implementation expectation:
- Follow the Nuxt skill for project/layer structure, server route patterns, and composable conventions.
- Follow the Drizzle ORM skill for schema modeling, migration generation, and query organization.
- Follow the Reka UI skill for accessible primitive composition and wrapper component design.
- When guidance conflicts, prioritize repository requirements in this spec, then apply skill patterns in a way that preserves the same API contract and data model.

---

## 1) Goal
A modern OpenMath web app where **multiplication is the first quiz type students can run**, with:
- Difficulty selection (`low`, `medium`, `hard`)
- Quiz sessions that store **generated questions**, **submitted answers**, and **scoring**
- History view + session detail view (full audit/replay)

---

## 2) Nuxt Layers Plan
Nuxt auto-registers local layers inside `layers/`, and each layer must contain a `nuxt.config.ts` (can be empty) to be recognized. citeturn0search0turn0search13

### Layer breakdown
- `layers/core` — domain logic (difficulty sets, generator, scoring), shared types
- `layers/db` — Drizzle schema, migrations config, DB client helpers
- `layers/ui` — Reka UI wrappers + app UI components (unstyled primitives + your design)

This keeps:
- API routes thin and stable (`server/api/*` at app root)
- business logic testable and reusable (`layers/core`)
- DB access isolated (`layers/db`)
- UI primitives consistent (`layers/ui`)

---

## 3) Project Structure (Nuxt 4 + Layers)
```
.
├─ app/
│  ├─ pages/
│  │  ├─ index.vue                 # Start screen (difficulty + length)
│  │  ├─ quiz/[sessionId].vue      # Quiz runner
│  │  └─ history/
│  │     ├─ index.vue              # Sessions list
│  │     └─ [sessionId].vue        # Session details
│  ├─ components/
│  └─ composables/
│     └─ useApi.ts                 # tiny fetch wrapper
│
├─ layers/
│  ├─ core/
│  │  ├─ nuxt.config.ts
│  │  └─ server/logic/
│  │     ├─ difficulty.ts
│  │     ├─ generator.ts
│  │     ├─ scoring.ts
│  │     └─ types.ts
│  │
│  ├─ db/
│  │  ├─ nuxt.config.ts
│  │  ├─ drizzle.config.ts
│  │  └─ server/db/
│  │     ├─ schema.ts              # Drizzle schema (tables + relations)
│  │     ├─ client.ts              # pg driver + drizzle() instance
│  │     └─ queries.ts
│  │
│  └─ ui/
│     ├─ nuxt.config.ts
│     ├─ components/
│     │  ├─ DifficultySelect.vue
│     │  ├─ QuestionCard.vue
│     │  ├─ ResultSummary.vue
│     │  └─ SessionTable.vue
│     └─ reka/
│        ├─ BaseButton.vue
│        ├─ BaseInput.vue
│        └─ BaseDialog.vue
│
├─ server/
│  └─ api/
│     ├─ sessions.post.ts
│     ├─ sessions.get.ts
│     ├─ sessions/[id].get.ts
│     └─ answers.post.ts
│
├─ drizzle/                        # migrations output folder (drizzle-kit)
│  └─ 0001_*.sql
├─ .env                            # DATABASE_URL=postgres://...
└─ package.json
```

---

## 4) UI Controls (Reka UI) — Suggested Building Blocks
Reka UI provides unstyled, accessible primitives meant to be styled by you. citeturn0search1turn0search10turn0search4

Suggested primitives for this app:
- **Start screen**
  - Radio/Toggle group (difficulty)
  - Select or Slider (question count)
  - Text input (optional name)
  - Primary button (Start)
- **Quiz**
  - Card-like container
  - Text input (numeric answer)
  - Button (Submit)
  - Progress indicator (answered / total)
  - Toast / Alert (optional feedback)
- **History**
  - Table (sessions)
  - Badges/Chips (difficulty)
  - Dialog (optional confirmations)

Implementation approach:
- Wrap Reka primitives into `layers/ui/reka/Base*.vue` so styling is centralized.

---

## 5) Database (PostgreSQL) — Traceable & Replayable
### Entities
- `students` (optional)
- `quiz_sessions`
- `questions`
- `answers`

### Relational Rules
- `quiz_sessions (1) -> (N) questions`
- `questions (1) -> (0/1) answers`
- `students (1) -> (N) quiz_sessions` (optional)

---

## 6) Drizzle ORM (schema + migrations)
Drizzle supports PostgreSQL via `node-postgres` (pg) or `postgres.js`. citeturn0search2turn0search5  
Drizzle-kit uses a `drizzle.config.ts` to define connection + folders. citeturn0search15

### Minimal Drizzle setup (spec-level)
- `layers/db/server/db/schema.ts` defines the tables + relations + indexes
- `layers/db/server/db/client.ts` reads `DATABASE_URL` and exports `db`

### Migration workflow
- Generate migrations into `/drizzle`
- Apply migrations to local DB

---

## 7) Difficulty Rules (server-side)
- `low` => mostly `{1, 5, 10}`
- `medium` => include `{2, 3, 4, 6}` + some easy
- `hard` => include `{7, 8, 9}` + all others

Constraints:
- `a` and `b` in `[1..10]`
- ensure at least one factor from the selected set

---

## 8) Nitro API Contract
### Create session + questions
`POST /api/sessions`
```json
{ "difficulty": "low", "totalQuestions": 10, "studentName": "Anna" }
```
Returns:
```json
{
  "sessionId": "uuid",
  "questions": [{ "id": "uuid", "a": 5, "b": 7, "position": 1 }]
}
```

### Submit answer
`POST /api/answers`
```json
{ "questionId": "uuid", "value": 35 }
```
Returns:
```json
{
  "isCorrect": true,
  "correctValue": 35,
  "session": { "correct": 3, "wrong": 1, "percent": 75 }
}
```

### History + details
- `GET /api/sessions`
- `GET /api/sessions/:id`

---

## 9) Scoring & Finalization
On each answer:
- compute correctness using stored `questions.correct`
- update session counters
- `score_percent = correct_count / total_questions * 100`
Finalize when answered == total_questions (`finished_at`).

---

## 10) Dev Run (recommended workflow)
- Postgres: Docker compose (single container)
- App: `pnpm dev` (Vite HMR)
- DB: run drizzle migrations before first use
- During implementation, apply the three required skills above as coding standards for Nuxt, Drizzle, and Reka UI decisions.

---

## 11) Acceptance Criteria (updated)
- Layers are in `layers/*` and recognized via `nuxt.config.ts`. citeturn0search0turn0search13
- Drizzle schema + migrations exist; DB is reproducible.
- Questions are generated server-side per difficulty and persisted.
- Answers persist; correctness and history replay match DB records.
- Implementation decisions and resulting code organization are consistent with the required skills references for Nuxt, Drizzle ORM, and Reka UI.
