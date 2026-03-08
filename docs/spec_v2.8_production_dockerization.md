# OpenMath Specification — v2.8
## Production Dockerization (3-Container Deployment)

**Version:** 2.8  
**Status:** Draft Specification  
**Module:** Deployment / Infrastructure / Production Runtime

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

This spec also introduces a Linux deployment helper script named **`prod.sh`**, modeled after the existing `dev.ps1` menu approach, to simplify local production deployment on self-hosted Docker.

---

# 2. Goals

Primary objectives:

1. Support self-hosted production deployment with minimal setup
2. Standardize a 3-container architecture
3. Keep internal services isolated on a private container network
4. Expose only the public frontend endpoint to end users
5. Support portability to Azure, AWS, and GCP container runtimes
6. Provide a repeatable Linux deployment workflow through `prod.sh`
7. Keep the setup simple enough for single-server hosting as the primary target

---

# 3. Scope

Included in this version:

- Dockerized PostgreSQL container
- Dockerized Python backend API container
- Dockerized Angular frontend container
- Shared Docker network for internal communication
- Volume-based persistence for PostgreSQL
- Linux production deployment helper script
- Public/private endpoint design
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
openmath_postgres_data:/var/lib/postgresql/data
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
- `SECRET_KEY=...`
- `ALLOWED_HOSTS=...`
- `CORS_ALLOWED_ORIGINS=...`

### Internal health endpoint

```text
GET /health
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

- `API_BASE_URL`
- runtime environment config for production
- host-specific frontend branding/domain config if required later

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
openmath_net
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
openmath_postgres_data
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

# 11. prod.sh Linux Deployment Script

## 11.1 Purpose

Introduce a new script named **`prod.sh`** with a menu-driven experience similar in spirit to `dev.ps1`, but intended for Linux-hosted production deployment.

This script is primarily for:

- self-hosted Docker server setup
- image build
- local production stack deployment
- service restarts
- logs and status checks
- controlled shutdown

---

## 11.2 Functional Requirements

`prod.sh` must support at minimum the following actions:

1. Build backend image
2. Build frontend image
3. Build all images
4. Start or deploy production stack
5. Stop production stack
6. Restart production stack
7. Show container status
8. Show logs
9. Run database migration command
10. Remove and recreate stack without deleting DB volume
11. Optional full cleanup including containers, network, and non-persistent assets

---

## 11.3 Suggested Menu

Example interactive menu:

```text
OpenMath Production Menu
------------------------
1) Build backend image
2) Build frontend image
3) Build all images
4) Deploy production stack
5) Stop production stack
6) Restart production stack
7) Show status
8) Show logs
9) Run DB migrations
10) Recreate stack
11) Full cleanup
0) Exit
```

---

## 11.4 Script Requirements

`prod.sh` must:

- run on Linux host
- use `bash`
- validate Docker is installed
- validate Docker daemon is running
- validate required `.env` file exists
- create Docker network if missing
- create volume if missing
- build images in deterministic order
- deploy containers in dependency order:
  1. PostgreSQL
  2. Python API
  3. Angular frontend
- fail fast on missing dependencies
- print readable status messages
- support non-interactive future extension if needed

---

## 11.5 Example Deployment Order

```text
Check prerequisites
    ↓
Load .env
    ↓
Create network if missing
    ↓
Create postgres volume if missing
    ↓
Build python-api image
    ↓
Build angular-app image
    ↓
Start postgresql container
    ↓
Wait for DB health
    ↓
Start python-api container
    ↓
Wait for API health
    ↓
Start angular-app container
    ↓
Show success summary
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

- `APP_ENV=production`
- `DATABASE_URL`
- `SECRET_KEY`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`

### Frontend

- `API_BASE_URL`
- `FRONTEND_PORT` if configurable
- domain-specific runtime values if used

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

- `openmath_net`
- `openmath_postgres_data`

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

# 19. Backup Expectations

Database backup is mandatory for production use.

Baseline recommendation:

- periodic PostgreSQL dump from host or container
- backup persistent volume or logical dumps
- verify restore procedure regularly

Out of scope for this version:

- automated backup scheduler implementation
- cloud backup integrations

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

# 21. Suggested Repository Additions

Suggested files to add:

```text
deploy/prod.sh
deploy/.env.example
deploy/docker-compose.prod.yml
backend/Dockerfile
frontend/Dockerfile
```

Optional documentation additions:

```text
docs/specs/v2.8-production-dockerization.md
docs/deployment/self-hosted-docker.md
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
- strong internal network isolation
- persistent PostgreSQL storage
- reproducible deployment via `prod.sh`
- future portability to Azure, AWS, and GCP

This version is intentionally minimal and practical so the project can move from development-only workflows toward real production hosting.
