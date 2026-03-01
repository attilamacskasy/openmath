# Multiplication Practice — Monorepo SPEC (Python console + Nuxt 4 + React/Laravel) 

## Goal (monorepo)
Keep **three implementations** in a single repository so you can compare and run:
- **Python**: simple console app (already implemented in `src/`)
- **Nuxt 4 + Nitro**: full-stack Vue app using Layers + Drizzle + Reka UI (current Nuxt work)
- **React + Laravel**: full-stack pair (React frontend using MUI or your preferred UI; Laravel backend) to be added

Both web implementations (**Nuxt** and **React/Laravel**) **share the same PostgreSQL database** so sessions/questions/answers are centrally stored and comparable.

---

## Top-level repo layout (monorepo)
```
.
├─ README.md
├─ .env                      # central defaults (not secrets)
├─ docker-compose.yml        # services: postgres, optional php/nginx for prod testing
├─ db/
│  ├─ migrations/            # canonical SQL migrations (single source of truth)
│  └─ seeds/                 # optional seed data (sql or js/ts)
│
├─ python-app/               # your existing console app
│  ├─ src/
│  │  └─ main.py
│  ├─ requirements.txt
│  └─ README.md
│
├─ nuxt-app/                 # Nuxt 4 + Nitro implementation
│  ├─ app/
│  ├─ layers/
│  │  ├─ core/
│  │  ├─ db/                 # Drizzle schema + drizzle.config.ts
│  │  └─ ui/                 # Reka UI wrappers
│  ├─ server/api/
│  ├─ drizzle/               # generated migrations (optional, produced from schema)
│  ├─ package.json
│  └─ README.md
│
├─ react-laravel/            # React + Laravel implementation (separate apps)
│  ├─ frontend/              # React app (MUI)
│  │  ├─ src/
│  │  └─ package.json
│  ├─ backend/               # Laravel app
│  │  ├─ app/
│  │  ├─ database/
│  │  │  └─ migrations/      # Laravel migrations (should reflect canonical SQL)
│  │  └─ composer.json
│  └─ README.md
│
└─ scripts/
   ├─ apply-migrations.sh    # helper to apply canonical SQL migrations to DB
   └─ reset-db.sh
```

---

## Database strategy — single shared PostgreSQL
**Principles**
- The DB is authoritative and shared by both web apps.
- Keep a **single canonical set of SQL migrations** in `db/migrations/` (raw SQL files, numbered).
- Each framework (Nuxt/Drizzle and Laravel) should either:
  1. Use the canonical SQL files (preferred: call `scripts/apply-migrations.sh` in CI/dev), **or**
  2. Keep its own migrations but **commit the generated SQL** to `db/migrations/` and ensure they match.

**Why raw SQL migrations as canonical?**
- Avoids drift between two different migration systems (Drizzle vs Laravel).
- Both Nuxt (drizzle) and Laravel can run raw SQL files to ensure the DB schema is identical.
- Simpler to audit and to run from one place (CI, Docker entrypoint).

**Suggested workflow**
- Author schema changes in one place (either `layers/db/schema.ts` or Laravel migration PHP), then generate canonical SQL and commit to `db/migrations/`.
- During dev, run `scripts/apply-migrations.sh` (it will run all files in `db/migrations/` in order).
- In CI, use the same script.

---

## Environment & Docker
Keep a single Postgres container used by all apps.

`docker-compose.yml` (dev-focused):
- service: `postgres` (expose 5432 on host)
- volumes: persisted PG data
- optional service: `adminer` or `pgadmin` for quick DB inspection

Example `.env` (root):
```
POSTGRES_USER=quiz
POSTGRES_PASSWORD=quiz
POSTGRES_DB=quiz
POSTGRES_PORT=5432
DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz
```

Each app uses its own local env file (e.g., `nuxt-app/.env`, `react-laravel/backend/.env`) that points to the same `DATABASE_URL` (or reference root `.env` in scripts).

---

## Migrations & Seed commands (helpers)
Provide simple scripts at repo root:
- `scripts/apply-migrations.sh` — psql loop through `db/migrations/*.sql`
- `scripts/reset-db.sh` — drops and recreates DB, then applies migrations and seeds

This keeps dev simple: one command to prepare the shared DB, then run either web app locally.

---

## Dev run recommendations
- Start Postgres: `docker compose up -d`
- Apply migrations: `./scripts/apply-migrations.sh`
- Run Nuxt (recommended host dev for fast HMR): `cd nuxt-app && pnpm dev`
- Run Laravel backend (use Valet, Sail, or host PHP devserver): `cd react-laravel/backend && php artisan serve`
- Run React frontend: `cd react-laravel/frontend && pnpm dev` (configure API_BASE to Laravel URL)

Because both web apps point to the same DB, you can:
- Create a session in Nuxt, view it from React UI, and vice versa.
- Compare stored questions/answers across implementations.

---

## Handling ORM differences
- **Drizzle** (Nuxt) and **Eloquent/Laravel** have different model layers. To prevent mismatch:
  - Use canonical SQL with explicit column types and constraints (`CHECK`, indexes).
  - In each codebase, map ORM models to the canonical schema (avoid letting the ORM auto-create schema silently).
  - Write integration tests that verify both stacks read/write the same shapes.

---

## Security & Concurrency notes
- Keep DB credentials out of committed files; use `.env` and `.env.example`.
- When both apps run concurrently against the same DB, ensure migrations are applied before either app writes.
- Use database transactions in backend endpoints when updating counts (prevent race conditions on score updates).

---

## Acceptance criteria (monorepo)
- `db/migrations` contains canonical SQL files; `scripts/apply-migrations.sh` runs cleanly.
- Nuxt app and React/Laravel app connect to the same Postgres instance and can read/write sessions/questions/answers interchangeably.
- Python console app remains functional and can read the DB optionally (if you wire it to the same DB) but may keep local file-based data; record in README which data source it uses.
- Documented dev commands in root `README.md`.

---

If you want, I can:
- generate the `docker-compose.yml` + `scripts/apply-migrations.sh` and a starter `db/migrations/0001_init.sql` reflecting the schema we discussed, **or**
- create example `.env` files for each app and example connection snippets.

Which would you like me to generate next?