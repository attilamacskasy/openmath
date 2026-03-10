# Implementation Summary — v2.8 Production Dockerization

**Version:** 2.8  
**Spec:** `docs/spec_v2.8_production_dockerization.md`  
**Status:** ✅ Complete  
**Depends on:** v2.7.5 (KaTeX Rendering)

---

## Overview

v2.8 establishes the first production deployment standard for OpenMath using a portable 3-container Docker architecture. The entire application stack is **stateless** — all persistent data lives exclusively in PostgreSQL. Containers can be rebuilt and redeployed at any time; a single database backup captures the complete application state.

The implementation replaces the originally proposed `prod.sh` bash script with a **Python DevOps PROD menu** integrated into the existing `dev.py` CLI framework, providing cross-platform support (Windows + Linux) with InquirerPy arrow-key navigation.

---

## Architecture

### 3-Container Stack

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Host (Linux server or Docker Desktop)               │
│                                                             │
│  ┌─────────────────┐                                        │
│  │  angular-app     │ ← Public :80 (nginx + SPA)            │
│  │  nginx reverse   │──→ /api/ proxied internally           │
│  └────────┬────────┘                                        │
│           │ http://python-api:8000                           │
│  ┌────────▼────────┐                                        │
│  │  python-api      │ ← Internal only (FastAPI + uvicorn)   │
│  └────────┬────────┘                                        │
│           │ postgresql:5432                                  │
│  ┌────────▼────────┐                                        │
│  │  postgresql      │ ← Internal only (postgres:16-alpine)  │
│  │  ┌─────────────┐│                                        │
│  │  │ Volume data  ││ ← openmath-local-prod-pgdata          │
│  │  └─────────────┘│                                        │
│  └─────────────────┘                                        │
│                                                             │
│  Network: openmath-local-prod-net (bridge)                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **nginx reverse proxy** — The Angular container proxies `/api/` requests to the backend internally. The browser never talks directly to `python-api`, providing stronger isolation than the spec's original `API_BASE_URL` approach.
- **No public ports on backend/DB** — Only `angular-app` exposes host port 80.
- **Docker Compose `depends_on` with health checks** — Containers start in dependency order with health conditions.
- **Python devops menu** — Replaces `prod.sh` for cross-platform support.

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production 3-container stack definition |
| `.env.example` | Environment variable template with all required/optional vars |
| `python-api/Dockerfile` | Backend image: `python:3.12-slim`, uvicorn with 2 workers |
| `angular-app/Dockerfile` | Frontend image: multi-stage `node:20-alpine` → `nginx:alpine` |
| `angular-app/nginx.conf` | SPA routing, API reverse proxy, gzip, static asset caching |
| `devops/prod/__init__.py` | Package init |
| `devops/prod/builds.py` | Image build functions (`prod_build_all`, `prod_build_component`) |
| `devops/prod/local.py` | Local Docker deployment (up, down, status, reset) |
| `devops/prod/remote.py` | Remote SSH deployment (setup, push, up, down, status) |
| `devops/prod/database.py` | PostgreSQL backup & restore (v3.2 addition) |
| `devops/menus/prod_menu.py` | Interactive PROD menu with InquirerPy |
| `backups/.gitkeep` | Backup storage directory |

### Modified Files

| File | Changes |
|------|---------|
| `devops/cli.py` | Added PROD CLI shortcut modes + database modes |
| `.gitignore` | Added `backups/*.sql.gz` |

---

## docker-compose.prod.yml

### Services

| Service | Image | Container Name | Ports | Health Check |
|---------|-------|----------------|-------|-------------|
| `postgresql` | `postgres:16-alpine` | `openmath-local-prod-db` | None (internal) | `pg_isready -U quiz` |
| `python-api` | `openmath/python-api:latest` | `openmath-local-prod-api` | None (internal) | `urllib GET /api/health` |
| `angular-app` | `openmath/angular-app:latest` | `openmath-local-prod-frontend` | `${PUBLIC_PORT:-80}:80` | `wget GET /` |

### Environment Variables

**PostgreSQL:**
- `POSTGRES_USER` (default: `quiz`)
- `POSTGRES_PASSWORD` (required, no default)
- `POSTGRES_DB` (default: `quiz`)

**Python API:**
- `DATABASE_URL` — constructed from compose vars
- `CORS_ORIGINS` (default: `http://localhost`)
- `JWT_SECRET_KEY` (required)
- `JWT_ALGORITHM` (default: `HS256`)
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` (default: `30`)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS` (default: `7`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (optional)
- `DEBUG` (hardcoded: `false`)

**Frontend:**
- `PUBLIC_PORT` (default: `80`)

### Resources

- Volume: `openmath-local-prod-pgdata` — persistent PostgreSQL data
- Volume mount: `./db/migrations:/docker-entrypoint-initdb.d:ro` — auto-applies SQL migrations on first init
- Network: `openmath-local-prod-net` (bridge driver)

---

## python-api/Dockerfile

```dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Key decisions:
- `python:3.12-slim` — smaller image than full Python
- Only copies `app/` directory (not tests, docs, etc.)
- 2 uvicorn workers for production concurrency
- Built-in health check at `/api/health`

---

## angular-app/Dockerfile

Multi-stage build:

1. **Stage 1 (build):** `node:20-alpine` + pnpm → `pnpm run build`
2. **Stage 2 (serve):** `nginx:alpine` + custom `nginx.conf` + built files

---

## angular-app/nginx.conf

| Feature | Configuration |
|---------|--------------|
| SPA routing | `try_files $uri $uri/ /index.html` |
| API reverse proxy | `location /api/` → `proxy_pass http://python-api:8000/api/` |
| Proxy headers | `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` |
| Static caching | 1 year, `immutable` for JS/CSS/images/fonts |
| Gzip compression | Enabled for common MIME types, min 256 bytes |

The nginx reverse proxy eliminates the need for `API_BASE_URL` — the browser makes all API calls to the same origin, and nginx routes them internally.

---

## DevOps PROD Menu

### Menu Structure

```
── Build Container Images ──────────────
  Build ALL         Build all production images
  Build Backend     openmath/python-api:latest
  Build Angular     openmath/angular-app:latest
  Build PostgreSQL  postgres:16-alpine (pull)
── Database (Backup & Restore) ─────────
  Backup            Create pg_dump → backups/
  Restore           Restore from backup file
  List Backups      Show available backups
── Local Docker (Docker Desktop) ───────
  Start             Start all containers
  Stop              Stop all containers
  Status            Container status + logs
  Reset             Stop + remove volumes + rebuild
── Remote Docker (Ubuntu 24 Server) ────
  Setup             Configure SSH + Docker check
  Push              Push images to remote
  Start             Start remote containers
  Stop              Stop remote containers
  Status            Remote status + logs
```

### CLI Shortcut Modes

```
python dev.py prod-build           Build all production images
python dev.py prod-local-up        Start local prod containers
python dev.py prod-local-down      Stop local prod containers
python dev.py prod-local-status    Show local prod status
python dev.py prod-local-reset     Reset local prod (rebuild)
python dev.py prod-remote-setup    Configure remote host
python dev.py prod-remote-push     Push images to remote
python dev.py prod-remote-up       Start remote containers
python dev.py prod-remote-down     Stop remote containers
python dev.py prod-remote-status   Show remote status
python dev.py prod-db-backup       Backup PostgreSQL database
python dev.py prod-db-restore      Restore from backup file
python dev.py prod-db-list         List available backups
```

---

## Remote Deployment (devops/prod/remote.py)

A feature beyond the original v2.8 spec, providing full SSH-based remote deployment:

| Function | Description |
|----------|-------------|
| `remote_setup()` | Interactive SSH wizard — configures host, user, port, deploy path, SSH key; tests connectivity; verifies Docker & Compose on remote; transfers compose file + `.env` |
| `remote_push()` | `docker save` → `scp` tar → `docker load` on remote |
| `remote_up()` | SSH → `docker compose up -d` on remote |
| `remote_down()` | SSH → `docker compose down` on remote |
| `remote_status()` | SSH → `docker compose ps` + `logs --tail=20` |

Configuration is persisted to `remote.json` via the state module.

---

## Database Backup & Restore (devops/prod/database.py)

Added via v3.2 spec, integrated into the v2.8 PROD menu:

| Function | Description |
|----------|-------------|
| `db_backup()` | `docker exec pg_dump --clean --if-exists` → Python gzip → `backups/openmath_{timestamp}.sql.gz` |
| `db_restore()` | Interactive picker → "type yes" confirmation → gzip decompress → `docker exec -i psql` |
| `db_list_backups()` | Formatted table: filename, size, date, total count + size |

Key details:
- Uses Python's `gzip` module (no native gzip required on Windows)
- Verifies container `openmath-local-prod-db` is running before operations
- Cleans up partial files on backup failure
- `backups/*.sql.gz` added to `.gitignore`

---

## Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Deploy on Docker host with exactly 3 containers | ✅ |
| 2 | PostgreSQL persists data across container recreation | ✅ Named volume `openmath-local-prod-pgdata` |
| 3 | Backend connects to DB over internal Docker networking | ✅ `postgresql:5432` via `openmath-local-prod-net` |
| 4 | Frontend publicly reachable from host port | ✅ `${PUBLIC_PORT:-80}:80` |
| 5 | Backend and database not publicly exposed | ✅ No `ports:` on either service |
| 6 | Menu supports build, deploy, stop, status | ✅ Full PROD menu + CLI shortcuts |
| 7 | Health checks defined for all services | ✅ `pg_isready`, `/api/health`, `wget /` |
| 8 | Environment config externalized through `.env` | ✅ `.env.example` provided |
| 9 | Portable to Azure/AWS/GCP container runtimes | ✅ Standard Docker Compose |
| 10 | Architecture docs with endpoint definitions | ✅ nginx.conf, spec diagrams |

---

## Spec Deviations

| Spec | Implementation | Reason |
|------|---------------|--------|
| `prod.sh` bash script | Python DevOps PROD menu | Cross-platform (Windows + Linux), consistent UX with DEV menu |
| `deploy/docker-compose.prod.yml` | Root `docker-compose.prod.yml` | Simpler path, standard Docker Compose convention |
| `deploy/.env.example` | Root `.env.example` | Same as compose file location |
| `SECRET_KEY` env var | `JWT_SECRET_KEY` | More specific naming for JWT-based auth |
| `CORS_ALLOWED_ORIGINS` | `CORS_ORIGINS` | Shorter, FastAPI convention |
| `GET /health` endpoint | `GET /api/health` | Consistent with `/api/` prefix used throughout |
| `API_BASE_URL` on frontend | nginx reverse proxy | Stronger isolation, no CORS needed |

---

## Beyond Spec

Features implemented that exceed the original v2.8 specification:

1. **Remote SSH deployment** — full wizard with config persistence
2. **Database backup & restore** — interactive compressed backup/restore (spec only mentioned it as a recommendation)
3. **nginx reverse proxy** — API calls proxied through frontend container
4. **Static asset caching + gzip** — production-grade nginx config
5. **Google OAuth env vars** — SSO configuration passed through
6. **JWT configuration** — fully externalized with sensible defaults
7. **DB migrations auto-mount** — `./db/migrations` mounted into PostgreSQL `initdb.d`
8. **InquirerPy arrow-key menu** — superior UX vs bash `select` menu
