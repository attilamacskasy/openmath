# OpenMath — Automated Testing & Load Testing Roadmap

**Status:** Planned  
**Date:** 2026-03-14  
**Depends on:** Production Docker stack (live), Traefik gateway (planned), OTEL monitoring (planned)

---

## 1. Overview

OpenMath currently has **zero automated tests**. This roadmap covers four testing
layers — unit, integration, end-to-end, and load/performance — with concrete
tool choices, example tests against real OpenMath endpoints, and a load-testing
strategy for right-sizing container resources.

### Current state

| Layer | Backend (FastAPI) | Frontend (Angular) | Infra |
|---|---|---|---|
| **Unit tests** | None | None (`ng test` in package.json, no spec files) | None |
| **Integration tests** | None | None | None |
| **E2E tests** | None | None | None |
| **Load tests** | None | None | None |

### API surface to test

10 router modules, 40+ endpoints:

| Router | Endpoints | Auth required |
|---|---|---|
| `auth.py` | register, login, google-callback, refresh, /me | Partial |
| `users.py` | CRUD, roles, associations, mastery, reset-password | Admin |
| `sessions.py` | create, list, get, complete | Student |
| `answers.py` | submit answer | Student |
| `quiz_types.py` | list, get, create, update | Mixed |
| `stats.py` | user stats, leaderboard | Mixed |
| `teacher.py` | students, sessions, reviews | Teacher |
| `parent.py` | children, sessions, sign-off | Parent |
| `badges.py` | list, user badges | Mixed |
| `notifications.py` | list, mark-read, count | Authenticated |

---

## 2. Tool Selection

| Layer | Tool | Why |
|---|---|---|
| **Backend unit/integration** | **pytest** + **httpx** (async) | FastAPI's recommended test client; async-native |
| **Frontend unit** | **Jest** (via `@angular-builders/jest`) | Faster than Karma, simpler config, better DX |
| **E2E** | **Playwright** | Cross-browser, auto-wait, network mocking, trace viewer |
| **Load testing** | **Grafana k6** | JS-based scenarios, Prometheus/Grafana integration, CLI-first |
| **API contract** | **Schemathesis** | Auto-generates tests from OpenAPI schema |
| **DB testing** | **pgTAP** (optional) | SQL-level unit tests for constraints, triggers, views |

---

## 3. Backend Testing (pytest + httpx)

### 3.1 Setup

```bash
# Add to python-api/requirements-dev.txt
pytest>=8.0
pytest-asyncio>=0.23
httpx>=0.27
pytest-cov>=4.1
factory-boy>=3.3
```

```ini
# python-api/pytest.ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

### 3.2 Test fixtures

```python
# python-api/tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import get_pool

@pytest.fixture
async def pool():
    """Create a test database connection pool."""
    import asyncpg
    pool = await asyncpg.create_pool(
        "postgresql://quiz:testpass@localhost:5432/quiz_test"
    )
    yield pool
    await pool.close()

@pytest.fixture
async def client():
    """Async test client for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_headers(client):
    """Register + login a test user, return auth headers."""
    await client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@openmath.local",
        "password": "TestPass123!",
        "birthday": "2015-01-01",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "test@openmath.local",
        "password": "TestPass123!",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
async def admin_headers(client, pool):
    """Register a user, promote to admin, return auth headers."""
    await client.post("/api/auth/register", json={
        "name": "Admin User",
        "email": "admin@openmath.local",
        "password": "AdminPass123!",
        "birthday": "1990-01-01",
    })
    # Promote to admin
    await pool.execute("""
        INSERT INTO user_roles (user_id, role_id)
        SELECT u.id, r.id FROM users u, roles r
        WHERE u.email = 'admin@openmath.local' AND r.name = 'admin'
        ON CONFLICT DO NOTHING
    """)
    resp = await client.post("/api/auth/login", json={
        "email": "admin@openmath.local",
        "password": "AdminPass123!",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

### 3.3 Example tests

```python
# python-api/tests/test_auth.py
import pytest

@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/api/auth/register", json={
        "name": "New Student",
        "email": "student@openmath.local",
        "password": "StrongPass1!",
        "birthday": "2016-03-15",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["name"] == "New Student"

@pytest.mark.asyncio
async def test_register_too_young(client):
    """Age < 4 must be rejected."""
    resp = await client.post("/api/auth/register", json={
        "name": "Baby",
        "email": "baby@openmath.local",
        "password": "StrongPass1!",
        "birthday": "2024-01-01",   # ~2 years old
    })
    assert resp.status_code == 400
    assert "at least 4" in resp.json()["detail"].lower()

@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post("/api/auth/login", json={
        "email": "noexist@openmath.local",
        "password": "wrong",
    })
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_me_unauthenticated(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
```

```python
# python-api/tests/test_quiz_flow.py
import pytest

@pytest.mark.asyncio
async def test_full_quiz_flow(client, auth_headers):
    """Complete a quiz: create session → answer questions → complete."""
    # Get quiz types
    resp = await client.get("/api/quiz-types", headers=auth_headers)
    assert resp.status_code == 200
    qt = resp.json()[0]

    # Start session
    resp = await client.post("/api/sessions", headers=auth_headers, json={
        "quiz_type_id": qt["id"],
        "difficulty": "medium",
        "total_questions": 5,
    })
    assert resp.status_code == 201
    session = resp.json()

    # Answer questions
    for q in session["questions"]:
        resp = await client.post(f"/api/answers", headers=auth_headers, json={
            "question_id": q["id"],
            "value": int(q["correct"]) if q["correct"].isdigit() else 0,
        })
        assert resp.status_code in (200, 201)

    # Complete session
    resp = await client.post(
        f"/api/sessions/{session['id']}/complete",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["score_percent"] >= 0

@pytest.mark.asyncio
async def test_admin_user_crud(client, admin_headers):
    """Admin creates, lists, patches, and verifies a user."""
    # Create
    resp = await client.post("/api/users", headers=admin_headers, json={
        "name": "Created User",
        "email": "created@openmath.local",
        "password": "Pass1234!",
        "birthday": "2014-06-01",
    })
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    # List
    resp = await client.get("/api/users", headers=admin_headers)
    assert resp.status_code == 200
    assert any(u["id"] == user_id for u in resp.json())

    # Patch
    resp = await client.patch(f"/api/users/{user_id}", headers=admin_headers, json={
        "name": "Updated User",
    })
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated User"
```

### 3.4 API contract tests (Schemathesis)

Auto-generate tests from the OpenAPI schema:

```bash
# Against running dev server
schemathesis run http://localhost:8000/openapi.json \
  --hypothesis-max-examples=50 \
  --checks all

# Or in pytest
pip install schemathesis
```

```python
# python-api/tests/test_schema.py
import schemathesis

schema = schemathesis.from_url("http://localhost:8000/openapi.json")

@schema.parametrize()
def test_api_contract(case):
    response = case.call()
    case.validate_response(response)
```

### 3.5 Running tests

```bash
cd python-api

# Run all tests
pytest -v

# With coverage
pytest --cov=app --cov-report=html

# Specific test file
pytest tests/test_auth.py -v
```

---

## 4. Frontend Testing (Jest + Playwright)

### 4.1 Unit tests — Jest

```bash
cd angular-app
pnpm add -D @angular-builders/jest jest @types/jest
```

```json
// angular.json — replace karma with jest
"test": {
  "builder": "@angular-builders/jest:run",
  "options": {
    "tsConfig": "tsconfig.spec.json"
  }
}
```

```typescript
// angular-app/src/app/features/auth/register.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTransloco } from '@jsverse/transloco';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should flag birthday too young', () => {
    component.birthday = new Date();  // today = 0 years old
    expect(component.birthdayTooYoung).toBe(true);
  });

  it('should accept valid birthday', () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    component.birthday = fiveYearsAgo;
    expect(component.birthdayTooYoung).toBe(false);
  });
});
```

### 4.2 E2E tests — Playwright

```bash
pnpm add -D @playwright/test
npx playwright install
```

```typescript
// angular-app/e2e/quiz-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Quiz Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@openmath.local');
    await page.fill('[data-testid="password"]', 'TestPass123!');
    await page.click('[data-testid="login-btn"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('complete a multiplication quiz', async ({ page }) => {
    await page.click('[data-testid="start-quiz"]');
    await page.click('text=Multiplication');
    await page.click('text=Medium');
    await page.click('[data-testid="begin-quiz"]');

    // Answer 10 questions
    for (let i = 0; i < 10; i++) {
      await page.fill('[data-testid="answer-input"]', '42');
      await page.click('[data-testid="submit-answer"]');
    }

    // Verify results page
    await expect(page.locator('[data-testid="score"]')).toBeVisible();
  });

  test('registration rejects age under 4', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="name"]', 'Baby User');
    await page.fill('[data-testid="email"]', 'baby@test.local');
    await page.fill('[data-testid="password"]', 'Pass1234!');
    // Set birthday to 1 year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    await page.fill('[data-testid="birthday"]', oneYearAgo.toISOString().split('T')[0]);

    await expect(page.locator('text=at least 4')).toBeVisible();
    await expect(page.locator('[data-testid="register-btn"]')).toBeDisabled();
  });
});

// angular-app/e2e/admin.spec.ts
test.describe('Admin Portal', () => {
  test('admin can manage users', async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@openmath.local');
    await page.fill('[data-testid="password"]', 'AdminPass123!');
    await page.click('[data-testid="login-btn"]');

    // Navigate to user admin
    await page.click('[data-testid="nav-admin"]');
    await expect(page.locator('table')).toBeVisible();

    // Create user
    await page.click('[data-testid="add-user"]');
    await page.fill('[data-testid="dialog-name"]', 'E2E User');
    await page.click('[data-testid="dialog-save"]');
    await expect(page.locator('text=E2E User')).toBeVisible();
  });
});
```

---

## 5. Load Testing & Right-Sizing (Grafana k6)

### 5.1 Why k6

- JavaScript scenarios (familiar syntax)
- Built-in Prometheus remote write → live dashboards in Grafana
- Models real user flows, not just raw HTTP
- Supports thresholds and SLOs
- CLI-first, CI/CD friendly

### 5.2 Install

```bash
# macOS / Linux
brew install k6

# Docker
docker run --rm -i grafana/k6 run - < script.js

# Windows
winget install grafana.k6
```

### 5.3 Test scenarios

#### Scenario 1: Frontend static assets (nginx capacity)

```javascript
// k6/frontend-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp to 50 VUs
    { duration: '2m',  target: 50 },   // hold 50
    { duration: '30s', target: 200 },  // spike to 200
    { duration: '1m',  target: 200 },  // hold 200
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95th percentile < 200ms
    http_req_failed: ['rate<0.01'],     // < 1% failures
  },
};

export default function () {
  const baseUrl = 'https://openmath.hu';

  // Simulate page load (SPA)
  const responses = http.batch([
    ['GET', `${baseUrl}/`],
    ['GET', `${baseUrl}/main.js`],
    ['GET', `${baseUrl}/styles.css`],
  ]);

  check(responses[0], { 'index 200': (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1);
}
```

#### Scenario 2: API backend load (quiz flow)

```javascript
// k6/api-load.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    quiz_takers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m',  target: 20 },
        { duration: '3m',  target: 20 },
        { duration: '1m',  target: 50 },
        { duration: '2m',  target: 50 },
        { duration: '1m',  target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{group:::Login}':      ['p(95)<500'],
    'http_req_duration{group:::Quiz}':       ['p(95)<1000'],
    'http_req_duration{group:::Answer}':     ['p(95)<300'],
    http_req_failed:                         ['rate<0.05'],
  },
};

const BASE = 'http://localhost/api';

export default function () {
  let token;

  group('Login', () => {
    const loginRes = http.post(`${BASE}/auth/login`, JSON.stringify({
      email: `loadtest_${__VU}@openmath.local`,
      password: 'LoadTest123!',
    }), { headers: { 'Content-Type': 'application/json' } });

    check(loginRes, { 'login ok': (r) => r.status === 200 });
    token = loginRes.json('access_token');
  });

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Quiz', () => {
    // Get quiz types
    const types = http.get(`${BASE}/quiz-types`, { headers });
    check(types, { 'types ok': (r) => r.status === 200 });
    const qtId = types.json('0.id');

    // Start session
    const session = http.post(`${BASE}/sessions`, JSON.stringify({
      quiz_type_id: qtId,
      difficulty: 'medium',
      total_questions: 10,
    }), { headers });
    check(session, { 'session created': (r) => r.status === 201 });

    const sessionId = session.json('id');
    const questions = session.json('questions');

    // Answer each question
    for (const q of questions) {
      group('Answer', () => {
        const ans = http.post(`${BASE}/answers`, JSON.stringify({
          question_id: q.id,
          value: 42,
        }), { headers });
        check(ans, { 'answer ok': (r) => r.status <= 201 });
      });
      sleep(0.5);  // simulate thinking time
    }

    // Complete session
    const complete = http.post(`${BASE}/sessions/${sessionId}/complete`,
      null, { headers });
    check(complete, { 'complete ok': (r) => r.status === 200 });
  });

  sleep(2);
}
```

#### Scenario 3: Database performance (heavy read)

```javascript
// k6/db-read-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 30,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // stats queries can be slow
  },
};

export default function () {
  const headers = { 'Authorization': `Bearer ${__ENV.TOKEN}` };

  // Heavy analytics endpoints
  http.get(`http://localhost/api/stats/leaderboard`, { headers });
  http.get(`http://localhost/api/users/${__ENV.USER_ID}/mastery`, { headers });
  http.get(`http://localhost/api/sessions?limit=100`, { headers });

  sleep(1);
}
```

#### Scenario 4: Full-stack external (through Traefik gateway)

```javascript
// k6/external-e2e.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // includes TLS + network
    'checks': ['rate>0.95'],
  },
};

export default function () {
  // External HTTPS through Traefik gateway
  const res = http.get('https://openmath.hu/');
  check(res, {
    'status 200': (r) => r.status === 200,
    'has angular app': (r) => r.body.includes('<app-root'),
    'TLS valid': (r) => r.tls_version !== '',
  });

  // API through full stack (Traefik → nginx → FastAPI)
  const health = http.get('https://openmath.hu/api/health');
  check(health, {
    'api healthy': (r) => r.status === 200,
  });
}
```

### 5.4 k6 → Prometheus → Grafana (live dashboards)

Send k6 metrics to Prometheus in real-time during tests:

```bash
# Output to Prometheus remote write (requires OTEL stack running)
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  k6 run --out experimental-prometheus-rw k6/api-load.js
```

Grafana dashboard panels during load test:

| Panel | Metric | Purpose |
|---|---|---|
| Request rate | `k6_http_reqs` | Total throughput |
| Latency p95 | `k6_http_req_duration{quantile="0.95"}` | SLO compliance |
| Error rate | `k6_http_req_failed` | Reliability |
| VU count | `k6_vus` | Load level |
| Container CPU | `container_cpu_usage_seconds_total` (cAdvisor) | Backend saturation |
| Container memory | `container_memory_usage_bytes` (cAdvisor) | Memory pressure |
| PostgreSQL connections | `pg_stat_activity` (via pg exporter) | DB connection pool |
| API latency (server) | `http_server_request_duration` (OTEL) | Server-side view |

### 5.5 Right-sizing containers

Run load tests at increasing VU counts and record resource usage:

```
┌──────────┬────────┬────────┬──────────┬──────────┬─────────────────┐
│ VUs      │ RPS    │ p95 ms │ API CPU  │ API Mem  │ DB CPU          │
├──────────┼────────┼────────┼──────────┼──────────┼─────────────────┤
│ 10       │ ~30    │ <100   │ ~5%      │ ~80 MB   │ ~2%             │
│ 50       │ ~120   │ <300   │ ~25%     │ ~120 MB  │ ~10%            │
│ 100      │ ~200   │ <500   │ ~50%     │ ~180 MB  │ ~25%            │
│ 200      │ ~300   │ <1000  │ ~80%     │ ~250 MB  │ ~40%            │
│ 500      │ ???    │ ???    │ ???      │ ???      │ ???             │
└──────────┴────────┴────────┴──────────┴──────────┴─────────────────┘
```

Use results to set Docker resource limits:

```yaml
# docker-compose.prod.yml — add after benchmarking
services:
  python-api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M

  angular-app:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  postgresql:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.25'
          memory: 256M
```

---

## 6. Test Scopes — Internal vs External

### 6.1 Internal testing (inside Docker network)

| Test type | What it validates | How to run |
|---|---|---|
| pytest (unit) | Router logic, schemas, validators | `cd python-api && pytest` |
| pytest (integration) | Full endpoint → DB round-trips | `pytest` with test DB |
| Jest (unit) | Component logic, pipes, services | `cd angular-app && pnpm test` |
| k6 internal | API throughput, DB query perf | `k6 run` against `http://localhost/api` |
| Schemathesis | OpenAPI contract compliance | Against `http://localhost:8000/openapi.json` |

### 6.2 External testing (through Traefik + network)

| Test type | What it validates | How to run |
|---|---|---|
| Playwright E2E | Full user flows through browser | Against `https://openmath.hu` |
| k6 external | TLS handshake, Traefik routing, end-to-end latency | Against `https://openmath.hu` |
| curl smoke | Health check, certificate validity | `curl -I https://openmath.hu` |
| OWASP ZAP | Runtime security (DAST) | Against `https://openmath.hu` |

### 6.3 MikroTik / network layer

| Test | What | Tool |
|---|---|---|
| Port scan from outside | Verify only 80/443 open | `nmap <public-ip>` |
| DNS resolution | Verify A records resolve | `dig openmath.hu` |
| Bandwidth under load | Network isn't the bottleneck | k6 + MikroTik SNMP metrics |

---

## 7. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: quiz
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: quiz_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r python-api/requirements.txt -r python-api/requirements-dev.txt
      - run: cd python-api && pytest --cov=app --cov-report=xml -v
      - uses: codecov/codecov-action@v4

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: cd angular-app && pnpm install && pnpm test -- --ci

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.prod.yml up -d --build
      - uses: actions/setup-node@v4
      - run: cd angular-app && npx playwright install --with-deps && npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: angular-app/test-results/

  load-test:
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main'    # only on main merges
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/k6-action@v0.3.1
        with:
          filename: k6/api-load.js
          flags: --duration 1m --vus 20    # short CI run
```

---

## 8. Implementation Phases

| Phase | What | Effort | Priority |
|---|---|---|---|
| **Phase 1** | pytest setup + `conftest.py` + auth tests (10 tests) | 1 day | High |
| **Phase 2** | pytest quiz flow + user CRUD tests (20 tests) | 1–2 days | High |
| **Phase 3** | Schemathesis contract tests | 0.5 day | High |
| **Phase 4** | Jest setup + component unit tests (register, profile, admin) | 1 day | Medium |
| **Phase 5** | Playwright E2E — login, quiz flow, admin CRUD | 1–2 days | Medium |
| **Phase 6** | k6 internal API load test + baseline benchmark | 1 day | Medium |
| **Phase 7** | k6 external full-stack test (through Traefik) | 0.5 day | Medium |
| **Phase 8** | k6 → Prometheus → Grafana live dashboard | 0.5 day | Low |
| **Phase 9** | Right-sizing: load test → set Docker resource limits | 0.5 day | Low |
| **Phase 10** | GitHub Actions CI pipeline (all layers) | 1 day | Medium |

---

## 9. Coverage Targets

| Layer | Target | Rationale |
|---|---|---|
| Backend unit/integration | **80%** line coverage | Auth + quiz flow are critical paths |
| Frontend unit | **60%** | Focus on components with business logic |
| E2E | **5 core flows** | Login, register, quiz, admin CRUD, profile |
| Load test baseline | Documented p95 at 50 VUs | Know the performance ceiling before going public |

---

## 10. Multiplayer WebSocket Testing (v4.0)

> Cross-reference: `spec_v4.0_multiplayer.md` Section 13.6

The v4.0 multiplayer mode adds 2 new router modules (`multiplayer.py` REST +
`multiplayer_ws.py` WebSocket), increasing the API surface by ~20%.

### 10.1 pytest — WebSocket fixtures

The `httpx.AsyncClient` transport does not support WebSocket. Add a
Starlette `TestClient` fixture specifically for multiplayer tests:

```python
# python-api/tests/conftest.py — add alongside existing fixtures
from starlette.testclient import TestClient

@pytest.fixture
def ws_client(app):
    """Synchronous WebSocket test client for multiplayer endpoints."""
    with TestClient(app) as client:
        yield client
```

Example WebSocket test:

```python
# python-api/tests/test_multiplayer_ws.py
import pytest

def test_join_game_lobby(ws_client, auth_token):
    with ws_client.websocket_connect(
        f"/ws/game/TEST-123?token={auth_token}"
    ) as ws:
        ws.send_json({"type": "player_ready", "payload": {"ready": True}})
        data = ws.receive_json()
        assert data["type"] == "player_ready_changed"

def test_ws_rejects_invalid_token(ws_client):
    with pytest.raises(Exception):
        with ws_client.websocket_connect(
            "/ws/game/TEST-123?token=invalid"
        ) as ws:
            pass
```

Use the `@pytest.mark.websocket` marker so WebSocket tests can be run
independently: `pytest -m websocket`.

### 10.2 Playwright — multi-client multiplayer E2E

Multiplayer E2E tests require **multiple browser contexts** connected to
the same game simultaneously:

```typescript
// angular-app/e2e/multiplayer.spec.ts
import { test, expect } from '@playwright/test';

test('3-player game completes with correct scoring', async ({ browser }) => {
  // Create isolated browser contexts (each with its own cookies/storage)
  const hostCtx = await browser.newContext();
  const p1Ctx = await browser.newContext();
  const p2Ctx = await browser.newContext();

  const host = await hostCtx.newPage();
  const player1 = await p1Ctx.newPage();
  const player2 = await p2Ctx.newPage();

  // Host creates game
  await host.goto('/multiplayer/create');
  await host.fill('[data-testid="game-settings-questions"]', '5');
  await host.click('[data-testid="create-game-btn"]');
  const gameCode = await host.locator('[data-testid="game-code"]').textContent();

  // Players join
  await player1.goto('/multiplayer/join');
  await player1.fill('[data-testid="join-code"]', gameCode);
  await player1.click('[data-testid="join-btn"]');

  await player2.goto('/multiplayer/join');
  await player2.fill('[data-testid="join-code"]', gameCode);
  await player2.click('[data-testid="join-btn"]');

  // All ready → host starts → game plays → results appear
  // ... (full flow)

  // Cleanup
  await hostCtx.close();
  await p1Ctx.close();
  await p2Ctx.close();
});
```

### 10.3 k6 — WebSocket load scenario

k6 supports WebSocket natively via `import ws from 'k6/ws'`. Add a scenario
to measure multiplayer capacity:

```javascript
// k6/multiplayer-ws-load.js
import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  scenarios: {
    multiplayer_games: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // ramp to 50 WS connections
        { duration: '2m',  target: 50 },   // hold
        { duration: '30s', target: 0 },    // ramp down
      ],
    },
  },
  thresholds: {
    ws_connecting: ['p(95)<500'],           // WS handshake < 500ms
    ws_msgs_received: ['count>100'],        // received game updates
  },
};

export default function () {
  const url = `wss://${__ENV.HOST}/ws/game/${__ENV.GAME_CODE}?token=${__ENV.TOKEN}`;
  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'player_ready', payload: { ready: true } }));
    });
    socket.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'next_question') {
        socket.send(JSON.stringify({
          type: 'submit_answer', payload: { answer: 0 }
        }));
      }
    });
    socket.setTimeout(() => socket.close(), 180000);
  });
  check(res, { 'WS status 101': (r) => r && r.status === 101 });
}
```

**Target capacity:** 10 simultaneous games × 5 players = 50 WebSocket
connections with p95 message round-trip < 100ms.

### 10.4 Updated coverage targets

| Layer | Target | Notes |
|---|---|---|
| Multiplayer REST API | **80%** | Game CRUD, player management |
| WebSocket protocol | **90%** | All 10 message types, error paths |
| Multiplayer E2E | **1 core flow** | Create → join → play → results |
| WebSocket load | Documented p95 at 50 WS connections | Baseline before production |