# OpenMath — Data & AI Roadmap

**Status:** Planned  
**Date:** 2026-03-14  
**Depends on:** PostgreSQL (live), OTEL monitoring stack (planned), Traefik gateway (planned)

---

## 1. Overview

This roadmap outlines how **data engineering and AI** can extend OpenMath beyond
the current operational database into analytics, predictions, and intelligent
tutoring — all built on top of the existing PostgreSQL data, planned
OpenTelemetry telemetry, Traefik access logs, and MikroTik network metrics.

### Data sources available today and planned

| Source | Type | Status | What it contains |
|---|---|---|---|
| **PostgreSQL** (quiz DB) | Relational | Live | Users, quiz sessions, questions, answers, badges, reviews, roles |
| **FastAPI application** | OTEL traces + metrics + logs | Planned | Request latency, active sessions, errors, user actions |
| **Angular frontend** | OTEL events (via API relay) | Planned | Page views, quiz start/abandon, UI interactions |
| **Traefik gateway** | Access logs + metrics | Planned | Domain hits, TLS handshake times, status codes, geo-IP |
| **MikroTik router** | SNMP / REST / syslog | Planned | Bandwidth, connection counts, firewall events, DHCP leases |
| **Docker host** | cAdvisor + node-exporter | Planned | CPU, memory, disk, container health |

---

## 2. Architecture — Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VISUALIZATION                                   │
│  Grafana dashboards │ Apache Superset │ Custom Angular admin pages       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ SQL / PromQL / LogQL
┌──────────────────────────────▼──────────────────────────────────────────┐
│                       ANALYTICS & QUERY                                 │
│  PostgreSQL (direct) │ DuckDB (OLAP) │ Prometheus │ Loki                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                  PROCESSING & ML                                        │
│  Python scripts │ pandas/polars │ scikit-learn │ lightweight LLM         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                       INGESTION                                         │
│  OTEL Collector │ Traefik logs │ pg_dump/COPY │ MikroTik SNMP exporter  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                     RAW DATA SOURCES                                    │
│  PostgreSQL │ FastAPI │ Angular │ Traefik │ MikroTik │ Docker host       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Analytics on PostgreSQL (no new infra needed)

The existing database already holds rich learning analytics. These queries
can run directly against the production DB or against a read replica / nightly
`pg_dump` snapshot loaded into a local DuckDB file.

### 3.1 Learning analytics queries (SQL)

| Metric | Source tables | Value |
|---|---|---|
| Per-user accuracy trend over time | `quiz_sessions`, `users` | Track improvement week-over-week |
| Hardest quiz types by failure rate | `quiz_sessions`, `quiz_types` | Identify curriculum gaps |
| Average time-to-complete per difficulty | `quiz_sessions` | Detect speed vs. accuracy tradeoffs |
| Timetable mastery heatmap (user × table) | `questions`, `answers`, `quiz_types` | Per-student weak spots (e.g. 7×8) |
| Badge earning velocity | `user_badges` | Gamification effectiveness |
| Review turnaround time | `quiz_reviews` | Teacher/parent engagement |
| Drop-off rate (started but not finished) | `quiz_sessions` (finished_at IS NULL) | UX friction indicator |
| Peak usage hours | `quiz_sessions.started_at` | Capacity planning |
| Age-group performance distribution | `users.age`, `quiz_sessions` | Curriculum alignment |
| Daily active users (DAU) | `quiz_sessions.started_at` | Growth tracking |

### 3.2 Example: weekly improvement report (pure SQL)

```sql
WITH weekly AS (
  SELECT
    user_id,
    date_trunc('week', started_at) AS week,
    AVG(score_percent) AS avg_score,
    COUNT(*) AS sessions
  FROM quiz_sessions
  WHERE finished_at IS NOT NULL
  GROUP BY user_id, date_trunc('week', started_at)
)
SELECT
  u.name,
  w.week,
  w.avg_score,
  w.avg_score - LAG(w.avg_score) OVER (PARTITION BY w.user_id ORDER BY w.week) AS improvement,
  w.sessions
FROM weekly w
JOIN users u ON u.id = w.user_id
ORDER BY u.name, w.week;
```

### 3.3 DuckDB for local OLAP (optional)

For heavier analytical workloads without loading the prod database:

```bash
# Export nightly snapshot
pg_dump -Fc --data-only quiz > /backups/quiz_$(date +%Y%m%d).dump

# Load into DuckDB
duckdb analytics.db <<SQL
  INSTALL postgres; LOAD postgres;
  ATTACH 'dbname=quiz host=localhost' AS pg (TYPE postgres, READ_ONLY);
  CREATE TABLE sessions AS SELECT * FROM pg.quiz_sessions;
  CREATE TABLE users AS SELECT * FROM pg.users;
SQL
```

DuckDB runs in-process (no server), handles millions of rows, and supports
the same SQL syntax. Good for ad-hoc analysis and Jupyter notebooks.

---

## 4. OTEL-Powered Analytics (planned infra)

The planned OTEL stack (see `roadmap_observability_otel_monitoring.md`) feeds
Prometheus (metrics) and Loki (logs). On top of operational monitoring, we can
derive **usage analytics** from the same telemetry.

### 4.1 Application telemetry → analytics

| OTEL signal | Analytics use |
|---|---|
| `http.server.request.duration` histogram | API latency percentiles per endpoint |
| `quiz.session.started` counter | Real-time quiz activity rate |
| `quiz.session.completed` counter + attributes | Completion rate by quiz type, difficulty, age group |
| `user.login` event | Login frequency, peak hours, auth provider breakdown |
| `user.badge.awarded` event | Badge earning trends |
| Structured log: `action=answer, correct=false` | Real-time error-pattern detection |

### 4.2 Traefik telemetry

Traefik exports Prometheus metrics natively and can write structured access logs:

```yaml
# In traefik.yml — add metrics + access log
metrics:
  prometheus:
    entryPoint: metrics        # add entryPoint metrics :8082
    addEntryPointsLabels: true
    addServicesLabels: true

accessLog:
  filePath: "/var/log/traefik/access.json"
  format: json
  fields:
    headers:
      names:
        User-Agent: keep
```

| Traefik metric | Analytics use |
|---|---|
| `traefik_entrypoint_requests_total` | Total hits per domain |
| `traefik_service_request_duration_seconds` | Backend response time from gateway perspective |
| `traefik_tls_certs_not_after` | Certificate expiry monitoring |
| Access log `ClientHost` | Geo-IP origin analysis (with MaxMind lookup) |
| Access log `RequestPath` | Most visited pages |

### 4.3 MikroTik router telemetry

Export MikroTik metrics to Prometheus via the **SNMP exporter** or the
**MikroTik REST API exporter**:

```yaml
# docker-compose.monitoring.yml — add SNMP exporter
services:
  mikrotik-exporter:
    image: nshttpd/mikrotik-exporter:latest
    container_name: mikrotik-exporter
    environment:
      - MIKROTIK_ADDRESS=192.168.88.1
      - MIKROTIK_USER=prometheus
      - MIKROTIK_PASSWORD=${MIKROTIK_PROM_PASSWORD}
    ports:
      - "9436:9436"
    networks:
      - monitoring
```

| MikroTik metric | Analytics use |
|---|---|
| Interface bandwidth (rx/tx bytes) | Network utilization trends |
| Active connections count | Concurrent user estimate |
| Firewall rule hit counters | Security event detection |
| DHCP lease count | Connected device count |
| CPU / memory usage | Router health |

### 4.4 Infrastructure telemetry

Docker host metrics from **cAdvisor** and **node-exporter**:

| Metric | Analytics use |
|---|---|
| Container CPU/memory per service | Right-sizing containers |
| Disk I/O on pgdata volume | Database growth forecasting |
| Network traffic between containers | Internal traffic patterns |

---

## 5. AI & Machine Learning Use Cases

All ML runs as **Python scripts or lightweight services** — no GPU cluster
needed. Models train on data exported from PostgreSQL + OTEL.

### 5.1 Adaptive difficulty recommendation

```
Input:  user_id, quiz_type, recent accuracy, recent speed
Output: recommended difficulty (low / medium / hard)
Model:  gradient boosted classifier (scikit-learn)
Data:   quiz_sessions + answers (historical)
```

Replace the current client-side difficulty picker with a server-suggested
default. The teacher can still override.

### 5.2 Weak-topic detection

```
Input:  user's answer history per question template kind
Output: ranked list of weak topic areas
Model:  item response theory (IRT) or simple accuracy pivot
Data:   questions.prompt + answers.is_correct
```

Power a "practice what you missed" feature: after a quiz, suggest the specific
timetable or operation the student struggles with most.

### 5.3 Engagement prediction (churn risk)

```
Input:  login frequency, session count trend, badge velocity
Output: probability of user going inactive in next 7 days
Model:  logistic regression (scikit-learn)
Data:   quiz_sessions + user_badges + OTEL login events
```

Alert teachers/parents when a student's engagement is declining — trigger a
notification via the existing notification system.

### 5.4 Smart review suggestions

```
Input:  quiz score, student profile, teacher's past review patterns
Output: suggested review template + sentiment
Model:  nearest-neighbor on teacher review history
Data:   quiz_reviews + review_templates
```

Pre-select the most appropriate review template for the teacher based on the
quiz result and student context.

### 5.5 Natural-language quiz feedback (LLM)

```
Input:  quiz results summary, student name, locale (en/hu)
Output: personalized paragraph of encouragement/advice
Model:  local LLM (Ollama + Mistral 7B) or OpenAI API
Data:   quiz_sessions + user profile
```

Generate a personalized comment instead of canned templates. Runs as an
optional API endpoint — falls back to templates if the LLM is unavailable.

### 5.6 Anomaly detection on infrastructure

```
Input:  Prometheus time-series (API latency, error rate, container CPU)
Output: anomaly alerts
Model:  statistical (z-score on sliding window) or Prophet
Data:   Prometheus metrics
```

Detect unusual spikes before they become outages. Feeds into Grafana alerts.

---

## 6. Implementation Phases

| Phase | What | Prerequisites | Effort |
|---|---|---|---|
| **Phase 1** | SQL analytics views + Grafana dashboards on PostgreSQL | Grafana container (from OTEL stack) | 1–2 days |
| **Phase 2** | OTEL instrumentation in FastAPI + collector pipeline | OTEL stack deployed | 2–3 days |
| **Phase 3** | Traefik metrics + access logs → Prometheus/Loki | Traefik gateway deployed | 1 day |
| **Phase 4** | MikroTik exporter → Prometheus | MikroTik REST API credentials | 0.5 day |
| **Phase 5** | DuckDB nightly snapshot + Jupyter notebooks | pg_dump cron job | 0.5 day |
| **Phase 6** | Adaptive difficulty ML model | Phase 1 data | 2–3 days |
| **Phase 7** | Weak-topic detection + practice suggestions | Phase 6 model | 1–2 days |
| **Phase 8** | Engagement prediction + notification integration | Phase 2 OTEL data | 2 days |
| **Phase 9** | LLM-powered quiz feedback (Ollama) | Docker host with 16 GB+ RAM | 1–2 days |

---

## 7. Tool Selection Summary

| Layer | Tool | Why |
|---|---|---|
| **Application DB** | PostgreSQL 16 | Already deployed, rich quiz data |
| **OLAP sidecar** | DuckDB | Zero-server, fast analytics, Parquet-compatible |
| **Metrics store** | Prometheus | Standard for OTEL + Traefik + MikroTik |
| **Log store** | Loki | Lightweight, Grafana-native, label-indexed |
| **Telemetry routing** | OTEL Collector | Vendor-neutral, single pipeline |
| **Visualization** | Grafana | Unified dashboards for all data sources |
| **BI (optional)** | Apache Superset | SQL-based analytics for non-technical admins |
| **ML framework** | scikit-learn | Lightweight, no GPU needed, fits tabular data |
| **LLM (optional)** | Ollama + Mistral 7B | Local, private, no API costs |
| **Orchestration** | cron + Python scripts | Simple — upgrade to Dagster/Airflow if pipeline count grows |

---

## 8. Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   MikroTik ──► mikrotik-exporter ──► Prometheus ──┐                        │
│                                                    │                        │
│   Docker host ──► node-exporter ──► Prometheus ──┐ │                        │
│                  cAdvisor ────────► Prometheus ──┐│ │                        │
│                                                  │││                        │
│   Traefik ──► /metrics endpoint ──► Prometheus ──┤││                        │
│              access.json log ─────► Loki ────────┤││                        │
│                                                  ││▼                        │
│   FastAPI ──► OTEL Collector ──► Prometheus ─────┤│───► Grafana             │
│                               ──► Loki ──────────┘│      dashboards         │
│                                                    │                        │
│   PostgreSQL ──► pg_dump nightly ──► DuckDB ───────┼───► Jupyter / Superset │
│              ──► direct SQL ───────────────────────┘                        │
│                                                                            │
│   DuckDB + scikit-learn ──► ML predictions ──► FastAPI endpoints            │
│   Ollama (Mistral 7B) ──► LLM feedback ──► FastAPI endpoints               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. What This Does NOT Cover

- Enterprise data lake (MinIO / Hadoop / Delta Lake) — overkill for this scale
- Kafka / streaming pipelines — PostgreSQL + OTEL collector is sufficient
- GPU-based deep learning — tabular quiz data fits classical ML
- Multi-cluster observability — single Docker host
- Managed cloud analytics (BigQuery, Snowflake) — self-hosted preference

---

## 10. Multiplayer Data Impact (v4.0)

> Cross-reference: `spec_v4.0_multiplayer.md` Section 13.10

The v4.0 multiplayer mode adds 5 new database tables (`multiplayer_games`,
`multiplayer_players`, `multiplayer_answers`, `multiplayer_chat_messages`,
`multiplayer_game_settings`) that provide a new data source for analytics
and ML models.

### 10.1 New analytical signals

| Signal | Source table | ML model impact |
|---|---|---|
| Accuracy under competitive pressure | `multiplayer_answers` | Different from self-paced solo data — weight separately |
| Engagement intensity | `multiplayer_players` (game count per user) | Strong signal for engagement prediction model |
| Win/loss patterns | `multiplayer_games` (player rankings) | Inform adaptive difficulty differently than solo scores |
| Time-to-answer under pressure | `multiplayer_answers` (time_taken_ms) | Competitive vs. solo response time comparison |
| Social engagement | `multiplayer_chat_messages` | Proxy for student engagement level |

### 10.2 Unified analytics view

The existing analytics queries reference `quiz_sessions` and `answers`.
Multiplayer data lives in separate tables. To avoid duplicating every
analytics query, create a unified SQL view:

```sql
CREATE VIEW all_answers AS
SELECT
    a.id, a.user_id, a.question_id, a.is_correct,
    a.time_taken_ms, 'single' AS mode,
    qs.started_at AS session_time
FROM answers a
JOIN quiz_sessions qs ON a.session_id = qs.id
UNION ALL
SELECT
    ma.id, mp.user_id, ma.question_id, ma.is_correct,
    ma.time_taken_ms, 'multi' AS mode,
    mg.started_at AS session_time
FROM multiplayer_answers ma
JOIN multiplayer_players mp ON ma.player_id = mp.id
JOIN multiplayer_games mg ON mp.game_id = mg.id;
```

This allows ML models to include a `mode` feature and weight competitive
vs. solo performance appropriately.

### 10.3 DuckDB export update

The nightly `pg_dump → DuckDB` pipeline must include the 5 new multiplayer
tables. Update the export script to include:

```bash
pg_dump -U quiz -d quiz -t multiplayer_games -t multiplayer_players \
  -t multiplayer_answers -t multiplayer_chat_messages \
  -t multiplayer_game_settings --data-only | duckdb analytics.db
```
