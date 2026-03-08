# Implementation Summary — v2.7.5 KaTeX Rendering

**Version:** 2.7.5  
**Spec:** `docs/spec_v2_75_katex_rendering.md`  
**Status:** ✅ Complete  
**Build:** `ng build` passes — zero compilation errors  
**Depends on:** v2.7 (badge system, PDF export, localization)

---

## Overview

v2.75 adds KaTeX-based mathematical rendering to OpenMath. Quiz types can now be configured with a `render_mode` property (`text` or `katex`) that controls how question expressions are displayed across all flows — live quiz play, session history, teacher review, and parent sign-off. A new exam-paper style review layout replaces the default table view with a corrected-paper format: checkmarks for correct answers, strikethrough with red corrections for wrong ones. A new `basic_fractions` quiz type showcases KaTeX rendering with proper fraction notation (`\frac{}{}`).

---

## Database Changes

### Migration `0020_render_mode.sql`

- Added `render_mode VARCHAR(20) NOT NULL DEFAULT 'text'` column to `quiz_types` table
- All existing quiz types default to `'text'` (plain rendering)

### Migration `0021_basic_fractions_quiz_type.sql`

- Seeded `basic_fractions` quiz type with `ON CONFLICT (code) DO NOTHING`:

| Field | Value |
|-------|-------|
| `code` | `basic_fractions` |
| `description` | Basic Fractional Numbers |
| `template_kind` | `basic_fractions` |
| `answer_type` | `text` |
| `category` | `fractions` |
| `render_mode` | `katex` |
| `recommended_age_min` | 8 |
| `recommended_age_max` | 14 |
| `sort_order` | 200 |

---

## Backend Changes (Python API)

### Schemas (`app/schemas/quiz_type.py`)

- **`QuizTypeOut`** — added `render_mode: str = "text"`
- **`QuizTypeCreate`** — added `render_mode: str = "text"`
- **`QuizTypeUpdate`** — added `render_mode: str | None = None`

### Queries (`app/queries.py`)

All quiz type queries updated to include `render_mode`:

| Function | Change |
|----------|--------|
| `list_quiz_types()` | Added `render_mode` to SELECT |
| `list_active_quiz_types()` | Added `render_mode` to SELECT |
| `get_quiz_type_by_id()` | Added `render_mode` to SELECT |
| `get_quiz_type_by_code()` | Added `render_mode` to SELECT |
| `create_quiz_type()` | Added `render_mode` as 10th INSERT parameter |
| `update_quiz_type()` | Added `"render_mode"` to allowed update fields |
| `get_session_by_id()` | Fetches `render_mode` from `quiz_types` and adds `renderMode` to session dict |

All RETURNING clauses also include `render_mode`.

### Generator (`app/services/generator.py`)

New function **`_gen_basic_fractions()`** (~80 lines):

- Generates fraction arithmetic questions with KaTeX-ready LaTeX expressions
- Three operation types randomly selected:
  - **Addition** — same denominator, e.g. `\frac{1}{4} + \frac{2}{4}`
  - **Subtraction** — same denominator, e.g. `\frac{3}{5} - \frac{1}{5}`
  - **Multiply by whole number** — e.g. `\frac{2}{3} \times 4`
- Denominators: 2, 3, 4, 5, 6, 8, 10
- Answers are simplified fractions as text (e.g. `"3/4"`, `"1"`)
- Uses `gcd` for automatic simplification
- Registered in `GENERATORS` as `"basic_fractions"`

### Sessions Router (`app/routers/sessions.py`)

- Session creation response now includes `"renderMode": quiz_type.get("render_mode", "text")`
- This allows the frontend to know the render mode immediately after starting a quiz

---

## Frontend Changes (Angular)

### Dependencies

- Installed **KaTeX 0.16.37** via `npm install katex`
- Added `node_modules/katex/dist/katex.min.css` to `angular.json` build styles array
- KaTeX includes built-in TypeScript types — no `@types/katex` needed

### New Files

| File | Purpose |
|------|---------|
| `shared/pipes/katex.pipe.ts` | Angular pipe that transforms LaTeX expressions to rendered KaTeX HTML |
| `shared/components/exam-paper-view.component.ts` | Exam-paper style corrected answer layout component |

### KatexPipe (`shared/pipes/katex.pipe.ts`)

- Standalone pipe, selector: `katex`
- `transform(expression, enabled)` — renders LaTeX via `katex.renderToString()`
- Options: `throwOnError: false`, `displayMode: false`, `output: 'html'`
- Falls back to plain text on error with `console.warn`

### ExamPaperViewComponent (`shared/components/exam-paper-view.component.ts`)

- Standalone component, selector: `app-exam-paper-view`
- **Inputs:**
  - `questions: ExamPaperQuestion[]` — question data with expression, correct answer, student answer
  - `katexEnabled: boolean` — toggles KaTeX rendering
  - `startedAt / finishedAt: string | null` — for duration display
  - `reviews: ExamPaperReview[]` — teacher/parent reviews
- **Visual layout:**
  - Each question: position number + expression + `=` + answer + correction mark
  - ✓ checkmark (red) for correct answers
  - Strikethrough + red correct answer for wrong answers
  - Dash (—) for unanswered questions
  - Score summary line at bottom with duration
  - Reviews section below score
- **Exports:** `ExamPaperQuestion` and `ExamPaperReview` interfaces
- **CSS:** `.exam-paper`, `.exam-question`, `.exam-correct-mark`, `.exam-wrong-answer`, `.exam-correct-answer`, `.exam-unanswered`, `.exam-summary`, `.exam-reviews`

### Models

**`models/quiz-type.model.ts`:**
- Added `render_mode: string` to `QuizType`
- Added `render_mode?: string` to `QuizTypeCreate` and `QuizTypeUpdate`

**`models/session.model.ts`:**
- Added `renderMode?: string` to `CreateSessionResponse`
- Added `renderMode?: string` to `SessionDetailSession`

### QuizService (`core/services/quiz.service.ts`)

- Added `renderMode: string` to `ActiveQuiz` interface
- Flows render mode from session creation through to quiz component

### Modified Components

#### Session Detail (`features/history/session-detail.component.ts`)

- Added view toggle: `p-selectButton` with options "📝 Exam Paper" / "📊 Table"
- Added KaTeX checkbox: `p-checkbox` toggling `katexEnabled`
- Default `viewMode = 'exam'`, `katexEnabled` auto-set from session's `renderMode`
- When exam view: renders `ExamPaperViewComponent`; when table: shows existing `p-table`
- New method: `examPaperQuestions()` — maps session questions to `ExamPaperQuestion[]`
- New method: `answerValue()` — extracts answer value from question data

#### Teacher Dashboard (`features/teacher/teacher-dashboard.component.ts`)

- Added exam-paper/table toggle in review dialog
- Added KaTeX checkbox in review dialog
- New properties: `reviewViewMode`, `reviewKatexEnabled`, `reviewViewOptions`
- `openReviewDialog()` — auto-sets `katexEnabled` based on session's `renderMode`
- New methods: `reviewExamPaperQuestions()`, `answerValue()`

#### Parent Dashboard (`features/parent/parent-dashboard.component.ts`)

- Added exam-paper/table toggle in session detail dialog
- Added KaTeX checkbox in session detail dialog
- New properties: `detailViewMode`, `detailKatexEnabled`, `detailViewOptions`
- `openSessionDialog()` — auto-sets `katexEnabled` based on session's `renderMode`
- New methods: `detailExamPaperQuestions()`, `answerValue()`

#### Quiz Component (`features/quiz/quiz.component.ts`)

- Added `KatexPipe` to imports
- Added `quizRenderMode` property (default `'text'`)
- Template: question expression conditionally rendered via `katex` pipe when `quizRenderMode === 'katex'`
- `quizRenderMode` set from:
  - `ActiveQuiz.renderMode` when navigating from start page
  - `SessionDetail.session.renderMode` when resuming from API

#### Start Component (`features/start/start.component.ts`)

- Passes `renderMode` through to `setActiveQuiz()` from `CreateSessionResponse` or quiz type data

#### Quiz Type Editor (`features/quiz-type-editor/quiz-type-editor.component.ts`)

- Added `render_mode` dropdown (`p-dropdown`) in create/edit dialog
- Added `render_mode` column to quiz types table with color-coded `p-tag`:
  - `warning` severity for `katex`
  - `secondary` severity for `text`
- Table colspan updated from 9 to 10
- New property: `formRenderMode = 'text'`
- New property: `renderModeOptions = ['text', 'katex']`
- Added `'basic_fractions'` to `templateKindOptions`
- `openNew()`, `editQuizType()`, `saveQuizType()` — all handle `render_mode`

---

## Translations

### English (`assets/i18n/en.json`)

| Key | Value |
|-----|-------|
| `examPaper.score` | Score |
| `examPaper.time` | Time |
| `examPaper.enableKatex` | Render maths notation |
| `quizEditor.renderMode` | Render Mode |

### Hungarian (`assets/i18n/hu.json`)

| Key | Value |
|-----|-------|
| `examPaper.score` | Pontszám |
| `examPaper.time` | Idő |
| `examPaper.enableKatex` | Matematikai jelölés megjelenítése |
| `quizEditor.renderMode` | Megjelenítési mód |

---

## Data Flow

```
quiz_types.render_mode (DB)
  ↓
GET /quiz-types → QuizTypeOut.render_mode
  ↓
POST /sessions → response.renderMode
  ↓
QuizService.activeQuiz().renderMode
  ↓
QuizComponent.quizRenderMode → KatexPipe in template
  ↓
GET /sessions/:id → session.renderMode
  ↓
SessionDetail / TeacherDashboard / ParentDashboard
  ↓
ExamPaperViewComponent ← katexEnabled toggle
```

---

## File Change Summary

| File | Action |
|------|--------|
| `db/migrations/0020_render_mode.sql` | **Created** |
| `db/migrations/0021_basic_fractions_quiz_type.sql` | **Created** |
| `python-api/app/schemas/quiz_type.py` | Modified |
| `python-api/app/queries.py` | Modified |
| `python-api/app/services/generator.py` | Modified |
| `python-api/app/routers/sessions.py` | Modified |
| `angular-app/angular.json` | Modified |
| `angular-app/package.json` | Modified (katex dependency) |
| `angular-app/src/app/shared/pipes/katex.pipe.ts` | **Created** |
| `angular-app/src/app/shared/components/exam-paper-view.component.ts` | **Created** |
| `angular-app/src/app/models/quiz-type.model.ts` | Modified |
| `angular-app/src/app/models/session.model.ts` | Modified |
| `angular-app/src/app/core/services/quiz.service.ts` | Modified |
| `angular-app/src/app/features/history/session-detail.component.ts` | Modified |
| `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` | Modified |
| `angular-app/src/app/features/parent/parent-dashboard.component.ts` | Modified |
| `angular-app/src/app/features/quiz/quiz.component.ts` | Modified |
| `angular-app/src/app/features/quiz-type-editor/quiz-type-editor.component.ts` | Modified |
| `angular-app/src/app/features/start/start.component.ts` | Modified |
| `angular-app/src/assets/i18n/en.json` | Modified |
| `angular-app/src/assets/i18n/hu.json` | Modified |
