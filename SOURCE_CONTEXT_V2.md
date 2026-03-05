# OpenMath v2.0 – Source Context Reference

> Quick-reference for AI assistants continuing development. Contains key patterns, code conventions, and module relationships.

---

## 1. Codebase Relationships

```
                    ┌─────────────────────┐
                    │     PostgreSQL 16    │
                    │  (docker-compose)    │
                    └──────┬──────┬───────┘
                           │      │
              ┌────────────┘      └────────────┐
              │                                │
     ┌────────▼─────────┐           ┌──────────▼──────────┐
     │  nuxt-app        │           │  python-api          │
     │  Drizzle ORM     │           │  asyncpg (raw SQL)   │
     │  Port 3000       │           │  Port 8000           │
     │  (existing)      │           │  (new - v2.0)        │
     └──────────────────┘           └──────────▲──────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │  angular-app         │
                                    │  PrimeNG + Signals   │
                                    │  Port 4200           │
                                    │  (new - v2.0)        │
                                    └─────────────────────┘
```

## 2. FastAPI Patterns

### Query Pattern (queries.py)

```python
async def list_quiz_types() -> list[dict]:
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT ... FROM quiz_types ORDER BY ...")
        return [_row_to_dict(r) for r in rows]
```

### Router Pattern

```python
@router.get("/endpoint")
async def handler():
    data = await queries.some_query()
    return data  # FastAPI auto-serializes dicts
```

### Config Access

```python
from app.config import settings
dsn = settings.database_url
```

### JSONB Insert

```python
import json
await conn.execute(
    "INSERT INTO questions (..., prompt) VALUES ($1, $2::jsonb, ...)",
    question_id, json.dumps(prompt_dict)
)
```

### _row_to_dict Helper

Converts asyncpg Records to JSON-safe dicts:
- UUID → str
- datetime → ISO format string
- JSONB string fields → parsed via json.loads()

## 3. Angular Patterns

### Signal State

```typescript
// In service
activeQuiz = signal<CreateSessionResponse | null>(null);
currentStudent = computed(() =>
  this.studentsDirectory().find(s => s.id === this.currentStudentId())
);

// In component
quizTypes = signal<QuizType[]>([]);
ngOnInit() {
  this.apiService.getQuizTypes().subscribe(data => this.quizTypes.set(data));
}
```

### API Service Pattern

```typescript
getQuizTypes(): Observable<QuizType[]> {
  return this.http.get<QuizType[]>(`${this.apiUrl}/quiz-types`);
}
```

### Lazy Route Pattern

```typescript
{
  path: 'quiz/:sessionId',
  loadComponent: () =>
    import('./features/quiz/quiz.component').then(m => m.QuizComponent),
}
```

### PrimeNG Integration

```typescript
@Component({
  standalone: true,
  imports: [DropdownModule, ButtonModule, CardModule],
  template: `
    <p-card header="Title">
      <p-dropdown [options]="items()" [(ngModel)]="selected" />
      <p-button label="Submit" (onClick)="onSubmit()" />
    </p-card>
  `,
})
```

### New Control Flow

```html
@if (loading()) {
  <p>Loading...</p>
} @else {
  @for (item of items(); track item.id) {
    <div>{{ item.name }}</div>
  } @empty {
    <p>No items.</p>
  }
}
```

## 4. Database Schema Highlights

### JSONB Prompt Structure (questions.prompt)

```json
{
  "template": "axb",
  "render": "7 × 8 = ?",
  "operands": { "a": 7, "b": 8 },
  "operator": "×",
  "expected": 56
}
```

### JSONB Response Structure (answers.response)

```json
{ "answer": 56 }
```

### Key Tables

| Table | Primary Key | Notable Columns |
|-------|------------|-----------------|
| `quiz_types` | `id` (uuid) | `name`, `label`, `answer_type`, `template_kind` |
| `students` | `id` (uuid) | `display_name`, `learned_timetables` (int[]) |
| `sessions` | `id` (uuid) | `quiz_type_id` FK, `student_id` FK, `difficulty`, `total_questions` |
| `questions` | `id` (uuid) | `session_id` FK, `operand_a`, `operand_b`, `operator`, `expected`, `prompt` (JSONB) |
| `answers` | `id` (uuid) | `question_id` FK, `session_id` FK, `value`, `is_correct`, `response` (JSONB), `raw_input` |

### Indexes (from migration 0005)

- `idx_questions_prompt_gin` — GIN on `questions.prompt`
- `idx_answers_response_gin` — GIN on `answers.response`
- `idx_questions_prompt_template` — functional on `prompt->>'template'`
- `idx_sessions_student` — btree on `sessions.student_id`

## 5. Service Layer Logic

### Question Generation (`services/generator.py`)

1. Gets quiz type to determine `template_kind`
2. Gets difficulty → timetable set from `DIFFICULTY_SETS`
3. For each question:
   - Picks random operands from difficulty set
   - Computes expected answer
   - Builds JSONB `prompt` with `template`, `render`, `operands`, `operator`, `expected`
4. Returns list of question dicts with both legacy + JSONB fields

### Answer Grading (`services/grader.py`)

Supports 4 answer types:
- `int` — direct integer comparison
- `choice` — string match for multiple-choice
- `tuple` — ordered tuple comparison
- `fraction` — numerator/denominator pair comparison

### Performance Stats (`services/stats.py`)

Aggregates student performance into buckets:
- Groups answers by quiz type
- Calculates correct/total/percent per quiz type
- Produces `overall` + `by_quiz_type[]` structure

## 6. Package Dependencies

### FastAPI (`python-api/requirements.txt`)

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
asyncpg>=0.29.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-dotenv>=1.0.0
```

### Angular (`angular-app/package.json` additions)

```json
{
  "primeng": "^17.18.0",
  "primeicons": "^7.0.0",
  "primeflex": "^3.3.0"
}
```

## 7. dev.ps1 Mode Reference

| Mode | Function | Description |
|------|----------|-------------|
| `install-fastapi` | `Invoke-FastApiInstall` | pip install -r requirements.txt |
| `start-fastapi` | `Start-FastApiServer` | uvicorn with --reload |
| `stop-fastapi` | `Stop-FastApiServer` | Kill PID |
| `install-angular` | `Invoke-AngularInstall` | pnpm install |
| `start-angular` | `Start-AngularDevServer` | pnpm start (ng serve) |
| `stop-angular` | `Stop-AngularDevServer` | Kill PID |
| `build-angular` | `Invoke-AngularBuild` | pnpm run build (ng build) |
| `up-v2` | `Invoke-V2FullUp` | docker compose up + FastAPI + Angular |

## 8. Nuxt ↔ FastAPI Query Mapping

| Nuxt Drizzle Function | FastAPI Query Function | Notes |
|----------------------|----------------------|-------|
| `listQuizTypes()` | `list_quiz_types()` | Adds answer_type, template_kind |
| `listStudents()` | `list_students()` | Same |
| `getStudentProfile()` | `get_student_profile()` | Adds performance stats |
| `updateStudentProfile()` | `update_student_profile()` | Adds learned_timetables |
| `createSession()` + `insertQuestions()` | `create_session()` + `insert_questions()` | Adds JSONB prompt |
| `listSessions()` | `list_sessions()` | Same + student filter |
| `getSessionById()` | `get_session_by_id()` | Same |
| `submitAnswer()` | `submit_answer()` | Adds JSONB response |
| — | `get_student_performance_stats()` | New endpoint |
| `getDatabaseStatistics()` | `get_database_statistics()` | Same |
| `getDatabaseTableRows()` | `get_database_table_rows()` | Same |
| `deleteAllSchemaData()` | `delete_all_schema_data()` | Same |
