# OpenMath — DevOps Roadmap

**Status:** Partially implemented  
**Date:** 2026-03-14  
**Depends on:** Production Docker stack (live), Traefik gateway (planned), OTEL monitoring (planned)

---

## 1. Overview

This roadmap covers the DevOps lifecycle for OpenMath — from local development
tooling to CI/CD pipelines, container registry, deployment automation, and
infrastructure-as-code. It defines the path from today's manual `dev.py`
workflow to a fully automated, self-hosted pipeline.

### Current state

| Area | Current state | Gap |
|---|---|---|
| **Source control** | GitHub (repo + collaboration only) | No workflows / Actions |
| **Local dev tooling** | `dev.py` CLI — InquirerPy menus, quick-start, per-component init/build/start/stop | Feature-complete for dev ✅ |
| **Prod deployment** | `dev.py` PROD mode — build images, deploy local/remote via SSH | Manual trigger, no pipeline |
| **DB backup/restore** | `dev.py` PROD — pg_dump/pg_restore, gzip, `backups/` folder | Manual trigger, no scheduling |
| **Container images** | Built locally, `docker save` → `scp` → `docker load` on remote | No registry, large tar transfers |
| **Secrets** | `.env.prod` file (git-ignored) on workstation + remote | No encrypted store |
| **CI/CD pipelines** | None | No automated build/test/deploy |
| **IaC** | None | Docker Compose only, no infra provisioning |
| **Environments** | Prod only (remote Ubuntu) + local Docker Desktop test | No staging environment |

### dev.py CLI — current surface

The `devops/` Python package provides a structured CLI for the full stack:

```
DEV:                                PROD:
  dev-quick   Quick start all         prod-build        Build all images
  db-init     Init database           prod-local-up     Start local prod
  db-build    Build DB container      prod-local-down   Stop local prod
  db-start    Start PostgreSQL        prod-local-status Show status
  db-stop     Stop DB                 prod-local-reset  Reset (rebuild)
  db-migrate  Apply SQL migrations    prod-remote-setup Configure SSH
  db-status   Show DB status          prod-remote-push  SCP images to remote
  fastapi-*   init/start/stop/status  prod-remote-up    Start remote stack
  angular-*   init/start/stop/build   prod-remote-down  Stop remote stack
  nuxt-*      init/start/stop/build   prod-remote-status Show remote status
  dev-stop    Quick stop all          prod-db-backup    pg_dump → gzip
                                      prod-db-restore   Restore from backup
                                      prod-db-list      List backups
                                      prod-db-migrate   Apply migrations
```

---

## 2. Architecture — Current vs Target

### Current deployment flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Developer workstation (Windows 11)                                      │
│                                                                          │
│  git push ──► GitHub (repo only, no workflows)                           │
│                                                                          │
│  python dev.py prod-build                                                │
│       │                                                                  │
│       ▼                                                                  │
│  docker compose -f docker-compose.prod.yml build                         │
│       │                                                                  │
│       ▼                                                                  │
│  python dev.py prod-remote-push                                          │
│       │                                                                  │
│       ▼  docker save → scp → docker load                                 │
│  ┌────────────────────────────────────────┐                               │
│  │  Remote Ubuntu server (/opt/openmath)  │                               │
│  │  docker compose up -d                  │                               │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐  │                               │
│  │  │ angular  │ │ python   │ │ pg 16  │  │                               │
│  │  │ (nginx)  │ │ api      │ │        │  │                               │
│  │  └─────────┘ └──────────┘ └────────┘  │                               │
│  └────────────────────────────────────────┘                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Problems:** No CI/CD, no automated testing before deploy, large tar file
transfers, no rollback, secrets in plain-text files.

### Target deployment flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Developer workstation                                                     │
│  git push ──► GitHub / GitLab                                              │
└────────┬───────────────────────────────────────────────────────────────────┘
         │ webhook
┌────────▼───────────────────────────────────────────────────────────────────┐
│  GitLab CE (self-hosted) — CI/CD Pipeline                                  │
│                                                                            │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │  Lint    ├──►│  Test    ├──►│  Build   ├──►│  Push    ├──►│ Deploy  │ │
│  │ semgrep  │   │ pytest   │   │ docker   │   │ registry │   │ SSH +   │ │
│  │ trivy    │   │ jest     │   │ build    │   │ pull     │   │ compose │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └─────────┘ │
│                                                                            │
│  ┌─── Registry ──────────┐                                                 │
│  │ GitLab Container      │  images pulled by remote on deploy              │
│  │ Registry (built-in)   │                                                 │
│  └───────────────────────┘                                                 │
└────────────────────────────────────────────────────────────────────────────┘
         │ deploy (docker compose pull + up)
┌────────▼───────────────────────────────────────────────────────────────────┐
│  Remote Ubuntu Server                                                      │
│                                                                            │
│  ┌── Traefik ────┐   ┌── OpenMath Stack ───────────────────────┐           │
│  │ TLS + routing │──►│ angular-app │ python-api │ postgresql   │           │
│  └───────────────┘   └─────────────────────────────────────────┘           │
│                                                                            │
│  ┌── Vault ───────┐   ┌── OTEL Stack ───────────────────────┐              │
│  │ secrets inject │   │ Collector │ Prometheus │ Grafana     │              │
│  └────────────────┘   └─────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CI/CD — GitLab CE (Self-Hosted)

### 3.1 Why GitLab CE

| Criterion | GitLab CE | GitHub Actions | Gitea + Drone | Jenkins |
|---|---|---|---|---|
| Fully self-hosted | ✅ | ❌ cloud-only runners | ✅ | ✅ |
| Built-in container registry | ✅ | ❌ need GHCR (cloud) | ❌ separate | ❌ separate |
| CI/CD + repo in one | ✅ | ✅ (cloud) | 2 tools | separate |
| YAML pipeline syntax | ✅ `.gitlab-ci.yml` | ✅ | ✅ | Groovy / YAML |
| Resource footprint | ~2 GB RAM | N/A | ~300 MB | ~1 GB |
| Community/docs | Excellent | Excellent | Good | Excellent |
| Home-lab fit | **Best** | N/A (not self-hosted) | Good | Heavy |

**Decision:** GitLab CE provides CI/CD pipelines, container registry, and code
hosting in a single self-hosted package. GitHub remains the public mirror / collaboration repo.

### 3.2 GitLab deployment

```yaml
# /opt/gitlab/docker-compose.yml
services:
  gitlab:
    image: gitlab/gitlab-ce:latest
    container_name: gitlab
    hostname: git.openmath.hu     # or git.homelab.local
    restart: unless-stopped
    ports:
      - "8929:80"                 # HTTP (behind Traefik for HTTPS)
      - "2222:22"                 # SSH for git clone
    volumes:
      - gitlab-config:/etc/gitlab
      - gitlab-logs:/var/log/gitlab
      - gitlab-data:/var/opt/gitlab
    environment:
      GITLAB_OMNIBUS_CONFIG: |
        external_url 'https://git.openmath.hu'
        nginx['listen_port'] = 80
        nginx['listen_https'] = false
        gitlab_rails['initial_root_password'] = 'ChangeMeOnFirstLogin!'
        # Built-in container registry
        registry_external_url 'https://registry.openmath.hu'
        registry['enable'] = true
        registry_nginx['listen_port'] = 5050
        registry_nginx['listen_https'] = false
        # Resource tuning for home lab
        puma['workers'] = 2
        sidekiq['concurrency'] = 5
        postgresql['shared_buffers'] = '256MB'
        prometheus_monitoring['enable'] = false

volumes:
  gitlab-config:
  gitlab-logs:
  gitlab-data:
```

### 3.3 GitLab Runner (executes CI jobs)

```bash
# On Docker host
docker run -d \
  --name gitlab-runner \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v gitlab-runner-config:/etc/gitlab-runner \
  gitlab/gitlab-runner:latest

# Register runner
docker exec -it gitlab-runner gitlab-runner register \
  --url https://git.openmath.hu \
  --token $REGISTRATION_TOKEN \
  --executor docker \
  --docker-image python:3.12-slim \
  --description "openmath-runner"
```

### 3.4 Traefik labels for GitLab

```yaml
# Add to GitLab container labels (routed through Traefik)
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.gitlab.rule=Host(`git.openmath.hu`)"
  - "traefik.http.routers.gitlab.tls.certresolver=letsencrypt"
  - "traefik.http.services.gitlab.loadbalancer.server.port=80"
  # Container Registry
  - "traefik.http.routers.registry.rule=Host(`registry.openmath.hu`)"
  - "traefik.http.routers.registry.tls.certresolver=letsencrypt"
  - "traefik.http.services.registry.loadbalancer.server.port=5050"
```

---

## 4. CI/CD Pipeline (`.gitlab-ci.yml`)

```yaml
# .gitlab-ci.yml
stages:
  - lint
  - test
  - build
  - deploy

variables:
  REGISTRY: registry.openmath.hu
  IMAGE_API: $REGISTRY/openmath/python-api
  IMAGE_FRONTEND: $REGISTRY/openmath/angular-app
  POSTGRES_USER: quiz
  POSTGRES_PASSWORD: testpass
  POSTGRES_DB: quiz_test

# ── Stage 1: Lint & Security Scan ────────────────────────────

semgrep:
  stage: lint
  image: returntocorp/semgrep
  script:
    - semgrep scan --config auto --error python-api/
  allow_failure: false

trivy-deps:
  stage: lint
  image: aquasec/trivy
  script:
    - trivy fs --severity HIGH,CRITICAL --exit-code 1 python-api/requirements.txt
    - trivy fs --severity HIGH,CRITICAL --exit-code 1 angular-app/package.json

# ── Stage 2: Test ────────────────────────────────────────────

pytest:
  stage: test
  image: python:3.12-slim
  services:
    - postgres:16-alpine
  variables:
    DATABASE_URL: postgresql://quiz:testpass@postgres:5432/quiz_test
  before_script:
    - pip install -r python-api/requirements.txt -r python-api/requirements-dev.txt
  script:
    - cd python-api && pytest --cov=app --cov-report=xml -v
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: python-api/coverage.xml

jest:
  stage: test
  image: node:22-alpine
  before_script:
    - corepack enable
    - cd angular-app && pnpm install --frozen-lockfile
  script:
    - pnpm test -- --ci --coverage

# ── Stage 3: Build & Push Images ─────────────────────────────

build-api:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $REGISTRY
    - docker build -t $IMAGE_API:$CI_COMMIT_SHORT_SHA -t $IMAGE_API:latest python-api/
    - docker push $IMAGE_API:$CI_COMMIT_SHORT_SHA
    - docker push $IMAGE_API:latest
  only:
    - main

build-frontend:
  stage: build
  image: docker:27
  services:
    - docker:27-dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $REGISTRY
    - docker build -t $IMAGE_FRONTEND:$CI_COMMIT_SHORT_SHA -t $IMAGE_FRONTEND:latest angular-app/
    - docker push $IMAGE_FRONTEND:$CI_COMMIT_SHORT_SHA
    - docker push $IMAGE_FRONTEND:latest
  only:
    - main

# ── Stage 4: Deploy ──────────────────────────────────────────

deploy-prod:
  stage: deploy
  image: alpine
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$SSH_KNOWN_HOSTS" >> ~/.ssh/known_hosts
  script:
    - |
      ssh deploy@$PROD_HOST "
        cd /opt/openmath
        # Pull latest images from registry
        docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $REGISTRY
        docker compose -f docker-compose.prod.yml pull
        # Rolling restart (zero-downtime for stateless containers)
        docker compose -f docker-compose.prod.yml up -d --remove-orphans
        # Verify health
        sleep 10
        docker compose -f docker-compose.prod.yml ps
        curl -sf http://localhost/api/health || exit 1
      "
  only:
    - main
  when: manual    # manual gate until confidence is high
  environment:
    name: production
    url: https://openmath.hu
```

---

## 5. Container Registry Strategy

### Current: `docker save` → `scp` → `docker load`

```
Workstation                     Remote
  docker save ──► .tar (1.2GB) ──► scp ──► docker load
  ~3 min build    ~5 min transfer    ~2 min load = ~10 min total
```

### Target: GitLab Container Registry

```
CI Runner                      Registry              Remote
  docker build ──► docker push ──► registry.openmath.hu ──► docker pull
  ~3 min build    ~1 min push      stored               ~1 min pull
```

**Benefits:**
- Only changed layers transferred (not full tar)
- Image versioning (`$CI_COMMIT_SHORT_SHA` tags)
- Rollback by pulling a previous tag
- No large file transfers via SCP

### `docker-compose.prod.yml` update for registry

```yaml
services:
  python-api:
    image: registry.openmath.hu/openmath/python-api:latest    # was: openmath/python-api:latest
    # remove: build: section (images come from registry now)

  angular-app:
    image: registry.openmath.hu/openmath/angular-app:latest   # was: openmath/angular-app:latest
```

---

## 6. Deployment Strategies

### 6.1 Current: Stop → Rebuild → Start (downtime)

```bash
# dev.py prod-remote-push does this:
docker save → scp → docker load → docker compose up -d
# Downtime: 5-10 minutes during transfer + restart
```

### 6.2 Target: Registry pull + rolling restart (near-zero downtime)

```bash
# On remote server (triggered by CI/CD)
docker compose pull                    # pull new images (seconds)
docker compose up -d --remove-orphans  # restart changed containers
# Downtime: ~5 seconds (container restart only)
```

### 6.3 Rollback

```bash
# If latest deploy is broken, roll back to previous version
docker compose stop python-api
docker pull registry.openmath.hu/openmath/python-api:abc1234   # previous known-good commit
docker tag registry.openmath.hu/openmath/python-api:abc1234 \
           registry.openmath.hu/openmath/python-api:latest
docker compose up -d python-api
```

### 6.4 Blue-green deployment (future)

Not needed now — single-server Docker Compose. If scale requires it,
run two parallel stacks and swap Traefik routing labels.

---

## 7. Database Migration Strategy

### Current flow (manual)

```bash
python dev.py prod-db-migrate
# → runs inside container: psql -f each migration .sql file
```

### CI/CD-integrated flow

```yaml
# In deploy-prod job, before restarting containers:
- |
  ssh deploy@$PROD_HOST "
    cd /opt/openmath
    # Backup before migration
    docker exec openmath-local-prod-db pg_dump -U quiz quiz | gzip > backups/pre-deploy-$(date +%Y%m%d).sql.gz
    # Apply new migrations
    for f in db/migrations/*.sql; do
      docker exec -i openmath-local-prod-db psql -U quiz -d quiz < \$f 2>&1 || true
    done
  "
```

**Key principle:** Always backup before migration. The `dev.py prod-db-backup`
command already handles this — the CI job automates the same flow.

---

## 8. Secrets Management

### Current: `.env.prod` files

```
# .env.prod (on workstation + remote)
POSTGRES_PASSWORD=...
JWT_SECRET_KEY=...
GOOGLE_CLIENT_SECRET=...
```

**Risks:** Plain text, no rotation, manually synced between workstation and remote.

### Phase 1: GitLab CI/CD Variables (quick win)

Store secrets as CI/CD variables (masked + protected) in GitLab:

| Variable | Type | Protected | Masked |
|---|---|---|---|
| `POSTGRES_PASSWORD` | Variable | ✅ | ✅ |
| `JWT_SECRET_KEY` | Variable | ✅ | ✅ |
| `GOOGLE_CLIENT_SECRET` | Variable | ✅ | ✅ |
| `SSH_PRIVATE_KEY` | File | ✅ | ❌ |
| `SSH_KNOWN_HOSTS` | Variable | ✅ | ❌ |

CI jobs use them via `$VARIABLE_NAME` — never committed to git.

### Phase 2: HashiCorp Vault (see security roadmap)

Full integration with encrypted storage, automatic rotation, audit logging.

---

## 9. Backup Automation

### Current: Manual `dev.py prod-db-backup`

```bash
python dev.py prod-db-backup
# → pg_dump | gzip → backups/openmath_prod_20260313_143022.sql.gz
```

### Target: Scheduled cron + GitLab CI schedule

```bash
# On remote server — /etc/cron.d/openmath-backup
0 2 * * * deploy docker exec openmath-local-prod-db pg_dump -U quiz quiz | gzip > /opt/openmath/backups/nightly_$(date +\%Y\%m\%d).sql.gz 2>&1 | logger -t openmath-backup
```

Or as a GitLab CI scheduled pipeline:

```yaml
backup-nightly:
  stage: deploy
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - |
      ssh deploy@$PROD_HOST "
        docker exec openmath-local-prod-db pg_dump -U quiz quiz | gzip > /opt/openmath/backups/nightly_$(date +%Y%m%d).sql.gz
        # Keep last 30 days only
        find /opt/openmath/backups -name 'nightly_*.sql.gz' -mtime +30 -delete
        echo 'Backup complete. Remaining:'
        ls -lh /opt/openmath/backups/nightly_*.sql.gz | tail -5
      "
```

---

## 10. Environment Management

### Current: 2 environments

| Environment | Where | Purpose |
|---|---|---|
| **Dev** | Windows 11 workstation | Local development (`dev.py dev-quick`) |
| **Prod** | Remote Ubuntu server | Public `openmath.hu` |

### Target: 3 environments

| Environment | Where | Compose file | Domain |
|---|---|---|---|
| **Dev** | Windows 11 workstation | `docker-compose.yml` | `localhost` |
| **Staging** | Remote Ubuntu server | `docker-compose.staging.yml` | `staging.openmath.hu` |
| **Prod** | Remote Ubuntu server | `docker-compose.prod.yml` | `openmath.hu` |

Staging uses the same server, different Docker project + port + Traefik
routing — separate from prod to test deployments before going live.

```yaml
# docker-compose.staging.yml — key differences from prod
services:
  postgresql:
    container_name: openmath-staging-db
    volumes:
      - openmath-staging-pgdata:/var/lib/postgresql/data

  python-api:
    image: registry.openmath.hu/openmath/python-api:$CI_COMMIT_SHORT_SHA   # specific commit, not :latest
    container_name: openmath-staging-api
    labels:
      - "traefik.http.routers.staging-api.rule=Host(`staging.openmath.hu`) && PathPrefix(`/api`)"

  angular-app:
    image: registry.openmath.hu/openmath/angular-app:$CI_COMMIT_SHORT_SHA
    container_name: openmath-staging-frontend
    labels:
      - "traefik.http.routers.staging.rule=Host(`staging.openmath.hu`)"
```

---

## 11. dev.py Integration Path

The `dev.py` CLI **remains the primary developer tool** for local work.
CI/CD automates what `dev.py` PROD commands do manually:

| dev.py command | CI/CD equivalent | Phase |
|---|---|---|
| `prod-build` | `docker build` in GitLab runner | Phase 2 |
| `prod-remote-push` | `docker push` to registry | Phase 2 |
| `prod-remote-up` | `docker compose pull && up` via SSH | Phase 2 |
| `prod-db-backup` | Scheduled CI pipeline / cron | Phase 3 |
| `prod-db-migrate` | Pre-deploy step in CI | Phase 3 |
| (none) | Semgrep + Trivy lint | Phase 1 |
| (none) | pytest + Jest test | Phase 1 |

`dev.py` PROD commands remain available as **manual overrides** — useful for
debugging, emergency deploys, and running against local Docker Desktop.

---

## 12. Monitoring & Alerting Integration

CI/CD events should feed into the OTEL monitoring stack (see observability roadmap):

| Event | Where to send | Alert |
|---|---|---|
| Pipeline failed | Grafana annotation + notification | Yes — email/Telegram |
| Deploy succeeded | Grafana annotation | No |
| Image scan found CVE | GitLab issue + Grafana | Yes |
| Nightly backup completed | Loki log | No (alert on failure only) |
| Health check failed post-deploy | Prometheus alert | Yes |

---

## 13. Implementation Phases

| Phase | What | Effort | Priority |
|---|---|---|---|
| **Phase 1** | Deploy GitLab CE + Runner on Docker host | 1 day | High |
| **Phase 2** | Create `.gitlab-ci.yml` — lint + test stages | 1 day | High |
| **Phase 3** | Add build + push stages (container registry) | 0.5 day | High |
| **Phase 4** | Add deploy stage (SSH + compose pull) | 0.5 day | High |
| **Phase 5** | Migrate secrets from `.env.prod` to GitLab CI vars | 0.5 day | High |
| **Phase 6** | Set up staging environment (`staging.openmath.hu`) | 1 day | Medium |
| **Phase 7** | Automated nightly DB backup (cron or CI schedule) | 0.5 day | Medium |
| **Phase 8** | Add Traefik labels for GitLab + Registry | 0.5 day | Medium |
| **Phase 9** | GitHub → GitLab mirror (bidirectional sync) | 0.5 day | Low |
| **Phase 10** | Grafana annotations for CI/CD events | 0.5 day | Low |
| **Phase 11** | Blue-green or canary deployment (future) | 1 day | Low |

---

## 14. Tool Summary

| Tool | Purpose | Self-hosted |
|---|---|---|
| **GitLab CE** | CI/CD + code hosting + container registry | ✅ |
| **GitLab Runner** | Executes CI jobs in Docker containers | ✅ |
| **Docker Compose** | Application stack orchestration | ✅ |
| **Traefik v3** | Reverse proxy, TLS, routing to GitLab + apps | ✅ |
| **dev.py** | Local dev CLI + manual prod overrides | ✅ (local) |
| **Semgrep** | SAST in CI pipeline | ✅ (container) |
| **Trivy** | Image + dependency scanning in CI | ✅ (container) |
| **pytest / Jest** | Unit + integration tests in CI | ✅ (container) |
| **HashiCorp Vault** | Secrets management (Phase 2 — see security roadmap) | ✅ |

---

## 15. Cross-Roadmap Dependencies

| This roadmap | Depends on | Direction |
|---|---|---|
| CI/CD test stages | **Automated testing roadmap** | Tests must exist for CI to run them |
| Traefik labels for GitLab | **Application gateway roadmap** | Traefik must be running |
| CI secrets → Vault | **Security roadmap** | Vault deployed first |
| CI/CD events → Grafana | **Observability roadmap** | OTEL stack must be running |
| Backup automation | **DB backup spec (v3.2)** | Builds on existing `dev.py` backup logic |
| Registry images | **Production dockerization (v2.8)** | Dockerfiles must exist |

