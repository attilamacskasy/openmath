# OpenMath — React Frontend Spec (PrimeReact + MUI)

**Status:** Draft (March 2026)  
**Depends on:** OpenMath v2.0 FastAPI backend (`python-api/`), shared PostgreSQL 16 database  
**Goal:** Two React-based frontends — PrimeReact (closest to existing PrimeNG/Angular) and MUI (most popular React component library) — both backed by the shared FastAPI backend

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Library Analysis](#2-library-analysis)
3. [Selection Decision](#3-selection-decision)
4. [Shared Backend Strategy](#4-shared-backend-strategy)
5. [Common React Foundation](#5-common-react-foundation)
6. [PrimeReact Implementation](#6-primereact-implementation)
7. [MUI Implementation](#7-mui-implementation)
8. [Feature Scope](#8-feature-scope)
9. [Folder Structure](#9-folder-structure)
10. [Dev Tooling](#10-dev-tooling)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Purpose

OpenMath now has five frontend implementations:

| App | Stack | Complexity | Lines of frontend code |
|-----|-------|-----------|----------------------|
| `nuxt-app/` | Nuxt 4 + Vue 3 + Reka UI | High | ~3,000 |
| `angular-app/` | Angular 18 + PrimeNG 17 | High | ~2,500 |
| `python-app/` | Python CLI (console) | Low | ~800 |
| `reflex-app/` | Reflex (Python SPA) | Medium | ~800 |
| `streamlit-app/` | Streamlit (Python data app) | Low | ~450 |

This spec adds **two React-based frontends** that demonstrate how the same product looks when built with different component libraries on the most popular JavaScript UI framework:

1. **PrimeReact** — the React port of PrimeNG, giving near-identical look and API to the existing Angular implementation
2. **MUI (Material UI)** — the most popular React component library, bringing Google Material Design aesthetics

### Design Priorities

- **PrimeNG-comparable look** — polished, professional UI out of the box
- **Less code is better** — React functional components + hooks should be concise
- **Easy to learn, easy to maintain** — a developer familiar with React basics should be productive immediately
- **Python backend** — both apps consume the existing FastAPI API (no Node.js backend)

---

## 2. Library Analysis

### 2.1 Candidates Evaluated

| Library | Description | Styling System | Component Count | Theming |
|---------|------------|---------------|----------------|---------|
| **PrimeReact** | React port of PrimeNG | PrimeFlex + CSS themes | 90+ | Lara, Aura, Material, 40+ themes |
| **MUI** | Material Design for React | Emotion/styled-components | 60+ | `createTheme()`, CSS variables |
| **Ant Design** | Enterprise UI library (Alibaba) | CSS-in-JS (cssinjs) | 60+ | Design tokens, ConfigProvider |
| **Mantine** | Modern React component library | CSS modules + PostCSS | 100+ | CSS variables |
| **shadcn/ui** | Copy-paste Radix primitives + Tailwind | Tailwind CSS | ~40 | Tailwind theme config |

### 2.2 Quick Comparison

| Library | Similarity to PrimeNG | Popularity | Best For |
|---------|----------------------|------------|----------|
| **PrimeReact** | ⭐⭐⭐⭐⭐ | High | PrimeNG equivalent — identical look and API |
| **MUI** | ⭐⭐⭐⭐ | Extremely high | SaaS dashboards, most-used React UI library |
| **Ant Design** | ⭐⭐⭐⭐ | High | Enterprise apps, complex forms |
| **Mantine** | ⭐⭐⭐ | Growing | Modern React apps, hooks-first |
| **shadcn/ui** | ⭐⭐ | Very trendy | Custom UI systems, full control |

### 2.3 Detailed Evaluation Matrix

Scored 1–5 on each criterion. Weight reflects our priorities.

| Criterion | Weight | PrimeReact | MUI | Ant Design | Mantine | shadcn/ui |
|-----------|--------|-----------|-----|-----------|---------|----------|
| **PrimeNG-like polish** | 3x | ⭐⭐⭐⭐⭐ (15) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) | ⭐⭐ (6) |
| **Minimal code** | 3x | ⭐⭐⭐⭐ (12) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) | ⭐⭐⭐⭐ (12) | ⭐⭐⭐ (9) |
| **Easy to learn** | 2x | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) |
| **Component quality** | 2x | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐ (6) |
| **Theming / branding** | 2x | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐⭐ (10) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐⭐ (8) | ⭐⭐⭐⭐ (8) |
| **Community / ecosystem** | 1x | ⭐⭐⭐ (3) | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐⭐ (4) | ⭐⭐⭐ (3) | ⭐⭐⭐⭐ (4) |
| **Migration from PrimeNG** | 1x | ⭐⭐⭐⭐⭐ (5) | ⭐⭐⭐ (3) | ⭐⭐⭐ (3) | ⭐⭐ (2) | ⭐⭐ (2) |
| **Total** | | **65** | **60** | **50** | **50** | **41** |

### 2.4 Detailed Library Comparison

#### PrimeReact — Best for PrimeNG parity

**Pros:**
- **Identical component API** to PrimeNG — `<Dropdown>`, `<InputNumber>`, `<DataTable>`, `<Card>`, `<ProgressBar>` map 1:1 to their Angular counterparts
- **Same themes** — Lara Light Blue, Aura, Material Design — pixel-identical to the existing Angular app
- **PrimeFlex** utility CSS works unchanged — `flex`, `gap-3`, `justify-content-center`, `surface-card`, `shadow-2`
- **PrimeIcons** icon set shared with PrimeNG — `pi pi-play`, `pi pi-check`, `pi pi-arrow-right`
- **90+ components** — everything from InputMask to DataTable to TreeSelect out of the box
- Template migration is almost mechanical: convert `p-card` → `<Card>`, `p-button` → `<Button>`, `[(ngModel)]` → `value`/`onChange`
- Well-maintained by PrimeTek (same company as PrimeNG)

**Cons:**
- Smaller community than MUI (npm: ~100k weekly downloads vs MUI's ~4M)
- PrimeFlex is less well-known than Tailwind or MUI's `sx` prop — new hires may not know it
- Bundle size can be large if not using tree-shaking properly
- Documentation quality is good but not as polished as MUI's

**Code taste — Start page form in PrimeReact:**
```tsx
import { Card } from 'primereact/card';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { RadioButton } from 'primereact/radiobutton';
import { Button } from 'primereact/button';

function StartPage() {
  const [quizType, setQuizType] = useState('multiplication_1_10');
  const [difficulty, setDifficulty] = useState('medium');
  const [total, setTotal] = useState(10);

  return (
    <div className="flex justify-content-center">
      <Card header="Start a Quiz" style={{ maxWidth: 600, width: '100%' }}>
        <div className="flex flex-column gap-3">
          <label className="font-semibold">Quiz Type</label>
          <Dropdown
            value={quizType}
            options={quizTypeOptions}
            onChange={(e) => setQuizType(e.value)}
            optionLabel="label"
            optionValue="value"
            placeholder="Select quiz type"
          />

          <label className="font-semibold">Difficulty</label>
          <div className="flex gap-3">
            {['low', 'medium', 'hard'].map((d) => (
              <div key={d} className="flex align-items-center gap-1">
                <RadioButton inputId={d} value={d} checked={difficulty === d}
                  onChange={(e) => setDifficulty(e.value)} />
                <label htmlFor={d} className="capitalize">{d}</label>
              </div>
            ))}
          </div>

          <label className="font-semibold">Number of Questions</label>
          <InputNumber value={total} onValueChange={(e) => setTotal(e.value!)}
            min={1} max={30} showButtons useGrouping={false} />

          <Button label="Start Quiz" icon="pi pi-play" onClick={startQuiz} />
        </div>
      </Card>
    </div>
  );
}
```

**Note the similarity to the Angular PrimeNG template** — component names, prop names, and CSS classes are nearly identical.

---

#### MUI (Material UI) — Best for ecosystem and polish

**Pros:**
- **Most popular React UI library** — ~4M npm weekly downloads, massive community
- **Google Material Design 3** aesthetics — clean, modern, universally recognized
- **`sx` prop** for inline styling — no separate CSS files needed, excellent DX
- **Excellent theming** — `createTheme()` customizes every detail; can make it look like PrimeNG Lara with a few color overrides
- **Strong TypeScript support** — best-in-class type definitions
- **MUI X** add-ons — `DataGrid`, `DatePicker`, `Charts` if we ever need advanced components
- **Massive documentation** with live editors, examples for every prop, accessibility guides

**Cons:**
- Material Design aesthetic is distinct — won't look identical to PrimeNG Lara Light Blue
- `sx` prop and `styled()` API can be verbose for complex layouts vs PrimeFlex utilities
- Bundle size is larger than PrimeReact for equivalent components
- Some components require `@mui/x-data-grid` (separate package) for full DataTable equivalent
- Opinionated elevation/shadow system — cards look "Material" rather than "PrimeNG"

**Code taste — Start page form in MUI:**
```tsx
import { Card, CardContent, CardHeader } from '@mui/material';
import { TextField, Select, MenuItem, RadioGroup, Radio, FormControlLabel } from '@mui/material';
import { Button, Box, Typography } from '@mui/material';

function StartPage() {
  const [quizType, setQuizType] = useState('multiplication_1_10');
  const [difficulty, setDifficulty] = useState('medium');
  const [total, setTotal] = useState(10);

  return (
    <Box display="flex" justifyContent="center">
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardHeader title="Start a Quiz" />
        <CardContent>
          <Box display="flex" flexDirection="column" gap={2}>
            <Typography variant="subtitle2">Quiz Type</Typography>
            <Select value={quizType} onChange={(e) => setQuizType(e.target.value)}>
              {quizTypeOptions.map((qt) => (
                <MenuItem key={qt.value} value={qt.value}>{qt.label}</MenuItem>
              ))}
            </Select>

            <Typography variant="subtitle2">Difficulty</Typography>
            <RadioGroup row value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}>
              {['low', 'medium', 'hard'].map((d) => (
                <FormControlLabel key={d} value={d} control={<Radio />}
                  label={d} sx={{ textTransform: 'capitalize' }} />
              ))}
            </RadioGroup>

            <Typography variant="subtitle2">Number of Questions</Typography>
            <TextField type="number" value={total}
              onChange={(e) => setTotal(Number(e.target.value))}
              inputProps={{ min: 1, max: 30 }} />

            <Button variant="contained" startIcon={<PlayArrow />}
              onClick={startQuiz}>
              Start Quiz
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Comparison:** MUI requires more explicit layout — `Box` with `sx` props instead of PrimeFlex utility classes. Component names differ (`Select` vs `Dropdown`, `RadioGroup` vs `RadioButton`). The code is slightly longer but equally readable.

---

#### Ant Design — Honorable Mention

Strong enterprise library from Alibaba. `Form`, `Table`, `Select`, `Radio.Group` are excellent. However, it has its own design language (not Material, not PrimeNG) and the `Form` component's validation-first approach adds boilerplate for our simple use case. Best when you need complex form validation, table filtering, and enterprise dashboards. Deferred to keep scope to two implementations.

#### Mantine — Honorable Mention

Modern, hooks-first library with CSS modules. Very clean API (`useForm`, `useDisclosure`). Growing rapidly but still smaller ecosystem than MUI. Its aesthetic is neutral (neither Material nor PrimeNG) — looks modern but requires more styling effort to match PrimeNG Lara. Good future candidate if we want a lighter, more flexible option.

#### shadcn/ui — Passed

Not a traditional component library — it's a collection of copy-paste Radix primitives styled with Tailwind. Maximum flexibility but minimum out-of-the-box polish. You build your own design system on top. Excellent for teams with dedicated designers, but adds work for our "PrimeNG-like look with minimal effort" goal. Code volume would be higher because you write more customization.

---

## 3. Selection Decision

### Selected: PrimeReact + MUI

Two implementations demonstrating opposite philosophies within React:

| Dimension | PrimeReact (`react-primereact-app/`) | MUI (`react-mui-app/`) |
|-----------|-------------------------------------|----------------------|
| **Design language** | PrimeFaces Lara Light Blue | Material Design 3 |
| **Similarity to Angular app** | ~95% (near-identical look) | ~70% (same layout, different style) |
| **Component API style** | `<Dropdown options={[...]} />` | `<Select><MenuItem>...</Select>` |
| **Layout system** | PrimeFlex utility classes | `Box` + `sx` prop / `Stack` |
| **Icons** | PrimeIcons (`pi pi-*`) | MUI Icons / Material Icons |
| **Data table** | `<DataTable>` (built-in) | `<DataGrid>` (MUI X, separate pkg) or `<Table>` (basic) |
| **Form approach** | Controlled components + useState | Controlled components + useState |
| **Theming** | CSS theme files (Lara Light Blue) | `createTheme()` JS object |
| **Code volume** | ~1,200–1,400 lines | ~1,300–1,500 lines |
| **npm popularity** | ~100k/week | ~4M/week |
| **Port** | 5173 | 5174 |

### Why both?

- **PrimeReact** shows that migrating from Angular + PrimeNG to React is nearly mechanical — same components, same CSS, same theme. This proves vendor consistency across frameworks and makes the comparison with the Angular implementation trivially easy.
- **MUI** shows what the same product looks like when built with the most mainstream React component library. Material Design brings a globally recognized aesthetic. Developers joining from any React background will likely already know MUI.

Together they answer: *"Does the component library choice matter, or does the app look the same either way?"* (Spoiler: both look professional, but PrimeReact is pixel-identical to the Angular version while MUI brings its own Material personality.)

---

## 4. Shared Backend Strategy

Both React frontends are **static SPAs** that call the existing FastAPI backend via HTTP:

```
┌──────────────────────┐   ┌──────────────────┐
│ react-primereact-app │   │  react-mui-app   │
│  Vite + React :5173  │   │ Vite + React :5174│
└──────────┬───────────┘   └────────┬─────────┘
           │                        │
           └───────────┬────────────┘
                       │ HTTP (fetch / axios)
              ┌────────▼────────┐
              │  FastAPI :8000   │
              │  python-api/     │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  PostgreSQL :5432│
              └─────────────────┘
```

**No Node.js backend.** Both apps are pure client-side React, built with Vite, served as static files in dev mode. All business logic and database access lives in FastAPI.

### API Client (shared pattern)

Both apps use the same API client pattern (`src/services/api.ts`):

```typescript
const API_URL = 'http://localhost:8000/api';

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

// Typed wrappers
export const api = {
  getQuizTypes: () => get<QuizType[]>('/quiz-types'),
  getStudents: () => get<Student[]>('/students'),
  getStudent: (id: string) => get<StudentDetail>(`/students/${id}`),
  updateStudent: (id: string, data: StudentUpdate) => patch<StudentDetail>(`/students/${id}`, data),
  createSession: (data: CreateSession) => post<SessionCreated>('/sessions'),
  getSessions: () => get<SessionSummary[]>('/sessions'),
  getSession: (id: string) => get<SessionDetail>(`/sessions/${id}`),
  submitAnswer: (data: SubmitAnswer) => post<AnswerResult>('/answers', data),
  getStats: () => get<Stats>('/stats'),
  getTableRows: (table: string) => get<any[]>(`/stats/${table}`),
  resetData: () => post<void>('/stats/reset', {}),
};
```

### API Endpoints (unchanged from v2.0)

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

## 5. Common React Foundation

Both implementations share identical React fundamentals:

### 5.1 Tooling

| Tool | Choice | Why |
|------|--------|-----|
| Build tool | Vite 6 | Fastest React dev server, instant HMR |
| Language | TypeScript 5.5+ | Type safety, matches Angular app |
| React | React 19 | Latest stable, hooks-only |
| Routing | React Router 7 | Standard React routing with URL params |
| HTTP | `fetch` (native) | Zero dependencies — no axios needed |
| State | React Context + `useState` | Simple enough for this app — no Redux needed |
| Linting | ESLint + Prettier | Consistent formatting |

### 5.2 Routing Configuration

Both apps use identical React Router setup:

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { StartPage } from './pages/StartPage';
import { QuizPage } from './pages/QuizPage';
import { HistoryPage } from './pages/HistoryPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserGuidePage } from './pages/UserGuidePage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<StartPage />} />
            <Route path="/quiz/:sessionId" element={<QuizPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/:sessionId" element={<SessionDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/user-guide" element={<UserGuidePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
```

### 5.3 Global State (React Context)

A minimal context provides the student selector state (equivalent to Angular's `QuizService`):

```tsx
// src/context/AppContext.tsx
interface AppContextType {
  students: Student[];
  currentStudentId: string;
  setCurrentStudentId: (id: string) => void;
  refreshStudents: () => void;
  activeQuiz: ActiveQuiz | null;
  setActiveQuiz: (quiz: ActiveQuiz | null) => void;
}

const AppContext = createContext<AppContextType>(/* ... */);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState('');
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);

  const refreshStudents = useCallback(async () => {
    const data = await api.getStudents();
    setStudents(data);
  }, []);

  useEffect(() => { refreshStudents(); }, [refreshStudents]);

  return (
    <AppContext.Provider value={{
      students, currentStudentId, setCurrentStudentId,
      refreshStudents, activeQuiz, setActiveQuiz,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
```

### 5.4 TypeScript Models

Shared type definitions (identical in both apps):

```typescript
// src/models/types.ts
export interface QuizType {
  id: string;
  code: string;
  description: string;
  answer_type: string;
  template_kind: string;
}

export interface Student {
  id: string;
  name: string;
}

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

export interface AnswerOut {
  id: string;
  response: { raw: string; parsed: { type: string; value: unknown } };
  is_correct: boolean;
  answered_at: string;
}

export interface SessionSummary {
  id: string;
  student_id: string | null;
  difficulty: string;
  total_questions: number;
  score_percent: number | null;
  started_at: string;
  finished_at: string | null;
  student_name: string | null;
  quiz_type_code: string;
}

export interface ActiveQuiz {
  sessionId: string;
  quizTypeCode: string;
  questions: QuestionOut[];
}
```

### 5.5 Utility Functions

```typescript
// src/utils/duration.ts
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (seconds < 3600) return `${m}:${String(s).padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

### 5.6 Vite Proxy Configuration

Both apps proxy `/api` to FastAPI to avoid CORS in development:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // or 5174 for MUI
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

With the proxy, the API client uses relative paths (`/api/quiz-types`) instead of `http://localhost:8000/api/quiz-types`.

---

## 6. PrimeReact Implementation

### 6.1 Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "primereact": "^10.8.0",
    "primeicons": "^7.0.0",
    "primeflex": "^3.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0"
  }
}
```

### 6.2 Theme Setup

```tsx
// src/main.tsx
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

import { PrimeReactProvider } from 'primereact/api';

createRoot(document.getElementById('root')!).render(
  <PrimeReactProvider>
    <App />
  </PrimeReactProvider>
);
```

**Result:** Pixel-identical to the Angular PrimeNG app — same Lara Light Blue theme, same PrimeFlex utilities.

### 6.3 Component Mapping (Angular PrimeNG → React PrimeReact)

This is the key advantage: nearly 1:1 migration.

| Angular (PrimeNG) | React (PrimeReact) | Notes |
|---|---|---|
| `<p-card header="...">` | `<Card header="...">` | Identical API |
| `<p-dropdown [options]="..." [(ngModel)]="x">` | `<Dropdown options={...} value={x} onChange={...} />` | Props instead of ngModel |
| `<p-button label="..." icon="pi pi-play">` | `<Button label="..." icon="pi pi-play" />` | Identical |
| `<p-inputNumber [(ngModel)]="x" [showButtons]="true">` | `<InputNumber value={x} onValueChange={...} showButtons />` | Same props |
| `<p-progressBar [value]="x">` | `<ProgressBar value={x} />` | Identical |
| `<p-radioButton [value]="d" [(ngModel)]="x">` | `<RadioButton value={d} checked={x===d} onChange={...} />` | Controlled |
| `<p-checkbox [value]="n" [(ngModel)]="arr">` | `<Checkbox value={n} checked={arr.includes(n)} onChange={...} />` | Controlled |
| `<p-table [value]="rows">` | `<DataTable value={rows}>` | Nearly identical |
| `<p-tag severity="success">` | `<Tag severity="success" />` | Identical |
| `<p-dialog [(visible)]="x">` | `<Dialog visible={x} onHide={...} />` | Controlled |
| `class="surface-card shadow-2"` | `className="surface-card shadow-2"` | Same PrimeFlex |
| `class="flex gap-3"` | `className="flex gap-3"` | Same PrimeFlex |

**Migration effort:** Change `class` → `className`, `[(ngModel)]` → `value`/`onChange`, remove Angular decorators, wrap in functional component. Template logic (`@for`, `@if`) becomes JSX (`map`, ternary).

### 6.4 Layout Component

```tsx
// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom';
import { Dropdown } from 'primereact/dropdown';
import { useApp } from '../context/AppContext';

export function Layout() {
  const { students, currentStudentId, setCurrentStudentId } = useApp();

  const studentOptions = students.map((s) => ({ label: s.name, value: s.id }));

  return (
    <div className="min-h-screen flex flex-column">
      {/* Header */}
      <header className="surface-card shadow-2 px-4 py-2 flex align-items-center justify-content-between">
        <nav className="flex gap-3 align-items-center">
          <NavLink to="/" className={({ isActive }) =>
            `no-underline text-primary ${isActive ? 'font-bold' : ''}`}>Start</NavLink>
          <NavLink to="/profile" className={({ isActive }) =>
            `no-underline text-primary ${isActive ? 'font-bold' : ''}`}>Profile</NavLink>
          <NavLink to="/history" className={({ isActive }) =>
            `no-underline text-primary ${isActive ? 'font-bold' : ''}`}>History</NavLink>
          <NavLink to="/user-guide" className={({ isActive }) =>
            `no-underline text-primary ${isActive ? 'font-bold' : ''}`}>User Guide</NavLink>
          <NavLink to="/admin" className={({ isActive }) =>
            `no-underline text-primary ${isActive ? 'font-bold' : ''}`}>Admin</NavLink>
        </nav>
        <div className="flex align-items-center gap-2">
          <label className="text-sm text-500">Student:</label>
          <Dropdown
            options={studentOptions}
            value={currentStudentId}
            onChange={(e) => setCurrentStudentId(e.value || '')}
            optionLabel="label"
            optionValue="value"
            placeholder="No student"
            showClear
            style={{ minWidth: '180px' }}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="text-center text-500 text-sm py-3 surface-ground">
        OpenMath v2.0 — React + PrimeReact + FastAPI + PostgreSQL
      </footer>
    </div>
  );
}
```

**Compare to Angular `header.component.ts`:** The structure and CSS classes are identical. The only differences are React-specific: `NavLink` instead of `routerLink`, `className` instead of `class`, and controlled `Dropdown` instead of `[(ngModel)]`.

### 6.5 Quiz Page Blueprint

```tsx
// src/pages/QuizPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { InputNumber } from 'primereact/inputnumber';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export function QuizPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { activeQuiz } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [intAnswer, setIntAnswer] = useState<number | null>(null);
  const [choiceAnswer, setChoiceAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeQuiz?.sessionId === sessionId) {
      setQuestions(activeQuiz.questions);
      setLoading(false);
    } else {
      api.getSession(sessionId!).then((detail) => {
        const unanswered = detail.questions.filter((q) => !q.answer);
        setQuestions(unanswered);
        setAnsweredCount(detail.questions.length - unanswered.length);
        setLoading(false);
      });
    }
  }, [sessionId, activeQuiz]);

  useEffect(() => { inputRef.current?.focus(); }, [currentIndex, feedback]);

  const current = questions[currentIndex] ?? null;
  const total = questions.length;
  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const submitAnswer = async () => {
    if (!current) return;
    const value = current.prompt.answer.type === 'choice' ? choiceAnswer : intAnswer;
    const result = await api.submitAnswer({
      questionId: current.id,
      response: { raw: String(value), parsed: { type: current.prompt.answer.type, value } },
    });
    setFeedback({
      isCorrect: result.isCorrect,
      correctValue: result.correctValue,
    });
    setAnsweredCount((c) => c + 1);
  };

  const nextQuestion = () => {
    setFeedback(null);
    setIntAnswer(null);
    setChoiceAnswer('');
    if (currentIndex + 1 >= total) {
      navigate(`/history/${sessionId}`);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  if (loading) return <p className="text-center text-500">Loading quiz...</p>;
  if (!current) return <p className="text-center text-500">No questions available.</p>;

  return (
    <div className="flex justify-content-center">
      <div style={{ maxWidth: 700, width: '100%' }}>
        <div className="mb-3">
          <div className="flex justify-content-between mb-1">
            <span className="text-sm text-500">
              Question {answeredCount + 1} of {total}
            </span>
          </div>
          <ProgressBar value={progress} showValue={false} style={{ height: 8 }} />
        </div>

        <Card
          header={<h2 className="text-center m-0 p-3">{current.prompt.render}</h2>}
          footer={
            <div className="flex justify-content-center">
              {!feedback ? (
                <Button label="Submit" icon="pi pi-check" onClick={submitAnswer}
                  disabled={intAnswer == null && !choiceAnswer} />
              ) : (
                <Button label="Next" icon="pi pi-arrow-right" onClick={nextQuestion} />
              )}
            </div>
          }
        >
          {current.prompt.answer.type === 'int' ? (
            <div className="flex justify-content-center">
              <InputNumber ref={inputRef} value={intAnswer}
                onValueChange={(e) => setIntAnswer(e.value!)}
                onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                placeholder="Your answer"
                inputStyle={{ textAlign: 'center', fontSize: '1.5rem' }}
                style={{ width: 200 }} />
            </div>
          ) : (
            <div className="flex justify-content-center">
              <SelectButton options={current.prompt.answer.options ?? []}
                value={choiceAnswer} onChange={(e) => setChoiceAnswer(e.value)} />
            </div>
          )}

          {feedback && (
            <div className={`mt-3 p-3 border-round text-center text-lg font-semibold
              ${feedback.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {feedback.isCorrect
                ? 'Correct! ✓'
                : `Wrong — correct answer is ${feedback.correctValue}`}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
```

**Side-by-side with Angular:** The PrimeReact quiz page is structurally identical to the Angular `quiz.component.ts`. Same PrimeNG components, same PrimeFlex classes, same layout. The Angular `signal()` maps to React `useState()`, and `@if`/`@for` maps to ternary/`map`.

---

## 7. MUI Implementation

### 7.1 Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@mui/material": "^6.4.0",
    "@mui/icons-material": "^6.4.0",
    "@emotion/react": "^11.13.0",
    "@emotion/styled": "^11.13.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^6.0.0"
  }
}
```

### 7.2 Theme Setup

Custom MUI theme aligned to the PrimeNG Lara Light Blue color palette:

```tsx
// src/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#3B82F6',      // PrimeNG Lara Light Blue primary
      light: '#60A5FA',
      dark: '#2563EB',
      contrastText: '#fff',
    },
    secondary: {
      main: '#64748B',      // Slate 500
    },
    success: {
      main: '#22C55E',
      light: '#DCFCE7',     // bg-green-100 equivalent
    },
    error: {
      main: '#EF4444',
      light: '#FEE2E2',     // bg-red-100 equivalent
    },
    background: {
      default: '#F8FAFC',   // Slate 50
      paper: '#FFFFFF',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 2 },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
  },
});
```

```tsx
// src/main.tsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
```

### 7.3 Component Mapping (PrimeNG → MUI)

| PrimeNG / PrimeReact | MUI Equivalent | Notes |
|---|---|---|
| `<Card header="...">` | `<Card><CardHeader title="..." /><CardContent>` | MUI splits header/content |
| `<Dropdown options={...}>` | `<Select><MenuItem>...</Select>` or `<Autocomplete>` | MUI uses children pattern |
| `<Button label="..." icon="pi pi-play">` | `<Button startIcon={<PlayArrow />}>Start</Button>` | MUI uses children for label |
| `<InputNumber>` | `<TextField type="number">` | MUI lacks specialized InputNumber |
| `<ProgressBar value={x}>` | `<LinearProgress variant="determinate" value={x}>` | Same concept |
| `<RadioButton>` | `<Radio>` inside `<RadioGroup>` | MUI groups radios |
| `<Checkbox>` | `<Checkbox>` with `<FormControlLabel>` | MUI wraps with label |
| `<DataTable>` | `<Table>` (basic) or `<DataGrid>` (MUI X) | Basic `Table` for our needs |
| `<Tag severity="success">` | `<Chip color="success" size="small">` | Different naming |
| `<Dialog>` | `<Dialog>` | Similar API |
| PrimeFlex `flex gap-3` | `<Stack direction="row" spacing={1.5}>` or `<Box sx={{ display: 'flex', gap: 1.5 }}>` | MUI uses `sx` or `Stack` |
| `surface-card shadow-2` | `<Paper elevation={2}>` or `<Card>` | MUI elevation system |

### 7.4 Layout Component

```tsx
// src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom';
import { AppBar, Toolbar, Box, Select, MenuItem, Typography, Container } from '@mui/material';
import { useApp } from '../context/AppContext';

const navLinks = [
  { to: '/', label: 'Start' },
  { to: '/profile', label: 'Profile' },
  { to: '/history', label: 'History' },
  { to: '/user-guide', label: 'User Guide' },
  { to: '/admin', label: 'Admin' },
];

export function Layout() {
  const { students, currentStudentId, setCurrentStudentId } = useApp();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={2}>
        <Toolbar sx={{ gap: 2 }}>
          <Box component="nav" sx={{ display: 'flex', gap: 2, flexGrow: 1 }}>
            {navLinks.map(({ to, label }) => (
              <NavLink key={to} to={to}
                style={({ isActive }) => ({
                  textDecoration: 'none',
                  color: '#3B82F6',
                  fontWeight: isActive ? 700 : 400,
                })}>
                {label}
              </NavLink>
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">Student:</Typography>
          <Select
            value={currentStudentId}
            onChange={(e) => setCurrentStudentId(e.target.value)}
            displayEmpty
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value=""><em>No student</em></MenuItem>
            {students.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Container maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Outlet />
      </Container>

      {/* Footer */}
      <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
        <Typography variant="caption">
          OpenMath v2.0 — React + MUI + FastAPI + PostgreSQL
        </Typography>
      </Box>
    </Box>
  );
}
```

**Compare to PrimeReact Layout:** MUI uses `AppBar` + `Toolbar` (Material pattern) instead of a plain `<header>` with PrimeFlex. The `Select` component uses `<MenuItem>` children instead of PrimeReact's `options` array prop. Layout uses `Container` and `Box` with `sx` instead of PrimeFlex classes.

### 7.5 Quiz Page Blueprint

```tsx
// src/pages/QuizPage.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card, CardHeader, CardContent, CardActions,
  TextField, Button, LinearProgress, Box, Typography, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { Check, ArrowForward } from '@mui/icons-material';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

export function QuizPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { activeQuiz } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [intAnswer, setIntAnswer] = useState('');
  const [choiceAnswer, setChoiceAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(true);

  // ... bootstrap logic identical to PrimeReact version ...

  const current = questions[currentIndex] ?? null;
  const total = questions.length;
  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  if (loading) return <Typography align="center" color="text.secondary">Loading quiz...</Typography>;
  if (!current) return <Typography align="center" color="text.secondary">No questions available.</Typography>;

  return (
    <Box display="flex" justifyContent="center">
      <Box maxWidth={700} width="100%">
        {/* Progress */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="body2" color="text.secondary">
              Question {answeredCount + 1} of {total}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
        </Box>

        {/* Question Card */}
        <Card>
          <CardHeader
            title={current.prompt.render}
            titleTypographyProps={{ align: 'center', variant: 'h4' }}
          />
          <CardContent>
            {current.prompt.answer.type === 'int' ? (
              <Box display="flex" justifyContent="center">
                <TextField
                  inputRef={inputRef}
                  type="number"
                  value={intAnswer}
                  onChange={(e) => setIntAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                  placeholder="Your answer"
                  sx={{ width: 200 }}
                  inputProps={{ style: { textAlign: 'center', fontSize: '1.5rem' } }}
                />
              </Box>
            ) : (
              <Box display="flex" justifyContent="center">
                <ToggleButtonGroup exclusive value={choiceAnswer}
                  onChange={(_, v) => v && setChoiceAnswer(v)}>
                  {(current.prompt.answer.options ?? []).map((opt) => (
                    <ToggleButton key={opt} value={opt}>{opt}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            )}

            {/* Feedback */}
            {feedback && (
              <Box mt={2} p={2} borderRadius={1} textAlign="center"
                sx={{
                  bgcolor: feedback.isCorrect ? 'success.light' : 'error.light',
                  color: feedback.isCorrect ? 'success.dark' : 'error.dark',
                }}>
                <Typography variant="h6">
                  {feedback.isCorrect
                    ? 'Correct! ✓'
                    : `Wrong — correct answer is ${feedback.correctValue}`}
                </Typography>
              </Box>
            )}
          </CardContent>
          <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
            {!feedback ? (
              <Button variant="contained" startIcon={<Check />}
                onClick={submitAnswer} disabled={!intAnswer && !choiceAnswer}>
                Submit
              </Button>
            ) : (
              <Button variant="contained" endIcon={<ArrowForward />} onClick={nextQuestion}>
                Next
              </Button>
            )}
          </CardActions>
        </Card>
      </Box>
    </Box>
  );
}
```

### 7.6 History Page — Table Comparison

This is where the libraries diverge most:

**PrimeReact** — declarative `<DataTable>` with built-in features:
```tsx
<DataTable value={sessions} stripedRows size="small">
  <Column field="student_name" header="Student" />
  <Column field="difficulty" header="Difficulty"
    body={(row) => <Link to={`/history/${row.id}`}>{row.difficulty}</Link>} />
  <Column field="total_questions" header="Questions" />
  <Column header="Score" body={(row) => (
    <Tag value={`${row.score_percent}%`}
      severity={row.score_percent >= 70 ? 'success' : 'danger'} />
  )} />
  <Column field="started_at" header="Started"
    body={(row) => new Date(row.started_at).toLocaleString()} />
</DataTable>
```

**MUI** — manual `<Table>` layout:
```tsx
<TableContainer component={Paper}>
  <Table size="small">
    <TableHead>
      <TableRow>
        <TableCell>Student</TableCell>
        <TableCell>Difficulty</TableCell>
        <TableCell>Questions</TableCell>
        <TableCell>Score</TableCell>
        <TableCell>Started</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {sessions.map((row) => (
        <TableRow key={row.id}>
          <TableCell>{row.student_name}</TableCell>
          <TableCell>
            <Link to={`/history/${row.id}`}>{row.difficulty}</Link>
          </TableCell>
          <TableCell>{row.total_questions}</TableCell>
          <TableCell>
            <Chip label={`${row.score_percent}%`} size="small"
              color={row.score_percent >= 70 ? 'success' : 'error'} />
          </TableCell>
          <TableCell>{new Date(row.started_at).toLocaleString()}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

**Verdict:** PrimeReact's `<DataTable>` is significantly more concise for tables with many columns. MUI's `<Table>` is more explicit/manual but offers full control. For our history page with 7 columns, PrimeReact saves ~30% code.

---

## 8. Feature Scope

Both implementations target v1.5 feature parity.

### 8.1 Page-by-Page Feature Matrix

| Page | Route | PrimeReact | MUI | Notes |
|------|-------|-----------|-----|-------|
| **Start** | `/` | `Card`, `Dropdown`, `RadioButton`, `InputNumber`, `Checkbox`, `Button` | `Card`, `Select`, `RadioGroup`, `TextField`, `Checkbox`, `Button` | Same form, different components |
| **Quiz** | `/quiz/:sessionId` | `Card`, `ProgressBar`, `InputNumber`, `SelectButton`, `Button` | `Card`, `LinearProgress`, `TextField`, `ToggleButtonGroup`, `Button` | Same flow |
| **History** | `/history` | `DataTable`, `Column`, `Tag` | `Table`, `TableRow`, `Chip` | PrimeReact more concise |
| **Session Detail** | `/history/:sessionId` | `DataTable`, `Tag`, `Card` | `Table`, `Chip`, `Card` | Same structure |
| **Profile** | `/profile` | `InputText`, `InputNumber`, `Dropdown`, `Checkbox`, `Card` | `TextField`, `Select`, `Checkbox`, `Card` | Same form |
| **User Guide** | `/user-guide` | Static content in `Card` | Static content in `Card` | Identical |
| **Admin** | `/admin` | `Card`, `DataTable`, `Button`, `Dialog` | `Card`, `Table`, `Button`, `Dialog` | PrimeReact `DataTable` wins |

### 8.2 Feature Checklist

| Feature | PrimeReact | MUI |
|---------|-----------|-----|
| Start page (create session) | ✅ | ✅ |
| Quiz page (answer questions) | ✅ | ✅ |
| Feedback (correct/wrong) | ✅ | ✅ |
| Progress indicator | ✅ | ✅ |
| History list (grouped by type) | ✅ | ✅ |
| Session detail | ✅ | ✅ |
| Student selector in header | ✅ | ✅ |
| Profile edit | ✅ | ✅ |
| Performance stats | ✅ | ✅ |
| User guide | ✅ | ✅ |
| Admin stats | ✅ | ✅ |
| Table browser | ✅ | ✅ |
| Reset with confirmation | ✅ | ✅ |
| URL routing with params | ✅ | ✅ |
| Auto-focus answer input | ✅ | ✅ |
| Quiz resume (unfinished) | ✅ | ✅ |

### 8.3 Out of Scope

- JSONB v2.0 new quiz types beyond `axb` and `axb_plus_cxd`
- Authentication (v2.1)
- RBAC roles
- Server-side rendering (both are client-side SPAs)

---

## 9. Folder Structure

### 9.1 PrimeReact App

```
react-primereact-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.ico
└── src/
    ├── main.tsx                     # Entry: PrimeReact provider + theme imports
    ├── App.tsx                      # BrowserRouter + Routes
    ├── context/
    │   └── AppContext.tsx            # Global state (students, activeQuiz)
    ├── services/
    │   └── api.ts                   # Typed fetch wrappers
    ├── models/
    │   └── types.ts                 # TypeScript interfaces
    ├── utils/
    │   └── duration.ts              # formatDuration helper
    ├── components/
    │   └── Layout.tsx               # Header + nav + footer + Outlet
    └── pages/
        ├── StartPage.tsx
        ├── QuizPage.tsx
        ├── HistoryPage.tsx
        ├── SessionDetailPage.tsx
        ├── ProfilePage.tsx
        ├── UserGuidePage.tsx
        └── AdminPage.tsx
```

**Estimated:** ~14 files, ~1,300 lines of TypeScript/TSX

### 9.2 MUI App

```
react-mui-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.ico
└── src/
    ├── main.tsx                     # Entry: ThemeProvider + CssBaseline
    ├── App.tsx                      # BrowserRouter + Routes
    ├── theme.ts                     # createTheme() with Lara Blue palette
    ├── context/
    │   └── AppContext.tsx            # Global state (identical to PrimeReact)
    ├── services/
    │   └── api.ts                   # Typed fetch wrappers (identical)
    ├── models/
    │   └── types.ts                 # TypeScript interfaces (identical)
    ├── utils/
    │   └── duration.ts              # formatDuration helper (identical)
    ├── components/
    │   └── Layout.tsx               # AppBar + nav + footer + Outlet
    └── pages/
        ├── StartPage.tsx
        ├── QuizPage.tsx
        ├── HistoryPage.tsx
        ├── SessionDetailPage.tsx
        ├── ProfilePage.tsx
        ├── UserGuidePage.tsx
        └── AdminPage.tsx
```

**Estimated:** ~15 files, ~1,450 lines of TypeScript/TSX

### 9.3 Code Volume Comparison (all implementations)

| Implementation | Language | Files | Estimated Lines | Config overhead |
|---------------|----------|-------|----------------|----------------|
| Angular + PrimeNG | TypeScript | 25 | ~2,500 | angular.json, environments, tsconfig |
| Nuxt + Vue 3 | Vue/TS | ~20 | ~3,000 | nuxt.config.ts, layers |
| **React + PrimeReact** | TSX | ~14 | ~1,300 | vite.config.ts, tsconfig |
| **React + MUI** | TSX | ~15 | ~1,450 | vite.config.ts, tsconfig, theme.ts |
| Reflex (Python) | Python | ~10 | ~800 | rxconfig.py |
| Streamlit (Python) | Python | ~8 | ~450 | config.toml |
| Python CLI | Python | ~5 | ~800 | — |

**React + PrimeReact delivers the same product in ~52% of the Angular code.** The reduction comes from:
- No Angular modules/decorators/dependency injection
- Functional components + hooks instead of class-like structure with `signal()`
- JSX instead of separate template strings
- Vite instead of Angular CLI (simpler config)

**React + MUI** is ~12% more code than PrimeReact, mainly due to MUI's more verbose `<Table>` and explicit `Box`/`sx` layout system vs PrimeFlex utility classes.

### 9.4 Shared Files Between the Two React Apps

These files are **identical** in both implementations:

| File | Purpose | Lines |
|------|---------|-------|
| `context/AppContext.tsx` | Global state provider | ~60 |
| `services/api.ts` | Typed API client | ~80 |
| `models/types.ts` | TypeScript interfaces | ~90 |
| `utils/duration.ts` | Duration formatting | ~15 |
| `App.tsx` | Router setup | ~30 |

**~275 lines of shared logic** — 55% of a PrimeReact app is library-agnostic. The only files that differ are the pages, layout, main entry point, and theme configuration.

---

## 10. Dev Tooling

### 10.1 dev.ps1 Integration

New menu items:

```
--- React Frontends ---
29. React PrimeReact: Install dependencies
30. React PrimeReact: Start Dev Server (port 5173)
31. React PrimeReact: Stop Dev Server
32. React MUI: Install dependencies
33. React MUI: Start Dev Server (port 5174)
34. React MUI: Stop Dev Server
```

CLI modes:
```powershell
.\dev.ps1 -Mode install-react-primereact
.\dev.ps1 -Mode start-react-primereact
.\dev.ps1 -Mode stop-react-primereact
.\dev.ps1 -Mode install-react-mui
.\dev.ps1 -Mode start-react-mui
.\dev.ps1 -Mode stop-react-mui
```

### 10.2 Running Manually

```powershell
# PrimeReact
cd react-primereact-app
npm install          # or pnpm install
npm run dev          # Vite dev server on :5173

# MUI
cd react-mui-app
npm install
npm run dev          # Vite dev server on :5174
```

### 10.3 Full Stack (all frontends)

| Service | Port | Stack |
|---------|------|-------|
| PostgreSQL | 5432 | Docker |
| Adminer | 8080 | Docker |
| FastAPI | 8000 | `python-api/` (shared backend) |
| Nuxt | 3000 | `nuxt-app/` |
| Reflex | 3001 | `reflex-app/` |
| Angular | 4200 | `angular-app/` |
| **React + PrimeReact** | **5173** | `react-primereact-app/` |
| **React + MUI** | **5174** | `react-mui-app/` |
| Streamlit | 8501 | `streamlit-app/` |

All seven frontends share the same FastAPI backend and PostgreSQL database.

---

## 11. Acceptance Criteria

### PrimeReact App (`react-primereact-app/`)

- [ ] All 7 pages render and are navigable via header links
- [ ] Start page creates a session and navigates to quiz
- [ ] Quiz page shows progress, accepts answers, shows correct/wrong feedback
- [ ] Quiz page auto-focuses the answer input
- [ ] History groups sessions by quiz type with `DataTable`
- [ ] Session detail shows question-by-question results with `DataTable`
- [ ] Profile loads and saves student data
- [ ] Admin shows stats cards, table browser, and reset with confirmation dialog
- [ ] Student selector in header works and persists across navigation
- [ ] Lara Light Blue theme produces a pixel-identical look to the Angular PrimeNG app
- [ ] URL routing works: `/`, `/quiz/:sessionId`, `/history`, `/history/:sessionId`, `/profile`, `/user-guide`, `/admin`
- [ ] All data flows through FastAPI on port 8000 (no direct DB access)
- [ ] Total TSX code under 1,500 lines

### MUI App (`react-mui-app/`)

- [ ] All 7 pages render and are navigable via AppBar links
- [ ] Start page creates a session and navigates to quiz
- [ ] Quiz page shows progress, accepts answers, shows correct/wrong feedback
- [ ] Quiz page auto-focuses the answer input
- [ ] History shows session tables with `Chip` score badges
- [ ] Session detail shows per-question results
- [ ] Profile loads and saves student data
- [ ] Admin shows stats cards, table browser, and reset with confirmation dialog
- [ ] Student selector in AppBar works and persists across navigation
- [ ] Custom MUI theme with blue-500 primary produces a polished, professional look
- [ ] URL routing works: all 7 routes with params
- [ ] All data flows through FastAPI on port 8000 (no direct DB access)
- [ ] Total TSX code under 1,600 lines

### Both

- [ ] Vite dev server proxies `/api` to FastAPI (no CORS issues)
- [ ] TypeScript strict mode with no `any` in models
- [ ] Works with the existing PostgreSQL schema (no migrations needed)
- [ ] `dev.ps1` can start/stop both apps
- [ ] Shared files (context, api, models, utils) are identical between the two apps

---

*End of specification — OpenMath React Frontends (PrimeReact + MUI)*
