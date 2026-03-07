# OpenMath — Implementation Spec (Angular + FastAPI + PostgreSQL + PrimeNG)

**Status:** Active (March 2026)  
**Stack:** Angular 18+ | PrimeNG | Python FastAPI | PostgreSQL 16 | JSONB

---

## 1) Purpose

This spec defines the target architecture for **OpenMath v2.0**, featuring:

1. **Angular frontend** with PrimeNG component library
2. **FastAPI backend** (Python 3.11+)
3. **PostgreSQL database** with JSONB-based flexible question/answer storage
4. Feature parity with the existing Nuxt 4 implementation (v1.5)

This document serves as the **primary implementation blueprint** for the next development wave.

---

## 2) Current Product Scope

OpenMath is a quiz platform for elementary math practice (grades 2–4, HU általános iskola alsó tagozat), with student profiles and session history.

### 2.1 Implemented Quiz Types (v1.5 baseline)

| Code | Shape | Template Kind |
|------|-------|---------------|
| `multiplication_1_10` | `a × b` | `axb` |
| `sum_products_1_10` | `(a × b) + (c × d)` | `axb_plus_cxd` |

### 2.2 Planned Quiz Types (v2.0 JSONB-enabled)

| Code | Shape | Template Kind | Answer Type |
|------|-------|---------------|-------------|
| `paren_mul_sum` | `k × (x + y)` | `paren_mul_sum` | `int` |
| `missing_addend` | `□ + known = sum` | `missing_addend` | `int` |
| `compare` | `38 □ 41` | `compare` | `choice` |
| `decompose_base10` | `347 = __ + __ + __` | `decompose_base10` | `tuple` |
| `convert_metric` | `2m 35cm = __ cm` | `convert_metric` | `unit_int` |
| `fraction_add` | `1/2 + 1/4` | `fraction_add` | `fraction` |

### 2.3 Difficulty Labels

- `low`: factors `[1, 5, 10]`
- `medium`: factors `[1, 2, 3, 4, 5, 6, 10]`
- `hard`: factors `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`

### 2.4 Main User Areas

| Route | Purpose |
|-------|---------|
| `/` | Start page (create session) |
| `/quiz/:sessionId` | Quiz page (answer questions) |
| `/history` | Session history list |
| `/history/:sessionId` | Session detail |
| `/profile` | Student profile management |
| `/user-guide` | Usage instructions |
| `/admin` | Database statistics/admin |

---

## 3) UX and Navigation Behavior

### 3.1 Global Layout

**Header navigation:**
- Start (`/`)
- Profile (`/profile`)
- History (`/history`)
- User Guide (`/user-guide`)
- Admin (`/admin`)

**Global state:**
- `currentStudentId` (active student UUID)
- `studentsDirectory` (list of `{id, name}`)

**Header student selector:**
- "No student" option (empty value)
- All students from `GET /api/students`
- Auto-reset if selected student no longer exists

**Footer:** Static metadata (version, source link, stack)

### 3.2 Start Page (`/`)

**Form fields:**
- Quiz type selector (`quizTypeCode`)
- Difficulty radio group (`low|medium|hard`)
- New student fields (when no active student):
  - `studentName` (required)
  - `studentAge` (optional, 4..120)
  - `studentGender` (enum)
  - `learnedTimetables` checkboxes (1..10, at least one)
- `totalQuestions` (1..30, default 10)

**Behavior:**
- Validates required fields before submit
- Calls `POST /api/sessions`
- Stores `activeQuiz` in state: `{sessionId, quizTypeCode, questions}`
- Navigates to `/quiz/:sessionId`

### 3.3 Quiz Page (`/quiz/:sessionId`)

**Display:**
- Quiz type label
- Progress indicator: `answered / total`
- Current question card with answer input

**Session bootstrap:**
1. If `activeQuiz.sessionId` matches route → use in-memory questions
2. Else fetch `GET /api/sessions/:id`:
   - Filter to unanswered questions
   - Compute `initialAnsweredCount`

**Answer flow:**
- Submit via `POST /api/answers`
- Show feedback: `Correct!` or `Wrong, correct answer is X.`
- Advance to next question or navigate to `/history/:sessionId`

**Input UX:**
- Auto-focus answer input on mount and question change
- Support for different answer types (int, choice, tuple based on `prompt.answer.type`)

### 3.4 History Page (`/history`)

**Data:** Parallel load of sessions and quiz types

**Features:**
- Toggle: "Show only active student results" (default true)
- Group sessions by quiz type
- Per-group session table

**Session table columns:**
- Student
- Difficulty (linked to detail)
- Questions
- Time Spent
- Avg/Question
- Score
- Started
- Finished (or "In progress" link)

**Duration formatting:**
- `≤0` → `0s`
- `<60s` → `Ns`
- `<3600s` → `mm:ss`
- `≥3600s` → `hh:mm:ss`

### 3.5 Session Detail Page (`/history/:sessionId`)

**Display:**
- Session ID
- Student name (or `-`)
- Result summary (correct, wrong, percent, avg time)
- Question table with:
  - Position
  - Question text (rendered from `prompt.render`)
  - Correct value
  - Student answer (or `—`)
  - Status badge

### 3.6 Profile Page (`/profile`)

**Requires active student selection.**

**Editable fields:**
- `name` (required)
- `age` (nullable, 4..120)
- `gender` (nullable enum)
- `learned_timetables` (≥1 item)

**Stats display:**
- Overall bucket
- Per quiz type breakdown

### 3.7 User Guide Page (`/user-guide`)

Static instructional content.

### 3.8 Admin Page (`/admin`)

**Stats cards:** `quiz_types`, `students`, `quiz_sessions`, `questions`, `answers`

**Actions:**
- Refresh counts
- Browse table rows
- Delete all data (with confirmation modal)

---

## 4) Backend API Contracts

**Base path:** `/api`

### 4.1 `GET /api/quiz-types`

```json
[
  {
    "id": "uuid",
    "code": "multiplication_1_10",
    "description": "Multiplication quiz with factors between 1 and 10",
    "answer_type": "int",
    "template_kind": "axb"
  }
]
```

### 4.2 `GET /api/students`

```json
[
  { "id": "uuid", "name": "Anna" }
]
```

### 4.3 `GET /api/students/{id}`

```json
{
  "id": "uuid",
  "name": "Anna",
  "age": 9,
  "gender": "female",
  "learned_timetables": [1,2,3,4,5],
  "stats": {
    "overall": {
      "quiz_type_code": "all",
      "quiz_type_description": "All quiz types",
      "sessions": 4,
      "completed_sessions": 3,
      "in_progress_sessions": 1,
      "total_questions": 40,
      "correct_answers": 31,
      "wrong_answers": 9,
      "average_score_percent": 77.5,
      "total_time_seconds": 523
    },
    "by_quiz_type": [...]
  }
}
```

### 4.4 `PATCH /api/students/{id}`

**Request:**
```json
{
  "name": "Anna",
  "age": 10,
  "gender": "female",
  "learned_timetables": [1,2,3,4,5,10]
}
```

**Validation:**
- `name`: non-empty string
- `age`: null or 4..120
- `gender`: null or enum
- `learned_timetables`: array of 1..10, at least one

### 4.5 `POST /api/sessions`

**Request:**
```json
{
  "difficulty": "medium",
  "totalQuestions": 10,
  "quizTypeCode": "multiplication_1_10",
  "studentId": "uuid-or-null",
  "studentName": "optional",
  "studentAge": null,
  "studentGender": null,
  "learnedTimetables": [1,2,3,4,5]
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "quizTypeCode": "multiplication_1_10",
  "questions": [
    {
      "id": "uuid",
      "position": 1,
      "prompt": {
        "template": { "kind": "axb", "a": 5, "b": 7 },
        "answer": { "type": "int" },
        "render": "5 × 7"
      }
    }
  ]
}
```

### 4.6 `POST /api/answers`

**Request:**
```json
{
  "questionId": "uuid",
  "response": {
    "raw": "35",
    "parsed": { "type": "int", "value": 35 }
  }
}
```

**Response:**
```json
{
  "isCorrect": true,
  "correctValue": 35,
  "session": {
    "correct": 3,
    "wrong": 1,
    "percent": 75
  }
}
```

**Behavior:**
- Idempotent: no new answer if already exists for question
- Session counters recomputed on each submit

### 4.7 `GET /api/sessions`

```json
[
  {
    "id": "uuid",
    "student_id": "uuid-or-null",
    "difficulty": "low",
    "total_questions": 10,
    "score_percent": 80,
    "started_at": "2026-03-02T10:00:00.000Z",
    "finished_at": null,
    "student_name": "Anna",
    "quiz_type_code": "multiplication_1_10"
  }
]
```

**Order:** `started_at DESC`

### 4.8 `GET /api/sessions/{id}`

```json
{
  "session": {
    "id": "uuid",
    "studentId": "uuid-or-null",
    "quizTypeId": "uuid",
    "difficulty": "low",
    "totalQuestions": 10,
    "correctCount": 6,
    "wrongCount": 2,
    "scorePercent": "60.00",
    "startedAt": "...",
    "finishedAt": null,
    "studentName": "Anna",
    "quizTypeCode": "multiplication_1_10"
  },
  "questions": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "position": 1,
      "prompt": {
        "template": { "kind": "axb", "a": 2, "b": 3 },
        "answer": { "type": "int" },
        "render": "2 × 3"
      },
      "correct": 6,
      "answer": {
        "id": "uuid",
        "response": { "raw": "6", "parsed": { "type": "int", "value": 6 } },
        "isCorrect": true,
        "answeredAt": "..."
      }
    }
  ]
}
```

### 4.9 `GET /api/stats`

```json
{
  "quiz_types": 2,
  "students": 5,
  "quiz_sessions": 12,
  "questions": 120,
  "answers": 88
}
```

### 4.10 `GET /api/stats/{table}`

**Allowed tables:** `quiz_types`, `students`, `quiz_sessions`, `questions`, `answers`

### 4.11 `POST /api/stats/reset`

**Request:**
```json
{ "confirmation": "DELETE ALL DATA" }
```

**Scope:** Deletes `answers`, `questions`, `quiz_sessions`, `students`. Preserves `quiz_types`.

---

## 5) Domain and Business Logic

### 5.1 Learned Timetables Sanitization

- Accept only integers `[1..10]`
- Remove duplicates
- Fallback to `[1..10]` if empty/invalid

### 5.2 Question Generation

**Inputs:** `difficulty`, `totalQuestions`, `quizTypeCode`, `learnedTimetables`

**Algorithm:**
1. Compute `learnedSet` (sanitized)
2. Compute `difficultySet` from difficulty mapping
3. `focusSet = difficultySet ∩ learnedSet`
4. `effectiveFocus = focusSet` if non-empty, else `learnedSet`
5. For each position:
   - Generate factors based on `template.kind`
   - Build `prompt` JSONB payload
   - Compute `correct` value

**Generated question record:**
```python
{
    "session_id": uuid,
    "quiz_type_id": uuid,
    "position": int,
    "prompt": {
        "template": {"kind": "axb", "a": 5, "b": 7},
        "answer": {"type": "int"},
        "render": "5 × 7"
    },
    "correct": 35,
    # Legacy columns (phase 1): a=5, b=7, c=null, d=null
}
```

### 5.3 Answer Grading

**Process:**
1. Parse `response.parsed` based on `prompt.answer.type`
2. Compare to expected answer:
   - `int`: exact equality to `questions.correct`
   - `choice`: exact match to expected option
   - `tuple`: element-wise comparison with constraints
   - `fraction`: normalized comparison (simplify if required)
3. Record `is_correct`, store full `response` JSONB
4. Update session counters

**Session completion:**
- Set `finished_at = now()` when answer count equals `total_questions`

### 5.4 Student Performance Aggregation

**Buckets:**
- `overall` (all quiz types)
- `by_quiz_type` (per code)

**Metrics per bucket:**
- `sessions`, `completed_sessions`, `in_progress_sessions`
- `total_questions`, `correct_answers`, `wrong_answers`
- `average_score_percent` (completed only)
- `total_time_seconds`

---

## 6) PostgreSQL Schema (JSONB Modernization)

### 6.1 Schema Overview

This schema supports **both legacy columns and JSONB** during migration, with eventual deprecation of fixed operand columns.

### 6.2 `quiz_types`

```sql
CREATE TABLE quiz_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'int',        -- NEW: int|choice|tuple|fraction|unit_int
  template_kind TEXT NULL,                         -- NEW: axb, compare, missing_addend, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Seed data:**
```sql
INSERT INTO quiz_types (code, description, answer_type, template_kind) VALUES
  ('multiplication_1_10', 'Multiplication quiz with factors between 1 and 10', 'int', 'axb'),
  ('sum_products_1_10', 'Sum of two products with factors between 1 and 10', 'int', 'axb_plus_cxd');
```

### 6.3 `students`

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INT NULL CHECK (age IS NULL OR age BETWEEN 4 AND 120),
  gender TEXT NULL CHECK (gender IN ('female','male','other','prefer_not_say')),
  learned_timetables INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 6.4 `quiz_sessions`

```sql
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NULL REFERENCES students(id) ON DELETE SET NULL,
  quiz_type_id UUID NOT NULL REFERENCES quiz_types(id),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('low','medium','hard')),
  total_questions INT NOT NULL CHECK (total_questions > 0),
  correct_count INT NOT NULL DEFAULT 0,
  wrong_count INT NOT NULL DEFAULT 0,
  score_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_sessions_quiz_type ON quiz_sessions(quiz_type_id);
CREATE INDEX idx_sessions_started ON quiz_sessions(started_at DESC);
CREATE INDEX idx_sessions_student ON quiz_sessions(student_id);
```

### 6.5 `questions` (JSONB-enabled)

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  quiz_type_id UUID NOT NULL REFERENCES quiz_types(id),
  
  -- JSONB payload (new primary storage)
  prompt JSONB NOT NULL,
  
  -- Legacy columns (kept for backwards compatibility, phase 1)
  a INT NULL CHECK (a IS NULL OR a BETWEEN 1 AND 10),
  b INT NULL CHECK (b IS NULL OR b BETWEEN 1 AND 10),
  c INT NULL CHECK (c IS NULL OR c BETWEEN 1 AND 10),
  d INT NULL CHECK (d IS NULL OR d BETWEEN 1 AND 10),
  
  correct INT NOT NULL,
  position INT NOT NULL CHECK (position >= 1),
  UNIQUE (session_id, position)
);

CREATE INDEX idx_questions_session ON questions(session_id);
CREATE INDEX idx_questions_quiz_type ON questions(quiz_type_id);
CREATE INDEX questions_prompt_gin ON questions USING gin(prompt);
CREATE INDEX questions_template_kind_idx ON questions((prompt->'template'->>'kind'));
```

### 6.6 `answers` (JSONB-enabled)

```sql
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  quiz_type_id UUID NOT NULL REFERENCES quiz_types(id),
  
  -- JSONB response (new primary storage)
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_input TEXT NULL,
  
  -- Legacy column (kept for backwards compatibility, phase 1)
  value INT NULL,
  
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_quiz_type ON answers(quiz_type_id);
CREATE INDEX answers_response_gin ON answers USING gin(response);
```

---

## 7) JSONB Payload Structures

### 7.1 `questions.prompt`

**Required:** Either `template` (preferred) or `expr` (AST fallback)  
**Recommended:** `answer`, `render`

#### Template Mode (grades 2-4 patterns)

```json
{
  "template": { "kind": "axb", "a": 7, "b": 9 },
  "answer": { "type": "int" },
  "render": "7 × 9"
}
```

```json
{
  "template": { "kind": "missing_addend", "known": 17, "sum": 45 },
  "answer": { "type": "int" },
  "render": "□ + 17 = 45"
}
```

```json
{
  "template": { "kind": "compare", "left": 38, "right": 41 },
  "answer": { "type": "choice", "options": ["<", ">", "="] },
  "render": "38 □ 41"
}
```

```json
{
  "template": { "kind": "decompose_base10", "n": 347, "places": ["hundreds","tens","ones"] },
  "answer": { "type": "tuple", "arity": 3, "items": [{"type":"int"},{"type":"int"},{"type":"int"}] },
  "render": "347 = __ + __ + __",
  "constraints": { "must_sum_to": 347, "must_be_place_values": true }
}
```

#### Expr Mode (AST fallback)

```json
{
  "expr": { "op": "*", "args": [3, { "op": "+", "args": [7, 5] }] },
  "answer": { "type": "int" },
  "render": "3 × (7 + 5)"
}
```

### 7.2 Template Kinds Reference

| Kind | Parameters | Example |
|------|------------|---------|
| `axb` | `a`, `b` | `7 × 9` |
| `axb_plus_cxd` | `a`, `b`, `c`, `d` | `(2×5) + (3×4)` |
| `paren_mul_sum` | `k`, `x`, `y` | `3 × (7 + 5)` |
| `missing_addend` | `known`, `sum` | `□ + 17 = 45` |
| `compare` | `left`, `right` | `38 □ 41` |
| `decompose_base10` | `n`, `places` | `347 = __ + __ + __` |
| `convert_metric` | `value`, `to` | `2m 35cm = __ cm` |
| `fraction_add` | `a`, `b` (as `[num, den]`) | `1/2 + 1/4` |

### 7.3 Answer Types

| Type | Example Prompt | Student Response |
|------|---------------|------------------|
| `int` | `7 × 9` | `{"raw":"63","parsed":{"type":"int","value":63}}` |
| `choice` | `38 □ 41` | `{"raw":"<","parsed":{"type":"choice","value":"<"}}` |
| `tuple` | `347 = __ + __ + __` | `{"raw":"300,40,7","parsed":{"type":"tuple","values":[300,40,7]}}` |
| `fraction` | `1/2 + 1/4` | `{"raw":"3/4","parsed":{"type":"fraction","num":3,"den":4}}` |
| `unit_int` | `2m 35cm = __ cm` | `{"raw":"235","parsed":{"type":"unit_int","value":235,"unit":"cm"}}` |

### 7.4 `answers.response`

```json
{
  "raw": "35",
  "parsed": { "type": "int", "value": 35 },
  "timing_ms": 2340,
  "steps": [],
  "errors": []
}
```

---

## 8) FastAPI Backend Blueprint

### 8.1 Project Structure

```
python-api/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Settings, DATABASE_URL
│   ├── database.py             # Async PostgreSQL connection
│   ├── models/
│   │   ├── __init__.py
│   │   ├── quiz_type.py
│   │   ├── student.py
│   │   ├── session.py
│   │   ├── question.py
│   │   └── answer.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── quiz_type.py
│   │   ├── student.py
│   │   ├── session.py
│   │   ├── question.py
│   │   ├── answer.py
│   │   └── stats.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── quiz_types.py
│   │   ├── students.py
│   │   ├── sessions.py
│   │   ├── answers.py
│   │   └── stats.py
│   └── services/
│       ├── __init__.py
│       ├── difficulty.py
│       ├── generator.py
│       ├── grader.py
│       └── stats.py
├── tests/
├── requirements.txt
└── README.md
```

### 8.2 Key Dependencies

```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
asyncpg>=0.29.0
pydantic>=2.6.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
```

### 8.3 Router Registration

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import quiz_types, students, sessions, answers, stats

app = FastAPI(title="OpenMath API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],  # Angular dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quiz_types.router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(answers.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
```

### 8.4 Pydantic Schemas (examples)

```python
# app/schemas/question.py
from pydantic import BaseModel
from typing import Optional, Any
from uuid import UUID

class PromptTemplate(BaseModel):
    kind: str
    # Dynamic fields based on kind

class PromptAnswer(BaseModel):
    type: str  # int, choice, tuple, fraction, unit_int
    options: Optional[list[str]] = None
    arity: Optional[int] = None

class Prompt(BaseModel):
    template: Optional[dict] = None
    expr: Optional[dict] = None
    answer: PromptAnswer
    render: str
    constraints: Optional[dict] = None

class QuestionOut(BaseModel):
    id: UUID
    position: int
    prompt: Prompt

class AnswerResponse(BaseModel):
    raw: str
    parsed: dict
    timing_ms: Optional[int] = None
```

### 8.5 Question Generator Service

```python
# app/services/generator.py
from typing import Any
import random

DIFFICULTY_SETS = {
    "low": [1, 5, 10],
    "medium": [1, 2, 3, 4, 5, 6, 10],
    "hard": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

def generate_questions(
    quiz_type_code: str,
    template_kind: str,
    difficulty: str,
    total: int,
    learned_timetables: list[int]
) -> list[dict]:
    """Generate question payloads with JSONB prompt structure."""
    
    learned_set = set(t for t in learned_timetables if 1 <= t <= 10) or set(range(1, 11))
    difficulty_set = set(DIFFICULTY_SETS.get(difficulty, DIFFICULTY_SETS["hard"]))
    focus_set = difficulty_set & learned_set or learned_set
    
    questions = []
    for pos in range(1, total + 1):
        if template_kind == "axb":
            a = random.choice(list(focus_set))
            b = random.choice(list(learned_set))
            if random.random() < 0.5:
                a, b = b, a
            prompt = {
                "template": {"kind": "axb", "a": a, "b": b},
                "answer": {"type": "int"},
                "render": f"{a} × {b}"
            }
            correct = a * b
            questions.append({"position": pos, "prompt": prompt, "correct": correct, "a": a, "b": b})
        
        elif template_kind == "axb_plus_cxd":
            a = random.choice(list(focus_set))
            b = random.choice(list(learned_set))
            c = random.choice(list(focus_set))
            d = random.choice(list(learned_set))
            prompt = {
                "template": {"kind": "axb_plus_cxd", "a": a, "b": b, "c": c, "d": d},
                "answer": {"type": "int"},
                "render": f"({a} × {b}) + ({c} × {d})"
            }
            correct = (a * b) + (c * d)
            questions.append({"position": pos, "prompt": prompt, "correct": correct, "a": a, "b": b, "c": c, "d": d})
        
        # Add more template_kind handlers as quiz types expand
    
    return questions
```

### 8.6 Grader Service

```python
# app/services/grader.py
from typing import Any

def grade_answer(prompt: dict, response: dict, correct_value: int) -> bool:
    """Grade student response based on answer type."""
    
    answer_type = prompt.get("answer", {}).get("type", "int")
    parsed = response.get("parsed", {})
    
    if answer_type == "int":
        return parsed.get("value") == correct_value
    
    elif answer_type == "choice":
        expected = determine_expected_choice(prompt)
        return parsed.get("value") == expected
    
    elif answer_type == "tuple":
        values = parsed.get("values", [])
        constraints = prompt.get("constraints", {})
        if constraints.get("must_sum_to"):
            return sum(values) == constraints["must_sum_to"]
        return False
    
    elif answer_type == "fraction":
        # Normalize and compare
        num, den = parsed.get("num"), parsed.get("den")
        expected_num, expected_den = compute_expected_fraction(prompt)
        return normalize_fraction(num, den) == normalize_fraction(expected_num, expected_den)
    
    return False

def determine_expected_choice(prompt: dict) -> str:
    template = prompt.get("template", {})
    if template.get("kind") == "compare":
        left, right = template.get("left"), template.get("right")
        if left < right:
            return "<"
        elif left > right:
            return ">"
        return "="
    return ""
```

---

## 9) Angular + PrimeNG Frontend Blueprint

### 9.1 Project Structure

```
angular-app/
├── src/
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── core/
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts
│   │   │   │   ├── quiz.service.ts
│   │   │   │   └── student.service.ts
│   │   │   ├── guards/
│   │   │   └── interceptors/
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── header/
│   │   │   │   ├── footer/
│   │   │   │   └── student-selector/
│   │   │   └── pipes/
│   │   │       └── duration.pipe.ts
│   │   ├── features/
│   │   │   ├── start/
│   │   │   │   └── start.component.ts
│   │   │   ├── quiz/
│   │   │   │   ├── quiz.component.ts
│   │   │   │   └── question-card/
│   │   │   ├── history/
│   │   │   │   ├── history-list.component.ts
│   │   │   │   ├── session-detail.component.ts
│   │   │   │   └── session-table.component.ts
│   │   │   ├── profile/
│   │   │   │   └── profile.component.ts
│   │   │   ├── user-guide/
│   │   │   │   └── user-guide.component.ts
│   │   │   └── admin/
│   │   │       └── admin.component.ts
│   │   └── models/
│   │       ├── quiz-type.model.ts
│   │       ├── student.model.ts
│   │       ├── session.model.ts
│   │       ├── question.model.ts
│   │       └── answer.model.ts
│   ├── environments/
│   └── styles.scss
├── angular.json
├── package.json
└── tsconfig.json
```

### 9.2 Key Dependencies

```json
{
  "dependencies": {
    "@angular/core": "^18.0.0",
    "@angular/router": "^18.0.0",
    "@angular/forms": "^18.0.0",
    "primeng": "^17.0.0",
    "primeicons": "^7.0.0",
    "primeflex": "^3.3.0"
  }
}
```

### 9.3 Routes Configuration

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./features/start/start.component').then(m => m.StartComponent) },
  { path: 'quiz/:sessionId', loadComponent: () => import('./features/quiz/quiz.component').then(m => m.QuizComponent) },
  { path: 'history', loadComponent: () => import('./features/history/history-list.component').then(m => m.HistoryListComponent) },
  { path: 'history/:sessionId', loadComponent: () => import('./features/history/session-detail.component').then(m => m.SessionDetailComponent) },
  { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
  { path: 'user-guide', loadComponent: () => import('./features/user-guide/user-guide.component').then(m => m.UserGuideComponent) },
  { path: 'admin', loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent) },
  { path: '**', redirectTo: '' }
];
```

### 9.4 PrimeNG Component Mapping

| Concept | PrimeNG Component |
|---------|-------------------|
| Quiz type selector | `p-dropdown` |
| Difficulty selector | `p-selectButton` or `p-radioButton` |
| Timetables checkboxes | `p-checkbox` |
| Question count input | `p-inputNumber` |
| Submit button | `p-button` |
| Progress indicator | `p-progressBar` |
| Answer input (int) | `p-inputNumber` |
| Answer input (choice) | `p-selectButton` |
| Session table | `p-table` |
| Stats cards | `p-card` |
| Confirmation dialog | `p-confirmDialog` |
| Toast messages | `p-toast` |
| Student selector | `p-dropdown` |

### 9.5 State Management

**Signal-based state (Angular 18+):**

```typescript
// core/services/quiz.service.ts
import { Injectable, signal, computed } from '@angular/core';

export interface ActiveQuiz {
  sessionId: string;
  quizTypeCode: string;
  questions: Question[];
}

@Injectable({ providedIn: 'root' })
export class QuizService {
  private _activeQuiz = signal<ActiveQuiz | null>(null);
  private _currentStudentId = signal<string>('');
  private _studentsDirectory = signal<{id: string, name: string}[]>([]);

  activeQuiz = this._activeQuiz.asReadonly();
  currentStudentId = this._currentStudentId.asReadonly();
  studentsDirectory = this._studentsDirectory.asReadonly();

  currentStudent = computed(() => {
    const id = this._currentStudentId();
    return this._studentsDirectory().find(s => s.id === id) || null;
  });

  setActiveQuiz(quiz: ActiveQuiz | null) {
    this._activeQuiz.set(quiz);
  }

  setCurrentStudent(id: string) {
    this._currentStudentId.set(id);
  }

  setStudentsDirectory(students: {id: string, name: string}[]) {
    this._studentsDirectory.set(students);
  }
}
```

### 9.6 API Service

```typescript
// core/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  // Quiz Types
  getQuizTypes() {
    return this.http.get<QuizType[]>(`${this.baseUrl}/quiz-types`);
  }

  // Students
  getStudents() {
    return this.http.get<{id: string, name: string}[]>(`${this.baseUrl}/students`);
  }

  getStudent(id: string) {
    return this.http.get<StudentProfile>(`${this.baseUrl}/students/${id}`);
  }

  updateStudent(id: string, payload: UpdateStudentRequest) {
    return this.http.patch<Student>(`${this.baseUrl}/students/${id}`, payload);
  }

  // Sessions
  createSession(payload: CreateSessionRequest) {
    return this.http.post<CreateSessionResponse>(`${this.baseUrl}/sessions`, payload);
  }

  getSessions() {
    return this.http.get<Session[]>(`${this.baseUrl}/sessions`);
  }

  getSession(id: string) {
    return this.http.get<SessionDetail>(`${this.baseUrl}/sessions/${id}`);
  }

  // Answers
  submitAnswer(payload: SubmitAnswerRequest) {
    return this.http.post<SubmitAnswerResponse>(`${this.baseUrl}/answers`, payload);
  }

  // Stats
  getStats() {
    return this.http.get<Stats>(`${this.baseUrl}/stats`);
  }

  getTableRows(table: string) {
    return this.http.get<TableRows>(`${this.baseUrl}/stats/${table}`);
  }

  resetData(confirmation: string) {
    return this.http.post<{success: boolean}>(`${this.baseUrl}/stats/reset`, { confirmation });
  }
}
```

### 9.7 Question Card Component (JSONB-aware)

```typescript
// features/quiz/question-card/question-card.component.ts
import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-question-card',
  standalone: true,
  imports: [CommonModule, FormsModule, InputNumberModule, SelectButtonModule, CardModule],
  template: `
    <p-card>
      <ng-template pTemplate="header">
        <h3 class="text-center">{{ question.prompt.render }}</h3>
      </ng-template>
      
      <ng-template pTemplate="content">
        @switch (question.prompt.answer.type) {
          @case ('int') {
            <p-inputNumber 
              #answerInput
              [(ngModel)]="intAnswer" 
              [showButtons]="false"
              (keydown.enter)="submit()"
            />
          }
          @case ('choice') {
            <p-selectButton 
              [options]="question.prompt.answer.options" 
              [(ngModel)]="choiceAnswer"
            />
          }
          @case ('tuple') {
            <div class="flex gap-2">
              @for (item of tupleAnswers; track $index) {
                <p-inputNumber [(ngModel)]="tupleAnswers[$index]" />
              }
            </div>
          }
        }
      </ng-template>
      
      <ng-template pTemplate="footer">
        <p-button label="Submit" (onClick)="submit()" [disabled]="!hasAnswer()" />
      </ng-template>
    </p-card>
  `
})
export class QuestionCardComponent implements AfterViewInit {
  @Input() question!: Question;
  @Output() answered = new EventEmitter<AnswerResponse>();
  @ViewChild('answerInput') answerInput?: ElementRef;

  intAnswer: number | null = null;
  choiceAnswer: string = '';
  tupleAnswers: number[] = [];

  ngAfterViewInit() {
    this.focusInput();
  }

  focusInput() {
    setTimeout(() => this.answerInput?.nativeElement?.focus(), 0);
  }

  hasAnswer(): boolean {
    switch (this.question.prompt.answer.type) {
      case 'int': return this.intAnswer !== null;
      case 'choice': return this.choiceAnswer !== '';
      case 'tuple': return this.tupleAnswers.every(v => v !== null);
      default: return false;
    }
  }

  submit() {
    if (!this.hasAnswer()) return;

    const response = this.buildResponse();
    this.answered.emit(response);
    this.resetInputs();
  }

  private buildResponse(): AnswerResponse {
    const type = this.question.prompt.answer.type;
    
    if (type === 'int') {
      return { raw: String(this.intAnswer), parsed: { type: 'int', value: this.intAnswer } };
    }
    if (type === 'choice') {
      return { raw: this.choiceAnswer, parsed: { type: 'choice', value: this.choiceAnswer } };
    }
    if (type === 'tuple') {
      return { raw: this.tupleAnswers.join(','), parsed: { type: 'tuple', values: [...this.tupleAnswers] } };
    }
    
    return { raw: '', parsed: {} };
  }

  private resetInputs() {
    this.intAnswer = null;
    this.choiceAnswer = '';
    this.tupleAnswers = [];
  }
}
```

---

## 10) Migration Strategy

### Phase 1: Add JSONB Columns (no behavior change)

```sql
-- Migration: Add prompt column to questions
ALTER TABLE questions ADD COLUMN prompt JSONB;

-- Migration: Add response columns to answers  
ALTER TABLE answers ADD COLUMN response JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE answers ADD COLUMN raw_input TEXT NULL;

-- Migration: Add quiz_types metadata
ALTER TABLE quiz_types ADD COLUMN answer_type TEXT NOT NULL DEFAULT 'int';
ALTER TABLE quiz_types ADD COLUMN template_kind TEXT NULL;

UPDATE quiz_types SET template_kind = 'axb' WHERE code = 'multiplication_1_10';
UPDATE quiz_types SET template_kind = 'axb_plus_cxd' WHERE code = 'sum_products_1_10';
```

### Phase 2: Backfill Existing Data

```sql
-- Backfill questions.prompt from legacy columns
UPDATE questions SET prompt = jsonb_build_object(
  'template', jsonb_build_object(
    'kind', CASE 
      WHEN c IS NOT NULL THEN 'axb_plus_cxd'
      ELSE 'axb'
    END,
    'a', a, 'b', b, 'c', c, 'd', d
  ),
  'answer', jsonb_build_object('type', 'int'),
  'render', CASE 
    WHEN c IS NOT NULL THEN '(' || a || ' × ' || b || ') + (' || c || ' × ' || d || ')'
    ELSE a || ' × ' || b
  END
)
WHERE prompt IS NULL;

-- Backfill answers.response from legacy value column
UPDATE answers SET response = jsonb_build_object(
  'raw', value::text,
  'parsed', jsonb_build_object('type', 'int', 'value', value)
)
WHERE (response IS NULL OR response = '{}'::jsonb) AND value IS NOT NULL;
```

### Phase 3: App Uses JSONB

- FastAPI generates `prompt` JSONB for new questions
- Answer submission uses `response` JSONB
- Legacy columns written in parallel (dual-write)

### Phase 4: Deprecate Legacy Columns

- Stop writing `a`, `b`, `c`, `d`, `value`
- Keep columns nullable for rollback
- Eventually: DROP legacy columns

---

## 11) Environment Configuration

### Backend `.env`

```env
DATABASE_URL=postgresql://quiz:quiz@localhost:5432/quiz
CORS_ORIGINS=http://localhost:4200
DEBUG=true
```

### Frontend `environment.ts`

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'
};
```

### Docker Compose

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quiz
      POSTGRES_USER: quiz
      POSTGRES_PASSWORD: quiz
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  adminer:
    image: adminer
    ports:
      - "8080:8080"

  api:
    build: ./python-api
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://quiz:quiz@db:5432/quiz
    depends_on:
      - db

  web:
    build: ./angular-app
    ports:
      - "4200:80"
    depends_on:
      - api

volumes:
  pgdata:
```

---

## 12) Acceptance Criteria

### Feature Parity (v1.5)

1. ✅ Both baseline quiz types work identically
2. ✅ Difficulty/timetables interaction matches
3. ✅ Session creation rules preserved
4. ✅ Answer submission idempotent, counters recompute
5. ✅ In-progress sessions resume correctly
6. ✅ Profile stats match aggregation semantics
7. ✅ Admin page supports table browse + reset

### JSONB Modernization (v2.0)

8. ✅ Questions use `prompt` JSONB as primary payload
9. ✅ Answers use `response` JSONB with `raw` + `parsed`
10. ✅ Template-based generation for new quiz types
11. ✅ Frontend renders questions dynamically from `prompt.answer.type`
12. ✅ Grading supports multiple answer types
13. ✅ Backward compatibility with existing data

---

## 13) Known Implementation Notes

1. **Question count limits:** API allows 1..50, UI limits 1..30
2. **Difficulty sets:** All include `1`, hard includes full `1..10`
3. **Score format:** Numeric with 2 decimal precision
4. **Profile average:** Calculated from completed sessions only
5. **Reset scope:** Preserves `quiz_types` table
6. **JSONB indexes:** GIN index on `prompt` and `response` for analytics queries
7. **Legacy columns:** Maintained Phase 1-2 for rollback safety

---

## 14) Future Extensions (Post-v2.0)

- **Expression AST evaluation** for complex questions
- **Fraction simplification** requirements and grading
- **Unit conversion** with multiple target units
- **Timed mode** with per-question countdown
- **Adaptive difficulty** based on performance
- **Teacher dashboard** with class-level analytics
- **Progress badges** and achievements
