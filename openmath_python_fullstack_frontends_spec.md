# OpenMath — Python Full-Stack Frontend Spec (Reflex + Streamlit)

**Status:** Draft (March 2026)  
**Depends on:** OpenMath v2.0 FastAPI backend (`python-api/`), shared PostgreSQL 16 database  
**Goal:** Two additional Python-only frontends with minimal code, PrimeNG-comparable look, and easy maintenance

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Framework Analysis](#2-framework-analysis)
3. [Selection Decision](#3-selection-decision)
4. [Shared Backend Strategy](#4-shared-backend-strategy)
5. [Reflex Implementation](#5-reflex-implementation)
6. [Streamlit Implementation](#6-streamlit-implementation)
7. [Feature Scope](#7-feature-scope)
8. [Schema and Data Layer](#8-schema-and-data-layer)
9. [Folder Structure](#9-folder-structure)
10. [Dev Tooling](#10-dev-tooling)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Purpose

OpenMath already has three frontends:

| App | Stack | Complexity | Lines of frontend code |
|-----|-------|-----------|----------------------|
| `nuxt-app/` | Nuxt 4 + Vue 3 + Reka UI | High | ~3,000 |
| `angular-app/` | Angular 18 + PrimeNG 17 | High | ~2,500 |
| `python-app/` | Python CLI (console) | Low | ~800 |

All share the same PostgreSQL database and the same business logic semantics. This spec adds **two more Python-only web frontends** that prove the same product can be delivered with radically less code and no JavaScript at all:

1. **Reflex** — a real component-based web app with proper routing, closest to the Angular experience
2. **Streamlit** — the absolute simplest possible web UI, optimized for zero-friction development

The design priorities are:
- **PrimeNG-comparable look** — polished, professional, not a bare HTML page
- **Less code is better** — every line must earn its place
- **Easy to learn, easy to maintain** — a junior Python developer should be productive in hours, not days

---

## 2. Framework Analysis

### 2.1 Candidates Evaluated

| Framework | What it is | Language | Routing | Components | Styling | Deployment |
|-----------|-----------|----------|---------|------------|---------|-----------|
| **Reflex** | Full-stack Python web framework | Python only | Yes (file-based) | React-based (compiled) | Tailwind + Radix | `reflex deploy` or Docker |
| **Streamlit** | Data app framework | Python only | Multipage (limited) | Built-in widgets | Theme config + CSS | `streamlit run` or Cloud |
| **NiceGUI** | UI framework for Python | Python only | Yes | Quasar/Vue-based | Tailwind | `nicegui.ui.run()` |
| **Dash** | Analytical web apps | Python + callbacks | URL routing | Plotly/Bootstrap | CSS/Bootstrap | WSGI/Gunicorn |
| **Anvil** | Full-stack Python platform | Python only | Yes | Built-in | Built-in themes | Anvil hosting |
| **Gradio** | ML demo interfaces | Python only | Tabs only | Built-in widgets | Theme config | `gradio.launch()` |
| **Panel** | Data app framework | Python only | Limited | HoloViz widgets | CSS | Panel serve |

### 2.2 Evaluation Matrix

Scored 1–5 on each criterion. Weight reflects our priorities.

| Criterion | Weight | Reflex | Streamlit | NiceGUI | Dash | Anvil |
|-----------|--------|--------|-----------|---------|------|-------|
| **PrimeNG-like polish** | 3x | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) | ⭐⭐⭐ (9) | ⭐⭐ (6) | ⭐⭐⭐ (9) |
| **Minimal code** | 3x | ⭐⭐⭐ (9) | ⭐⭐⭐⭐⭐ (15) | ⭐⭐⭐⭐ (12) | ⭐⭐ (6) | ⭐⭐⭐ (9) |
| **Easy to learn** | 2x | ⭐⭐⭐ (6) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐ (8) | ⭐⭐ (4) | ⭐⭐⭐ (6) |
| **Component quality** | 2x | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) | ⭐⭐⭐ (6) | ⭐⭐⭐ (6) | ⭐⭐⭐ (6) |
| **Real routing / SPA feel** | 2x | ⭐⭐⭐⭐⭐ (10) | ⭐⭐ (4) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) | ⭐⭐⭐ (6) |
| **Python ecosystem fit** | 1x | ⭐⭐⭐⭐ (4) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) |
| **Community / docs** | 1x | ⭐⭐⭐ (3) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) |
| **Total** | | **52** | **54** | **50** | **36** | **40** |

### 2.3 Detailed Framework Comparison

#### Reflex — Best for "real web app" feel

**Pros:**
- True SPA with file-based routing and URL parameters — feels like Angular/Next.js
- Components compile to React under the hood — snappy, no full-page reloads
- Built-in state management with `rx.State` — Python classes, reactive vars
- Radix UI primitives + Tailwind CSS — polished, accessible, themeable
- Supports Chakra UI and Shadcn-style component libraries
- Full Python — no JavaScript, TypeScript, or HTML templates to write
- Growing ecosystem: `reflex-chakra`, Shadcn-inspired component sets

**Cons:**
- Newer framework (2023) — smaller community than Streamlit
- State model has a learning curve (reactive vars, event handlers)
- Build step compiles Python → React app (adds complexity)
- Hot reload can be slower than Streamlit

**Code taste — a quiz page in Reflex:**
```python
class QuizState(rx.State):
    current_question: int = 0
    answer: str = ""
    feedback: str = ""

    def submit_answer(self):
        # grade and advance
        ...

def quiz_page():
    return rx.box(
        rx.heading(f"Question {QuizState.current_question + 1}"),
        rx.text(QuizState.prompt_text),
        rx.input(value=QuizState.answer, on_change=QuizState.set_answer),
        rx.button("Submit", on_click=QuizState.submit_answer),
        rx.cond(QuizState.feedback, rx.text(QuizState.feedback)),
    )
```

#### Streamlit — Best for "just ship it"

**Pros:**
- Absolute minimum code — a page is a single `.py` file with linear top-to-bottom flow
- Zero boilerplate — no classes, no decorators, no configuration
- Beautiful defaults out of the box with theme configuration
- Massive community and documentation (Google, Snowflake-backed)
- Built-in components: `st.selectbox`, `st.number_input`, `st.dataframe`, `st.metric`, `st.progress`
- Multipage support via `st.navigation()` or folder structure
- Session state for cross-page persistence (`st.session_state`)

**Cons:**
- Re-runs entire script on every interaction (execution model, not SPA)
- No true URL routing with parameters (page-level only, no `/quiz/uuid`)
- Limited component customization without custom components (which we want to avoid)
- Can feel "data-app-ish" rather than "web-app-ish"
- Not ideal for complex multi-step flows

**Code taste — a quiz page in Streamlit:**
```python
st.title("Quiz")
st.progress(answered / total)
st.subheader(prompt_text)

answer = st.number_input("Your answer:", step=1, key="answer")
if st.button("Submit"):
    is_correct = grade(answer, expected)
    if is_correct:
        st.success("Correct!")
    else:
        st.error(f"Wrong — the answer is {expected}")
```

#### NiceGUI — Honorable mention

Strong contender — Quasar/Vue under the hood gives nice Material Design components, true routing, and a Pythonic API. It sits between Reflex and Streamlit in complexity. Deferred for now to keep the scope to two implementations, but a solid future candidate.

#### Dash — Passed

Callback-based architecture makes it verbose for an interactive quiz app. Excellent for analytics dashboards but over-engineered for our form-heavy pages. Higher code volume than any other candidate.

#### Anvil — Passed

Platform lock-in (Anvil hosting preferred), smaller community, and the drag-and-drop builder doesn't align with our spec-driven, code-first workflow. Good for internal tools but not the right fit here.

---

## 3. Selection Decision

### Selected: Reflex + Streamlit

Two implementations that cover opposite ends of the spectrum:

| Dimension | Reflex (`reflex-app/`) | Streamlit (`streamlit-app/`) |
|-----------|----------------------|----------------------------|
| **Feel** | Real SPA, Angular-like | Data app, notebook-like |
| **Routing** | File-based, URL params | Multipage, session state |
| **State** | `rx.State` classes | `st.session_state` dict |
| **Styling** | Tailwind + Radix/Chakra | Theme config only |
| **Code volume** | ~600–800 lines | ~400–500 lines |
| **Learning curve** | Medium (1–2 days) | Very easy (hours) |
| **Best for** | Showing Python can build real web apps | Fastest possible prototype |
| **Port** | 3001 | 8501 |

Both connect to the **existing FastAPI backend** (`python-api/` on port 8000) via HTTP — no database code in the frontends.

### Why both?

They demonstrate fundamentally different approaches:
- **Reflex** proves that a Python developer can build a polished, component-based web application that rivals Angular — with routing, state management, and Tailwind-powered styling — without writing a single line of JavaScript.
- **Streamlit** proves that the same product can be shipped in under 500 lines of Python with zero configuration, at the cost of a simpler interaction model.

Together they bracket the full spectrum of Python web UI options and provide real data for evaluating tradeoffs.

---

## 4. Shared Backend Strategy

Both frontends are **thin HTTP clients** to the existing FastAPI backend:

```
┌────────────────┐     ┌────────────────┐
│  Reflex :3001  │     │ Streamlit :8501 │
│  (Python SPA)  │     │ (Python app)   │
└───────┬────────┘     └───────┬────────┘
        │                      │
        └──────────┬───────────┘
                   │ HTTP
          ┌────────▼────────┐
          │  FastAPI :8000   │
          │  python-api/     │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  PostgreSQL :5432│
          └─────────────────┘
```

**No database code in Reflex or Streamlit.** All data flows through FastAPI's existing API:

| API call | Endpoint |
|----------|----------|
| List quiz types | `GET /api/quiz-types` |
| List students | `GET /api/students` |
| Get student profile | `GET /api/students/{id}` |
| Update student | `PATCH /api/students/{id}` |
| Create session | `POST /api/sessions` |
| List sessions | `GET /api/sessions` |
| Get session detail | `GET /api/sessions/{id}` |
| Submit answer | `POST /api/answers` |
| Get stats | `GET /api/stats` |
| Get table rows | `GET /api/stats/{table}` |
| Reset data | `POST /api/stats/reset` |

Both frontends use a shared `api_client.py` helper:

```python
import httpx

API_URL = "http://localhost:8000/api"

def get(path: str, params: dict | None = None) -> dict | list:
    r = httpx.get(f"{API_URL}{path}", params=params)
    r.raise_for_status()
    return r.json()

def post(path: str, data: dict) -> dict:
    r = httpx.post(f"{API_URL}{path}", json=data)
    r.raise_for_status()
    return r.json()

def patch(path: str, data: dict) -> dict:
    r = httpx.patch(f"{API_URL}{path}", json=data)
    r.raise_for_status()
    return r.json()
```

---

## 5. Reflex Implementation

### 5.1 Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | Reflex 0.6+ | Python-only SPA with real routing |
| Styling | Tailwind CSS (built-in) | Utility-first, PrimeNG-comparable polish |
| Components | Radix UI primitives (built-in) + reflex-chakra | Accessible, polished |
| HTTP client | httpx | Async-capable, clean API |
| Theme | Custom Tailwind config | Blue primary (matches PrimeNG Lara Light Blue) |

### 5.2 State Management

Reflex uses `rx.State` classes — similar to Angular services but reactive:

```python
class AppState(rx.State):
    """Global state — persists across pages."""
    current_student_id: str = ""
    students: list[dict] = []
    quiz_types: list[dict] = []

    def load_students(self):
        self.students = api_client.get("/students")

    def set_student(self, student_id: str):
        self.current_student_id = student_id

    @rx.var
    def current_student_name(self) -> str:
        match = [s for s in self.students if s["id"] == self.current_student_id]
        return match[0]["name"] if match else "No student"


class QuizState(AppState):
    """Quiz-specific state — extends app state."""
    session_id: str = ""
    questions: list[dict] = []
    current_index: int = 0
    answer: str = ""
    feedback: str = ""
    show_feedback: bool = False

    @rx.var
    def current_question(self) -> dict:
        if self.current_index < len(self.questions):
            return self.questions[self.current_index]
        return {}

    @rx.var
    def progress_percent(self) -> int:
        if not self.questions:
            return 0
        return int(self.current_index / len(self.questions) * 100)

    def submit_answer(self):
        result = api_client.post("/answers", {
            "questionId": self.current_question["id"],
            "sessionId": self.session_id,
            "value": int(self.answer),
        })
        self.show_feedback = True
        self.feedback = "Correct!" if result["isCorrect"] else f"Wrong — answer is {result['correctValue']}"

    def next_question(self):
        self.current_index += 1
        self.answer = ""
        self.show_feedback = False
        if self.current_index >= len(self.questions):
            return rx.redirect(f"/history/{self.session_id}")
```

### 5.3 Page Structure

```python
# reflex-app/reflex_app/pages/index.py

@rx.page(route="/", title="OpenMath — Start")
def start_page():
    return layout(
        rx.heading("Start a Quiz", size="6"),
        rx.select(
            [qt["description"] for qt in StartState.quiz_types],
            placeholder="Select quiz type",
            on_change=StartState.set_quiz_type,
        ),
        rx.radio_group(
            ["low", "medium", "hard"],
            value=StartState.difficulty,
            on_change=StartState.set_difficulty,
        ),
        rx.number_input(
            value=StartState.total_questions,
            min_=1, max_=30,
            on_change=StartState.set_total_questions,
        ),
        rx.button("Start Quiz", on_click=StartState.create_session),
    )
```

### 5.4 Layout Component

Shared layout wrapping all pages — header nav + footer:

```python
def layout(*children):
    return rx.box(
        # Header
        rx.flex(
            rx.link("Start", href="/"),
            rx.link("Profile", href="/profile"),
            rx.link("History", href="/history"),
            rx.link("Guide", href="/guide"),
            rx.link("Admin", href="/admin"),
            rx.spacer(),
            rx.select(
                AppState.students,
                value=AppState.current_student_id,
                on_change=AppState.set_student,
            ),
            class_name="bg-white shadow px-6 py-3 flex items-center gap-4",
        ),
        # Content
        rx.box(*children, class_name="max-w-4xl mx-auto p-6"),
        # Footer
        rx.box(
            rx.text("OpenMath v2.0 — Reflex + FastAPI + PostgreSQL", size="1"),
            class_name="text-center text-gray-400 py-4 mt-8",
        ),
    )
```

### 5.5 Styling Strategy

Tailwind utility classes styled to approximate PrimeNG Lara Light Blue:

| PrimeNG element | Reflex/Tailwind equivalent |
|-----------------|--------------------------|
| `p-card` | `rx.box(class_name="bg-white rounded-lg shadow p-6")` |
| `p-button` | `rx.button(class_name="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600")` |
| `p-progressBar` | `rx.progress(value=...)` |
| `p-table` | `rx.data_table(data=..., columns=[...])` |
| `p-dropdown` | `rx.select(items=[...])` |
| `p-tag` (success) | `rx.badge("90%", class_name="bg-green-100 text-green-800 rounded-full px-2")` |
| `p-tag` (danger) | `rx.badge("40%", class_name="bg-red-100 text-red-800 rounded-full px-2")` |

Primary color: `blue-500` (`#3B82F6`) — close to PrimeNG's Lara Light Blue `#3B82F6` (identical).

---

## 6. Streamlit Implementation

### 6.1 Design Philosophy

**Rules for this implementation:**
- **No custom components** — use only built-in Streamlit widgets
- **No custom CSS** beyond theme configuration — keep it pure Streamlit
- **Minimal code** — every page should be under 100 lines
- **Theme config only** for styling

This is intentionally the simplest possible web frontend for OpenMath.

### 6.2 Theme Configuration

Streamlit theme via `.streamlit/config.toml`:

```toml
[theme]
primaryColor = "#3B82F6"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F8FAFC"
textColor = "#1E293B"
font = "sans serif"

[server]
port = 8501
headless = true
```

This produces a clean, modern look that tonally matches the PrimeNG Lara Light Blue palette. No further styling needed.

### 6.3 Multipage Structure

Streamlit multipage apps use a folder convention:

```
streamlit-app/
├── app.py                    # Entry point + navigation
├── api_client.py             # Shared HTTP client
├── pages/
│   ├── 1_Start.py            # Quiz creation
│   ├── 2_Quiz.py             # Quiz taking
│   ├── 3_History.py          # Session history
│   ├── 4_Session_Detail.py   # Session review
│   ├── 5_Profile.py          # Student profile
│   ├── 6_User_Guide.py       # Instructions
│   └── 7_Admin.py            # DB admin
└── .streamlit/
    └── config.toml           # Theme
```

### 6.4 Entry Point

```python
# app.py
import streamlit as st

st.set_page_config(
    page_title="OpenMath",
    page_icon="🧮",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Sidebar navigation (replaces header nav)
st.sidebar.title("🧮 OpenMath")
st.sidebar.divider()

# Student selector in sidebar
students = api_client.get("/students")
student_names = ["No student"] + [s["name"] for s in students]
selected = st.sidebar.selectbox("Active Student", student_names)
if selected != "No student":
    st.session_state["student_id"] = next(s["id"] for s in students if s["name"] == selected)
else:
    st.session_state["student_id"] = None

# Pages registered via folder structure — Streamlit auto-discovers them
```

### 6.5 Start Page Example

```python
# pages/1_Start.py
import streamlit as st
import api_client

st.title("Start a Quiz")

quiz_types = api_client.get("/quiz-types")
qt_options = {qt["description"]: qt["code"] for qt in quiz_types}

selected_qt = st.selectbox("Quiz Type", list(qt_options.keys()))
difficulty = st.radio("Difficulty", ["low", "medium", "hard"], horizontal=True)
total = st.number_input("Number of questions", min_value=1, max_value=30, value=10)

# Timetables (if no active student)
if not st.session_state.get("student_id"):
    st.subheader("New Student")
    name = st.text_input("Name")
    tables = st.multiselect("Learned timetables", list(range(1, 11)), default=list(range(1, 6)))
else:
    name = None
    tables = None

if st.button("Start Quiz", type="primary"):
    payload = {
        "quizTypeCode": qt_options[selected_qt],
        "difficulty": difficulty,
        "totalQuestions": total,
        "studentId": st.session_state.get("student_id"),
        "studentDisplayName": name,
        "learnedTimetables": tables or [1,2,3,4,5],
    }
    result = api_client.post("/sessions", payload)
    st.session_state["active_quiz"] = result
    st.session_state["current_q"] = 0
    st.switch_page("pages/2_Quiz.py")
```

### 6.6 Quiz Page Example

```python
# pages/2_Quiz.py
import streamlit as st
import api_client

quiz = st.session_state.get("active_quiz")
if not quiz:
    st.warning("No active quiz. Go to Start to begin.")
    st.stop()

questions = quiz["questions"]
idx = st.session_state.get("current_q", 0)

if idx >= len(questions):
    st.success("Quiz complete!")
    st.switch_page("pages/3_History.py")
    st.stop()

q = questions[idx]
total = len(questions)

st.title("Quiz")
st.progress((idx) / total, text=f"Question {idx + 1} of {total}")
st.subheader(q["prompt"]["render"])

answer = st.number_input("Your answer:", step=1, key=f"ans_{idx}")

if st.button("Submit", type="primary"):
    result = api_client.post("/answers", {
        "questionId": q["id"],
        "sessionId": quiz["sessionId"],
        "value": int(answer),
    })
    if result["isCorrect"]:
        st.success("✅ Correct!")
    else:
        st.error(f"❌ Wrong — the correct answer is {result['correctValue']}")

    st.session_state["current_q"] = idx + 1
    st.rerun()
```

### 6.7 Streamlit Limitations and Workarounds

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| Full script re-run on interaction | Performance | Use `st.session_state` to cache data |
| No URL params like `/quiz/:id` | Can't bookmark sessions | Use `st.session_state` to pass context between pages |
| No true SPA navigation | Feels like page reloads | `st.switch_page()` is fast enough |
| No `@for` / `@if` template syntax | — | Plain Python `for` / `if` (this is actually simpler) |
| Limited component styling | Less control | Theme config gets 90% there |

---

## 7. Feature Scope

Both implementations target v1.5 feature parity (same as the Nuxt app baseline).

### 7.1 Feature Matrix

| Feature | Reflex | Streamlit | Notes |
|---------|--------|-----------|-------|
| Start page (create session) | ✅ | ✅ | |
| Quiz page (answer questions) | ✅ | ✅ | |
| Feedback (correct/wrong) | ✅ | ✅ | |
| Progress indicator | ✅ | ✅ | |
| History list (grouped by type) | ✅ | ✅ | |
| Session detail | ✅ | ✅ | |
| Student selector | ✅ header | ✅ sidebar | |
| Profile edit | ✅ | ✅ | |
| Performance stats | ✅ | ✅ | |
| User guide | ✅ | ✅ | Static content |
| Admin stats | ✅ | ✅ | |
| Table browser | ✅ | ✅ `st.dataframe` | |
| Reset with confirmation | ✅ | ✅ | |
| Quiz resume (unfinished) | ✅ | ⚠️ limited | Session state only, no URL |
| URL routing with params | ✅ `/quiz/:id` | ❌ | Streamlit limitation |
| Auto-focus answer input | ✅ | ❌ | Streamlit limitation |

### 7.2 Out of Scope

- JSONB v2.0 features (new quiz types beyond `axb` and `axb_plus_cxd`)
- Authentication (v2.1)
- RBAC roles
- Any feature not in v1.5 Nuxt baseline

---

## 8. Schema and Data Layer

**No schema changes.** Both frontends consume the existing FastAPI API which uses the same PostgreSQL database with the same schema (including JSONB columns from migration 0005).

**No ORM, no database access.** All data operations go through `httpx` → FastAPI → asyncpg → PostgreSQL.

Dependencies per app:

| App | Dependencies |
|-----|-------------|
| `reflex-app/` | `reflex`, `httpx` |
| `streamlit-app/` | `streamlit`, `httpx` |

Both are pure Python — no `npm`, no `node_modules`, no TypeScript, no build tools beyond what the framework provides.

---

## 9. Folder Structure

### 9.1 Reflex App

```
reflex-app/
├── requirements.txt           # reflex, httpx
├── rxconfig.py                # Reflex config (port, tailwind theme)
├── reflex_app/
│   ├── __init__.py
│   ├── api_client.py          # Shared HTTP client
│   ├── state.py               # rx.State classes (AppState, QuizState, etc.)
│   ├── layout.py              # Shared header/footer layout
│   ├── styles.py              # Tailwind class constants
│   └── pages/
│       ├── __init__.py
│       ├── index.py           # Start page (/)
│       ├── quiz.py            # Quiz page (/quiz/[session_id])
│       ├── history.py         # History list (/history)
│       ├── session_detail.py  # Session detail (/history/[session_id])
│       ├── profile.py         # Profile (/profile)
│       ├── guide.py           # User guide (/guide)
│       └── admin.py           # Admin (/admin)
└── assets/                    # Static files (logo, etc.)
```

**Estimated total: ~800 lines of Python**

### 9.2 Streamlit App

```
streamlit-app/
├── requirements.txt           # streamlit, httpx
├── app.py                     # Entry point + sidebar nav
├── api_client.py              # Shared HTTP client
├── pages/
│   ├── 1_Start.py
│   ├── 2_Quiz.py
│   ├── 3_History.py
│   ├── 4_Session_Detail.py
│   ├── 5_Profile.py
│   ├── 6_User_Guide.py
│   └── 7_Admin.py
└── .streamlit/
    └── config.toml            # Theme config
```

**Estimated total: ~450 lines of Python**

### 9.3 Code Volume Comparison

| Implementation | Language files | Estimated lines | Config files |
|---------------|--------------|----------------|-------------|
| Angular + PrimeNG | 25 TypeScript | ~2,500 | angular.json, tsconfig, environments |
| Nuxt + Vue | ~20 Vue/TS | ~3,000 | nuxt.config.ts, layers config |
| Reflex | ~10 Python | ~800 | rxconfig.py |
| Streamlit | ~8 Python | ~450 | config.toml |
| Python CLI | ~5 Python | ~800 | — |

Streamlit delivers the full product in **~18% of the Angular code volume**. Reflex does it in **~32%**. Both write zero JavaScript.

---

## 10. Dev Tooling

### 10.1 dev.ps1 Integration

New menu items and CLI modes for dev.ps1:

```
--- Python Frontends ---
23. Reflex: Install dependencies
24. Reflex: Start Dev Server (port 3001)
25. Reflex: Stop Dev Server
26. Streamlit: Install dependencies
27. Streamlit: Start Dev Server (port 8501)
28. Streamlit: Stop Dev Server
```

CLI modes:
```powershell
.\dev.ps1 -Mode install-reflex
.\dev.ps1 -Mode start-reflex
.\dev.ps1 -Mode stop-reflex
.\dev.ps1 -Mode install-streamlit
.\dev.ps1 -Mode start-streamlit
.\dev.ps1 -Mode stop-streamlit
```

### 10.2 Running Manually

```powershell
# Reflex
cd reflex-app
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m reflex run --port 3001

# Streamlit
cd streamlit-app
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m streamlit run app.py --server.port 8501
```

### 10.3 Full Stack (all frontends)

With all services running simultaneously:

| Service | Port | Stack |
|---------|------|-------|
| PostgreSQL | 5432 | Docker |
| Adminer | 8080 | Docker |
| FastAPI | 8000 | `python-api/` (shared backend) |
| Nuxt | 3000 | `nuxt-app/` |
| Angular | 4200 | `angular-app/` |
| Reflex | 3001 | `reflex-app/` |
| Streamlit | 8501 | `streamlit-app/` |

All five frontends share the same FastAPI backend and PostgreSQL database.

---

## 11. Acceptance Criteria

### Reflex App

- [ ] All 7 pages render and are navigable via header links
- [ ] Start page creates a session and navigates to quiz
- [ ] Quiz page shows progress, accepts answers, shows feedback
- [ ] History groups sessions by quiz type
- [ ] Session detail shows question-by-question results
- [ ] Profile loads and saves student data
- [ ] Admin shows stats and supports data reset
- [ ] Student selector in header works across pages
- [ ] Tailwind styling produces a polished, PrimeNG-comparable look
- [ ] URL routing works: `/`, `/quiz/uuid`, `/history`, `/history/uuid`, `/profile`, `/guide`, `/admin`
- [ ] Total Python code under 1,000 lines

### Streamlit App

- [ ] All 7 pages accessible via sidebar navigation
- [ ] Start page creates a session and switches to quiz page
- [ ] Quiz page advances through questions with feedback
- [ ] History shows session table with metrics
- [ ] Session detail shows per-question results
- [ ] Profile edit form works
- [ ] Admin shows stats, table browser, and reset
- [ ] Student selector in sidebar works
- [ ] Theme produces a clean, modern appearance
- [ ] No custom components — only built-in Streamlit widgets
- [ ] Total Python code under 600 lines

### Both

- [ ] Both apps connect to FastAPI on port 8000 (no direct DB access)
- [ ] Both work with the existing PostgreSQL schema (no migrations needed)
- [ ] Both install cleanly into the existing `.venv`
- [ ] `dev.ps1` can start/stop both apps

---

*End of specification — OpenMath Python Full-Stack Frontends (Reflex + Streamlit)*
