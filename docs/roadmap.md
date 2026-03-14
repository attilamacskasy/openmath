# OpenMath — Roadmap Index & Vision

**Date:** 2026-03-14  
**Author:** Attila Macskasy

---

## Why OpenMath Exists

I am a Multi-Cloud Architect with 28 years in IT. Born as a geek, raised in a family
of mathematicians, architects, professors, and chess champions. Technology was never
just a career for me — it was the language my family spoke.

Today I work inside a large enterprise, designing infrastructure that serves
millions of users. My day-to-day involves Azure Application Gateways in
complex multi-tier setups (the equivalent of AWS Elastic Load Balancer / ALB
in Amazon's world), cross-functional architecture reviews, and advising teams
across security, DevOps, platform engineering, data, and application development.
I am preparing to step into a cross-function architect role — the kind of person
who can walk into any division of an enterprise company and speak their language
with authority and depth.

But there is a gap between *knowing about* systems and *building* them end-to-end.

OpenMath closes that gap.

---

## The Journey

OpenMath started as a simple idea: a math quiz app for kids. My sons — Attila
and Levente — needed a way to practice arithmetic that was more engaging than
worksheets. I built it. Then I kept building.

What began as a weekend project became a deliberate, disciplined engineering
laboratory. I decided to treat OpenMath the way an enterprise treats a
production application — with proper environments (DEV for development, UAT
for performance testing, PROD as a separated secure environment), CI/CD
pipelines, observability, security hardening, and infrastructure-as-code.

Every roadmap document in this folder represents a domain I need to master
hands-on — not just theoretically, but by building it, breaking it, and
rebuilding it on my own infrastructure.

The technology choices are intentional:

- **Self-hosted and open-source first.** I want to understand what the cloud
  services abstract away. If I can build a Traefik-based application gateway
  on bare metal, I understand Azure Application Gateway and AWS ALB at a
  level most architects never reach.
- **On-premises Proxmox lab.** Everything runs on hardware I own — VMs on
  Proxmox, networking on MikroTik, GPUs I purchased with my own money. No
  cloud bill, no abstractions hiding the complexity.
- **Docker today, Kubernetes tomorrow.** The current stack runs on Docker
  Compose. The next step is a self-hosted multi-node Kubernetes cluster with
  Helm-based deployments — the same patterns running in every serious
  production environment worldwide.
- **OpenTelemetry is non-negotiable.** Observability is not an afterthought.
  OTEL is the only vendor-neutral standard that makes sense, and I am building
  the full stack: collector, Prometheus, Loki, Grafana.
- **Security and data protection are top priority.** I work hand-in-hand with
  DevSecOps professionals every day. I understand SAST, DAST, dependency
  scanning, secrets management with HashiCorp Vault, Wazuh SIEM, and
  container hardening. OpenMath implements all of it.
- **AI runs behind my firewall.** I personally invested in 2× NVIDIA RTX 3090
  GPUs, with a Threadripper-based build on the horizon. Open-source LLMs via
  Ollama — zero API costs, complete data sovereignty.
- **CI/CD and IaC are automated end-to-end.** Self-hosted GitLab CE with
  pipelines that lint, test, build, scan, and deploy. The same workflow I
  design for enterprise teams — but this time I own every moving part.

---

## The Objective

By completing every roadmap in this folder, I will have built — with my own
hands — a production-grade, enterprise-pattern application covering:

| Domain | What I learn hands-on |
|---|---|
| **Full-stack development** | Angular + FastAPI + PostgreSQL, REST APIs, JWT auth, RBAC, SSO |
| **Application gateway & TLS** | Reverse proxy, Let's Encrypt automation, routing, rate limiting |
| **Automated testing** | pytest, Playwright, Grafana k6 load testing, contract testing |
| **DevOps & CI/CD** | GitLab CE, container registry, pipeline-as-code, IaC |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Loki, structured logging |
| **Security** | SAST/DAST, Vault, Wazuh SIEM, container hardening, network policy |
| **Container orchestration** | Kubernetes (kubeadm), Helm charts, Calico, Longhorn storage |
| **Data & analytics** | DuckDB OLAP, learning analytics, Prometheus/Loki-derived insights |
| **AI / ML** | On-premises LLM inference, Ollama, RAG pipelines, pgvector |
| **Infrastructure** | Proxmox VE, MikroTik networking, GPU passthrough, NVMe storage |

This is not just career development. This is preparation for what comes next.

---

## The Bigger Purpose

My family roots run through mathematicians, architects, professors, and chess
champions. Education and mentorship are in my DNA. When I reach my 50s, I plan
to transition into education and coaching — following the family tradition of
giving knowledge back.

OpenMath is the foundation for that future. By building it, I gain the depth
to teach every layer of modern IT with real, lived experience. Not slides.
Not certifications. Actual systems I designed, deployed, secured, monitored,
and scaled.

My sons Attila and Levente are the first students. One day, the next generation
of engineers will be too.

---

## Roadmap Documents

Eight roadmap documents define the path from the current Docker-based
deployment to a fully production-grade, enterprise-pattern platform.

### Dependency order

```
roadmap_application_gateway_publish.md     ← foundation (TLS, routing)
    │
    ├── roadmap_automated_testing.md       ← quality gate
    ├── roadmap_devops.md                  ← CI/CD, container registry
    ├── roadmap_observability_otel_monitoring.md  ← telemetry stack
    │
    ├── roadmap_security.md                ← hardening, Vault, Wazuh
    │
    ├── roadmap_data_and_ai.md             ← analytics, ML models
    │   └── roadmap_onpremises_nvidia_ai_ollama.md  ← GPU inference
    │
    └── roadmap_kubernetes_helm.md         ← runtime modernization
```

### Document index

| # | Document | Status | Summary |
|---|---|---|---|
| 1 | [roadmap_application_gateway_publish.md](roadmap_application_gateway_publish.md) | Planned | **Traefik application gateway.** Deploys Traefik as the single entry point for all public domains, terminates HTTPS with auto-managed Let's Encrypt certificates, and routes traffic to internal services. Replaces the current direct port-80 exposure with a proper reverse proxy layer — the self-hosted equivalent of Azure Application Gateway or AWS ALB. |
| 2 | [roadmap_automated_testing.md](roadmap_automated_testing.md) | Planned | **Automated testing & load testing.** Introduces four testing layers across a codebase that currently has zero tests: backend unit/integration tests (pytest + httpx), frontend unit tests (Jest), end-to-end tests (Playwright), and load/performance tests (Grafana k6). Covers all 40+ API endpoints and defines the quality gate for CI/CD. |
| 3 | [roadmap_devops.md](roadmap_devops.md) | Partially implemented | **DevOps & CI/CD pipelines.** Defines the path from the current manual `dev.py` CLI workflow to a fully automated pipeline. Deploys self-hosted GitLab CE with built-in container registry, GitLab Runner for CI/CD jobs, and a pipeline that lints (Semgrep, Trivy), tests (pytest, Jest), builds (Docker), pushes to registry, and deploys via SSH or Helm. The `dev.py` CLI remains the local development tool. |
| 4 | [roadmap_observability_otel_monitoring.md](roadmap_observability_otel_monitoring.md) | Draft | **OpenTelemetry monitoring stack.** Adds four containers to the production deployment — OTEL Collector, Prometheus, Loki, and Grafana — to provide real-time visibility into logged-in users, active sessions, API latency, error rates, and infrastructure health. Standardizes all telemetry output in OTEL format for vendor-neutral portability. |
| 5 | [roadmap_security.md](roadmap_security.md) | Planned | **Security hardening across six layers.** Code scanning (Semgrep SAST, Trivy dependency/image scanning, OWASP ZAP DAST), application hardening (rate limiting, security headers, CSP), secrets management (HashiCorp Vault), container hardening (read-only rootfs, drop all capabilities), security monitoring (Wazuh SIEM integration with OTEL), and MikroTik firewall policies. |
| 6 | [roadmap_data_and_ai.md](roadmap_data_and_ai.md) | Planned | **Data engineering & AI.** Extends OpenMath into analytics and machine learning — SQL-based learning analytics on PostgreSQL, DuckDB for OLAP workloads, OTEL-derived usage metrics, MikroTik telemetry ingestion, and ML models (scikit-learn) for adaptive difficulty, weak-topic detection, engagement prediction, and LLM-powered personalized quiz feedback. |
| 7 | [roadmap_onpremises_nvidia_ai_ollama.md](roadmap_onpremises_nvidia_ai_ollama.md) | Planned | **On-premises GPU-accelerated AI.** Companion to the Data & AI roadmap, focused on the GPU inference platform. Runs Ollama on 2× RTX 3090 (48 GB VRAM) with PCIe passthrough from Proxmox, serving Qwen2.5 72B (math reasoning), DeepSeek-Math 33B, and Llama3.1 8B. Targets a future AMD Threadripper PRO build with 4× GPUs (96 GB VRAM). Includes Open WebUI for admin testing, DCGM/Prometheus GPU monitoring, content safety filtering, and a RAG pipeline with pgvector. |
| 8 | [roadmap_kubernetes_helm.md](roadmap_kubernetes_helm.md) | Planned | **Kubernetes & Helm deployment.** Migrates from single-host Docker Compose to a multi-node kubeadm cluster on Proxmox VMs with Calico CNI (networking + NetworkPolicy), Longhorn distributed storage, Traefik Ingress Controller, cert-manager, External Secrets Operator (Vault integration), and Helm-packaged releases with HPA auto-scaling. Defines the full migration strategy with rollback plan. |

---

## Implementation Sequence

The roadmaps are designed to be tackled incrementally. Each one builds on the
previous, and the application remains functional at every stage.

| Phase | Roadmap | What changes in production |
|---|---|---|
| **Phase 1** | Application Gateway | Traefik terminates TLS, HTTPS live, port 80 no longer exposed directly |
| **Phase 2** | Automated Testing | pytest + Playwright + k6 — quality gate exists, regressions caught |
| **Phase 3** | DevOps & CI/CD | GitLab CE deployed, pipelines automate build/test/deploy, container registry replaces tar file transfers |
| **Phase 4** | Observability | OTEL Collector + Prometheus + Loki + Grafana — real-time dashboards for ops |
| **Phase 5** | Security | Vault replaces .env files, Wazuh connected, containers hardened, code scanning in CI |
| **Phase 6** | Data & AI | Learning analytics dashboards, ML models for adaptive difficulty, LLM-powered feedback |
| **Phase 7** | On-Prem AI | Ollama running on GPU server, quiz feedback and hints powered by local LLMs |
| **Phase 8** | Kubernetes & Helm | Docker Compose replaced by K8s cluster, Helm releases, auto-scaling, zero-downtime deploys |

> **Cross-cutting feature: v4.0 Multiplayer (spec_v4.0_multiplayer.md)**
> The real-time multiplayer mode (WebSocket, in-memory GameManager, 5 new DB
> tables) intersects with most roadmap phases. Key impacts: nginx/Traefik need
> WebSocket proxy config (Phase 1), pytest needs WS fixtures and Playwright
> needs multi-context tests (Phase 2), CI/CD needs graceful WS drain on deploy
> (Phase 3), OTEL needs multiplayer event types and metrics (Phase 4), slowapi
> needs WS exemptions and CSP needs `wss://` verification (Phase 5), multiplayer
> data feeds ML models (Phase 6), and Kubernetes HPA conflicts with in-memory
> game state requiring a `GameBroadcaster` abstraction for future Redis pub/sub
> (Phase 8). See Section 13.5–13.12 of the multiplayer spec for full details.

---

## Current Tech Stack

| Layer | Technology | Status |
|---|---|---|
| **Frontend** | Angular 19 + PrimeNG + Tailwind CSS | Live |
| **Backend** | FastAPI (Python) + asyncpg | Live |
| **Real-time** | WebSocket (FastAPI native) | v4.0 — Multiplayer |
| **Database** | PostgreSQL 16 | Live |
| **Auth** | JWT + Google SSO + bcrypt | Live |
| **Dev tooling** | `dev.py` CLI (InquirerPy) | Live |
| **Containerization** | Docker Compose (prod) | Live |
| **Application gateway** | Traefik v3 | Planned |
| **CI/CD** | GitLab CE (self-hosted) | Planned |
| **Monitoring** | OTEL + Prometheus + Grafana + Loki | Planned |
| **Security** | Vault + Wazuh + Semgrep + Trivy | Planned |
| **Orchestration** | Kubernetes (kubeadm) + Helm | Planned |
| **AI inference** | Ollama + 2× RTX 3090 | Planned |
| **Virtualization** | Proxmox VE | Live |
| **Networking** | MikroTik router | Live |

---

## Guiding Principles

1. **Self-hosted, open-source first.** Every tool is something I can run on
   my own hardware, inspect the source of, and replace if needed.
2. **Enterprise patterns at home-lab scale.** The architecture mirrors what
   runs in production at large companies — same tools, same patterns, smaller
   scale.
3. **Security is not optional.** Every roadmap considers the security
   implications. Data protection, least privilege, encryption at rest and in
   transit.
4. **Observability from day one.** If it runs, it emits telemetry. If it
   emits telemetry, it has a dashboard.
5. **AI stays local.** No student data leaves the network. No cloud API
   dependencies for inference.
6. **Document everything.** Each roadmap is a specification detailed enough
   to implement from scratch. The documentation *is* the architecture.
