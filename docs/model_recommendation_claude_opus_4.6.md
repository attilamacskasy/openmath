# AI Model Recommendation for OpenMath v2.0 Implementation

**Evaluated by:** Claude Opus 4.6  
**Date:** March 5, 2026  
**Context:** Implementing the [OpenMath Angular + FastAPI + PrimeNG Spec](openmath_angular_fastapi_primeng_spec.md)  
**Task scope:** Full-stack app — Angular 18 + PrimeNG frontend, Python FastAPI backend, PostgreSQL JSONB schema migration

---

## Task Complexity Profile

This implementation requires:
- **Angular 18** with standalone components, signals, lazy-loaded routes
- **PrimeNG** component library integration (tables, forms, dialogs)
- **FastAPI** with async PostgreSQL (asyncpg), Pydantic v2 schemas
- **PostgreSQL JSONB** schema design, migration scripts, GIN indexes
- **Business logic** parity with existing Nuxt 4 app (quiz generation, grading, stats aggregation)
- **Multi-file orchestration** across 40+ files in two projects
- **Testing** awareness and idiomatic code patterns

Estimated effort: ~2,000–4,000 lines of production code across backend + frontend.

---

## Models Evaluated

### Tier S — Best for This Task

#### Claude Opus 4.6 `3x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Latest Opus with strongest reasoning and code generation. Excellent multi-file orchestration — can plan, implement, and refactor across dozens of files in a single session. Deep understanding of Angular signals/standalone patterns, FastAPI async patterns, and PostgreSQL JSONB. Produces idiomatic, production-ready code. Strong at maintaining context across long implementation sessions. |
| **Weaknesses** | 3x cost multiplier. Can be slower per response than lighter models. |
| **Verdict** | **Top recommendation for this project.** The complexity and multi-file nature of this spec directly benefits from Opus-tier reasoning. |

#### Claude Opus 4.5 `3x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Proven track record — built the entire Python CLI app in this repo. Excellent at maintaining spec fidelity across long sessions. Strong Angular and FastAPI knowledge. Reliable multi-step task execution. |
| **Weaknesses** | Same 3x cost. Slightly older training data than 4.6, may have less exposure to latest Angular 18 signal patterns and PrimeNG v17+ API changes. |
| **Verdict** | Excellent choice. Nearly equivalent to 4.6 for this task. |

---

### Tier A — Strong Alternatives

#### Claude Sonnet 4.6 `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Best cost/performance ratio for coding. 1x cost with strong code generation. Handles Angular, FastAPI, and SQL well. Faster response times than Opus. Good for iterative development with many small changes. |
| **Weaknesses** | Weaker at very long multi-file planning sessions. May need more guidance on complex JSONB schema decisions. Can lose context in sessions exceeding 30+ tool calls. |
| **Verdict** | **Best value pick.** Use for implementation phases after Opus sets up the architecture. |

#### Claude Sonnet 4.5 `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Reliable, well-tested coding model. Strong TypeScript and Python output. Good at following existing patterns. 1x cost. |
| **Weaknesses** | Older than 4.6 — less familiarity with newest Angular patterns. Slightly less capable at complex reasoning chains. |
| **Verdict** | Solid workhorse. Good for feature-by-feature implementation tasks. |

#### GPT-5.2-Codex `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Purpose-built for code. Strong at generating boilerplate and standard patterns. Good Angular and Python knowledge. 1x cost. |
| **Weaknesses** | Less reliable at maintaining architectural consistency across many files. Can produce subtly non-idiomatic FastAPI patterns. JSONB/PostgreSQL-specific knowledge varies. |
| **Verdict** | Good alternative if switching away from Claude family. |

#### GPT-5.3-Codex `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Latest GPT Codex model. Improved code reasoning over 5.2. Strong TypeScript generation for Angular. 1x cost. |
| **Weaknesses** | Preview-adjacent — may have unexpected edge cases. Less proven than 5.2-Codex for production use. |
| **Verdict** | Worth trying for specific Angular component generation. |

#### Gemini 2.5 Pro `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Very large context window. Good at analyzing specs and generating consistent code. Strong SQL knowledge. 1x cost. |
| **Weaknesses** | Can be verbose. Angular-specific patterns (signals, standalone components) less reliable than Claude/GPT models. FastAPI async patterns sometimes use older conventions. |
| **Verdict** | Good for schema design and SQL migration work specifically. |

---

### Tier B — Usable with Limitations

#### Claude Sonnet 4 `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Stable, fast, 1x cost. Good for simple CRUD implementations. |
| **Weaknesses** | Older model — less familiar with Angular 18 standalone patterns, PrimeNG v17 API. May produce NgModule-based code instead of standalone. |
| **Verdict** | Acceptable for backend-only tasks. Not ideal for Angular frontend work. |

#### GPT-5.1 `1x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | General-purpose strong model. Good reasoning. 1x cost. |
| **Weaknesses** | Not code-specialized — Codex variants are better for this task. Can produce overly abstract architectures. |
| **Verdict** | Use GPT-5.x-Codex variants instead for coding tasks. |

#### GPT-5.1-Codex `1x` ⚠️

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Dedicated coding model. Decent at Angular and Python. |
| **Weaknesses** | Warning icon in UI suggests stability issues. Older than 5.2/5.3 Codex. |
| **Verdict** | Skip — use 5.2-Codex or 5.3-Codex instead. |

#### Gemini 3 Pro (Preview) `1x` ⚠️

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Next-gen Gemini with improved code capabilities. |
| **Weaknesses** | Preview status — may have reliability issues. Warning icon. Less proven for multi-file implementation. |
| **Verdict** | Experimental. Not recommended for production implementation yet. |

#### Gemini 3.1 Pro (Preview) `1x` ⚠️

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Latest Gemini preview. |
| **Weaknesses** | Preview stability concerns. Unproven for Angular 18 + FastAPI stack. |
| **Verdict** | Wait for GA release. |

---

### Tier C — Not Recommended for This Task

#### Claude Haiku 4.5 `0.33x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Very cheap (0.33x). Fast responses. |
| **Weaknesses** | Too lightweight for multi-file full-stack implementation. Will lose architectural coherence. Cannot reliably handle JSONB schema design or Angular signal patterns at this scale. |
| **Verdict** | Use only for trivial fixes, typo corrections, or simple rename operations. |

#### GPT-5 mini `0x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Free. |
| **Weaknesses** | Insufficient reasoning depth for this project scope. Cannot maintain context across complex multi-step implementations. |
| **Verdict** | Not suitable for any part of this implementation. |

#### GPT-4.1 / GPT-4o `0x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Free. Basic code generation works. |
| **Weaknesses** | Older generation — poor Angular 18 awareness. No standalone component patterns. Limited PrimeNG v17 knowledge. FastAPI patterns may be outdated. |
| **Verdict** | Do not use. These will produce legacy Angular code requiring significant rework. |

#### Raptor mini (Preview) `0x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Free. |
| **Weaknesses** | Preview, unknown capability profile for full-stack coding. |
| **Verdict** | Insufficient data. Not recommended for production work. |

#### Gemini 3 Flash (Preview) `0.33x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Cheap, fast. |
| **Weaknesses** | Flash tier prioritizes speed over depth. Will not maintain architectural consistency across this project. |
| **Verdict** | Use only for quick lookups or simple questions. |

#### GPT-5.1-Codex-Max `1x` ⚠️

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Extended compute for complex tasks. |
| **Weaknesses** | Warning icon. "Max" models optimized for single hard problems, not iterative multi-file coding sessions. |
| **Verdict** | Overkill per-request, not suited to interactive coding workflow. |

#### GPT-5.1-Codex-Mini (Preview) `0.33x` ⚠️

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Cheap. |
| **Weaknesses** | Preview + Mini = unreliable for complex full-stack work. |
| **Verdict** | Not recommended. |

#### Grok Code Fast 1 `0.25x`

| Aspect | Assessment |
|--------|------------|
| **Strengths** | Very cheap (0.25x). Fast. |
| **Weaknesses** | Limited training data for Angular 18, PrimeNG, and modern FastAPI patterns. Code quality inconsistent for complex projects. |
| **Verdict** | Not suitable for this implementation. |

---

## Recommended Strategy

### Phase 1: Architecture & Scaffolding
**Use: Claude Opus 4.6 (3x)**

Set up project structure, database schema migrations, FastAPI app skeleton with all routers, Angular app with routing and core services. This phase benefits most from strong reasoning and multi-file orchestration.

Estimated: 1–2 sessions

### Phase 2: Feature Implementation
**Use: Claude Sonnet 4.6 (1x)**

Implement individual features (quiz page, history, profile, admin) one at a time. Each feature is well-scoped and the architecture is already established.

Estimated: 5–8 sessions

### Phase 3: JSONB Migration & New Quiz Types
**Use: Claude Opus 4.6 (3x)**

Complex schema migration, backfill scripts, and grader logic for new answer types require deep reasoning. Switch back to Opus for this phase.

Estimated: 1–2 sessions

### Phase 4: Polish & Testing
**Use: Claude Sonnet 4.6 (1x)**

Bug fixes, UI polish, error handling improvements, test writing. Iterative work well-suited to Sonnet's speed and cost.

Estimated: 3–5 sessions

### Cost Optimization Summary

| Strategy | Estimated Cost Ratio |
|----------|---------------------|
| All Opus 4.6 | ~3.0x baseline |
| All Sonnet 4.6 | ~1.0x baseline |
| **Mixed (recommended)** | **~1.5x baseline** |
| All GPT-5.2-Codex | ~1.0x baseline |
| Budget (Haiku/Flash) | Not viable |

---

## Final Verdict

> **Primary: Claude Opus 4.6** for architecture, schema, and complex logic  
> **Secondary: Claude Sonnet 4.6** for feature implementation and iteration  
> **Alternative: GPT-5.2-Codex or GPT-5.3-Codex** if preferring OpenAI models

The mixed Opus + Sonnet strategy gives the best balance of quality and cost for a project of this scope.

---

*This recommendation was generated by Claude Opus 4.6 based on the available model list in VS Code Copilot as of March 2026. Model capabilities may change with updates.*
