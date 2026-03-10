# OpenMath Specification — v2.8
## Production Dockerization (3-Container Deployment)

**Version:** 2.8  
**Status:** Implemented  
**Module:** Deployment / Infrastructure / Production Runtime  
**Implementation Summary:** [implementation_summary_v2.8_production_dockerization.md](implementation_summary_v2.8_production_dockerization.md)

---

# 1. Overview

This specification defines the first production-ready container deployment model for OpenMath.

The primary goal is to support **self-hosted Docker deployment on a Linux host**, while keeping the architecture compatible with managed container runtimes such as:

- Azure container services
- AWS container services
- GCP container services

The initial production setup uses **three containers**:

1. **postgresql** — persistent relational database
2. **python-api** — backend API service
3. **angular-app** — frontend application

This spec also introduces a **Python-based DevOps PROD menu** (replacing the originally proposed `prod.sh` bash script), integrated into the existing `dev.py` CLI framework with InquirerPy arrow-key navigation, to simplify production deployment on self-hosted Docker.

---

# 2. Goals

Primary objectives:

1. Support self-hosted production deployment with minimal setup
2. Standardize a 3-container architecture
3. Keep internal services isolated on a private container network
4. Expose only the public frontend endpoint to end users
5. Support portability to Azure, AWS, and GCP container runtimes
6. Provide a repeatable deployment workflow through the Python DevOps PROD menu (`python dev.py` → PROD)
7. Keep the setup simple enough for single-server hosting as the primary target

---

# 3. Scope

Included in this version:

- Dockerized PostgreSQL container
- Dockerized Python backend API container
- Dockerized Angular frontend container
- Shared Docker network for internal communication
- Volume-based persistence for PostgreSQL
- Linux production deployment helper ~~script~~ Python DevOps menu
- Public/private endpoint design
- nginx reverse proxy for API routing (frontend → backend)
- Mermaid deployment architecture diagram
- Baseline environment variable strategy
- Health check expectations
- Production-ready image build flow

Not included in this version:

- Kubernetes manifests
- multi-node orchestration
- auto-scaling
- external managed databases
- object storage
- CDN-specific configuration
- secrets manager integrations
- reverse proxy container beyond the 3-container baseline
- TLS termination details for advanced production edge setups

---

# 4. High-Level Deployment Model

OpenMath production runs as a 3-container stack on one Docker host.

### Containers

- **postgresql**  
  Stores application data with persistent disk-backed volume storage

- **python-api**  
  Exposes backend application endpoints and connects to PostgreSQL over the internal container network

- **angular-app**  
  Serves the frontend and communicates with the backend through configured API base URLs

### Hosting Priority

Primary target:

- **self-hosted Linux Docker server**

Secondary supported targets:

- Azure container runtime services
- AWS container runtime services
- GCP container runtime services

The architecture should remain portable by relying on:

- standard Dockerfiles
- environment variables
- container networking conventions
- stateless frontend/backend containers
- externalized database persistence

---

# 5. Architecture Diagram

```mermaid
flowchart TD
    U[User Browser]

    subgraph HOST[Docker Host / Self-Hosted Linux Server]
        subgraph NET[Internal Docker Network]
            FE[angular-app container\nPublic HTTP endpoint]
            API[python-api container\nInternal API service]
            DB[postgresql container\nInternal database service]
        end

        VOL[(Persistent Docker Volume\nPostgreSQL Data)]
    end

    U -->|HTTPS/HTTP :80 or :443| FE
    FE -->|Internal API calls\nhttp://python-api:8000| API
    API -->|PostgreSQL protocol :5432| DB
    DB --> VOL
```

---

# 6. Network and Endpoint Design

## 6.1 Public Endpoint

Only the frontend container is intended to be publicly reachable.

### Public access

- `angular-app` exposed on:
  - port `80` for HTTP
  - optional port `443` if TLS is terminated in-container or at host level

Example public URL:

```text
https://openmath.example.com
```

---

## 6.2 Internal Endpoints

Backend and database must remain private on the Docker network.

### Backend internal endpoint

```text
http://python-api:8000
```

This endpoint is reachable only by other containers attached to the same Docker network, especially the frontend container.

### Database internal endpoint

```text
postgresql:5432
```

This endpoint is reachable only by the backend container and must not be published to the public internet by default.

---

## 6.3 Exposure Rules

Required default rules:

- `angular-app` may publish host ports
- `python-api` should not publish host ports unless explicitly enabled for admin/debug
- `postgresql` must not publish host ports in standard production mode
- inter-container traffic must use Docker DNS names:
  - `python-api`
  - `postgresql`

---

# 7. Container Specifications

## 7.1 PostgreSQL Container

### Responsibilities

- store users
- store quiz data
- store session data
- store progress, badges, leaderboard data, and application metadata
- provide durable relational persistence

### Requirements

- based on official PostgreSQL image or approved derived image
- persistent volume required
- environment-based initialization supported
- health check required
- automatic restart policy enabled

### Required configuration

Environment variables:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Persistent volume example:

```text
openmath-local-prod-pgdata:/var/lib/postgresql/data
```

### Internal port

- `5432`

### Security requirements

- must not be exposed publicly by default
- strong password required
- data volume must survive container recreation

---

## 7.2 Python API Container

### Responsibilities

- expose backend REST API
- perform authentication/authorization
- process quiz sessions
- manage leaderboard, badges, certificate generation, and reporting
- communicate with PostgreSQL
- provide health endpoint

### Requirements

- containerized Python application image
- startup must run migrations or validate migration status
- health check endpoint required
- configurable environment variables
- automatic restart policy enabled

### Internal port

- `8000`

### Required environment variables

Examples:

- `APP_ENV=production`
- `DATABASE_URL=postgresql://user:password@postgresql:5432/openmath`
- `JWT_SECRET_KEY=...`
- `CORS_ORIGINS=...`
- `JWT_ALGORITHM=HS256`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30`
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS=7`
- `GOOGLE_CLIENT_ID=...` (optional)
- `GOOGLE_CLIENT_SECRET=...` (optional)
- `GOOGLE_REDIRECT_URI=...` (optional)

### Internal health endpoint

```text
GET /api/health
```

### Internal service URL

```text
http://python-api:8000
```

---

## 7.3 Angular Frontend Container

### Responsibilities

- serve compiled Angular application
- expose public UI
- route browser traffic to the SPA
- connect to backend API through configured API base URL

### Requirements

- multi-stage Docker build recommended
- static build served from lightweight web server
- automatic restart policy enabled
- frontend runtime config supported if needed

### Public port

- `80`

Optional:

- `443`

### Required configuration

Examples:

- `API_BASE_URL` (not required when nginx reverse proxy is used)
- runtime environment config for production
- host-specific frontend branding/domain config if required later

> **Implementation note:** The Angular frontend uses an nginx reverse proxy
> (`location /api/` → `http://python-api:8000/api/`) so `API_BASE_URL` is not
> needed at runtime.  All browser API calls are routed through the frontend
> container, providing stronger isolation than direct backend access.

### Public service URL

```text
http://<host>
```

or

```text
https://<domain>
```

---

# 8. Recommended Docker Network Layout

A dedicated bridge network must be created for the OpenMath stack.

Example:

```text
openmath-local-prod-net
```

All three containers must join this network.

Benefits:

- private DNS resolution between containers
- isolation from unrelated containers
- clear internal service naming
- easier migration to cloud container environments

---

# 9. Persistent Storage

Only PostgreSQL requires persistent storage in the initial 3-container design.

### Persistent volume

```text
openmath-local-prod-pgdata
```

Requirements:

- volume must persist across container restarts
- backups must be possible independently of container lifecycle
- host disk capacity monitoring is recommended
- the application must tolerate backend/frontend recreation without data loss

Future optional volumes may include:

- exported PDFs
- logs
- uploaded assets

Those are out of scope for the baseline 2.8 stack.

---

# 10. Image Build Strategy

## 10.1 Backend Image

The backend image should:

- install Python dependencies
- copy application source
- set production environment
- expose port `8000`
- define startup command

Recommended high-level Dockerfile flow:

```text
FROM python:<version>
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD [production startup command]
```

---

## 10.2 Frontend Image

The frontend should use a multi-stage build.

Recommended high-level flow:

```text
Stage 1: Build Angular app
Stage 2: Serve built files via lightweight web server
```

Example structure:

```text
FROM node:<version> AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/<app-name> /usr/share/nginx/html
EXPOSE 80
```

---

## 10.3 Database Image

Preferred baseline:

- official PostgreSQL image

No custom image is required unless initialization logic becomes more complex.

---

# 11. Python DevOps PROD Menu

## 11.1 Purpose

The originally proposed `prod.sh` bash script has been replaced by a **Python-based DevOps PROD menu** integrated into the existing `dev.py` CLI framework. This provides:

- Cross-platform support (Windows + Linux) instead of Linux-only bash
- InquirerPy arrow-key navigation instead of text input menus
- Consistent UX with the DEV menu
- Both interactive menu and CLI shortcut modes

The PROD menu is accessible via:

```text
python dev.py          → Main Menu → PROD
python dev.py prod-*   → Direct CLI shortcuts
```

---

## 11.2 Functional Requirements

The PROD menu supports the following actions:

1. Build backend image (`openmath/python-api:latest`)
2. Build frontend image (`openmath/angular-app:latest`)
3. Build all images
4. Pull PostgreSQL image (`postgres:16-alpine`)
5. Backup PostgreSQL database (pg_dump → gzip → `backups/`)
6. Restore PostgreSQL database from backup
7. List available database backups
8. Start local production stack
9. Stop local production stack
10. Show container status + recent logs
11. Reset local stack (stop + remove volumes + rebuild)
12. Configure remote host (SSH wizard)
13. Push images to remote host
14. Start remote containers
15. Stop remote containers
16. Show remote status

---

## 11.3 Menu Layout

```text
PROD — Production Deployment
Stack: Postgres + FastAPI + Angular/PrimeNG (Docker)

Select action:
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
──────────────────
  ← Back
```

---

## 11.4 CLI Shortcut Modes

All PROD actions are also available as non-interactive CLI modes:

```text
python dev.py prod-build          Build all production images
python dev.py prod-local-up       Start local prod containers
python dev.py prod-local-down     Stop local prod containers
python dev.py prod-local-status   Show local prod status
python dev.py prod-local-reset    Reset local prod (rebuild)
python dev.py prod-remote-setup   Configure remote host
python dev.py prod-remote-push    Push images to remote
python dev.py prod-remote-up      Start remote containers
python dev.py prod-remote-down    Stop remote containers
python dev.py prod-remote-status  Show remote status
python dev.py prod-db-backup      Backup PostgreSQL database
python dev.py prod-db-restore     Restore from backup file
python dev.py prod-db-list        List available backups
```

---

## 11.5 Implementation Files

```text
devops/prod/builds.py      Image build functions
devops/prod/local.py       Local Docker deployment
devops/prod/remote.py      Remote SSH deployment
devops/prod/database.py    Database backup & restore
devops/menus/prod_menu.py  Interactive PROD menu
devops/cli.py              CLI mode routing
```

---

# 12. Environment Configuration

Production configuration must be driven by environment variables or `.env` files.

## 12.1 Minimum variables

### Database

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

### Backend

- `DATABASE_URL`
- `CORS_ORIGINS`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `GOOGLE_REDIRECT_URI` (optional)
- `DEBUG=false`

### Frontend

- `PUBLIC_PORT` (default: 80)
- domain-specific runtime values if used

> **Note:** `API_BASE_URL` is not required because the nginx reverse proxy
> in the Angular container routes `/api/` requests to `python-api:8000`
> internally.

---

## 12.2 Secrets Handling

For baseline self-hosted Docker:

- secrets may initially be supplied through `.env`
- `.env` must not be committed to git
- example template such as `.env.example` should be committed

For future cloud runtimes:

- secrets should be externalizable to platform secret stores

---

# 13. Health Checks

All core services must expose or support health validation.

## 13.1 PostgreSQL

Health validation must confirm the database is accepting connections.

Example:

```text
pg_isready
```

## 13.2 Python API

The API must provide a lightweight health endpoint.

Example:

```text
GET /health
```

Expected response:

- HTTP 200 when healthy

## 13.3 Angular Frontend

The frontend container should respond to root path requests:

```text
GET /
```

Expected response:

- HTTP 200 when static app is being served

---

# 14. Restart Policy

Each container should use a restart policy appropriate for production single-host operation.

Recommended baseline:

```text
restart: unless-stopped
```

This applies to:

- postgresql
- python-api
- angular-app

---

# 15. Docker Compose Alignment

Although this spec is centered on Docker-hosted production deployment, the stack should be structurally compatible with a `docker-compose.yml` or equivalent orchestration file.

Expected services:

- `postgresql`
- `python-api`
- `angular-app`

Expected resources:

- `openmath-local-prod-net`
- `openmath-local-prod-pgdata`

This alignment improves portability to:

- Docker Compose on self-hosted Linux
- Azure container-based deployments
- AWS container-based deployments
- GCP container-based deployments

---

# 16. Public vs Internal Traffic Rules

## Public Traffic

Allowed:

- Browser → angular-app

Examples:

```text
User browser -> https://openmath.example.com
User browser -> http://server-ip
```

## Internal Traffic

Allowed:

- angular-app -> python-api
- python-api -> postgresql

Examples:

```text
angular-app -> http://python-api:8000
python-api -> postgresql:5432
```

## Not Allowed by Default

- Browser -> postgresql
- Browser -> python-api directly
- Internet -> postgresql
- Internet -> python-api unless explicitly enabled by operator choice

---

# 17. Cloud Portability Notes

This 3-container design should remain portable to managed container runtimes.

## Azure

Can map to:

- Azure Container Apps
- Azure App Service for Containers
- Azure Database for PostgreSQL as a future replacement

## AWS

Can map to:

- ECS / Fargate
- EC2 Docker hosts
- RDS PostgreSQL as a future replacement

## GCP

Can map to:

- Cloud Run for frontend/backend
- GCE Docker hosts
- Cloud SQL for PostgreSQL as a future replacement

Primary requirement:

- do not hardcode host IPs
- rely on env vars and service names
- keep the application stateless except for DB data

---

# 18. Logging and Operations

Baseline operational expectations:

- `prod.sh` can display logs per container
- backend logs go to stdout/stderr
- frontend server logs go to stdout/stderr
- postgres logs go to stdout/stderr
- host-level log collection may be added later

Recommended operational commands exposed via script:

- show running containers
- tail backend logs
- tail frontend logs
- tail postgres logs

---

# 19. Backup & Restore

Database backup is mandatory for production use.

The entire application stack is **stateless** — all user data lives exclusively
in PostgreSQL.  A single backup captures the complete application state;
restoring it fully recovers everything.

### Implementation (v3.2)

Backup and restore are implemented in `devops/prod/database.py` and accessible
from the PROD menu under "Database (Backup & Restore)":

- **Backup:** `docker exec` → `pg_dump --clean --if-exists` → gzip compressed → `backups/` directory
- **Restore:** Interactive file picker → safety confirmation → `psql` pipe from gzip
- **List:** Formatted table with filename, size, date

Backup files are stored at `{repo_root}/backups/openmath_{YYYY-MM-DD}_{HHMMSS}.sql.gz`.

CLI modes: `python dev.py prod-db-backup`, `prod-db-restore`, `prod-db-list`.

See [spec_v3.2_database_backup_restore.md](spec_v3.2_database_backup_restore.md) for full details.

---

# 20. Acceptance Criteria

This spec is considered implemented when all of the following are true:

1. OpenMath can be deployed on a Linux Docker host using exactly 3 containers
2. PostgreSQL persists data across container recreation
3. Backend connects to PostgreSQL over internal Docker networking
4. Frontend is publicly reachable from host port or domain
5. Backend and database are not publicly exposed by default
6. `prod.sh` supports build, deploy, stop, restart, logs, and status operations
7. Health checks are defined for DB, API, and frontend
8. Environment configuration is externalized through `.env`
9. The structure is portable to Azure, AWS, and GCP container runtimes
10. Architecture documentation includes clear public and internal endpoint definitions

---

# 21. Repository Files

Files added for production deployment:

```text
docker-compose.prod.yml          Production Docker Compose (repo root)
.env.example                     Environment variable template
python-api/Dockerfile            Backend container image
angular-app/Dockerfile           Frontend container image (multi-stage)
angular-app/nginx.conf           nginx config with SPA routing + API proxy
devops/prod/builds.py            Image build functions
devops/prod/local.py             Local Docker deployment
devops/prod/remote.py            Remote SSH deployment
devops/prod/database.py          Database backup & restore
devops/menus/prod_menu.py        Interactive PROD menu
backups/.gitkeep                 Backup storage directory
```

---

# 22. Future Enhancements

Potential next deployment improvements:

- reverse proxy container
- TLS automation
- separate admin API exposure controls
- object storage for generated PDFs
- external managed database option
- zero-downtime deployment strategy
- container image registry pipeline
- CI/CD automation for build and release
- multi-environment overlays
- observability stack integration

---

# 23. Summary

Version 2.8 establishes the first production deployment standard for OpenMath using a simple and portable 3-container architecture.

It prioritizes:

- self-hosted Linux Docker deployment
- strong internal network isolation (nginx reverse proxy for API routing)
- persistent PostgreSQL storage with backup & restore support
- reproducible deployment via the Python DevOps PROD menu
- full remote deployment workflow via SSH
- future portability to Azure, AWS, and GCP

This version is intentionally minimal and practical so the project can move from development-only workflows toward real production hosting.
