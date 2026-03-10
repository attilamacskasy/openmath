# OpenMath Specification — v3.0
## DevOps Script (`dev.ps1`) Redesign

**Version:** 3.0  
**Status:** Draft Specification  
**Module:** Developer Experience / DevOps / Deployment  
**Inspiration:** Netlify-style self-hosted workflow — full control, no vendor lock-in

---

# 1. Overview

Redesign `dev.ps1` from a flat numbered menu into a **structured two-tier DevOps tool** covering both local development and production deployment workflows for OpenMath.

The script acts as a **self-hosted Netlify alternative**: a single entry point for building, running, deploying, and managing the entire OpenMath stack — without giving up control to a third-party platform.

---

# 2. Goals

1. Replace the flat 22-item menu with a clear two-tier structure: **DEV** and **PROD**
2. Group operations by component (Database, Backend, Frontend 1–4) with consistent sub-actions
3. Provide "Quick Start" commands to spin up the entire stack in one step
4. Support production container builds and deployment to both local Docker Desktop and remote Ubuntu servers
5. Keep the existing core infrastructure (logging, `Invoke-Step`, `Invoke-Flow`, PID management)
6. Make unimplemented frontends visible as placeholders (React, Svelte) without breaking the menu
7. Remove the old flat numbered menu entirely

---

# 3. Scope

### In scope
- Complete menu restructure with DEV / PROD tiers
- Per-component sub-menus with Init / Build / Start / Stop / Status+Logs actions
- Quick Start shortcuts for DEV and PROD
- Production container image builds (Dockerfile-based)
- Local Docker deployment (Docker Desktop)
- Remote Docker deployment (Ubuntu 24 server)
- Placeholder entries for React and Svelte frontends

### Out of scope
- Kubernetes / orchestration
- CI/CD pipeline files (GitHub Actions, etc.)
- TLS certificate management
- Cloud-managed container services (Azure, AWS, GCP)
- Secrets management beyond `.env` files

---

# 4. Menu Structure

```
═══════════════════════════════════════════════════════════════
  OpenMath DevOps Console (dev.ps1)
═══════════════════════════════════════════════════════════════

  [D] DEV  — Windows 11 — Docker + uvicorn + ng serve / Vite
  [P] PROD — Docker containers — local or remote deployment
  [H] Check Requirements (verify all prerequisites)
  [L] Open latest log
  [0] Exit
```

### DEV Sub-Menu

```
═══════════════════════════════════════════════════════════════
  DEV — Windows 11 — Docker + uvicorn + ng serve / Vite
═══════════════════════════════════════════════════════════════

  Current Dev Stack: Postgres + Python FastAPI + Angular/PrimeNG

  [Q] Quick Start Dev Stack (Postgres + FastAPI + Angular)
  [S] Setup — pick components to init/install

  ─── Database 1 (Docker / PostgreSQL) ───
  [D1] Init (verify Docker, create .env)
  [D2] Build (docker compose build)
  [D3] Start (docker compose up -d)
  [D4] Apply Migrations
  [D5] Stop (docker compose down)
  [D6] Status + Logs

  ─── Backend 1 (Python FastAPI) ───
  [B1] Init (create venv, install deps)
  [B2] Start (uvicorn --reload)
  [B3] Stop
  [B4] Status + Logs

  ─── Frontend 1 (React JS) ───
  [F1] Not yet implemented

  ─── Frontend 2 (Vue.js / Nuxt 4) ───
  [N1] Init (pnpm install, approve builds, nuxt prepare)
  [N2] Start (Vite dev server)
  [N3] Stop
  [N4] Validate (typecheck)
  [N5] Build
  [N6] Status + Logs

  ─── Frontend 3 (Angular + PrimeNG) ───
  [A1] Init (pnpm install)
  [A2] Start (ng serve)
  [A3] Stop
  [A4] Build
  [A5] Status + Logs

  ─── Frontend 4 (Svelte) ───
  [V1] Not yet implemented

  [0] ← Back to main menu
```

### PROD Sub-Menu

```
═══════════════════════════════════════════════════════════════
  PROD — Docker Container Deployment
═══════════════════════════════════════════════════════════════

  Current Prod Stack: Postgres + Python FastAPI + Angular/PrimeNG

  ─── Build Container Images ───
  [B1] Build ALL images (database + backend + frontend)
  [B2] Build Database image
  [B3] Build Backend image (python-api)
  [B4] Build Frontend 1 (React)       — not yet implemented
  [B5] Build Frontend 2 (Nuxt)
  [B6] Build Frontend 3 (Angular)
  [B7] Build Frontend 4 (Svelte)      — not yet implemented

  ─── Deploy to Local Docker (Docker Desktop) ───
  [L1] Start all containers
  [L2] Stop all containers
  [L3] Status + Logs
  [L4] Reset (stop + remove volumes + rebuild)

  ─── Deploy to Remote Docker (Ubuntu 24 Server) ───
  [R1] Setup remote host (SSH key, Docker install check)
  [R2] Push images to remote
  [R3] Start all containers on remote
  [R4] Stop all containers on remote
  [R5] Status + Logs (remote)

  [0] ← Back to main menu
```

---

# 5. Component Definitions

## 5.1 Database 1 — Docker / PostgreSQL

| Action | Command | Notes |
|--------|---------|-------|
| Init | Verify Docker installed, `.env` exists with `DATABASE_URL` | Run prerequisites subset |
| Build | `docker compose build postgres` | Pulls `postgres:16-alpine` |
| Start | `docker compose up -d postgres adminer` | Starts Postgres + Adminer |
| Apply Migrations | `scripts/apply-migrations.ps1` | Requires `psql` in PATH |
| Stop | `docker compose down` | Stops all Docker services |
| Status + Logs | `docker compose ps` + `docker compose logs --tail=100 postgres` | Show running state |

## 5.2 Backend 1 — Python FastAPI

| Action | Command | Notes |
|--------|---------|-------|
| Init | Create `.venv`, `pip install -r python-api/requirements.txt` | Uses repo-root venv |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` | Opens in new terminal |
| Stop | Kill tracked PID | PID stored in `.dev-assistant/state/` |
| Status + Logs | Check PID alive, show uvicorn window | Manual process check |

## 5.3 Frontend 1 — React JS (Placeholder)

All actions display: `"React frontend is not yet implemented. See docs/spec_react_fastapi.md"`

## 5.4 Frontend 2 — Vue.js / Nuxt 4

| Action | Command | Notes |
|--------|---------|-------|
| Init | `pnpm install` + `pnpm approve-builds` + `pnpm nuxt prepare` | Full setup flow |
| Start | `pnpm dev` | Opens Vite dev server in new terminal |
| Stop | Kill tracked PID | PID stored in `.dev-assistant/state/` |
| Validate | `pnpm nuxt typecheck` | Type checking |
| Build | `pnpm build` | Production build |
| Status + Logs | Check PID alive | Manual process check |

## 5.5 Frontend 3 — Angular + PrimeNG

| Action | Command | Notes |
|--------|---------|-------|
| Init | `pnpm install` | Install dependencies |
| Start | `pnpm start` (ng serve) | Opens in new terminal at `:4200` |
| Stop | Kill tracked PID | PID stored in `.dev-assistant/state/` |
| Build | `pnpm run build` | Production build |
| Status + Logs | Check PID alive | Manual process check |

## 5.6 Frontend 4 — Svelte (Placeholder)

All actions display: `"Svelte frontend is not yet implemented. See docs/spec_svelte_fastapi.md"`

---

# 6. Quick Start Flows

## 6.1 DEV Quick Start

Runs the **current default dev stack** in sequence:

1. Database 1 → Start
2. Database 1 → Apply Migrations (if pending)
3. Backend 1 → Init (skip if venv exists)
4. Backend 1 → Start
5. Frontend 3 → Init (skip if `node_modules` exists)
6. Frontend 3 → Start

**Result:** Full dev environment running with:
- PostgreSQL at `localhost:5432`
- Adminer at `localhost:8080`
- FastAPI at `localhost:8000` (with Swagger at `/docs`)
- Angular at `localhost:4200`

## 6.2 PROD Quick Start (Local)

1. Build all container images
2. Start all containers via `docker-compose.prod.yml`

## 6.3 PROD Quick Start (Remote)

1. Verify remote host connectivity
2. Build all container images
3. Push images to remote (via `docker save` / `docker load` or registry)
4. Start all containers on remote host

---

# 7. Production Architecture

## 7.1 Container Images

Each component gets a production Dockerfile:

| Image | Dockerfile | Base | Exposed Port |
|-------|-----------|------|-------------|
| `openmath-db` | `db/Dockerfile` | `postgres:16-alpine` | 5432 (internal only) |
| `openmath-api` | `python-api/Dockerfile` | `python:3.12-slim` | 8000 (internal only) |
| `openmath-angular` | `angular-app/Dockerfile` | `node` → `nginx:alpine` (multi-stage) | 80 (public) |
| `openmath-nuxt` | `nuxt-app/Dockerfile` | `node:20-alpine` | 3000 (public) |

## 7.2 Production Compose File

A separate `docker-compose.prod.yml` defines the production stack:

```yaml
services:
  postgres:
    image: openmath-db
    restart: unless-stopped
    volumes:
      - pg_prod_data:/var/lib/postgresql/data
    networks:
      - openmath-net

  python-api:
    image: openmath-api
    restart: unless-stopped
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql+asyncpg://...
    networks:
      - openmath-net

  angular-app:
    image: openmath-angular
    restart: unless-stopped
    depends_on:
      - python-api
    ports:
      - "80:80"
    networks:
      - openmath-net

networks:
  openmath-net:
    driver: bridge

volumes:
  pg_prod_data:
```

## 7.3 Remote Deployment Strategy

**Target:** Ubuntu 24.04 LTS server with Docker installed.

**Transfer method:** `docker save` → `scp` → `docker load` (no registry required for self-hosted).

| Step | Command | Where |
|------|---------|-------|
| Build | `docker compose -f docker-compose.prod.yml build` | Local |
| Save | `docker save openmath-api openmath-angular openmath-db > openmath-images.tar` | Local |
| Transfer | `scp openmath-images.tar user@server:/opt/openmath/` | Local → Remote |
| Load | `ssh user@server "docker load < /opt/openmath/openmath-images.tar"` | Remote |
| Deploy | `ssh user@server "cd /opt/openmath && docker compose -f docker-compose.prod.yml up -d"` | Remote |
| Status | `ssh user@server "docker compose -f docker-compose.prod.yml ps"` | Remote |
| Stop | `ssh user@server "docker compose -f docker-compose.prod.yml down"` | Remote |

---

# 8. Remote Host Setup

The `[R1] Setup remote host` action performs:

1. **Test SSH connectivity** — `ssh user@host "echo ok"`
2. **Verify Docker installed** — `ssh user@host "docker --version"`
3. **Verify Docker Compose** — `ssh user@host "docker compose version"`
4. **Create deployment directory** — `ssh user@host "mkdir -p /opt/openmath"`
5. **Transfer `.env.prod`** — `scp .env.prod user@host:/opt/openmath/.env`
6. **Transfer `docker-compose.prod.yml`** — `scp docker-compose.prod.yml user@host:/opt/openmath/`

### Remote Configuration

Remote host details are stored in `.dev-assistant/state/remote.json`:

```json
{
  "host": "192.168.1.100",
  "user": "deploy",
  "port": 22,
  "deployPath": "/opt/openmath",
  "sshKeyPath": "~/.ssh/id_ed25519"
}
```

The script prompts for these values on first use of any remote action. Values are persisted and reused.

---

# 9. CLI Modes

The script continues to support direct invocation without the interactive menu:

```powershell
# DEV shortcuts
.\dev.ps1 -Mode dev-quick         # Quick Start Dev Stack
.\dev.ps1 -Mode db-start          # Database Start
.\dev.ps1 -Mode db-stop           # Database Stop
.\dev.ps1 -Mode db-migrate        # Apply Migrations
.\dev.ps1 -Mode fastapi-start     # Start FastAPI
.\dev.ps1 -Mode fastapi-stop      # Stop FastAPI
.\dev.ps1 -Mode angular-start     # Start Angular
.\dev.ps1 -Mode angular-stop      # Stop Angular
.\dev.ps1 -Mode nuxt-start        # Start Nuxt
.\dev.ps1 -Mode nuxt-stop         # Stop Nuxt

# PROD shortcuts
.\dev.ps1 -Mode prod-build        # Build all prod images
.\dev.ps1 -Mode prod-local-up     # Start local prod stack
.\dev.ps1 -Mode prod-local-down   # Stop local prod stack
.\dev.ps1 -Mode prod-remote-setup # Setup remote host
.\dev.ps1 -Mode prod-remote-push  # Push images to remote
.\dev.ps1 -Mode prod-remote-up    # Start remote prod stack
.\dev.ps1 -Mode prod-remote-down  # Stop remote prod stack

# Utility
.\.dev.ps1 -Mode check-reqs        # Check requirements
.\dev.ps1 -Mode menu              # Interactive menu (default)
```

---

# 10. Status & Logs Standardization

Every component's "Status + Logs" action follows a consistent pattern:

1. **Check if running** — PID check (dev servers) or `docker compose ps` (containers)
2. **Show endpoint URLs** — Display the URL where the service is accessible
3. **Show recent logs** — Tail last 50 lines from the relevant source
4. **Show resource usage** — `docker stats --no-stream` for containers

Example output:
```
═══ Database 1 (PostgreSQL) ═══
  Status:    ● Running (container: openmath-local-dev-db)
  Endpoint:  localhost:5432
  Uptime:    2h 15m
  Memory:    42 MB

  Recent logs (last 10 lines):
  2026-03-09 10:15:22 LOG: checkpoint complete
  ...
```

---

# 11. Requirements Check

The existing prerequisites check function is updated to verify all components:

| Check | What |
|-------|------|
| `node` | Node.js installed |
| `pnpm` | pnpm installed |
| `docker` | Docker installed |
| `docker compose` | Compose V2 available |
| `git` | Git installed |
| `python` | Python 3.x installed |
| `pip` | pip available |
| `psql` | PostgreSQL client tools |
| `ssh` | SSH client (for remote deploy) |
| `.env` | Root `.env` file exists with `DATABASE_URL` |
| `.venv` | Python venv exists |
| Ports | Check 5432, 8000, 4200, 3000, 8080 availability |

---

# 12. Logging & State

### Unchanged from current

- Run logs saved to `.dev-assistant/logs/{run-id}/`
- PID files in `.dev-assistant/state/`
- Summary JSON generated at end of each run

### New state files

| File | Purpose |
|------|---------|
| `.dev-assistant/state/remote.json` | Remote host SSH configuration |
| `.dev-assistant/state/last-build.json` | Timestamps of last container image builds |

---

# 13. Implementation Plan

### Phase 1 — Menu Restructure (DEV)
1. Refactor `Show-Menu` into `Show-MainMenu`, `Show-DevMenu`, `Show-ProdMenu`
2. Implement letter-based navigation (D/P/H/L/0)
3. Wire all existing functions to new menu structure
4. Add placeholder entries for React and Svelte
5. Add status checks for each component sub-menu
6. Update requirements check with expanded checks

### Phase 2 — Production Builds
1. Create `db/Dockerfile`
2. Create `python-api/Dockerfile`
3. Create `angular-app/Dockerfile` (multi-stage: build + nginx)
4. Create `docker-compose.prod.yml`
5. Implement `Build ALL images` and per-component build commands

### Phase 3 — Local Production Deployment
1. Implement `prod-local-up` / `prod-local-down`
2. Add status and log viewing for production containers
3. Add reset (volumes + rebuild) option

### Phase 4 — Remote Deployment
1. Implement remote host setup wizard
2. Implement image transfer via `docker save` / `scp` / `docker load`
3. Implement remote start/stop/status via SSH
4. Persist remote config in `remote.json`

---

# 14. File Changes Summary

| File | Action |
|------|--------|
| `dev.ps1` | Major rewrite — new menu structure, all functions reorganized |
| `docker-compose.prod.yml` | New — production compose file |
| `db/Dockerfile` | New — PostgreSQL production image with migrations |
| `python-api/Dockerfile` | New — FastAPI production image |
| `angular-app/Dockerfile` | New — Angular multi-stage build (Node → Nginx) |
| `nuxt-app/Dockerfile` | New — Nuxt production image |
| `.env.prod.example` | New — example production environment file |

---

# 15. Success Criteria

1. `.\dev.ps1` launches a clean two-tier menu (DEV / PROD)
2. DEV Quick Start spins up DB + FastAPI + Angular with one keypress
3. Each component has consistent Init / Start / Stop / Status sub-actions
4. Production images build successfully for all implemented components
5. Local production deployment starts and serves the app on port 80
6. Remote deployment transfers images and starts containers on Ubuntu server
7. Placeholder menu items are visible but clearly marked as unimplemented
8. All existing CLI `-Mode` shortcuts continue to work
9. Requirements check covers all components and prerequisites
