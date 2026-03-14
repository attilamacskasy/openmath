# OpenMath — Security Roadmap

**Status:** Planned  
**Date:** 2026-03-14  
**Depends on:** Production Docker stack (live), Traefik gateway (planned), OTEL monitoring (planned), Wazuh (deployed)

---

## 1. Overview

This roadmap covers security hardening for OpenMath across six layers:
code scanning, application hardening, secrets management (HashiCorp Vault),
container & infrastructure security, security monitoring (Wazuh + OTEL
integration), and incident response.

### Current security posture

| Area | Current state | Gap |
|---|---|---|
| **Authentication** | JWT + Google SSO + bcrypt password hashing | No token revocation list, no rate limiting |
| **Authorization** | RBAC (admin/student/teacher/parent via `user_roles`) | No row-level security on DB |
| **Secrets** | `.env` file (git-ignored), plain-text env vars in Compose | No encrypted store, no rotation |
| **TLS** | None (port 80 only) | Traefik with Let's Encrypt planned |
| **Code scanning** | None | No SAST, DAST, or dependency scanning |
| **Container security** | Minimal (alpine images) | No image scanning, no read-only rootfs |
| **SIEM** | Wazuh deployed on home lab | Not connected to OpenMath app logs yet |
| **Network** | MikroTik router, Docker bridge networks | No firewall rules between containers |

---

## 2. Architecture — Security Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          DEVELOPER WORKSTATION                            │
│  Git hooks → Semgrep (SAST) + Trivy (dependency scan) + pre-commit       │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ git push
┌──────────────────────────────────▼────────────────────────────────────────┐
│                        CI/CD PIPELINE (GitHub Actions)                     │
│  Semgrep → Trivy image scan → OWASP ZAP (DAST) → build → deploy          │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ deploy
┌──────────────────────────────────▼────────────────────────────────────────┐
│                          DOCKER HOST (Runtime)                            │
│                                                                           │
│  ┌── Traefik ─────────┐    ┌── Vault ──────────────────────┐              │
│  │ TLS termination     │    │ JWT_SECRET_KEY                │              │
│  │ HTTP→HTTPS redirect │    │ POSTGRES_PASSWORD             │              │
│  │ rate limiting       │    │ GOOGLE_CLIENT_SECRET          │              │
│  └────────┬────────────┘    │ POSTGRES SSL cert             │              │
│           │                 └──────────┬───────────────────┘              │
│           ▼                            │ inject at startup                │
│  ┌── angular-app ──────┐  ┌── python-api ──────┐  ┌── postgresql ──┐     │
│  │ nginx (read-only)   │  │ FastAPI + asyncpg   │  │ postgres:16    │     │
│  │ CSP headers         │  │ rate-limit middleware│  │ SSL enabled    │     │
│  │ SPA + /api proxy    │  │ OTEL security events│  │ pgAudit logs   │     │
│  └─────────────────────┘  └─────────────────────┘  └────────────────┘     │
│                                                                           │
│  ┌── Wazuh Agent ──────────────────────────────────────────┐              │
│  │ Host IDS + Docker log ingestion + file integrity mon.   │              │
│  └──────────────────────────┬──────────────────────────────┘              │
│                              │ events                                     │
│  ┌── Wazuh Manager ─────────▼──────────────────────────────┐              │
│  │ SIEM correlation + alerts + compliance dashboards        │              │
│  └──────────────────────────┬──────────────────────────────┘              │
│                              │ metrics/logs                               │
│  ┌── OTEL Collector → Prometheus + Loki → Grafana ─────────┐              │
│  │ Security dashboards: failed logins, rate-limit hits, etc.│              │
│  └──────────────────────────────────────────────────────────┘              │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Code Scanning (Shift-Left Security)

### 3.1 Static Analysis (SAST) — Semgrep

Scan Python and TypeScript source for security anti-patterns.

```bash
# Install
pip install semgrep

# Run against backend
semgrep --config auto python-api/

# Run against frontend
semgrep --config auto angular-app/src/
```

**OpenMath-specific rules to enforce:**

| Rule | Target | Why |
|---|---|---|
| `python.lang.security.audit.exec` | python-api | No `eval()` / `exec()` |
| `python.django.security.audit.raw-query` | python-api | No raw SQL concatenation (use parameterized via asyncpg) |
| `python.jose.jwt.unverified-decode` | python-api | Always verify JWT signature |
| `typescript.angular.security.audit.innerhtml` | angular-app | No unsafe `innerHTML` bindings |
| `generic.secrets.security.detected-generic-api-key` | all | No hardcoded secrets |

### 3.2 Dependency Scanning — Trivy

Scan Python packages and npm packages for known CVEs.

```bash
# Install
brew install trivy   # or docker pull aquasec/trivy

# Scan Python dependencies
trivy fs --scanners vuln python-api/requirements.txt

# Scan Angular dependencies
trivy fs --scanners vuln angular-app/package.json

# Scan built Docker images
trivy image openmath/python-api:latest
trivy image openmath/angular-app:latest
```

**Current dependency risk surface:**

| Package | Role | Risk area |
|---|---|---|
| `python-jose[cryptography]` | JWT handling | Crypto vulnerabilities |
| `bcrypt` | Password hashing | Algorithm weaknesses |
| `asyncpg` | DB driver | SQL injection if misused |
| `httpx` | Google SSO HTTP calls | SSRF if URLs not validated |
| `reportlab` | PDF generation | File handling exploits |
| `@angular/*` | Frontend framework | XSS in template injection |
| `primeng` | UI components | DOM-based XSS |

### 3.3 Dynamic Application Testing (DAST) — OWASP ZAP

Run against the deployed application to find runtime vulnerabilities.

```bash
# Baseline scan against running instance
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://openmath.hu \
  -r zap-report.html
```

### 3.4 Pre-commit hook integration

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/semgrep/semgrep
    rev: v1.50.0
    hooks:
      - id: semgrep
        args: ['--config', 'auto', '--error']

  - repo: local
    hooks:
      - id: trivy-python
        name: Trivy Python deps
        entry: trivy fs --scanners vuln --exit-code 1 python-api/requirements.txt
        language: system
        pass_filenames: false
```

### 3.5 GitHub Actions CI pipeline

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push, pull_request]
jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: semgrep/semgrep-action@v1
        with:
          config: auto

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: HIGH,CRITICAL

  image-scan:
    runs-on: ubuntu-latest
    needs: [sast]
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.prod.yml build
      - name: Scan API image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: openmath/python-api:latest
          severity: HIGH,CRITICAL
      - name: Scan frontend image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: openmath/angular-app:latest
          severity: HIGH,CRITICAL
```

---

## 4. Application Hardening

### 4.1 FastAPI backend hardening

| Hardening measure | How | Status |
|---|---|---|
| **Rate limiting** | Add `slowapi` middleware: 30 req/min per IP on `/api/auth/*`, 100/min on other endpoints | To do |
| **Request size limit** | `uvicorn --limit-max-header-size 8192` + body limit in FastAPI | To do |
| **CORS strictness** | `CORS_ORIGINS=https://openmath.hu` (exact match, no wildcards) | Partial |
| **Security headers** | Add via middleware: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` | To do |
| **JWT hardening** | Short access tokens (15 min), refresh rotation, token revocation list in Redis or DB | To do |
| **SQL injection prevention** | Already parameterized via asyncpg `$1` placeholders — verify no f-string queries | Verify |
| **Input validation** | Pydantic schemas on all endpoints — already in place | Done |
| **Error detail hiding** | Return generic 500 messages in production, log details to OTEL only | To do |
| **Password policy** | Enforce minimum 8 chars, mixed complexity in `RegisterRequest` schema | To do |

#### Rate limiting implementation

```python
# python-api/app/middleware/rate_limit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# In main.py
app.state.limiter = limiter
app.add_exception_handler(429, _rate_limit_exceeded_handler)

# On auth routes
@router.post("/register")
@limiter.limit("5/minute")
async def register(request: Request, ...): ...

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, ...): ...
```

#### Security headers middleware

```python
# python-api/app/middleware/security_headers.py
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response
```

### 4.2 Angular frontend hardening

| Hardening measure | How | Status |
|---|---|---|
| **Content Security Policy** | nginx `add_header Content-Security-Policy` — restrict script/style sources | To do |
| **Subresource Integrity** | Angular CLI `--subresource-integrity` build flag | To do |
| **HttpOnly cookies** | If migrating JWT to cookies: set `HttpOnly`, `Secure`, `SameSite=Strict` | Future |
| **Angular built-in XSS** | Angular auto-sanitizes `[innerHTML]` — verify no `bypassSecurityTrust*` calls | Verify |
| **Source maps** | Disabled in production build (`"sourceMap": false` in angular.json) | Verify |

#### nginx CSP header

```nginx
# angular-app/nginx.conf — add inside server block
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://accounts.google.com; frame-ancestors 'none';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

### 4.3 PostgreSQL hardening

| Hardening measure | How | Status |
|---|---|---|
| **SSL connections** | Mount cert into postgres container, set `ssl = on` | To do |
| **Password strength** | 20+ char random password in Vault | To do |
| **pgAudit extension** | Log all DDL and DML by admin roles for compliance | To do |
| **No exposed port** | Already no host port mapping in `docker-compose.prod.yml` | Done |
| **Read-only user** | Create a `readonly` DB role for analytics queries | To do |

### 4.4 Traefik hardening

| Hardening measure | How | Status |
|---|---|---|
| **TLS 1.2 minimum** | `tls.options.default.minVersion: VersionTLS12` in Traefik config | To do |
| **HSTS** | Traefik middleware or via backend headers | To do |
| **Rate limiting** | Traefik middleware `rateLimit` as outer layer before app rate limiting | To do |
| **Dashboard locked** | `api.insecure: false`, dashboard behind BasicAuth or disabled | To do |
| **Docker socket read-only** | Already `:ro` in Traefik compose | Done |

```yaml
# In traefik dynamic config — global rate limit middleware
http:
  middlewares:
    global-rate-limit:
      rateLimit:
        average: 100
        burst: 200
        period: 1m

  routers:
    openmath:
      middlewares:
        - global-rate-limit
```

### 4.5 Docker container hardening

```yaml
# docker-compose.prod.yml — add to each service
services:
  python-api:
    read_only: true                      # read-only rootfs
    tmpfs:
      - /tmp                             # writable tmp only
    security_opt:
      - no-new-privileges:true           # prevent privilege escalation
    cap_drop:
      - ALL                              # drop all Linux capabilities
    user: "1000:1000"                    # non-root user

  angular-app:
    read_only: true
    tmpfs:
      - /tmp
      - /var/cache/nginx
      - /var/run
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE                 # nginx needs to bind port 80
```

---

## 5. Secrets Management — HashiCorp Vault

### 5.1 Why Vault

| Current problem | Vault solution |
|---|---|
| Secrets in `.env` plain-text file | Encrypted at rest, access-controlled |
| No secret rotation | Automatic rotation policies |
| Secrets visible in `docker inspect` | Injected at startup, not stored in container config |
| Shared `.env` across all services | Per-service policies (least privilege) |
| Google Client Secret in env var | Dynamic secret retrieval |

### 5.2 Vault deployment (Docker)

```yaml
# /opt/vault/docker-compose.yml
services:
  vault:
    image: hashicorp/vault:1.15
    container_name: vault
    restart: unless-stopped
    cap_add:
      - IPC_LOCK                         # prevent swapping secrets to disk
    ports:
      - "127.0.0.1:8200:8200"           # LAN only — never expose to internet
    environment:
      VAULT_ADDR: "http://0.0.0.0:8200"
      VAULT_API_ADDR: "http://127.0.0.1:8200"
    volumes:
      - vault-data:/vault/data
      - ./config:/vault/config:ro
    command: server

volumes:
  vault-data:

networks:
  default:
    name: vault-net
```

### 5.3 Vault configuration

```hcl
# /opt/vault/config/vault.hcl
storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1                # enable TLS in production with real cert
}

ui = true
disable_mlock = false
api_addr = "http://127.0.0.1:8200"
```

### 5.4 Initialize and store OpenMath secrets

```bash
# Initialize (first time only — save the unseal keys and root token!)
vault operator init -key-shares=3 -key-threshold=2

# Unseal (need 2 of 3 keys)
vault operator unseal <key-1>
vault operator unseal <key-2>

# Login
vault login <root-token>

# Enable KV secrets engine
vault secrets enable -path=openmath kv-v2

# Store secrets
vault kv put openmath/database \
  POSTGRES_USER=quiz \
  POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  POSTGRES_DB=quiz

vault kv put openmath/jwt \
  JWT_SECRET_KEY=$(openssl rand -base64 64) \
  JWT_ALGORITHM=HS256 \
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15 \
  JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

vault kv put openmath/google \
  GOOGLE_CLIENT_ID=<your-client-id> \
  GOOGLE_CLIENT_SECRET=<your-client-secret> \
  GOOGLE_REDIRECT_URI=https://openmath.hu/auth/google/callback
```

### 5.5 Application integration pattern

Use a startup script that pulls secrets from Vault and exports them as
environment variables before launching the container process:

```bash
#!/bin/sh
# python-api/entrypoint-vault.sh

# Fetch secrets from Vault using AppRole or Token auth
export VAULT_ADDR="http://vault:8200"
SECRETS=$(vault kv get -format=json openmath/database | jq -r '.data.data')
export POSTGRES_USER=$(echo $SECRETS | jq -r '.POSTGRES_USER')
export POSTGRES_PASSWORD=$(echo $SECRETS | jq -r '.POSTGRES_PASSWORD')

SECRETS=$(vault kv get -format=json openmath/jwt | jq -r '.data.data')
export JWT_SECRET_KEY=$(echo $SECRETS | jq -r '.JWT_SECRET_KEY')

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Alternative — Docker Compose with Vault agent sidecar:**

```yaml
# docker-compose.prod.yml — Vault agent template injection
services:
  vault-agent:
    image: hashicorp/vault:1.15
    container_name: vault-agent
    command: agent -config=/vault/config/agent.hcl
    volumes:
      - ./vault-agent-config:/vault/config:ro
      - shared-secrets:/secrets           # shared volume
    networks:
      - vault-net
      - openmath-local-prod-net

  python-api:
    env_file: []                          # no more .env
    volumes:
      - shared-secrets:/secrets:ro        # read injected secrets
    # Application reads from /secrets/.env at startup
```

### 5.6 Vault policies (least privilege)

```hcl
# policy: openmath-api
path "openmath/data/database" {
  capabilities = ["read"]
}
path "openmath/data/jwt" {
  capabilities = ["read"]
}
path "openmath/data/google" {
  capabilities = ["read"]
}

# policy: openmath-frontend (no secrets needed — frontend is static)
# No policy required

# policy: openmath-admin
path "openmath/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

### 5.7 Secret rotation strategy

| Secret | Rotation frequency | Method |
|---|---|---|
| `JWT_SECRET_KEY` | Every 90 days | Vault KV version + rolling deploy |
| `POSTGRES_PASSWORD` | Every 90 days | Vault dynamic database secrets engine (auto-generate) |
| `GOOGLE_CLIENT_SECRET` | On compromise only | Manual rotate in Google Console + update Vault |
| Vault unseal keys | Never (store offline securely) | Paper / USB in safe |

---

## 6. Wazuh — SIEM & Security Monitoring

### 6.1 Current Wazuh deployment

Wazuh is already deployed on the home lab. It needs to be connected to
OpenMath's application and infrastructure telemetry.

### 6.2 Wazuh + OpenMath integration points

| Data source | Wazuh agent/config | What it detects |
|---|---|---|
| **Docker host** | Wazuh agent on host | Rootkit detection, file integrity, OS-level attacks |
| **Docker container logs** | Wazuh Docker listener (`/var/lib/docker/containers/*/`) | Application errors, suspicious patterns |
| **FastAPI structured logs** | Forward OTEL logs → Wazuh via syslog or file | Failed logins, auth failures, 4xx/5xx spikes |
| **PostgreSQL logs** | pgAudit + Wazuh log collector | Unauthorized queries, DDL changes, privilege escalation |
| **Traefik access logs** | Wazuh log collector on `access.json` | Brute-force attempts, path traversal, scanner activity |
| **MikroTik syslog** | MikroTik syslog → Wazuh syslog receiver | Firewall events, unauthorized access attempts, VPN activity |
| **nginx (angular-app)** | Access/error logs via Docker listener | HTTP scanning, 404 floods, bot activity |

### 6.3 Wazuh detection rules for OpenMath

```xml
<!-- /var/ossec/etc/rules/openmath_rules.xml -->

<!-- Failed login brute force (>5 in 2 min from same IP) -->
<group name="openmath,authentication">
  <rule id="100001" level="10" frequency="5" timeframe="120">
    <decoded_as>json</decoded_as>
    <field name="action">login_failed</field>
    <description>OpenMath: brute force login attempt detected</description>
  </rule>
</group>

<!-- Admin action audit -->
<group name="openmath,admin">
  <rule id="100002" level="7">
    <decoded_as>json</decoded_as>
    <field name="role">admin</field>
    <field name="method">DELETE|PUT|PATCH</field>
    <description>OpenMath: admin performed destructive action</description>
  </rule>
</group>

<!-- Rate limit exceeded (from Traefik or FastAPI) -->
<group name="openmath,ratelimit">
  <rule id="100003" level="8" frequency="10" timeframe="60">
    <field name="status">429</field>
    <description>OpenMath: excessive rate limiting triggered</description>
  </rule>
</group>
```

### 6.4 Wazuh + OTEL alignment

The OTEL monitoring stack and Wazuh serve **complementary** purposes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TELEMETRY SOURCES                            │
│  FastAPI  │  Angular  │  Traefik  │  MikroTik  │  Docker host  │
└─────┬──────────┬──────────┬───────────┬──────────┬──────────────┘
      │          │          │           │          │
      ▼          ▼          ▼           ▼          ▼
┌─────────────────────┐   ┌──────────────────────────────┐
│   OTEL Collector     │   │   Wazuh Agent                │
│   (app telemetry)    │   │   (host + security events)   │
└──────┬──────┬────────┘   └──────────┬──────────────────┘
       │      │                       │
       ▼      ▼                       ▼
┌────────┐ ┌──────┐           ┌──────────────┐
│Promethe│ │ Loki │           │Wazuh Manager │
│us      │ │      │           │(Indexer +    │
│metrics │ │ logs │           │ Dashboard)   │
└───┬────┘ └──┬───┘           └──────┬───────┘
    │         │                      │
    ▼         ▼                      ▼
┌──────────────────┐       ┌──────────────────┐
│     Grafana       │       │  Wazuh Dashboard │
│  ● Performance    │       │  ● Security      │
│  ● Usage / UX     │       │  ● Compliance    │
│  ● Business KPIs  │       │  ● Threat detect │
│  ● Infra health   │       │  ● File integrity│
└──────────────────┘       └──────────────────┘
```

| Concern | Primary tool | Secondary |
|---|---|---|
| **Performance monitoring** (latency, throughput) | Grafana + Prometheus | — |
| **Usage analytics** (DAU, quiz activity) | Grafana + Loki/Prometheus | — |
| **Security event detection** (brute force, scans) | Wazuh | Grafana (security dashboard) |
| **File integrity monitoring** | Wazuh | — |
| **Compliance / CIS benchmarks** | Wazuh | — |
| **Vulnerability detection** | Wazuh (agent-based) + Trivy (CI) | — |
| **Log investigation** (debugging) | Grafana + Loki | Wazuh (correlated view) |
| **Infrastructure health** | Grafana + Prometheus | Wazuh (host agent) |
| **Alerting** | Both — Grafana for ops, Wazuh for security | — |

### 6.5 Cross-feeding Wazuh alerts into Grafana

Forward Wazuh alerts to Loki for unified dashboarding:

```yaml
# Wazuh integrations config — forward alerts to syslog → Loki
<integration>
  <name>syslog</name>
  <level>8</level>
  <format>json</format>
  <hook_url>http://otel-collector:4317</hook_url>
</integration>
```

Alternatively, Grafana can query the Wazuh Indexer (OpenSearch) directly as
a data source, giving operators a single-pane view.

---

## 7. MikroTik Router Security

| Measure | Implementation |
|---|---|
| **Firewall rules** | Allow only ports 80, 443 inbound; block all other WAN→LAN |
| **Port knocking** | Enable for SSH/Winbox management access |
| **Syslog to Wazuh** | `System > Logging > Actions` → remote syslog to Wazuh agent IP |
| **SNMP to Prometheus** | Read-only community string, restricted to monitoring VLAN |
| **Firmware updates** | Regular RouterOS updates — monitor CVEs |
| **Disable unused services** | Turn off Telnet, FTP, API (if not used), bandwidth-test server |

---

## 8. Implementation Phases

| Phase | What | Effort | Priority |
|---|---|---|---|
| **Phase 1** | Application hardening: security headers, rate limiting, CORS lockdown | 1 day | High |
| **Phase 2** | Trivy dependency + image scanning in CI | 0.5 day | High |
| **Phase 3** | Semgrep SAST + pre-commit hooks | 0.5 day | High |
| **Phase 4** | Docker container hardening (read-only, no-new-privileges, non-root) | 0.5 day | High |
| **Phase 5** | Traefik TLS hardening + rate limiting middleware | 0.5 day | High |
| **Phase 6** | Wazuh → OpenMath log integration (Docker listener + custom rules) | 1 day | Medium |
| **Phase 7** | Wazuh → Traefik access log ingestion | 0.5 day | Medium |
| **Phase 8** | Wazuh → MikroTik syslog integration | 0.5 day | Medium |
| **Phase 9** | HashiCorp Vault deployment + secret migration | 1–2 days | Medium |
| **Phase 10** | PostgreSQL SSL + pgAudit | 0.5 day | Medium |
| **Phase 11** | OWASP ZAP DAST in CI/CD | 0.5 day | Low |
| **Phase 12** | Secret rotation automation (Vault dynamic DB creds) | 1 day | Low |

---

## 9. Security Checklist (cumulative)

### Already done

- [x] JWT authentication with bcrypt password hashing
- [x] RBAC via `user_roles` junction table
- [x] PostgreSQL port not exposed to Docker host
- [x] `.env` file git-ignored
- [x] Pydantic input validation on all API endpoints
- [x] Wazuh deployed on home lab

### To do — high priority

- [ ] CORS locked to `https://openmath.hu` only
- [ ] Security headers on FastAPI (X-Content-Type-Options, X-Frame-Options, HSTS)
- [ ] CSP header on nginx (angular-app)
- [ ] Rate limiting on auth endpoints (slowapi)
- [ ] Trivy image scanning in CI
- [ ] Semgrep SAST in CI + pre-commit
- [ ] Docker containers: `read_only`, `no-new-privileges`, `cap_drop: ALL`
- [ ] Traefik TLS minimum version 1.2
- [ ] Source maps disabled in production Angular build

### To do — medium priority

- [ ] HashiCorp Vault deployed and secrets migrated
- [ ] Wazuh connected to OpenMath container logs
- [ ] Wazuh custom rules for failed login detection
- [ ] Wazuh ingesting Traefik access logs
- [ ] MikroTik syslog forwarded to Wazuh
- [ ] PostgreSQL SSL enabled
- [ ] pgAudit extension installed and configured
- [ ] Read-only DB user for analytics

### To do — future

- [ ] JWT refresh token rotation + revocation list
- [ ] Vault dynamic database credentials (auto-rotation)
- [ ] OWASP ZAP DAST in CI pipeline
- [ ] Wazuh alerts → Grafana (cross-feed)
- [ ] Password complexity policy enforcement
- [ ] Automated security regression testing
