# OpenMath — Svelte Frontend Spec (SMUI + Flowbite Svelte)

**Status:** Draft (March 2026)  
**Depends on:** OpenMath v2.0 FastAPI backend (`python-api/`), shared PostgreSQL 16 database  
**Goal:** Two Svelte-based frontends — SMUI (Svelte Material UI, Material Design) and Flowbite Svelte (Tailwind-based) — both backed by the shared FastAPI backend

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Why Svelte?](#2-why-svelte)
3. [Library Analysis](#3-library-analysis)
4. [Selection Decision](#4-selection-decision)
5. [Shared Backend Strategy](#5-shared-backend-strategy)
6. [Common Svelte Foundation](#6-common-svelte-foundation)
7. [SMUI Implementation](#7-smui-implementation)
8. [Flowbite Svelte Implementation](#8-flowbite-svelte-implementation)
9. [Feature Scope](#9-feature-scope)
10. [Folder Structure](#10-folder-structure)
11. [Dev Tooling](#11-dev-tooling)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Purpose

OpenMath now has seven frontend implementations (plus two React ones planned):

| App | Stack | Complexity | Lines of frontend code |
|-----|-------|-----------|----------------------|
| `nuxt-app/` | Nuxt 4 + Vue 3 + Reka UI | High | ~3,000 |
| `angular-app/` | Angular 18 + PrimeNG 17 | High | ~2,500 |
| `react-primereact-app/` | React 19 + PrimeReact | Medium | ~1,300 |
| `react-mui-app/` | React 19 + MUI | Medium | ~1,450 |
| `reflex-app/` | Reflex (Python SPA) | Medium | ~800 |
| `streamlit-app/` | Streamlit (Python data app) | Low | ~450 |
| `python-app/` | Python CLI (console) | Low | ~800 |

This spec adds **two Svelte-based frontends** that explore the fourth major JavaScript framework — the one known for the smallest bundle size, least boilerplate, and most intuitive reactivity model:

1. **SMUI (Svelte Material UI)** — Material Design components for Svelte, comparable to MUI in React and Angular Material
2. **Flowbite Svelte** — Tailwind CSS component library for Svelte, modern utility-first approach

### Design Priorities

- **PrimeNG-comparable look** — polished, professional UI out of the box
- **Less code is better** — Svelte's compiler-based reactivity should deliver the shortest frontend code in the project
- **Easy to learn, easy to maintain** — Svelte has the simplest mental model of any major framework
- **Python backend** — both apps consume the existing FastAPI API (no Node.js backend)

---

## 2. Why Svelte?

### 2.1 Framework Popularity Context

The Stack Overflow question trends chart (2009–2024) reveals the competitive landscape:

```
Framework popularity (% of SO questions, ~2024):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
React     ████████████████████████████  ~4.8%   ← dominant since 2020
Angular   ██████████                    ~2.0%   ← peaked 2019, steady decline
Vue.js    ███                           ~0.6%   ← stable niche
Svelte    █                             ~0.1%   ← small but fastest-growing %
AngularJS ██                            ~0.3%   ← legacy, declining since 2017
```

**Key observations from the chart:**

| Framework | Trend | Peak | Current trajectory |
|-----------|-------|------|--------------------|
| **React** | Dominant | ~6.3% (2022) | Slight decline from peak, still 2–3x any competitor |
| **Angular** | Mature | ~3.2% (2019) | Steady at ~2%, enterprise stronghold |
| **Vue.js** | Stable | ~1.2% (2020) | Plateaued at ~0.6% |
| **Svelte** | Growing | Still rising | Smallest community but steepest growth curve |
| **AngularJS** | Dead | ~3.4% (2016) | Near zero, fully superseded by Angular |

**Why Svelte matters despite low SO numbers:**

1. **Developer satisfaction** — #1 most loved framework in Stack Overflow surveys (2021–2023), #1 in State of JS satisfaction
2. **Smallest bundle size** — Svelte compiles away the framework; output is vanilla JS. A typical Svelte app ships ~30KB vs React's ~140KB
3. **Simplest reactivity** — `let count = 0; count += 1;` is reactive. No `useState`, no `signal()`, no `ref()`. Just assignment
4. **SvelteKit** — full-stack meta-framework (like Next.js/Nuxt) with file-based routing, SSR, and adapters
5. **Growing adoption** — Apple, Spotify, The New York Times, Ikea use Svelte in production
6. **Lowest learning curve** — Svelte components are essentially HTML/CSS/JS with superpowers. A developer who knows HTML can read Svelte immediately

**Why Svelte fits OpenMath:**

OpenMath is a small-to-medium app (7 pages, simple forms, tables, cards). Svelte excels here — its simplicity means less framework overhead and the fewest lines of code. The two Svelte implementations should be the **shortest JavaScript frontend code** in the project.

---

## 3. Library Analysis

### 3.1 Candidates Evaluated

| Library | Description | Styling System | Components | Maturity |
|---------|------------|---------------|------------|----------|
| **SMUI** | Material Design for Svelte | Sass + MDC Web | 30+ core | Stable (2019+) |
| **Flowbite Svelte** | Tailwind CSS components for Svelte | Tailwind CSS | 50+ | Stable (2022+) |
| **Skeleton UI** | Tailwind-based Svelte UI toolkit | Tailwind CSS | 30+ widgets | Growing |
| **Carbon Components Svelte** | IBM Carbon Design for Svelte | Carbon CSS | 60+ | Stable (IBM-backed) |
| **Svelte Headless UI** | Unstyled accessible primitives | BYO (Tailwind) | ~10 | Small |
| **daisyUI** (+ Svelte) | Tailwind component classes | Tailwind CSS | 50+ | Popular |

### 3.2 Quick Comparison

| Library | Similarity to PrimeNG | Popularity | Best For |
|---------|----------------------|------------|----------|
| **SMUI** | ⭐⭐⭐⭐ | Medium | Material Design — closest to MUI/Angular Material |
| **Flowbite Svelte** | ⭐⭐⭐ | Growing fast | Modern Tailwind UI — clean, customizable |
| **Skeleton UI** | ⭐⭐⭐ | Growing | Tailwind + opinionated theming system |
| **Carbon Svelte** | ⭐⭐⭐⭐ | Medium | Enterprise / IBM design language |
| **daisyUI** | ⭐⭐ | High | Quick prototypes with CSS-only components |

### 3.3 Detailed Evaluation Matrix

Scored 1–5 on each criterion. Weight reflects our priorities.

| Criterion | Weight | SMUI | Flowbite Svelte | Skeleton UI | Carbon Svelte | daisyUI |
|-----------|--------|------|-----------------|-------------|---------------|---------|
| **PrimeNG-like polish** | 3x | ⭐⭐⭐⭐ (12) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) | ⭐⭐⭐⭐ (12) | ⭐⭐ (6) |
| **Minimal code** | 3x | ⭐⭐⭐⭐ (12) | ⭐⭐⭐⭐⭐ (15) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) | ⭐⭐⭐⭐ (12) |
| **Easy to learn** | 2x | ⭐⭐⭐ (6) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) | ⭐⭐⭐⭐ (8) |
| **Component quality** | 2x | ⭐⭐⭐⭐ (8) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) |
| **Theming / branding** | 2x | ⭐⭐⭐⭐ (8) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐ (6) | ⭐⭐⭐⭐ (8) |
| **Community / docs** | 1x | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐ (3) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) |
| **Svelte 5 runes support** | 1x | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐⭐ (4) | ⭐⭐ (2) | ⭐⭐⭐⭐⭐ (5) |
| **Total** | | **52** | **63** | **52** | **46** | **49** |

### 3.4 Detailed Library Comparison

#### SMUI (Svelte Material UI) — Material Design done right

**Pros:**
- **Official Material Design** — wraps Google's MDC Web (Material Design Components), matching the MUI/Angular Material look
- **Rich component set** — Button, Card, DataTable, Dialog, Select, Textfield, Radio, Checkbox, LinearProgress, Snackbar, Tabs, and more
- **Sass-based theming** — full Material Design theming with `$mdc-theme-primary`, custom color palettes
- **Accessible** — inherits MDC Web's ARIA implementation
- **Stable and maintained** — actively developed since 2019, regularly updated for Svelte 5
- **Familiar to MUI users** — same design language, similar component names

**Cons:**
- **Sass dependency** — requires `sass` in the build pipeline (Vite handles this, but adds config)
- **Verbose for some components** — Material's structure means `<DataTable>` needs `<Head>`, `<Body>`, `<Row>`, `<Cell>` wrappers
- **Smaller community** than Flowbite Svelte — fewer tutorials, fewer Stack Overflow answers
- **MDC Web can feel heavy** — Material Design's spec is opinionated about spacing, elevation, typography

**Code taste — Start page in SMUI:**
```svelte
<script>
  import Card, { Content } from '@smui/card';
  import Select, { Option } from '@smui/select';
  import Radio from '@smui/radio';
  import Textfield from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import FormField from '@smui/form-field';

  let quizType = 'multiplication_1_10';
  let difficulty = 'medium';
  let total = 10;

  async function startQuiz() { /* ... */ }
</script>

<div class="start-container">
  <Card>
    <Content>
      <h2>Start a Quiz</h2>

      <Select bind:value={quizType} label="Quiz Type">
        {#each quizTypes as qt}
          <Option value={qt.code}>{qt.description}</Option>
        {/each}
      </Select>

      <p class="label">Difficulty</p>
      {#each ['low', 'medium', 'hard'] as d}
        <FormField>
          <Radio bind:group={difficulty} value={d} />
          <span slot="label" class="capitalize">{d}</span>
        </FormField>
      {/each}

      <Textfield bind:value={total} label="Number of questions"
        type="number" input$min="1" input$max="30" />

      <Button variant="raised" on:click={startQuiz}>
        <Label>Start Quiz</Label>
      </Button>
    </Content>
  </Card>
</div>
```

---

#### Flowbite Svelte — Modern Tailwind components

**Pros:**
- **Tailwind CSS foundation** — utility-first, highly customizable, no vendor-specific CSS
- **50+ components** — Button, Card, Table, Modal, Select, Radio, Checkbox, Progressbar, Badge, Navbar, and many more
- **Excellent documentation** — https://flowbite-svelte.com/ has live examples, copy-paste code, dark mode toggles
- **Minimal boilerplate** — components are simple wrappers with sensible defaults
- **Tailwind theming** — customize via `tailwind.config.js`, easy to match PrimeNG Lara Light Blue palette
- **Growing rapidly** — most popular Svelte UI library on npm (2024–2025)
- **Svelte 5 ready** — actively supports runes and the latest Svelte features
- **Dark mode built-in** — toggle between light/dark with one class

**Cons:**
- **Tailwind dependency** — requires PostCSS + Tailwind setup (SvelteKit scaffolding handles this)
- **Less "enterprise" feel** than Material Design — more modern/startup aesthetic by default
- **No advanced DataTable** — `<Table>` is basic HTML table with Tailwind styling (no built-in sorting/pagination)
- **Flowbite brand** — components follow Flowbite's design language, which may not match Material/PrimeNG exactly

**Code taste — Start page in Flowbite Svelte:**
```svelte
<script>
  import { Card, Select, Radio, Label, Input, Button, Helper } from 'flowbite-svelte';

  let quizType = 'multiplication_1_10';
  let difficulty = 'medium';
  let total = 10;

  async function startQuiz() { /* ... */ }
</script>

<div class="flex justify-center">
  <Card size="lg" class="max-w-xl w-full">
    <h2 class="text-xl font-semibold mb-4">Start a Quiz</h2>

    <Label class="mb-1">Quiz Type</Label>
    <Select bind:value={quizType} class="mb-4">
      {#each quizTypes as qt}
        <option value={qt.code}>{qt.description}</option>
      {/each}
    </Select>

    <Label class="mb-1">Difficulty</Label>
    <div class="flex gap-4 mb-4">
      {#each ['low', 'medium', 'hard'] as d}
        <Radio bind:group={difficulty} value={d}>{d}</Radio>
      {/each}
    </div>

    <Label class="mb-1">Number of Questions</Label>
    <Input bind:value={total} type="number" min="1" max="30" class="mb-4" />

    <Button on:click={startQuiz}>Start Quiz</Button>
  </Card>
</div>
```

**Note:** The Flowbite version is noticeably shorter than SMUI. No `<Content>`, `<Label>`, `<FormField>` wrappers — just the component and Tailwind classes.

---

#### Skeleton UI — Honorable Mention

Strong Tailwind-based alternative with an opinionated theming system ("design tokens"). Similar to Flowbite but with a built-in theme generator and more widget-like components (AppBar, AppShell, Table). Deferred to keep scope to two implementations, but a solid candidate if we wanted a third Svelte variant.

#### Carbon Components Svelte — Passed

IBM's Carbon Design System for Svelte. Excellent component quality (60+), but the Carbon aesthetic is very specific — corporate/enterprise, gray-heavy, not easily themed to match PrimeNG Lara Blue. Also has the heaviest learning curve of the Svelte options.

#### daisyUI — Passed

CSS-only component classes on top of Tailwind (`class="btn btn-primary"`). Extremely simple but no JS logic — no `<Select>` with binding, no `<Modal>` with open/close state. Would require writing the interactivity manually, increasing code volume. Better for static sites than interactive quiz apps.

---

## 4. Selection Decision

### Selected: SMUI + Flowbite Svelte

Two implementations demonstrating different styling philosophies within Svelte:

| Dimension | SMUI (`svelte-smui-app/`) | Flowbite Svelte (`svelte-flowbite-app/`) |
|-----------|--------------------------|----------------------------------------|
| **Design language** | Google Material Design 3 | Flowbite / Tailwind modern |
| **Styling system** | Sass + MDC Web classes | Tailwind CSS utilities |
| **Component pattern** | Slotted (`<Label>`, `<Content>`) | Flat (props + Tailwind classes) |
| **Theming** | Sass variables (`$mdc-theme-primary`) | `tailwind.config.js` colors |
| **DataTable** | `<DataTable>` built-in | Manual `<Table>` + `{#each}` |
| **Similarity to PrimeNG** | ⭐⭐⭐⭐ (Material family) | ⭐⭐⭐ (different but polished) |
| **Code volume** | ~900–1,100 lines | ~750–900 lines |
| **Learning curve** | Medium (MDC patterns) | Easy (Tailwind + simple props) |
| **Port** | 5175 | 5176 |

### Why both?

- **SMUI** answers: *"What does OpenMath look like with Material Design in Svelte?"* — directly comparable to the MUI (React) and Angular Material family. Validates that Material Design works across frameworks.
- **Flowbite Svelte** answers: *"What's the absolute simplest Svelte web app we can build?"* — Tailwind utilities + flat component API = least boilerplate in any JavaScript implementation. Should produce the **shortest JS frontend code** in the entire project.

Together they demonstrate that Svelte's compiler-based reactivity reduces code volume regardless of component library choice.

---

## 5. Shared Backend Strategy

Identical to all other frontends — thin SPA clients calling FastAPI:

```
┌────────────────────┐   ┌─────────────────────┐
│  svelte-smui-app   │   │ svelte-flowbite-app  │
│ SvelteKit + SMUI   │   │ SvelteKit + Flowbite │
│      :5175         │   │      :5176           │
└─────────┬──────────┘   └──────────┬───────────┘
          │                         │
          └────────────┬────────────┘
                       │ HTTP (fetch)
              ┌────────▼────────┐
              │  FastAPI :8000   │
              │  python-api/     │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  PostgreSQL :5432│
              └─────────────────┘
```

**No Node.js backend.** SvelteKit is configured as a **static SPA** (`adapter-static`) — the dev server serves Svelte components, but all data comes from FastAPI. No SvelteKit server routes, no `+server.ts` files, no SSR.

### API Endpoints (unchanged)

| API call | Endpoint | Method |
|----------|----------|--------|
| List quiz types | `/api/quiz-types` | GET |
| List students | `/api/students` | GET |
| Get student profile | `/api/students/{id}` | GET |
| Update student | `/api/students/{id}` | PATCH |
| Create session | `/api/sessions` | POST |
| List sessions | `/api/sessions` | GET |
| Get session detail | `/api/sessions/{id}` | GET |
| Submit answer | `/api/answers` | POST |
| Get stats | `/api/stats` | GET |
| Get table rows | `/api/stats/{table}` | GET |
| Reset data | `/api/stats/reset` | POST |

---

## 6. Common Svelte Foundation

### 6.1 Why SvelteKit (not plain Svelte + Vite)

| Feature | SvelteKit | Plain Svelte + Vite |
|---------|-----------|-------------------|
| File-based routing | ✅ `/routes/quiz/[sessionId]/+page.svelte` | ❌ manual router |
| URL params | ✅ `$page.params.sessionId` | ❌ need svelte-routing |
| Layout nesting | ✅ `+layout.svelte` | ❌ manual |
| Dev server + proxy | ✅ `vite.config.ts` | ✅ same |
| Build output | Static SPA via `adapter-static` | Static SPA |

SvelteKit provides file-based routing matching Nuxt and Next.js conventions. No need for a third-party router package.

### 6.2 Tooling

| Tool | Choice | Why |
|------|--------|-----|
| Meta-framework | SvelteKit 2 | File-based routing, layouts, params |
| Language | TypeScript | Type safety, matches other implementations |
| Svelte | Svelte 5 (runes) | Latest stable — `$state`, `$derived`, `$effect` |
| Build tool | Vite 6 (via SvelteKit) | Fastest dev server |
| HTTP | `fetch` (native) | Zero dependencies |
| State | Svelte stores + runes | Built-in — no Redux/Context needed |
| Adapter | `@sveltejs/adapter-static` | SPA mode, no SSR |

### 6.3 Svelte 5 Runes — The Reactivity Advantage

Svelte 5 introduces **runes** — a simpler reactivity model than React hooks or Angular signals:

```svelte
<script lang="ts">
  // React: const [count, setCount] = useState(0);
  // Angular: count = signal(0);
  // Vue: const count = ref(0);
  // Svelte 5:
  let count = $state(0);

  // React: const doubled = useMemo(() => count * 2, [count]);
  // Angular: doubled = computed(() => count() * 2);
  // Vue: const doubled = computed(() => count.value * 2);
  // Svelte 5:
  let doubled = $derived(count * 2);

  // React: useEffect(() => { ... }, [count]);
  // Angular: effect(() => { ... });
  // Svelte 5:
  $effect(() => {
    console.log('count changed:', count);
  });
</script>

<!-- No .value, no (), no signal() — just use the variable -->
<p>{count} × 2 = {doubled}</p>
<button onclick={() => count++}>Increment</button>
```

**This is why Svelte code is shorter.** No wrapper functions, no setter functions, no `.value` accessors. Variables are reactive by default.

### 6.4 Routing Structure

SvelteKit file-based routing maps directly to our pages:

```
src/routes/
├── +layout.svelte              # Header + nav + footer (shared)
├── +layout.ts                  # Root load function (fetch students)
├── +page.svelte                # Start page (/)
├── quiz/
│   └── [sessionId]/
│       └── +page.svelte        # Quiz page (/quiz/:sessionId)
├── history/
│   ├── +page.svelte            # History list (/history)
│   └── [sessionId]/
│       └── +page.svelte        # Session detail (/history/:sessionId)
├── profile/
│   └── +page.svelte            # Profile (/profile)
├── user-guide/
│   └── +page.svelte            # User guide (/user-guide)
└── admin/
    └── +page.svelte            # Admin (/admin)
```

**Compare to Angular:** No `app.routes.ts` to configure. Just create a folder = create a route. URL params like `[sessionId]` are built into the filename.

### 6.5 API Client

Identical pattern to React implementations, adapted for Svelte:

```typescript
// src/lib/api.ts
const API_URL = '/api'; // proxied to localhost:8000

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status}`);
  return res.json();
}

export const api = {
  getQuizTypes: () => get<QuizType[]>('/quiz-types'),
  getStudents: () => get<Student[]>('/students'),
  getStudent: (id: string) => get<StudentDetail>(`/students/${id}`),
  updateStudent: (id: string, data: StudentUpdate) => patch<StudentDetail>(`/students/${id}`, data),
  createSession: (data: CreateSession) => post<SessionCreated>('/sessions', data),
  getSessions: () => get<SessionSummary[]>('/sessions'),
  getSession: (id: string) => get<SessionDetail>(`/sessions/${id}`),
  submitAnswer: (data: SubmitAnswer) => post<AnswerResult>('/answers', data),
  getStats: () => get<Stats>('/stats'),
  getTableRows: (table: string) => get<any[]>(`/stats/${table}`),
  resetData: () => post<void>('/stats/reset', {}),
};
```

### 6.6 Global State (Svelte Store)

Svelte's built-in stores replace React Context and Angular services:

```typescript
// src/lib/stores.ts
import { writable, derived } from 'svelte/store';
import type { Student, ActiveQuiz } from './types';

export const students = writable<Student[]>([]);
export const currentStudentId = writable<string>('');
export const activeQuiz = writable<ActiveQuiz | null>(null);

export const currentStudent = derived(
  [students, currentStudentId],
  ([$students, $id]) => $students.find((s) => s.id === $id) ?? null
);

export async function refreshStudents() {
  const data = await api.getStudents();
  students.set(data);
}
```

**Usage in components:** `$students`, `$currentStudentId` — the `$` prefix auto-subscribes. No `useContext`, no `inject()`, no provider wrappers.

### 6.7 TypeScript Types

Same interfaces as React, stored in `src/lib/types.ts`:

```typescript
// src/lib/types.ts
export interface QuizType {
  id: string;
  code: string;
  description: string;
  answer_type: string;
  template_kind: string;
}

export interface Student { id: string; name: string; }

export interface StudentDetail extends Student {
  age: number | null;
  gender: string | null;
  learned_timetables: number[];
  stats: StudentStats;
}

export interface QuestionPrompt {
  template: Record<string, unknown>;
  answer: { type: string; options?: string[] };
  render: string;
}

export interface QuestionOut {
  id: string;
  sessionId: string;
  position: number;
  prompt: QuestionPrompt;
  correct: number;
  answer: AnswerOut | null;
}

// ... same as React spec
```

### 6.8 Vite Proxy Configuration

```typescript
// vite.config.ts (generated by SvelteKit, extended)
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5175, // or 5176 for Flowbite
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## 7. SMUI Implementation

### 7.1 Dependencies

```json
{
  "dependencies": {
    "@smui/button": "^7.0.0",
    "@smui/card": "^7.0.0",
    "@smui/checkbox": "^7.0.0",
    "@smui/data-table": "^7.0.0",
    "@smui/dialog": "^7.0.0",
    "@smui/form-field": "^7.0.0",
    "@smui/linear-progress": "^7.0.0",
    "@smui/radio": "^7.0.0",
    "@smui/select": "^7.0.0",
    "@smui/textfield": "^7.0.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.0",
    "@sveltejs/kit": "^2.8.0",
    "sass": "^1.80.0",
    "smui-theme": "^7.0.0",
    "svelte": "^5.0.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0"
  }
}
```

### 7.2 Theme Setup

SMUI uses Sass-based Material Design theming:

```scss
// src/theme/_smui-theme.scss
@use '@material/theme/color-palette' as *;

$mdc-theme-primary: #3B82F6;        // Match PrimeNG Lara Light Blue
$mdc-theme-secondary: #64748B;       // Slate 500
$mdc-theme-background: #F8FAFC;      // Slate 50
$mdc-theme-surface: #FFFFFF;
$mdc-theme-on-primary: #FFFFFF;
$mdc-theme-on-secondary: #FFFFFF;
$mdc-theme-on-surface: #1E293B;      // Slate 800
```

### 7.3 Component Mapping (PrimeNG → SMUI)

| PrimeNG / Angular | SMUI / Svelte | Notes |
|---|---|---|
| `<p-card header="...">` | `<Card><Content>` + `<h2>` | SMUI card has no `header` prop |
| `<p-dropdown>` | `<Select><Option>` | Identical pattern |
| `<p-button label="...">` | `<Button><Label>...</Label></Button>` | Slotted label |
| `<p-inputNumber>` | `<Textfield type="number">` | No dedicated InputNumber |
| `<p-progressBar>` | `<LinearProgress progress={x}>` | Similar |
| `<p-radioButton>` | `<Radio bind:group>` + `<FormField>` | Svelte bind:group is cleaner |
| `<p-checkbox>` | `<Checkbox bind:group>` + `<FormField>` | Same |
| `<p-table>` | `<DataTable><Head><Body><Row><Cell>` | More structure, but built-in |
| `<p-tag severity="success">` | `<Chip>` or styled `<span>` | Manual severity styling |
| `<p-dialog>` | `<Dialog><Title><Content><Actions>` | More structured |
| PrimeFlex `flex gap-3` | CSS or Tailwind (not included) | SMUI doesn't include PrimeFlex |

### 7.4 Layout Component

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import Select, { Option } from '@smui/select';
  import { students, currentStudentId, refreshStudents } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => refreshStudents());

  const navLinks = [
    { href: '/', label: 'Start' },
    { href: '/profile', label: 'Profile' },
    { href: '/history', label: 'History' },
    { href: '/user-guide', label: 'User Guide' },
    { href: '/admin', label: 'Admin' },
  ];
</script>

<div class="app-shell">
  <header class="app-header mdc-elevation--z2">
    <nav class="nav-links">
      {#each navLinks as link}
        <a href={link.href}
           class:active={$page.url.pathname === link.href}>
          {link.label}
        </a>
      {/each}
    </nav>
    <div class="student-selector">
      <Select bind:value={$currentStudentId} label="Student">
        <Option value="">No student</Option>
        {#each $students as s}
          <Option value={s.id}>{s.name}</Option>
        {/each}
      </Select>
    </div>
  </header>

  <main class="app-content">
    <slot />
  </main>

  <footer class="app-footer">
    OpenMath v2.0 — SvelteKit + SMUI + FastAPI + PostgreSQL
  </footer>
</div>

<style>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1.5rem;
    background: white;
  }
  .nav-links { display: flex; gap: 1rem; }
  .nav-links a { text-decoration: none; color: #3B82F6; }
  .nav-links a.active { font-weight: 700; }
  .app-content { max-width: 1024px; margin: 0 auto; padding: 1.5rem; }
  .app-footer { text-align: center; color: #94a3b8; padding: 1rem; font-size: 0.85rem; }
</style>
```

**Compare to Angular HeaderComponent:** Same structure — nav links, student selector. But in Svelte: no `@Component` decorator, no `implements OnInit`, no `inject()`. The `$currentStudentId` store auto-binds with `bind:value`. The scoped `<style>` block replaces external CSS files.

### 7.5 Quiz Page Blueprint

```svelte
<!-- src/routes/quiz/[sessionId]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Card, { Content } from '@smui/card';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import LinearProgress from '@smui/linear-progress';
  import { api } from '$lib/api';
  import { activeQuiz } from '$lib/stores';
  import type { QuestionOut } from '$lib/types';

  const sessionId = $page.params.sessionId;

  let questions = $state<QuestionOut[]>([]);
  let currentIndex = $state(0);
  let answeredCount = $state(0);
  let intAnswer = $state('');
  let feedback = $state<{ isCorrect: boolean; correctValue: number } | null>(null);
  let loading = $state(true);

  let current = $derived(questions[currentIndex] ?? null);
  let progress = $derived(questions.length > 0
    ? answeredCount / questions.length
    : 0);

  $effect(() => {
    const active = $activeQuiz;
    if (active?.sessionId === sessionId) {
      questions = active.questions;
      loading = false;
    } else {
      api.getSession(sessionId).then((detail) => {
        const unanswered = detail.questions.filter((q) => !q.answer);
        questions = unanswered;
        answeredCount = detail.questions.length - unanswered.length;
        loading = false;
      });
    }
  });

  async function submitAnswer() {
    if (!current) return;
    const result = await api.submitAnswer({
      questionId: current.id,
      response: { raw: intAnswer, parsed: { type: 'int', value: Number(intAnswer) } },
    });
    feedback = { isCorrect: result.isCorrect, correctValue: result.correctValue };
    answeredCount++;
  }

  function nextQuestion() {
    feedback = null;
    intAnswer = '';
    if (currentIndex + 1 >= questions.length) {
      goto(`/history/${sessionId}`);
    } else {
      currentIndex++;
    }
  }
</script>

{#if loading}
  <p class="center muted">Loading quiz...</p>
{:else if !current}
  <p class="center muted">No questions available.</p>
{:else}
  <div class="quiz-container">
    <div class="progress-row">
      <span class="muted">Question {answeredCount + 1} of {questions.length}</span>
    </div>
    <LinearProgress progress={progress} />

    <Card>
      <Content>
        <h2 class="question-text">{current.prompt.render}</h2>

        <div class="answer-row">
          <Textfield bind:value={intAnswer} label="Your answer"
            type="number" style="width: 200px; font-size: 1.5rem;"
            on:keydown={(e) => e.key === 'Enter' && submitAnswer()} />
        </div>

        {#if feedback}
          <div class="feedback" class:correct={feedback.isCorrect}
               class:wrong={!feedback.isCorrect}>
            {#if feedback.isCorrect}
              Correct! ✓
            {:else}
              Wrong — correct answer is {feedback.correctValue}
            {/if}
          </div>
        {/if}

        <div class="button-row">
          {#if !feedback}
            <Button variant="raised" on:click={submitAnswer} disabled={!intAnswer}>
              <Label>Submit</Label>
            </Button>
          {:else}
            <Button variant="raised" on:click={nextQuestion}>
              <Label>Next</Label>
            </Button>
          {/if}
        </div>
      </Content>
    </Card>
  </div>
{/if}

<style>
  .quiz-container { max-width: 700px; margin: 0 auto; }
  .progress-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
  .question-text { text-align: center; margin: 1rem 0; }
  .answer-row { display: flex; justify-content: center; margin: 1rem 0; }
  .button-row { display: flex; justify-content: center; margin-top: 1rem; }
  .feedback { padding: 1rem; border-radius: 8px; text-align: center; font-weight: 600; font-size: 1.1rem; margin-top: 1rem; }
  .correct { background: #dcfce7; color: #166534; }
  .wrong { background: #fee2e2; color: #991b1b; }
  .muted { color: #94a3b8; }
  .center { text-align: center; }
</style>
```

**Line count comparison:** This Svelte quiz page is ~85 lines. The equivalent Angular page is ~200 lines. The equivalent React PrimeReact page is ~120 lines. Svelte's reactivity model (`$state`, `$derived`, `$effect`) and scoped styles eliminate significant boilerplate.

---

## 8. Flowbite Svelte Implementation

### 8.1 Dependencies

```json
{
  "dependencies": {
    "flowbite-svelte": "^0.47.0",
    "flowbite-svelte-icons": "^1.6.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.0",
    "@sveltejs/kit": "^2.8.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "svelte": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0"
  }
}
```

### 8.2 Tailwind Theme Configuration

```javascript
// tailwind.config.js
import flowbitePlugin from 'flowbite/plugin';

export default {
  content: [
    './src/**/*.{html,svelte,js,ts}',
    './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',   // PrimeNG Lara Light Blue primary
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },
    },
  },
  plugins: [flowbitePlugin],
};
```

### 8.3 Component Mapping (PrimeNG → Flowbite Svelte)

| PrimeNG / Angular | Flowbite Svelte | Notes |
|---|---|---|
| `<p-card header="...">` | `<Card><h2>...</h2>` | Simple wrapper |
| `<p-dropdown>` | `<Select>` with `<option>` | HTML-native select enhanced |
| `<p-button label="...">` | `<Button>...</Button>` | Children as label |
| `<p-inputNumber>` | `<Input type="number">` | Standard input |
| `<p-progressBar>` | `<Progressbar progress={x}>` | Similar |
| `<p-radioButton>` | `<Radio bind:group>` | Cleaner than PrimeNG |
| `<p-checkbox>` | `<Checkbox bind:group>` | Same |
| `<p-table>` | `<Table><TableHead><TableBody><TableBodyRow><TableBodyCell>` | Manual structure |
| `<p-tag severity="success">` | `<Badge color="green">` | Different naming |
| `<p-dialog>` | `<Modal>` | Simple open/close |
| PrimeFlex `flex gap-3` | `class="flex gap-3"` | Tailwind (identical CSS) |

**Key advantage:** Flowbite's Tailwind classes are nearly identical to PrimeFlex utility names. `flex`, `gap-3`, `justify-center`, `items-center`, `p-4`, `text-sm` — they're the same strings.

### 8.4 Layout Component

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { Navbar, NavBrand, NavUl, NavLi, Select } from 'flowbite-svelte';
  import { students, currentStudentId, refreshStudents } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => refreshStudents());
</script>

<div class="min-h-screen flex flex-col">
  <Navbar class="shadow">
    <NavBrand href="/">
      <span class="text-xl font-semibold text-primary-600">🧮 OpenMath</span>
    </NavBrand>
    <NavUl>
      <NavLi href="/" active={$page.url.pathname === '/'}>Start</NavLi>
      <NavLi href="/profile" active={$page.url.pathname === '/profile'}>Profile</NavLi>
      <NavLi href="/history" active={$page.url.pathname === '/history'}>History</NavLi>
      <NavLi href="/user-guide" active={$page.url.pathname === '/user-guide'}>User Guide</NavLi>
      <NavLi href="/admin" active={$page.url.pathname === '/admin'}>Admin</NavLi>
    </NavUl>
    <Select bind:value={$currentStudentId} class="w-48" size="sm">
      <option value="">No student</option>
      {#each $students as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </Select>
  </Navbar>

  <main class="flex-1 max-w-5xl mx-auto w-full p-6">
    <slot />
  </main>

  <footer class="text-center text-gray-400 text-sm py-4">
    OpenMath v2.0 — SvelteKit + Flowbite Svelte + FastAPI + PostgreSQL
  </footer>
</div>
```

**Note:** Flowbite's `<Navbar>` component includes responsive hamburger menu and mobile drawer out of the box — free responsive layout. The Angular PrimeNG header doesn't have this. Zero extra code.

### 8.5 Quiz Page Blueprint

```svelte
<!-- src/routes/quiz/[sessionId]/+page.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Card, Button, Input, Progressbar, Label } from 'flowbite-svelte';
  import { CheckOutline, ArrowRightOutline } from 'flowbite-svelte-icons';
  import { api } from '$lib/api';
  import { activeQuiz } from '$lib/stores';
  import type { QuestionOut } from '$lib/types';

  const sessionId = $page.params.sessionId;

  let questions = $state<QuestionOut[]>([]);
  let currentIndex = $state(0);
  let answeredCount = $state(0);
  let answer = $state('');
  let feedback = $state<{ isCorrect: boolean; correctValue: number } | null>(null);
  let loading = $state(true);

  let current = $derived(questions[currentIndex] ?? null);
  let progress = $derived(questions.length > 0
    ? Math.round((answeredCount / questions.length) * 100)
    : 0);

  $effect(() => {
    const active = $activeQuiz;
    if (active?.sessionId === sessionId) {
      questions = active.questions;
      loading = false;
    } else {
      api.getSession(sessionId).then((detail) => {
        const unanswered = detail.questions.filter((q) => !q.answer);
        questions = unanswered;
        answeredCount = detail.questions.length - unanswered.length;
        loading = false;
      });
    }
  });

  async function submitAnswer() {
    if (!current) return;
    const result = await api.submitAnswer({
      questionId: current.id,
      response: { raw: answer, parsed: { type: 'int', value: Number(answer) } },
    });
    feedback = { isCorrect: result.isCorrect, correctValue: result.correctValue };
    answeredCount++;
  }

  function nextQuestion() {
    feedback = null;
    answer = '';
    if (currentIndex + 1 >= questions.length) {
      goto(`/history/${sessionId}`);
    } else {
      currentIndex++;
    }
  }
</script>

{#if loading}
  <p class="text-center text-gray-400">Loading quiz...</p>
{:else if !current}
  <p class="text-center text-gray-400">No questions available.</p>
{:else}
  <div class="max-w-2xl mx-auto">
    <div class="flex justify-between mb-1">
      <span class="text-sm text-gray-500">Question {answeredCount + 1} of {questions.length}</span>
    </div>
    <Progressbar {progress} size="h-2" class="mb-4" />

    <Card size="lg">
      <h2 class="text-3xl font-bold text-center my-4">{current.prompt.render}</h2>

      <div class="flex justify-center my-4">
        <Input bind:value={answer} type="number" placeholder="Your answer"
          class="w-48 text-center text-xl"
          on:keydown={(e) => e.key === 'Enter' && submitAnswer()} />
      </div>

      {#if feedback}
        <div class="p-3 rounded-lg text-center text-lg font-semibold mt-3"
             class:bg-green-100={feedback.isCorrect}
             class:text-green-800={feedback.isCorrect}
             class:bg-red-100={!feedback.isCorrect}
             class:text-red-800={!feedback.isCorrect}>
          {#if feedback.isCorrect}
            Correct! ✓
          {:else}
            Wrong — correct answer is {feedback.correctValue}
          {/if}
        </div>
      {/if}

      <div class="flex justify-center mt-4">
        {#if !feedback}
          <Button on:click={submitAnswer} disabled={!answer}>
            <CheckOutline class="w-4 h-4 mr-2" /> Submit
          </Button>
        {:else}
          <Button on:click={nextQuestion}>
            Next <ArrowRightOutline class="w-4 h-4 ml-2" />
          </Button>
        {/if}
      </div>
    </Card>
  </div>
{/if}
```

**Line count:** ~80 lines including the script. This is the shortest quiz page across all implementations:

| Implementation | Quiz page lines |
|---------------|----------------|
| Angular + PrimeNG | ~200 |
| React + PrimeReact | ~120 |
| React + MUI | ~130 |
| SMUI (Svelte) | ~85 |
| **Flowbite Svelte** | **~80** |
| Streamlit (Python) | ~35 |

### 8.6 History Page — Table Comparison

**Flowbite Svelte table:**
```svelte
<Table hoverable>
  <TableHead>
    <TableHeadCell>Student</TableHeadCell>
    <TableHeadCell>Difficulty</TableHeadCell>
    <TableHeadCell>Questions</TableHeadCell>
    <TableHeadCell>Score</TableHeadCell>
    <TableHeadCell>Started</TableHeadCell>
  </TableHead>
  <TableBody>
    {#each sessions as row}
      <TableBodyRow>
        <TableBodyCell>{row.student_name ?? '—'}</TableBodyCell>
        <TableBodyCell>
          <a href="/history/{row.id}" class="text-primary-600 underline">{row.difficulty}</a>
        </TableBodyCell>
        <TableBodyCell>{row.total_questions}</TableBodyCell>
        <TableBodyCell>
          <Badge color={row.score_percent >= 70 ? 'green' : 'red'}>
            {row.score_percent}%
          </Badge>
        </TableBodyCell>
        <TableBodyCell>{new Date(row.started_at).toLocaleString()}</TableBodyCell>
      </TableBodyRow>
    {/each}
  </TableBody>
</Table>
```

**SMUI DataTable:**
```svelte
<DataTable>
  <Head>
    <Row>
      <Cell>Student</Cell>
      <Cell>Difficulty</Cell>
      <Cell>Questions</Cell>
      <Cell>Score</Cell>
      <Cell>Started</Cell>
    </Row>
  </Head>
  <Body>
    {#each sessions as row}
      <Row>
        <Cell>{row.student_name ?? '—'}</Cell>
        <Cell><a href="/history/{row.id}">{row.difficulty}</a></Cell>
        <Cell>{row.total_questions}</Cell>
        <Cell>
          <span class="score-badge" class:success={row.score_percent >= 70}
                class:danger={row.score_percent < 70}>
            {row.score_percent}%
          </span>
        </Cell>
        <Cell>{new Date(row.started_at).toLocaleString()}</Cell>
      </Row>
    {/each}
  </Body>
</DataTable>
```

Both are similar in length — Svelte's `{#each}` syntax is nearly identical between libraries.

---

## 9. Feature Scope

### 9.1 Feature Matrix

| Feature | SMUI | Flowbite Svelte | Notes |
|---------|------|-----------------|-------|
| Start page (create session) | ✅ | ✅ | |
| Quiz page (answer questions) | ✅ | ✅ | |
| Feedback (correct/wrong) | ✅ | ✅ | |
| Progress indicator | ✅ | ✅ | |
| History list (grouped by type) | ✅ | ✅ | |
| Session detail | ✅ | ✅ | |
| Student selector in header | ✅ | ✅ Navbar | Flowbite includes responsive nav |
| Profile edit | ✅ | ✅ | |
| Performance stats | ✅ | ✅ | |
| User guide | ✅ | ✅ | |
| Admin stats | ✅ | ✅ | |
| Table browser | ✅ | ✅ | |
| Reset with confirmation | ✅ `<Dialog>` | ✅ `<Modal>` | |
| URL routing with params | ✅ SvelteKit | ✅ SvelteKit | |
| Auto-focus answer input | ✅ | ✅ | `use:action` directive |
| Quiz resume (unfinished) | ✅ | ✅ | |
| Responsive mobile layout | ⚠️ manual | ✅ built-in | Flowbite Navbar handles this |

### 9.2 Out of Scope

- New v2.0 JSONB quiz types beyond `axb` and `axb_plus_cxd`
- Authentication (v2.1)
- RBAC roles
- Server-side rendering (both run as SPA with `adapter-static`)

---

## 10. Folder Structure

### 10.1 SMUI App

```
svelte-smui-app/
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
├── static/
│   └── favicon.ico
└── src/
    ├── app.html                        # HTML shell
    ├── app.d.ts                        # SvelteKit types
    ├── theme/
    │   └── _smui-theme.scss            # Material Design color config
    ├── lib/
    │   ├── api.ts                      # Typed fetch wrappers
    │   ├── stores.ts                   # Svelte stores (students, activeQuiz)
    │   ├── types.ts                    # TypeScript interfaces
    │   └── utils.ts                    # formatDuration helper
    └── routes/
        ├── +layout.svelte              # Header + nav + footer
        ├── +page.svelte                # Start page (/)
        ├── quiz/
        │   └── [sessionId]/
        │       └── +page.svelte        # Quiz (/quiz/:id)
        ├── history/
        │   ├── +page.svelte            # History list (/history)
        │   └── [sessionId]/
        │       └── +page.svelte        # Session detail (/history/:id)
        ├── profile/
        │   └── +page.svelte            # Profile (/profile)
        ├── user-guide/
        │   └── +page.svelte            # User guide
        └── admin/
            └── +page.svelte            # Admin

```

**Estimated:** ~15 files, ~1,000 lines

### 10.2 Flowbite Svelte App

```
svelte-flowbite-app/
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js                  # Tailwind + Flowbite plugin
├── postcss.config.js                   # PostCSS for Tailwind
├── static/
│   └── favicon.ico
└── src/
    ├── app.html
    ├── app.css                         # @tailwind directives
    ├── app.d.ts
    ├── lib/
    │   ├── api.ts                      # Typed fetch wrappers (identical)
    │   ├── stores.ts                   # Svelte stores (identical)
    │   ├── types.ts                    # TypeScript interfaces (identical)
    │   └── utils.ts                    # formatDuration (identical)
    └── routes/
        ├── +layout.svelte              # Navbar + footer
        ├── +page.svelte                # Start page
        ├── quiz/
        │   └── [sessionId]/
        │       └── +page.svelte
        ├── history/
        │   ├── +page.svelte
        │   └── [sessionId]/
        │       └── +page.svelte
        ├── profile/
        │   └── +page.svelte
        ├── user-guide/
        │   └── +page.svelte
        └── admin/
            └── +page.svelte
```

**Estimated:** ~16 files, ~800 lines

### 10.3 Code Volume Comparison (all implementations)

| Implementation | Language | Files | Estimated Lines | Framework overhead |
|---------------|----------|-------|----------------|-------------------|
| Nuxt + Vue 3 | Vue/TS | ~20 | ~3,000 | Layers, composables, Nitro |
| Angular + PrimeNG | TypeScript | 25 | ~2,500 | Modules, decorators, DI |
| React + MUI | TSX | ~15 | ~1,450 | Context, sx prop |
| React + PrimeReact | TSX | ~14 | ~1,300 | Context, PrimeFlex |
| **Svelte + SMUI** | Svelte/TS | ~15 | **~1,000** | Sass theme |
| **Svelte + Flowbite** | Svelte/TS | ~16 | **~800** | Tailwind config |
| Reflex (Python) | Python | ~10 | ~800 | rxconfig.py |
| Streamlit (Python) | Python | ~8 | ~450 | config.toml |
| Python CLI | Python | ~5 | ~800 | — |

**Flowbite Svelte** delivers the same product in **~32% of Angular code** and **~62% of React PrimeReact code**. It's the **shortest JavaScript frontend** in the project, rivaling the Python Reflex implementation.

The reduction comes from:
- **Svelte's compiler** — no virtual DOM, no `useState`/`setState`, no `useEffect`. Just `$state` and `$derived`
- **Scoped styles** — `<style>` block in each component, no CSS modules or styled-components
- **File-based routing** — no router config file, no `Routes` component
- **Built-in stores** — no Context API, no provider wrappers
- **Less boilerplate** — no `export default`, no `defineComponent()`, no `@Component()` decorator

### 10.4 Shared Files Between the Two Svelte Apps

| File | Purpose | Lines |
|------|---------|-------|
| `lib/api.ts` | Typed API client | ~50 |
| `lib/stores.ts` | Svelte stores | ~25 |
| `lib/types.ts` | TypeScript interfaces | ~80 |
| `lib/utils.ts` | Duration formatting | ~15 |

**~170 lines of shared logic** — even less than the React shared code because Svelte stores are more concise than React Context.

---

## 11. Dev Tooling

### 11.1 dev.ps1 Integration

New menu items:

```
--- Svelte Frontends ---
35. Svelte SMUI: Install dependencies
36. Svelte SMUI: Start Dev Server (port 5175)
37. Svelte SMUI: Stop Dev Server
38. Svelte Flowbite: Install dependencies
39. Svelte Flowbite: Start Dev Server (port 5176)
40. Svelte Flowbite: Stop Dev Server
```

CLI modes:
```powershell
.\dev.ps1 -Mode install-svelte-smui
.\dev.ps1 -Mode start-svelte-smui
.\dev.ps1 -Mode stop-svelte-smui
.\dev.ps1 -Mode install-svelte-flowbite
.\dev.ps1 -Mode start-svelte-flowbite
.\dev.ps1 -Mode stop-svelte-flowbite
```

### 11.2 Running Manually

```powershell
# SMUI
cd svelte-smui-app
npm install
npm run dev -- --port 5175

# Flowbite Svelte
cd svelte-flowbite-app
npm install
npm run dev -- --port 5176
```

### 11.3 Full Stack (all frontends)

With all services running simultaneously:

| Service | Port | Stack |
|---------|------|-------|
| PostgreSQL | 5432 | Docker |
| Adminer | 8080 | Docker |
| FastAPI | 8000 | `python-api/` (shared backend) |
| Nuxt | 3000 | `nuxt-app/` |
| Reflex | 3001 | `reflex-app/` |
| Angular | 4200 | `angular-app/` |
| React + PrimeReact | 5173 | `react-primereact-app/` |
| React + MUI | 5174 | `react-mui-app/` |
| **Svelte + SMUI** | **5175** | `svelte-smui-app/` |
| **Svelte + Flowbite** | **5176** | `svelte-flowbite-app/` |
| Streamlit | 8501 | `streamlit-app/` |

All nine frontends share the same FastAPI backend and PostgreSQL database.

---

## 12. Acceptance Criteria

### SMUI App (`svelte-smui-app/`)

- [ ] All 7 pages render and are navigable via header links
- [ ] Start page creates a session and navigates to quiz
- [ ] Quiz page shows progress, accepts answers, shows correct/wrong feedback
- [ ] Quiz page auto-focuses the answer input
- [ ] History groups sessions by quiz type with `<DataTable>`
- [ ] Session detail shows question-by-question results
- [ ] Profile loads and saves student data
- [ ] Admin shows stats cards, table browser, and reset with confirmation `<Dialog>`
- [ ] Student selector in header works and persists across navigation
- [ ] Material Design theme with blue-500 primary produces a polished look
- [ ] SvelteKit file-based routing: `/`, `/quiz/[sessionId]`, `/history`, `/history/[sessionId]`, `/profile`, `/user-guide`, `/admin`
- [ ] All data flows through FastAPI on port 8000 (no direct DB access)
- [ ] Total Svelte/TS code under 1,200 lines

### Flowbite Svelte App (`svelte-flowbite-app/`)

- [ ] All 7 pages render and are navigable via `<Navbar>`
- [ ] Start page creates a session and navigates to quiz
- [ ] Quiz page shows progress, accepts answers, shows correct/wrong feedback
- [ ] Quiz page auto-focuses the answer input
- [ ] History shows session tables with `<Badge>` score indicators
- [ ] Session detail shows per-question results
- [ ] Profile loads and saves student data
- [ ] Admin shows stats, table browser, and reset with confirmation `<Modal>`
- [ ] Student selector in navbar works and persists across navigation
- [ ] Navbar is responsive (hamburger menu on mobile) without extra code
- [ ] Tailwind theme with blue-500 primary produces a clean, modern appearance
- [ ] SvelteKit file-based routing works for all 7 routes
- [ ] All data flows through FastAPI on port 8000 (no direct DB access)
- [ ] Total Svelte/TS code under 1,000 lines

### Both

- [ ] Vite dev server proxies `/api` to FastAPI (no CORS issues)
- [ ] TypeScript strict mode enabled
- [ ] SvelteKit configured with `adapter-static` (SPA mode, no SSR)
- [ ] Works with the existing PostgreSQL schema (no migrations needed)
- [ ] `dev.ps1` can start/stop both apps
- [ ] Shared files (api, stores, types, utils) are identical between the two apps

---

*End of specification — OpenMath Svelte Frontends (SMUI + Flowbite Svelte)*
