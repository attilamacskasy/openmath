# OpenMath — Production Operations Guide

> Complete reference for running, securing, and managing the OpenMath production
> stack on Docker Desktop (Windows/Mac) or any Docker-capable host.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Environment Configuration (.env)](#3-environment-configuration-env)
4. [First-Time Setup](#4-first-time-setup)
5. [PostgreSQL — Passwords & Security](#5-postgresql--passwords--security)
6. [Database Migrations](#6-database-migrations)
7. [Connecting with pgAdmin 4](#7-connecting-with-pgadmin-4)
8. [Accessing the Website](#8-accessing-the-website)
9. [Accessing the API](#9-accessing-the-api)
10. [Remote / LAN Access](#10-remote--lan-access)
11. [Container Management](#11-container-management)
12. [Database Backup & Restore](#12-database-backup--restore)
13. [Monitoring & Logs](#13-monitoring--logs)
14. [Troubleshooting](#14-troubleshooting)
15. [Security Hardening Checklist](#15-security-hardening-checklist)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    Docker Desktop (Host Machine)                 │
│                                                                  │
│  ┌─────────────────────┐                                        │
│  │ openmath-local-prod  │   docker-compose.prod.yml             │
│  │   -frontend          │   (3 containers + 1 volume + 1 net)   │
│  │   nginx:alpine       │                                        │
│  │   Port 80 ──────────────► http://localhost                    │
│  │   /api/ proxied ─────┐                                        │
│  └──────────────────────┘   │                                    │
│                              ▼                                    │
│  ┌──────────────────────┐                                        │
│  │ openmath-local-prod  │                                        │
│  │   -api               │                                        │
│  │   python:3.12-slim   │                                        │
│  │   uvicorn :8000      │   (internal only — no host port)       │
│  │   FastAPI + asyncpg  │                                        │
│  └──────────┬───────────┘                                        │
│             │ postgresql://quiz:***@postgresql:5432/quiz          │
│             ▼                                                    │
│  ┌──────────────────────┐                                        │
│  │ openmath-local-prod  │                                        │
│  │   -db                │                                        │
│  │   postgres:16-alpine │   (internal only — no host port)       │
│  │   Volume: pgdata     │                                        │
│  └──────────────────────┘                                        │
│                                                                  │
│  Network: openmath-local-prod-net (bridge)                       │
│  Volume:  openmath-local-prod-pgdata                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Aspect | Detail |
|--------|--------|
| **Frontend** | Angular + PrimeNG, served by nginx. Handles SPA routing (`try_files`). |
| **API proxy** | nginx proxies `/api/*` requests to the FastAPI backend — no CORS issues, no exposed API port. |
| **Database** | PostgreSQL 16 Alpine. **No port exposed to host** by default (security). |
| **Data** | All application data (users, quizzes, scores, badges, roles) lives in PostgreSQL. The app containers are stateless. |
| **Images** | `openmath/python-api:latest`, `openmath/angular-app:latest`, `postgres:16-alpine` |

---

## 2. Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Docker Desktop | 4.x | `docker --version` |
| Docker Compose | v2.x (bundled) | `docker compose version` |
| Python | 3.12+ | `python --version` (only for DevOps CLI) |
| Git | any | `git --version` |

---

## 3. Environment Configuration (.env)

Create a `.env` file in the **repository root** (`C:\Users\attila\Desktop\Code\openmath\.env`).
This file is git-ignored for security.

### Minimal .env (required)

```env
# ── PostgreSQL ──────────────────────────────────────────
POSTGRES_USER=quiz
POSTGRES_PASSWORD=your-strong-password-here
POSTGRES_DB=quiz

# ── JWT Authentication ──────────────────────────────────
JWT_SECRET_KEY=minimum-32-character-random-secret-change-this

# ── CORS (match the URL users access the site from) ────
CORS_ORIGINS=http://localhost
```

### Full .env (all options)

```env
# ── PostgreSQL ──────────────────────────────────────────
POSTGRES_USER=quiz
POSTGRES_PASSWORD=YourStr0ng!Passw0rd#2026
POSTGRES_DB=quiz

# ── JWT Authentication ──────────────────────────────────
JWT_SECRET_KEY=change-me-to-a-random-64-char-string-use-openssl-rand
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# ── CORS ────────────────────────────────────────────────
# Comma-separated origins. Add your LAN IP if accessing from other machines.
CORS_ORIGINS=http://localhost,http://192.168.1.100

# ── Google SSO (optional) ──────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost/auth/callback

# ── Public port (default: 80) ──────────────────────────
PUBLIC_PORT=80
```

### Generating Secure Secrets

```powershell
# Generate a random JWT secret (PowerShell)
-join ((65..90)+(97..122)+(48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Or use Python
python -c "import secrets; print(secrets.token_urlsafe(48))"

# Or use OpenSSL (Git Bash / WSL)
openssl rand -base64 48
```

---

## 5. PostgreSQL — Passwords & Security

### Where Passwords Come From

The PostgreSQL password is set **exclusively** via the `.env` file:

```env
POSTGRES_PASSWORD=YourStr0ng!Passw0rd#2026
```

This value flows to two places:
1. **PostgreSQL container** → `POSTGRES_PASSWORD` env var → sets the `quiz` user password
2. **API container** → `DATABASE_URL` env var → `postgresql://quiz:<password>@postgresql:5432/quiz`

Both are injected by `docker-compose.prod.yml` from the same `.env` variable, so they always match.

### Changing the Password

1. Stop containers: `docker compose -f docker-compose.prod.yml down`
2. Edit `.env` → change `POSTGRES_PASSWORD`
3. **Important**: The postgres container only sets the password on **first** volume creation. To change it on an existing database:
   ```powershell
   # Start just the DB
   docker compose -f docker-compose.prod.yml up -d postgresql

   # Change the password inside PostgreSQL
   docker exec openmath-local-prod-db psql -U quiz -c "ALTER USER quiz PASSWORD 'NewStr0ng!Pass#2026';"

   # Update .env to match
   # POSTGRES_PASSWORD=NewStr0ng!Pass#2026

   # Restart everything
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d
   ```

### Password Strength Recommendations

| Level | Example | When to Use |
|-------|---------|-------------|
| **Development** | `quiz` | Local dev only, never in prod |
| **Basic** | `OpenMath2026!` | Home network, no internet exposure |
| **Strong** | `xK9#mPq$vR2&nL7!wT4` | LAN with multiple users |
| **Maximum** | 64-char random string | Internet-facing, production server |

### Default Credentials (out of the box)

| Field | Default Value | Where Set |
|-------|--------------|-----------|
| DB User | `quiz` | `POSTGRES_USER` in `.env` (default fallback) |
| DB Password | **NONE** — must be set in `.env` | `POSTGRES_PASSWORD` (required, no default) |
| DB Name | `quiz` | `POSTGRES_DB` in `.env` (default fallback) |
| JWT Secret | Dev fallback exists but **must be overridden** | `JWT_SECRET_KEY` in `.env` |

---

## 4. First-Time Setup

### Step 1: Create `.env` file

```powershell
# From repository root
Copy the "Minimal .env" section above into .env
notepad .env
```

### Step 2: Build the images

```powershell
# Using DevOps CLI
python dev.py prod-build

# Or manually
docker compose -f docker-compose.prod.yml build
```

### Step 3: Start the stack

```powershell
# Using DevOps CLI
python dev.py prod-local-up

# Or manually
docker compose -f docker-compose.prod.yml up -d
```

### Step 4: Apply database migrations

> **CRITICAL**: The `docker-entrypoint-initdb.d` scripts only run when the
> PostgreSQL data volume is **brand new** (empty). If you ever need to apply
> new migrations to an existing database, you **must** run them manually.

```powershell
# Using DevOps CLI (recommended)
python dev.py prod-db-migrate

# Or manually (one migration at a time)
docker exec openmath-local-prod-db psql -U quiz -d quiz -f /docker-entrypoint-initdb.d/0006_auth_rbac.sql
```

The DevOps CLI menu also has this under: **PROD → Database → Run Migrations**

### Step 5: Verify everything works

```powershell
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check API health
curl http://localhost/api/health
# Expected: {"status":"ok"}

# Open the website
start http://localhost
```

### Step 6: Register your first user

Open `http://localhost` in the browser and use the registration form. The first
registered user will be a `student`. To make them an admin, see the
[Promoting a User to Admin](#promoting-a-user-to-admin) section below.

---

## 6. Database Migrations

### How Migrations Work

- All SQL migrations live in `db/migrations/` (mounted into the container as `/docker-entrypoint-initdb.d/`)
- Files are named `0001_init.sql`, `0002_quiz_types.sql`, ... `0021_basic_fractions_quiz_type.sql`
- All migrations are **idempotent** — they use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, etc.
- Safe to run repeatedly; they skip anything already applied

### When to Run Migrations

| Scenario | Action |
|----------|--------|
| Fresh install (empty volume) | Automatic — PostgreSQL runs all scripts in `initdb.d` |
| Existing database after pulling new code | **Manual** — run `python dev.py prod-db-migrate` |
| After `docker compose down` + `up` (volume preserved) | No action needed — data persists |
| After `prod-local-reset` (volume deleted) | Automatic — new volume triggers `initdb.d` |

### Running Migrations

```powershell
# DevOps CLI (runs ALL migrations, skips already-applied ones)
python dev.py prod-db-migrate

# Or via the interactive menu
python dev.py menu  →  PROD  →  Database  →  Run Migrations
```

---

## 7. Connecting with pgAdmin 4

By default, PostgreSQL has **no port exposed to the host** for security. To connect
with pgAdmin 4, you have two options:

### Option A: Expose PostgreSQL Port (Simple)

Add a `ports` mapping to `docker-compose.prod.yml`:

```yaml
  postgresql:
    # ... existing config ...
    ports:
      - "5433:5432"   # Use 5433 to avoid conflicts with DEV on 5432
```

Then restart: `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

#### pgAdmin 4 Connection Settings (Localhost)

| Field | Value |
|-------|-------|
| **Host name/address** | `localhost` |
| **Port** | `5433` (or whatever you mapped) |
| **Maintenance database** | `quiz` |
| **Username** | `quiz` (or your `POSTGRES_USER`) |
| **Password** | Value from `POSTGRES_PASSWORD` in `.env` |

#### pgAdmin 4 Connection Settings (Remote / LAN)

| Field | Value |
|-------|-------|
| **Host name/address** | `192.168.1.xxx` (IP of the machine running Docker) |
| **Port** | `5433` |
| **Maintenance database** | `quiz` |
| **Username** | `quiz` |
| **Password** | Value from `POSTGRES_PASSWORD` in `.env` |

> **Note**: For LAN access, ensure Windows Firewall allows inbound TCP on port 5433.

### Option B: Use `docker exec` (No Port Exposure)

If you don't want to expose the port, you can always use the CLI:

```powershell
# Interactive psql session
docker exec -it openmath-local-prod-db psql -U quiz -d quiz

# Run a query
docker exec openmath-local-prod-db psql -U quiz -d quiz -c "SELECT * FROM users;"
```

### Option C: pgAdmin 4 via Docker Network

Run pgAdmin 4 as a Docker container on the same network:

```yaml
# Add to docker-compose.prod.yml (or a separate file)
  pgadmin:
    image: dpage/pgadmin4
    container_name: openmath-local-prod-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@openmath.local
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    networks:
      - openmath-local-prod-net
```

Then connect to `postgresql` (the Docker service name) on port `5432` from within pgAdmin.

| Field | Value |
|-------|-------|
| **Host name/address** | `postgresql` (Docker DNS) |
| **Port** | `5432` |
| **Username** | `quiz` |
| **Password** | from `.env` |

Access pgAdmin at: `http://localhost:5050`

---

## 8. Accessing the Website

### From Localhost (the machine running Docker)

| URL | What You Get |
|-----|-------------|
| `http://localhost` | Angular frontend (full app) |
| `http://localhost/` | Same as above |

The nginx container listens on port 80 (configurable via `PUBLIC_PORT` in `.env`).

If port 80 is taken (e.g., by IIS or another service):

```env
# In .env
PUBLIC_PORT=8080
```

Then access at `http://localhost:8080`.

### From a Remote Machine (Same Subnet / LAN)

Use the **IP address** of the machine running Docker Desktop:

```
http://192.168.1.xxx
```

> **Finding your IP**: Run `ipconfig` in PowerShell and look for the IPv4 address
> on your network adapter (usually under "Ethernet adapter" or "Wi-Fi").

Requirements for LAN access:
1. Windows Firewall must allow inbound TCP on port 80 (or your `PUBLIC_PORT`)
2. Both machines must be on the same subnet
3. Add the accessing machine's origin to `CORS_ORIGINS` if API calls fail:
   ```env
   CORS_ORIGINS=http://localhost,http://192.168.1.100,http://192.168.1.0/24
   ```

#### Windows Firewall Rule (PowerShell as Admin)

```powershell
New-NetFirewallRule -DisplayName "OpenMath Web" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

---

## 9. Accessing the API

The API is **not directly exposed** to the host. All API requests go through nginx:

| Endpoint | URL |
|----------|-----|
| Health check | `http://localhost/api/health` |
| Login | `POST http://localhost/api/auth/login` |
| Register | `POST http://localhost/api/auth/register` |
| All API routes | `http://localhost/api/*` |

### Testing the API

```powershell
# Health check
curl http://localhost/api/health

# Register (example)
curl -X POST http://localhost/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Admin User","email":"admin@openmath.local","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@openmath.local","password":"SecurePass123!"}'
```

### API Documentation

FastAPI auto-generates OpenAPI docs, but they're only available inside the Docker
network (port 8000 is not exposed). To access them temporarily:

```powershell
# Direct API access for docs
docker exec openmath-local-prod-api python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/docs').read().decode()[:200])"
```

Or add a port mapping temporarily:
```yaml
  python-api:
    ports:
      - "8000:8000"  # Temporary — remove after use
```

Then visit `http://localhost:8000/docs` for Swagger UI.

---

## 10. Remote / LAN Access

### Access Matrix

| Service | Localhost | LAN (same subnet) | Internet |
|---------|-----------|-------------------|----------|
| Website | `http://localhost` | `http://<host-ip>` | Requires port forwarding + domain |
| API | `http://localhost/api/*` | `http://<host-ip>/api/*` | Same as website (proxied) |
| PostgreSQL | Not exposed (or `:5433`) | `:5433` if port exposed + firewall rule | **Never expose directly** |
| pgAdmin 4 | `http://localhost:5050` | `http://<host-ip>:5050` + firewall rule | Not recommended |

### Finding Host IP

```powershell
# Windows
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*"}).IPAddress
```

### Firewall Rules for LAN Access

```powershell
# Run as Administrator
# Allow web access
New-NetFirewallRule -DisplayName "OpenMath Web (80)" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow pgAdmin (if running)
New-NetFirewallRule -DisplayName "OpenMath pgAdmin (5050)" -Direction Inbound -Protocol TCP -LocalPort 5050 -Action Allow

# Allow PostgreSQL direct access (only if needed)
New-NetFirewallRule -DisplayName "OpenMath PostgreSQL (5433)" -Direction Inbound -Protocol TCP -LocalPort 5433 -Action Allow
```

---

## 11. Container Management

### Using the DevOps CLI

```powershell
python dev.py menu        # Interactive menu → PROD section
python dev.py prod-local-up      # Start all containers
python dev.py prod-local-down    # Stop all containers
python dev.py prod-local-status  # Show status + logs
python dev.py prod-local-reset   # Stop + delete volumes + rebuild (DESTRUCTIVE)
```

### Using Docker Compose Directly

```powershell
# Start
docker compose -f docker-compose.prod.yml up -d

# Stop (preserves data)
docker compose -f docker-compose.prod.yml down

# Stop and DELETE all data
docker compose -f docker-compose.prod.yml down -v  # ⚠️ DESTROYS DATABASE

# Rebuild images
docker compose -f docker-compose.prod.yml build --no-cache

# View logs
docker compose -f docker-compose.prod.yml logs -f

# View logs for specific container
docker compose -f docker-compose.prod.yml logs -f python-api
```

### Container Reference

| Container Name | Image | Ports | Purpose |
|---------------|-------|-------|---------|
| `openmath-local-prod-db` | `postgres:16-alpine` | None (internal) | PostgreSQL database |
| `openmath-local-prod-api` | `openmath/python-api:latest` | None (internal) | FastAPI backend |
| `openmath-local-prod-frontend` | `openmath/angular-app:latest` | `80:80` | nginx + Angular |

### Volume & Network

| Resource | Name | Purpose |
|----------|------|---------|
| Volume | `openmath_openmath-local-prod-pgdata` | PostgreSQL data files |
| Network | `openmath_openmath-local-prod-net` | Inter-container communication |

> Volume/network names are prefixed with `openmath_` by Docker Compose (project name).

---

## 12. Database Backup & Restore

### Create a Backup

```powershell
python dev.py prod-db-backup
# Creates: backups/openmath_2026-03-10_143000.sql.gz
```

### Restore from Backup

```powershell
python dev.py prod-db-restore
# Interactive: shows list of backups, asks for confirmation
```

### List Backups

```powershell
python dev.py prod-db-list
```

### Manual Backup (without DevOps CLI)

```powershell
# Full dump (compressed)
docker exec openmath-local-prod-db pg_dump -U quiz -d quiz --clean --if-exists | gzip > backup.sql.gz

# Restore
Get-Content backup.sql.gz | gunzip | docker exec -i openmath-local-prod-db psql -U quiz -d quiz
```

---

## 13. Monitoring & Logs

### Docker Desktop

Open Docker Desktop → Containers → click on `openmath` stack to see all 3 containers.
Click on any container to view its logs, inspect environment, exec into shell, etc.

### CLI Log Commands

```powershell
# All containers
docker compose -f docker-compose.prod.yml logs -f --tail 100

# API only (most useful for debugging)
docker compose -f docker-compose.prod.yml logs -f python-api

# Database only
docker compose -f docker-compose.prod.yml logs -f postgresql

# Frontend/nginx only
docker compose -f docker-compose.prod.yml logs -f angular-app
```

### Health Checks

All 3 containers have built-in health checks:

| Container | Health Check | Interval |
|-----------|-------------|----------|
| `postgresql` | `pg_isready -U quiz` | 10s |
| `python-api` | `GET http://localhost:8000/api/health` | 30s |
| `angular-app` | `wget http://localhost:80/` | 30s |

```powershell
# Check health status
docker inspect --format='{{.State.Health.Status}}' openmath-local-prod-db
docker inspect --format='{{.State.Health.Status}}' openmath-local-prod-api
docker inspect --format='{{.State.Health.Status}}' openmath-local-prod-frontend
```

---

## 14. Troubleshooting

### "Registration failed" — No Error in API Logs

**Root Cause**: Database migrations not applied. The `docker-entrypoint-initdb.d`
scripts only run on **first ever** container start with an empty volume. If you
built the PROD stack before all migrations existed, the database is missing
tables like `users`, `roles`, `user_roles`.

**Fix**:
```powershell
python dev.py prod-db-migrate
docker restart openmath-local-prod-api
```

**Verify**:
```powershell
docker exec openmath-local-prod-db psql -U quiz -d quiz -c "\dt"
# Should show 14 tables including: users, roles, user_roles, badges, etc.
```

### API Container Keeps Restarting

Check logs:
```powershell
docker compose -f docker-compose.prod.yml logs python-api --tail 50
```

Common causes:
- Missing `JWT_SECRET_KEY` in `.env` → container fails at startup
- Missing `POSTGRES_PASSWORD` → can't connect to DB
- DB not ready → should self-heal via `depends_on: condition: service_healthy`

### "CORS Error" in Browser Console

Add the URL you're accessing from to `CORS_ORIGINS` in `.env`:
```env
CORS_ORIGINS=http://localhost,http://192.168.1.100
```
Then restart: `docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

### Port 80 Already in Use

```powershell
# Find what's using port 80
netstat -ano | findstr :80

# Option 1: Stop the conflicting service
# Option 2: Change the port in .env
PUBLIC_PORT=8080
```

### Database Connection Refused

```powershell
# Check if DB container is running and healthy
docker ps --filter name=openmath-local-prod-db
docker inspect --format='{{.State.Health.Status}}' openmath-local-prod-db

# Check DB logs
docker logs openmath-local-prod-db --tail 20
```

---

## 15. Security Hardening Checklist

### Minimum (Home Network)

- [x] Set a real `POSTGRES_PASSWORD` in `.env` (not `quiz`)
- [x] Set a real `JWT_SECRET_KEY` in `.env` (minimum 32 characters)
- [x] PostgreSQL port NOT exposed to host (default)
- [x] `.env` file is git-ignored

### Recommended (Multi-User LAN)

- [ ] Use 64+ character random `JWT_SECRET_KEY`
- [ ] Use 20+ character `POSTGRES_PASSWORD` with mixed case, numbers, symbols
- [ ] Set `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15` (shorter sessions)
- [ ] Restrict `CORS_ORIGINS` to exact URLs needed
- [ ] Windows Firewall: only allow ports you need
- [ ] Regular database backups (`python dev.py prod-db-backup`)

### Production (Internet-Facing)

- [ ] Run behind a reverse proxy (Traefik, Caddy, or cloud LB) with TLS/HTTPS
- [ ] Use a proper domain name with SSL certificate
- [ ] Set `CORS_ORIGINS` to your exact domain only
- [ ] Use Docker secrets instead of `.env` for passwords
- [ ] Enable PostgreSQL SSL (`ssl = on` in `postgresql.conf`)
- [ ] Set up automated backups (cron job)
- [ ] Monitor with OpenTelemetry (see `spec_v2.9_otel_monitoring.md`)
- [ ] Disable debug mode (already `DEBUG=false` in docker-compose.prod.yml)

---

## Appendix

### Promoting a User to Admin

After registering via the web UI, promote a user to admin via SQL:

```powershell
# Find the user
docker exec openmath-local-prod-db psql -U quiz -d quiz -c "SELECT id, name, email FROM users;"

# Add admin role (replace <user-id> with the UUID)
docker exec openmath-local-prod-db psql -U quiz -d quiz -c "
  INSERT INTO user_roles (user_id, role_id)
  SELECT '<user-id>', id FROM roles WHERE name = 'admin'
  ON CONFLICT DO NOTHING;
"

# Verify
docker exec openmath-local-prod-db psql -U quiz -d quiz -c "
  SELECT u.name, r.name AS role
  FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN roles r ON r.id = ur.role_id;
"
```

### Quick Reference Card

```
START           python dev.py prod-local-up
STOP            python dev.py prod-local-down
STATUS          python dev.py prod-local-status
REBUILD         python dev.py prod-build
MIGRATE DB      python dev.py prod-db-migrate
BACKUP DB       python dev.py prod-db-backup
RESTORE DB      python dev.py prod-db-restore
WEBSITE         http://localhost
API HEALTH      http://localhost/api/health
PSQL SHELL      docker exec -it openmath-local-prod-db psql -U quiz -d quiz
API LOGS        docker compose -f docker-compose.prod.yml logs -f python-api
MENU            python dev.py menu → PROD
```
