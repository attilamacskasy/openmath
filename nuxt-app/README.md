# Nuxt App (Nuxt 4 + Nitro + Drizzle + Reka UI)

This app implements the web full-stack multiplication practice flow defined in:

- `../multiplication_practice_nuxt4_drizzle_reka_spec.md`
- `../multiproject_repo_spec.md`

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL running at `DATABASE_URL`

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:push
```

## Development

```bash
pnpm dev
```

## API Endpoints

- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/answers`
