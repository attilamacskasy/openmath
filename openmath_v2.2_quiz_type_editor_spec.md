
# OpenMath v2.2 — Quiz Type Editor

## Feature Summary

**Version:** 2.2  
**Scope:** Admin-only Quiz Type Editor — new menu item for admin users  
**Depends on:** v2.1 (auth/RBAC)  
**Tech stack:** Angular 18 + PrimeNG 17 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

Currently quiz types are managed only via SQL migrations. Only two quiz types exist:

| Code | Template | Description |
|---|---|---|
| `multiplication_1_10` | `axb` | a × b (factors 1–10) |
| `sum_products_1_10` | `axb_plus_cxd` | (a × b) + (c × d) |

**v2.2 delivers:**

1. A full CRUD admin page for quiz types (new **Quiz Types** menu item, admin-only)
2. Schema extensions: age range, active flag, sort order, category
3. Start page filters quiz types by the student's age (when range is set)
4. **14 new quiz types** seeded via migration — aligned with the Hungarian 2nd‑grade curriculum
5. Matching generator templates in the backend for every new quiz type
6. Grader support for the new answer types (`text`, `tuple`)

---

## 2. Database Changes

### 2.1 Migration `0007_quiz_type_editor.sql`

```sql
-- ── Schema additions ───────────────────────────────────────────
ALTER TABLE quiz_types
  ADD COLUMN IF NOT EXISTS category        TEXT,
  ADD COLUMN IF NOT EXISTS recommended_age_min INT,
  ADD COLUMN IF NOT EXISTS recommended_age_max INT,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order      INT     NOT NULL DEFAULT 0;

-- Age range sanity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_types_age_range_check') THEN
    ALTER TABLE quiz_types
      ADD CONSTRAINT quiz_types_age_range_check CHECK (
        recommended_age_min IS NULL
        OR recommended_age_max IS NULL
        OR recommended_age_min <= recommended_age_max
      );
  END IF;
END $$;

-- ── Backfill existing rows ─────────────────────────────────────
UPDATE quiz_types SET category = 'multiplication', sort_order = 1,
       recommended_age_min = 7, recommended_age_max = 9
WHERE code = 'multiplication_1_10';

UPDATE quiz_types SET category = 'multiplication', sort_order = 2,
       recommended_age_min = 8, recommended_age_max = 10
WHERE code = 'sum_products_1_10';

-- ── Seed new quiz types ────────────────────────────────────────

-- Arithmetic
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('add_within_20',        'Addition within 20 (a + b ≤ 20)',                 'a_plus_b',         'int', 'arithmetic',    3,  6, 8),
  ('sub_within_20',        'Subtraction within 20 (a − b, a ≥ b)',            'a_minus_b',        'int', 'arithmetic',    4,  6, 8),
  ('add_round_tens',       'Addition of round tens (10+20, 30+40 …)',         'round_tens_add',   'int', 'arithmetic',    5,  7, 8),
  ('sub_round_tens',       'Subtraction of round tens (50−20 …)',             'round_tens_sub',   'int', 'arithmetic',    6,  7, 8),
  ('add_within_100',       'Addition within 100 (a + b ≤ 100)',               'a_plus_b_100',     'int', 'arithmetic',    7,  7, 9),
  ('sub_within_100',       'Subtraction within 100 (a − b, a ≥ b)',           'a_minus_b_100',    'int', 'arithmetic',    8,  7, 9),
  ('two_digit_plus_one',   'Two‑digit + one‑digit (47 + 6)',                  'two_plus_one',     'int', 'arithmetic',    9,  7, 9),
  ('two_digit_minus_one',  'Two‑digit − one‑digit (63 − 5)',                  'two_minus_one',    'int', 'arithmetic',   10,  7, 9)
ON CONFLICT (code) DO NOTHING;

-- Multiplication & Division
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('times_table_3',    'Times table of 3 (3 × 1 … 3 × 10)',          'times_table',   'int', 'multiplication', 11, 7, 9),
  ('times_table_4',    'Times table of 4 (4 × 1 … 4 × 10)',          'times_table',   'int', 'multiplication', 12, 7, 9),
  ('times_table_6',    'Times table of 6 (6 × 1 … 6 × 10)',          'times_table',   'int', 'multiplication', 13, 8, 9),
  ('division_exact',   'Division without remainder (12 ÷ 3 = 4)',     'a_div_b',       'int', 'multiplication', 14, 8, 10),
  ('division_remainder','Division with remainder (13 ÷ 4 = 3 r 1)',   'a_div_b_rem',   'text','multiplication', 15, 8, 10),
  ('double_number',    'Double of a number (2 × a)',                   'double',        'int', 'multiplication', 16, 7, 9)
ON CONFLICT (code) DO NOTHING;

-- Counting patterns
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('count_by_2', 'Continue the pattern: counting by 2 (6, 8, 10, ?, ?)',  'count_by_n', 'tuple', 'patterns', 17, 7, 8),
  ('count_by_5', 'Continue the pattern: counting by 5 (5, 10, 15, ?, ?)', 'count_by_n', 'tuple', 'patterns', 18, 7, 8)
ON CONFLICT (code) DO NOTHING;

-- Roman numerals
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('roman_to_arabic', 'Roman → Arabic (XIV = ?)',    'roman_to_int',  'int',  'roman', 19, 7, 9),
  ('arabic_to_roman', 'Arabic → Roman (27 = ?)',     'int_to_roman',  'text', 'roman', 20, 7, 9)
ON CONFLICT (code) DO NOTHING;

-- Measurement
INSERT INTO quiz_types (code, description, template_kind, answer_type, category, sort_order, recommended_age_min, recommended_age_max)
VALUES
  ('measure_dm_to_cm', 'Conversion: dm → cm (5 dm = ? cm)',        'dm_to_cm',       'int', 'measurement', 21, 7, 9),
  ('measure_m_to_cm',  'Conversion: m → cm (2 m = ? cm)',          'm_to_cm',        'int', 'measurement', 22, 7, 9),
  ('length_addition',  'Length addition (35 cm + 12 cm = ? cm)',    'length_add',     'int', 'measurement', 23, 7, 9)
ON CONFLICT (code) DO NOTHING;
```

### 2.2 Final `quiz_types` table shape

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto‑generated |
| code | TEXT UNIQUE | machine identifier, e.g. `add_within_100` |
| description | TEXT | human‑readable label |
| template_kind | TEXT | generator dispatch key |
| answer_type | TEXT | `int` / `text` / `tuple` |
| category | TEXT | grouping label for the editor |
| recommended_age_min | INT | nullable — lower bound |
| recommended_age_max | INT | nullable — upper bound |
| is_active | BOOLEAN | default `true`; inactive types hidden from Start page |
| sort_order | INT | display ordering |
| created_at | TIMESTAMPTZ | auto |

---

## 3. Complete Quiz Type Catalogue (16 new + 2 existing = 18 total)

### Category: Arithmetic

| # | Code | Render example | Answer type | Template kind | Generator logic |
|---|---|---|---|---|---|
| 1 | `add_within_20` | `7 + 5` | int | `a_plus_b` | a ∈ [1, 18], b ∈ [1, 20−a]; correct = a + b |
| 2 | `sub_within_20` | `14 − 6` | int | `a_minus_b` | a ∈ [2, 20], b ∈ [1, a]; correct = a − b |
| 3 | `add_round_tens` | `30 + 40` | int | `round_tens_add` | a, b ∈ {10,20,30,40,50,60,70,80,90}, a+b ≤ 100 |
| 4 | `sub_round_tens` | `70 − 30` | int | `round_tens_sub` | a ∈ {20..90 step 10}, b ∈ {10..a step 10} |
| 5 | `add_within_100` | `34 + 18` | int | `a_plus_b_100` | a ∈ [10, 98], b ∈ [1, 100−a]; correct = a + b |
| 6 | `sub_within_100` | `52 − 17` | int | `a_minus_b_100` | a ∈ [11, 100], b ∈ [1, a]; correct = a − b |
| 7 | `two_digit_plus_one` | `47 + 6` | int | `two_plus_one` | a ∈ [10, 93], b ∈ [1, 9]; correct = a + b |
| 8 | `two_digit_minus_one` | `63 − 5` | int | `two_minus_one` | a ∈ [11, 99], b ∈ [1, min(9, a−10)]; correct = a − b |

### Category: Multiplication & Division

| # | Code | Render example | Answer type | Template kind | Generator logic |
|---|---|---|---|---|---|
| 9 | `multiplication_1_10` | `3 × 4` | int | `axb` | *existing* — factors 1–10 |
| 10 | `sum_products_1_10` | `(3 × 4) + (2 × 5)` | int | `axb_plus_cxd` | *existing* |
| 11 | `times_table_3` | `3 × 7` | int | `times_table` | fixed factor = 3, b ∈ [1, 10] |
| 12 | `times_table_4` | `4 × 9` | int | `times_table` | fixed factor = 4, b ∈ [1, 10] |
| 13 | `times_table_6` | `6 × 5` | int | `times_table` | fixed factor = 6, b ∈ [1, 10] |
| 14 | `division_exact` | `24 ÷ 6` | int | `a_div_b` | b ∈ [2, 10], quotient ∈ [1, 10]; a = b × quotient |
| 15 | `division_remainder` | `13 ÷ 4 =` | text | `a_div_b_rem` | b ∈ [2, 9], quotient ∈ [1, 10], remainder ∈ [1, b−1]; correct = `"3 r 1"` |
| 16 | `double_number` | `2 × 36` | int | `double` | a ∈ [2, 50]; correct = 2 × a |

### Category: Patterns

| # | Code | Render example | Answer type | Template kind | Generator logic |
|---|---|---|---|---|---|
| 17 | `count_by_2` | `6, 8, 10, __, __` | tuple | `count_by_n` | step = 2, start ∈ [2, 80 step 2]; answers = next 2 values |
| 18 | `count_by_5` | `15, 20, 25, __, __` | tuple | `count_by_n` | step = 5, start ∈ [5, 75 step 5]; answers = next 2 values |

### Category: Roman Numerals

| # | Code | Render example | Answer type | Template kind | Generator logic |
|---|---|---|---|---|---|
| 19 | `roman_to_arabic` | `XIV = ?` | int | `roman_to_int` | n ∈ [1, 100]; render Roman → answer is int |
| 20 | `arabic_to_roman` | `27 = ?` | text | `int_to_roman` | n ∈ [1, 100]; answer is Roman string |

### Category: Measurement

| # | Code | Render example | Answer type | Template kind | Generator logic |
|---|---|---|---|---|---|
| 21 | `measure_dm_to_cm` | `5 dm = ? cm` | int | `dm_to_cm` | a ∈ [1, 10]; correct = a × 10 |
| 22 | `measure_m_to_cm` | `2 m = ? cm` | int | `m_to_cm` | a ∈ [1, 10]; correct = a × 100 |
| 23 | `length_addition` | `35 cm + 12 cm = ? cm` | int | `length_add` | a ∈ [10, 90], b ∈ [1, 100−a]; correct = a + b |

---

## 4. Backend Changes

### 4.1 Schema update — `python-api/app/schemas/quiz_type.py`

```python
class QuizTypeOut(BaseModel):
    id: UUID
    code: str
    description: str
    answer_type: str = "int"
    template_kind: str | None = None
    category: str | None = None
    recommended_age_min: int | None = None
    recommended_age_max: int | None = None
    is_active: bool = True
    sort_order: int = 0

class QuizTypeCreate(BaseModel):
    code: str                                      # unique machine key
    description: str                               # display label
    template_kind: str                             # generator dispatch key
    answer_type: str = "int"                       # int | text | tuple
    category: str | None = None
    recommended_age_min: int | None = None
    recommended_age_max: int | None = None
    is_active: bool = True
    sort_order: int = 0

class QuizTypeUpdate(BaseModel):
    description: str | None = None
    template_kind: str | None = None
    answer_type: str | None = None
    category: str | None = None
    recommended_age_min: int | None = None
    recommended_age_max: int | None = None
    is_active: bool | None = None
    sort_order: int | None = None
```

### 4.2 New query functions — `python-api/app/queries.py`

| Function | SQL |
|---|---|
| `list_quiz_types()` | Existing — add `category, recommended_age_min, recommended_age_max, is_active, sort_order` to SELECT; order by `sort_order, code` |
| `list_active_quiz_types()` | Same SELECT but `WHERE is_active = true` — used by Start page |
| `get_quiz_type_by_id(id)` | `SELECT … FROM quiz_types WHERE id = $1` |
| `create_quiz_type(data)` | `INSERT INTO quiz_types (...) VALUES (...) RETURNING *` |
| `update_quiz_type(id, data)` | Dynamic `UPDATE quiz_types SET … WHERE id = $1 RETURNING *` |
| `delete_quiz_type(id)` | `DELETE FROM quiz_types WHERE id = $1` — fail if FK references exist |

### 4.3 API endpoints — `python-api/app/routers/quiz_types.py`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/quiz-types` | any user | List active quiz types (for Start page dropdown) |
| `GET` | `/admin/quiz-types` | admin | List **all** quiz types (including inactive) |
| `GET` | `/admin/quiz-types/{id}` | admin | Get single quiz type |
| `POST` | `/admin/quiz-types` | admin | Create new quiz type |
| `PATCH` | `/admin/quiz-types/{id}` | admin | Update quiz type |
| `DELETE` | `/admin/quiz-types/{id}` | admin | Delete quiz type (blocked if sessions reference it) |
| `POST` | `/admin/quiz-types/{id}/preview` | admin | Generate 3 sample questions (no DB write) for preview |

**Delete protection:** If any `quiz_sessions` rows reference the quiz type, return `409 Conflict` with a count of affected sessions. Admin must reassign or delete sessions first.

### 4.4 Generator extensions — `python-api/app/services/generator.py`

Add a dispatch function per `template_kind`. Each returns `{ prompt, correct }`.

| template_kind | Generator logic |
|---|---|
| `a_plus_b` | a + b within 20 |
| `a_minus_b` | a − b within 20, result ≥ 0 |
| `round_tens_add` | multiples of 10, sum ≤ 100 |
| `round_tens_sub` | multiples of 10, result ≥ 0 |
| `a_plus_b_100` | a + b ≤ 100 |
| `a_minus_b_100` | a − b ≤ 100, result ≥ 0 |
| `two_plus_one` | two-digit + one-digit |
| `two_minus_one` | two-digit − one-digit, result ≥ 10 |
| `times_table` | Extract fixed factor from quiz code (3/4/6), b random [1,10] |
| `a_div_b` | a = b × quotient, quotient ∈ [1,10], b ∈ [2,10] |
| `a_div_b_rem` | random a, b; correct = `"Q r R"` string |
| `double` | 2 × a, a ∈ [2,50] |
| `count_by_n` | Extract step from quiz code (2/5); show 3 values, answer = next 2 as `"v1, v2"` |
| `roman_to_int` | Random n [1,100], show Roman, answer = int |
| `int_to_roman` | Random n [1,100], show int, answer = Roman string |
| `dm_to_cm` | a ∈ [1,10], answer = a × 10 |
| `m_to_cm` | a ∈ [1,10], answer = a × 100 |
| `length_add` | a + b in cm, sum ≤ 100 |

**Pattern:** Use a `GENERATORS: dict[str, Callable]` registry. Unknown `template_kind` → raise `ValueError`.

### 4.5 Grader update — `python-api/app/services/grader.py`

Extend grading to handle:

| answer_type | Grading logic |
|---|---|
| `int` | *existing* — compare int |
| `text` | case-insensitive, whitespace-normalized string comparison (for Roman numerals, remainder notation `"3 r 1"`) |
| `tuple` | parse comma-separated ints, compare as list (for counting patterns `"12, 14"`) |

### 4.6 Start page filtering

Update `GET /quiz-types` (non-admin listing):
- Only return `WHERE is_active = true`
- Accept optional query param `?age=8`
- When `age` is provided, additionally filter: `recommended_age_min IS NULL OR recommended_age_min <= $age` AND `recommended_age_max IS NULL OR recommended_age_max >= $age`
- Order by `sort_order`

---

## 5. Frontend Changes

### 5.1 New Admin Menu Item

Add **Quiz Types** link to the header nav, visible only when `auth.isAdmin()`.

Route: `/admin/quiz-types` → `QuizTypeEditorComponent`

### 5.2 Quiz Type Editor Page — `QuizTypeEditorComponent`

**Layout:** Full admin CRUD using PrimeNG `p-table` (data table) + dialog for create/edit.

#### 5.2.1 Table view

| Column | Content | Sortable | Notes |
|---|---|---|---|
| Order | `sort_order` | ✓ drag | Inline reorder with drag handle |
| Code | `code` | ✓ | Read-only badge |
| Description | `description` | ✓ | Editable inline or via dialog |
| Category | `category` | ✓ | Colored chip/tag |
| Template | `template_kind` | ✓ | Mono font |
| Answer Type | `answer_type` | — | Chip |
| Age Range | `min – max` | ✓ | e.g. "7 – 9" or "—" |
| Active | toggle | — | `p-inputSwitch` — PATCH on toggle |
| Actions | Edit / Delete | — | Buttons |

**Toolbar:** `+ New Quiz Type` button + category filter dropdown.

#### 5.2.2 Create / Edit Dialog

PrimeNG `p-dialog` with a form:

| Field | Input | Validation |
|---|---|---|
| Code | `p-inputText` | required, unique, lowercase + underscores pattern |
| Description | `p-inputText` | required, max 200 chars |
| Template Kind | `p-dropdown` | required — list all known template_kind values from backend |
| Answer Type | `p-dropdown` | `int` / `text` / `tuple` |
| Category | `p-dropdown` with `editable=true` | Suggests existing categories, allows new |
| Age Min | `p-inputNumber` | optional, 4–18 |
| Age Max | `p-inputNumber` | optional, ≥ age min |
| Active | `p-inputSwitch` | default: true |
| Sort Order | `p-inputNumber` | default: next available |

**Code field** is editable only on create — read-only after save (it's a stable identifier).

#### 5.2.3 Preview Panel

In the create/edit dialog, a **Preview** button calls `POST /admin/quiz-types/{id}/preview` (or for unsaved types, sends `template_kind` + `answer_type` as query params to a preview endpoint).

Displays 3 sample questions in a mini-card list:
```
  3 × 7 = ?     → expected: 21
  6 × 4 = ?     → expected: 24
  3 × 9 = ?     → expected: 27
```

#### 5.2.4 Delete Confirmation

`p-confirmDialog`: "This quiz type has been used in **N sessions**. You cannot delete it while sessions reference it."  
If no sessions reference it: "Are you sure you want to delete **{description}**?"

### 5.3 Angular Model — `quiz-type.model.ts`

```typescript
export interface QuizType {
  id: string;
  code: string;
  description: string;
  answer_type: string;
  template_kind: string | null;
  category: string | null;
  recommended_age_min: number | null;
  recommended_age_max: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface QuizTypeCreate {
  code: string;
  description: string;
  template_kind: string;
  answer_type: string;
  category?: string | null;
  recommended_age_min?: number | null;
  recommended_age_max?: number | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface QuizTypeUpdate {
  description?: string;
  template_kind?: string;
  answer_type?: string;
  category?: string | null;
  recommended_age_min?: number | null;
  recommended_age_max?: number | null;
  is_active?: boolean;
  sort_order?: number;
}
```

### 5.4 API Service additions

```typescript
// Admin endpoints
getAdminQuizTypes(): Observable<QuizType[]>
getAdminQuizType(id: string): Observable<QuizType>
createQuizType(data: QuizTypeCreate): Observable<QuizType>
updateQuizType(id: string, data: QuizTypeUpdate): Observable<QuizType>
deleteQuizType(id: string): Observable<void>
previewQuizType(id: string): Observable<PreviewQuestion[]>

// Updated public endpoint
getQuizTypes(age?: number): Observable<QuizType[]>
```

### 5.5 Start Page Update

- Call `getQuizTypes(studentAge)` when student has a birthday/age set
- Group quiz types by `category` in the dropdown (PrimeNG `p-dropdown` with `[group]="true"`)
- Show category headers: **Arithmetic**, **Multiplication**, **Patterns**, **Roman**, **Measurement**

### 5.6 Quiz Component — Answer Type Handling

Extend the quiz input to handle new answer types:

| answer_type | Input widget | Submit behavior |
|---|---|---|
| `int` | `p-inputNumber` (existing) | Send `{ type: "int", value: N }` |
| `text` | `p-inputText` | Send `{ type: "text", value: "XXVII" }` or `"3 r 1"` |
| `tuple` | Two `p-inputNumber` side by side | Send `{ type: "tuple", value: "12, 14" }` |

Add `@case ('text')` and `@case ('tuple')` blocks in the quiz component template.

### 5.7 Routing

```typescript
{ path: 'admin/quiz-types', component: QuizTypeEditorComponent, canActivate: [adminGuard] }
```

---

## 6. Implementation Checklist

### Backend

- [ ] Migration `0007_quiz_type_editor.sql` — schema + seed data
- [ ] Update `QuizTypeOut` schema with new fields
- [ ] Add `QuizTypeCreate` and `QuizTypeUpdate` schemas
- [ ] Add query functions: create, update, delete, get by id, list all, list active
- [ ] Admin CRUD endpoints under `/admin/quiz-types`
- [ ] Preview endpoint — generates sample questions without DB write
- [ ] Age-filter support on `GET /quiz-types?age=N`
- [ ] Generator: add 16 new template_kind handlers
- [ ] Grader: add `text` and `tuple` answer type support
- [ ] Roman numeral utility functions (`int_to_roman`, `roman_to_int`)

### Frontend

- [ ] Update `QuizType` model with new fields
- [ ] Add admin API methods to `ApiService`
- [ ] Create `QuizTypeEditorComponent` with PrimeNG table + dialog
- [ ] Add preview panel in create/edit dialog
- [ ] Add route `/admin/quiz-types` with `adminGuard`
- [ ] Add **Quiz Types** link to header (admin-only)
- [ ] Update Start page: group by category, filter by age
- [ ] Quiz component: add `text` and `tuple` input modes

### Database

- [ ] Seed 16 new quiz types via migration
- [ ] Verify FK constraints allow delete only when no sessions reference the type

---

## 7. Safety Rules

These rules apply across all quiz types and are enforced at the generator level:

- Subtraction never produces negative results
- All numbers stay within the curriculum range for the difficulty level
- Division-with-remainder: divisor ∈ [2, 9], remainder always < divisor
- Roman numerals: only values 1–100
- Measurement values are realistic (≤ 10 m, ≤ 100 cm)
- All exercises are designed to be solvable mentally (no calculator needed)
- Generated questions within a session are deduplicated (no exact repeats)

---

## 8. Difficulty Interaction

The difficulty selector on the Start page adjusts number ranges for quiz types that support it:

| Difficulty | Number ceiling | Effect |
|---|---|---|
| Easy | ≤ 20 | Smaller operands, simpler results |
| Medium | ≤ 50 | Default |
| Hard | ≤ 100 | Full range |

Quiz types with fixed ranges (e.g. `measure_dm_to_cm` with a ∈ [1, 10]) ignore difficulty. The generator checks whether the `template_kind` is difficulty-sensitive and adjusts accordingly.

---

## 9. UI Mockup — Editor Table

```
┌─────────────────────────────────────────────────────────────────────┐
│  Quiz Types                                        [+ New Quiz Type]│
├─────┬──────────────────────┬─────────────┬──────────┬───────┬──────┤
│  #  │ Description          │ Category    │ Template │ Ages  │Active│
├─────┼──────────────────────┼─────────────┼──────────┼───────┼──────┤
│  1  │ Multiplication 1–10  │ multiply    │ axb      │ 7–9   │  ✓   │
│  2  │ Sum of products      │ multiply    │ axb+cxd  │ 8–10  │  ✓   │
│  3  │ Addition within 20   │ arithmetic  │ a+b      │ 6–8   │  ✓   │
│  4  │ Subtraction ≤ 20     │ arithmetic  │ a−b      │ 6–8   │  ✓   │
│  …  │ …                    │ …           │ …        │ …     │  …   │
│ 23  │ Length addition       │ measurement │ len_add  │ 7–9   │  ✓   │
└─────┴──────────────────────┴─────────────┴──────────┴───────┴──────┘
```

---

End of Specification
