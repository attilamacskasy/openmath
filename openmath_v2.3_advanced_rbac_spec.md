# OpenMath v2.3 — Roles, Review Workflow & Rendering

## Feature Summary

**Version:** 2.3  
**Scope:** Multi-role RBAC, teacher/parent review workflow, server-side quiz rendering  
**Depends on:** v2.2.1 (rename `students` → `users` table) ← v2.2 (quiz type editor, 23 quiz types, text/tuple answer types)  
**Tech stack:** Angular 18 + PrimeNG 17 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

### Current state (v2.2.1)

The `users` table (renamed from `students` in v2.2.1 migration `0009`) stores all user accounts. Auth columns were added in migration `0006_auth_rbac.sql`:

| Column | Type | Purpose |
|---|---|---|
| `email` | TEXT UNIQUE | Login identifier |
| `password_hash` | TEXT | bcrypt hash (local auth) |
| `role` | TEXT | `'student'` or `'admin'` — simple 2-role model |
| `auth_provider` | TEXT | `'local'`, `'google'`, or `'both'` |
| `google_sub` | TEXT UNIQUE | Google OAuth subject ID |
| `birthday` | DATE | Age computed dynamically |

Current tables: `users`, `quiz_types`, `quiz_sessions`, `questions`, `answers`.

Current RBAC: two FastAPI dependencies — `get_current_user` (any authenticated user) and `require_admin` (role == admin). Role is embedded in the HS256 JWT access token payload. Angular checks `authService.isAdmin()` computed signal and uses `authGuard` / `adminGuard` route guards.

> **v2.2.1 prerequisite:** The `students` table has been renamed to `users`, `quiz_sessions.student_id` → `user_id`, all backend/frontend code updated. See `openmath_v2.2.1_rename_students_to_users_spec.md`.

### v2.3 delivers

1. **Multi-role RBAC** — replace the single `role` TEXT column with a `user_roles` junction table supporting `admin`, `student`, `teacher`, `parent`
2. **Teacher role** — view assigned students' quizzes, review & comment
3. **Parent role** — view child's quizzes, read teacher reviews, sign off
4. **Quiz review workflow** — student → teacher review → parent sign-off
5. **Server-side quiz rendering** — backend produces structured render payloads (HTML/KaTeX https://katex.org/) for consistent display across quiz play, history, and reviews
6. **Google SSO improvement** — skip re-consent when previously authorized

---

## 2. Database Changes

### 2.1 Migration `0010_multi_role_rbac.sql`

#### 2.1.1 Roles table & seed data

```sql
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, description) VALUES
  ('admin',   'Full system access'),
  ('student', 'Can take quizzes and view own history'),
  ('teacher', 'Can view assigned students and review quizzes'),
  ('parent',  'Can view child quizzes and sign off on reviews')
ON CONFLICT (name) DO NOTHING;
```

#### 2.1.2 User–role junction table

```sql
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
```

> **Note:** The `user_roles` table references `users.id` — the base table was renamed from `students` to `users` in v2.2.1.

#### 2.1.3 Migrate existing role data

```sql
-- Populate user_roles from the existing role column
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = u.role
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Drop the old role column (after backend is updated to use user_roles)
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- Kept commented — drop only after confirming the new system works
```

#### 2.1.4 Relationship tables

```sql
-- Teacher ↔ Student assignments
CREATE TABLE IF NOT EXISTS teacher_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON teacher_students(student_id);

-- Parent ↔ Student assignments
CREATE TABLE IF NOT EXISTS parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON parent_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);
```

#### 2.1.5 Quiz reviews table (unified teacher + parent reviews)

```sql
CREATE TABLE IF NOT EXISTS quiz_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('teacher', 'parent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'signed')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quiz_reviews_session ON quiz_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_reviews_reviewer ON quiz_reviews(reviewer_id);
```

> **Design decision:** A single `quiz_reviews` table handles both teacher reviews (`reviewer_role = 'teacher'`, `status = 'reviewed'`) and parent sign-offs (`reviewer_role = 'parent'`, `status = 'signed'`). This avoids two nearly identical tables.

### 2.2 Final table inventory after v2.3

| Table | Purpose |
|---|---|
| `users` | User accounts (name, email, password_hash, auth_provider, google_sub, birthday, profile) |
| `roles` | Role definitions (admin, student, teacher, parent) |
| `user_roles` | User ↔ role junction (many-to-many) |
| `teacher_students` | Teacher ↔ student assignments |
| `parent_students` | Parent ↔ student assignments |
| `quiz_types` | Quiz type definitions (23 types, 5 categories) |
| `quiz_sessions` | Quiz session instances |
| `questions` | Generated questions per session |
| `answers` | Student answers per question |
| `quiz_reviews` | Teacher reviews + parent sign-offs |

---

## 3. RBAC Model

### 3.1 Roles

| Role | Capabilities |
|---|---|
| `admin` | Full CRUD on all resources, user management, quiz type editor, role assignment |
| `student` | Take quizzes, view own history, edit own profile |
| `teacher` | View assigned students' sessions, review quizzes, add comments |
| `parent` | View child's sessions, read teacher reviews, sign off, add comments |

### 3.2 Multi-role support

Users can hold multiple roles simultaneously:

- User A → `student`
- User B → `teacher` + `parent`
- User C → `admin` + `teacher`

### 3.3 Backend RBAC changes

#### Updated `dependencies.py`

Replace the current `require_admin` dependency with a flexible role-checking system:

```python
# Existing (keep as-is)
async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Decode JWT and return user payload. Raises 401 if invalid."""

# Updated — check roles from user_roles table
async def require_roles(*roles: str):
    """Factory: returns a dependency that checks the user has at least one of the given roles."""
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_roles = await get_user_roles(user["sub"])
        if not any(r in user_roles for r in roles):
            raise HTTPException(status_code=403, detail=f"Requires one of: {', '.join(roles)}")
        user["roles"] = user_roles
        return user
    return _check

# Convenience shortcuts
require_admin = Depends(require_roles("admin"))
require_teacher = Depends(require_roles("teacher", "admin"))
require_parent = Depends(require_roles("parent", "admin"))
```

#### JWT payload change

The access token payload currently includes `role: str`. Update to include `roles: list[str]`:

```python
# Current: create_access_token(sub, email, name, role)
# Updated: create_access_token(sub, email, name, roles)
{
    "sub": "uuid",
    "email": "user@example.com",
    "name": "Attila",
    "roles": ["student", "parent"],  # was: "role": "student"
    "exp": 1709827200
}
```

> **Backward compatibility:** During the transition, include both `role` (first role or "student") and `roles` (full list) in the JWT payload. The Angular `authInterceptor` and `authGuard` already work with the token — only the payload shape changes.

### 3.4 Frontend RBAC changes

#### Updated `auth.model.ts`

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;           // backward compat — primary role
  roles: string[];         // NEW — all assigned roles
  age: number | null;
  authProvider: 'local' | 'google' | 'both';
}
```

#### Updated `auth.service.ts`

```typescript
// Existing (keep)
readonly isAdmin = computed(() => this.currentUser()?.roles?.includes('admin') ?? false);

// New computed signals
readonly isTeacher = computed(() => this.currentUser()?.roles?.includes('teacher') ?? false);
readonly isParent = computed(() => this.currentUser()?.roles?.includes('parent') ?? false);
readonly userRoles = computed(() => this.currentUser()?.roles ?? []);
```

#### Updated `auth.guard.ts`

```typescript
export const teacherGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isTeacher() || auth.isAdmin() || (inject(Router).navigate(['/']) && false);
};

export const parentGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isParent() || auth.isAdmin() || (inject(Router).navigate(['/']) && false);
};
```

---

## 4. Teacher Role

### 4.1 Capabilities

- View list of assigned students
- See each student's quiz session history
- Open a completed quiz session and review it question-by-question
- Add a text comment to a quiz session
- Mark a quiz as "reviewed"

### 4.2 API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/teacher/students` | teacher | List students assigned to the current teacher |
| `GET` | `/api/teacher/students/{student_id}/sessions` | teacher | List quiz sessions for an assigned student |
| `GET` | `/api/teacher/sessions/{session_id}` | teacher | View full session detail (questions + answers) — only if student is assigned |
| `POST` | `/api/teacher/sessions/{session_id}/review` | teacher | Create or update a review (comment + status) |
| `GET` | `/api/teacher/reviews` | teacher | List all reviews created by the current teacher |

#### Review request body

```json
{
  "comment": "Great work on the multiplication tables! Practice division next.",
  "status": "reviewed"
}
```

### 4.3 Teacher Dashboard Component — `TeacherDashboardComponent`

**Route:** `/teacher` — guarded by `teacherGuard`

**Layout:** Left panel = student list, right panel = selected student's session history.

| Section | Content |
|---|---|
| Student list | PrimeNG `p-listbox` with assigned student names + age badges |
| Session table | Same columns as History page + review status column |
| Review dialog | `p-dialog` with comment `p-inputTextarea` + "Mark as Reviewed" button |

---

## 5. Parent Role

### 5.1 Capabilities

- View child's quiz session history
- Read teacher review comments
- Sign off on a reviewed quiz (acknowledge teacher feedback)
- Add an optional parent comment

### 5.2 API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/parent/children` | parent | List children assigned to the current parent |
| `GET` | `/api/parent/children/{child_id}/sessions` | parent | List quiz sessions for a child |
| `GET` | `/api/parent/sessions/{session_id}` | parent | View full session detail + teacher review |
| `POST` | `/api/parent/sessions/{session_id}/signoff` | parent | Sign off on a reviewed session |

#### Sign-off request body

```json
{
  "comment": "Noted, will practice division this weekend.",
  "status": "signed"
}
```

### 5.3 Parent Dashboard Component — `ParentDashboardComponent`

**Route:** `/parent` — guarded by `parentGuard`

**Layout:** Similar to teacher dashboard but read-focused.

| Section | Content |
|---|---|
| Child selector | `p-dropdown` if multiple children, auto-selected if only one |
| Session table | Quiz type, score, date, review status, sign-off status |
| Session detail | Questions + answers + teacher comment + sign-off button |

---

## 6. Review Workflow

```
Student completes quiz
        │
        ▼
  Session status: completed
  Review status: pending
        │
        ▼
  Teacher opens session
  Teacher adds comment + marks "reviewed"
        │
        ▼
  Review status: reviewed
  Teacher comment visible to student + parent
        │
        ▼
  Parent opens session
  Parent reads teacher comment
  Parent signs off + optional comment
        │
        ▼
  Review status: signed
```

### 6.1 Review status display

| Status | Badge | Visible to |
|---|---|---|
| `pending` | ⏳ gray | student, teacher |
| `reviewed` | ✅ blue | student, teacher, parent |
| `signed` | ✍️ green | student, teacher, parent |

### 6.2 Session detail — review section

Add a **Reviews** panel below the existing question/answer list in the session detail page (`/history/:sessionId`). Visible to all roles with access:

```html
<!-- Teacher review -->
<div class="surface-100 border-round p-3 mb-2">
  <div class="flex justify-content-between">
    <span class="font-semibold">Teacher review</span>
    <p-tag value="Reviewed" severity="info"></p-tag>
  </div>
  <p class="mt-2">{{ review.comment }}</p>
  <span class="text-xs text-500">{{ review.updated_at | date:'short' }}</span>
</div>

<!-- Parent sign-off -->
<div class="surface-100 border-round p-3">
  <div class="flex justify-content-between">
    <span class="font-semibold">Parent sign-off</span>
    <p-tag value="Signed" severity="success"></p-tag>
  </div>
  <p class="mt-2">{{ signoff.comment }}</p>
  <span class="text-xs text-500">{{ signoff.created_at | date:'short' }}</span>
</div>
```

---

## 7. Server-Side Quiz Rendering

### 7.1 Problem

Quiz expressions are currently rendered by the Angular frontend using the `render` string from the JSONB prompt (e.g. `"3 × 7"`, `"XIV = ?"`). This works but:

- Cannot guarantee consistent rendering across multiple frontends
- Special characters (×, ÷, −) depend on font support
- No structured math formatting (fractions, exponents — future-proofing)

### 7.2 Solution — Structured render payload

Extend the question prompt JSONB with a `render_html` field containing a KaTeX-compatible HTML string. The backend generates this when creating questions.

```python
# In generator.py — extend _make_prompt
def _make_prompt(kind: str, answer_type: str, render: str, **extra) -> dict:
    return {
        "template": {"kind": kind, **extra},
        "answer": {"type": answer_type},
        "render": render,               # plain text fallback
        "render_html": render_to_html(render),  # NEW — structured HTML
    }
```

#### Render format

Use KaTeX-style inline math wrapped in a structured HTML snippet:

```json
{
  "render": "3 × 7",
  "render_html": "<span class='om-expr'>3 &times; 7</span>"
}
```

For more complex expressions (future: fractions, exponents):

```json
{
  "render": "(3/4) + (1/2)",
  "render_html": "<span class='om-expr'><span class='om-frac'><span class='om-num'>3</span><span class='om-den'>4</span></span> + <span class='om-frac'><span class='om-num'>1</span><span class='om-den'>2</span></span></span>"
}
```

### 7.3 No separate render endpoint

Instead of a `GET /api/render/question/:id` endpoint, the render payload is embedded directly in the question's JSONB `prompt` field. This means:

- No extra API call per question
- Rendering is pre-computed at question generation time
- Quiz play, history, teacher review, and parent review all use the same data
- The Angular frontend uses `[innerHTML]` with the `render_html` field, falling back to the `render` plain text field

### 7.4 History & review rendering

All views that display questions (quiz play, session detail, teacher review, parent review) use the same rendering approach:

| Answer state | Visual |
|---|---|
| Unanswered | Expression only, input field below |
| Correct | Green `✔` icon + answer |
| Incorrect | Red `✘` icon + student's answer (struck through) + correct answer in green |

---

## 8. Admin — Role Management

### 8.1 Student Admin page updates

Extend the existing User Admin page (`/users`) with role management:

| New column | Widget | Notes |
|---|---|---|
| Roles | `p-multiSelect` chips | Shows assigned roles, editable |

#### Role assignment API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users/{id}/roles` | admin | Get roles for a user |
| `PUT` | `/api/users/{id}/roles` | admin | Set roles for a user (replaces all) |

#### Request body

```json
{
  "roles": ["student", "teacher"]
}
```

### 8.2 Relationship management

Admin can assign teacher → student and parent → student relationships:

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/teacher-students` | admin | List all teacher–student assignments |
| `POST` | `/api/admin/teacher-students` | admin | Assign student to teacher |
| `DELETE` | `/api/admin/teacher-students/{id}` | admin | Remove assignment |
| `GET` | `/api/admin/parent-students` | admin | List all parent–student assignments |
| `POST` | `/api/admin/parent-students` | admin | Assign student to parent |
| `DELETE` | `/api/admin/parent-students/{id}` | admin | Remove assignment |

---

## 9. Google SSO Improvement

### 9.1 Problem

Users are prompted to re-approve Google permissions on every login because the Angular app uses `prompt: 'consent'` when redirecting to Google's OAuth screen.

### 9.2 Fix

Change the Google OAuth redirect to use `prompt: 'select_account'` instead of `prompt: 'consent'`. This lets users pick their account without re-authorizing if they've already granted permissions.

In the Angular login component:

```typescript
// Current
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...&prompt=consent`;

// Updated
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?...&prompt=select_account`;
```

If the user has previously authorized, Google skips the consent screen entirely.

### 9.3 Silent re-authentication

For returning users, attempt a silent token refresh on app startup:

1. On `AuthService.loadFromStorage()`, check if the stored refresh token is still valid
2. If valid, call `POST /api/auth/refresh` automatically
3. If refresh fails and `auth_provider` includes `google`, try Google's silent auth iframe-less flow (optional — can be deferred)

---

## 10. Routing Changes

### 10.1 New routes

```typescript
// Teacher routes
{
  path: 'teacher',
  loadComponent: () => import('./features/teacher/teacher-dashboard.component')
    .then(m => m.TeacherDashboardComponent),
  canActivate: [authGuard, teacherGuard],
},

// Parent routes
{
  path: 'parent',
  loadComponent: () => import('./features/parent/parent-dashboard.component')
    .then(m => m.ParentDashboardComponent),
  canActivate: [authGuard, parentGuard],
},
```

### 10.2 Header navigation updates

Add role-based nav links to the existing header component (inside `nav`):

```html
@if (auth.isTeacher()) {
  <a routerLink="/teacher" routerLinkActive="font-bold" class="no-underline text-primary">My Students</a>
}
@if (auth.isParent()) {
  <a routerLink="/parent" routerLinkActive="font-bold" class="no-underline text-primary">My Child</a>
}
```

These appear **between** the existing "History" and "User Guide" links.

---

## 11. API Summary

### New endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/me` | any | **Updated** — returns `roles: string[]` instead of `role: string` |
| `GET` | `/api/users/{id}/roles` | admin | Get user's roles |
| `PUT` | `/api/users/{id}/roles` | admin | Set user's roles |
| `GET` | `/api/teacher/students` | teacher | Teacher's assigned students |
| `GET` | `/api/teacher/students/{id}/sessions` | teacher | Student's sessions |
| `GET` | `/api/teacher/sessions/{id}` | teacher | Session detail with questions + answers |
| `POST` | `/api/teacher/sessions/{id}/review` | teacher | Submit review |
| `GET` | `/api/teacher/reviews` | teacher | Teacher's reviews |
| `GET` | `/api/parent/children` | parent | Parent's assigned children |
| `GET` | `/api/parent/children/{id}/sessions` | parent | Child's sessions |
| `GET` | `/api/parent/sessions/{id}` | parent | Session detail + reviews |
| `POST` | `/api/parent/sessions/{id}/signoff` | parent | Sign off on session |
| `GET` | `/api/admin/teacher-students` | admin | All teacher–student assignments |
| `POST` | `/api/admin/teacher-students` | admin | Create assignment |
| `DELETE` | `/api/admin/teacher-students/{id}` | admin | Delete assignment |
| `GET` | `/api/admin/parent-students` | admin | All parent–student assignments |
| `POST` | `/api/admin/parent-students` | admin | Create assignment |
| `DELETE` | `/api/admin/parent-students/{id}` | admin | Delete assignment |

### Modified endpoints

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/auth/me` | Response adds `roles: string[]`, keeps `role` for backward compat |
| `POST` | `/api/auth/register` | Automatically assigns `student` role in `user_roles` |
| `POST` | `/api/auth/google` | Automatically assigns `student` role in `user_roles` for new users |
| `POST` | `/api/sessions` | Response adds `reviewStatus: string` (pending/reviewed/signed) |
| `GET` | `/api/sessions` | Response adds `review_status` column |

---

## 12. Migration Plan

| Step | Action | Details |
|---|---|---|
| 1 | Create migration `0010_multi_role_rbac.sql` | `roles`, `user_roles`, `teacher_students`, `parent_students`, `quiz_reviews` tables |
| 2 | Seed roles | admin, student, teacher, parent |
| 3 | Migrate existing data | Populate `user_roles` from `users.role` column |
| 4 | Update backend dependencies | `require_roles()` factory, role lookup from `user_roles` table |
| 5 | Update JWT payload | `roles: list[str]` alongside `role: str` for backward compat |
| 6 | Add teacher router | `/api/teacher/*` endpoints |
| 7 | Add parent router | `/api/parent/*` endpoints |
| 8 | Add role management endpoints | `/api/users/{id}/roles`, admin relationship CRUD |
| 9 | Update frontend auth model | `AuthUser.roles`, new computed signals, new guards |
| 10 | Create teacher dashboard | `TeacherDashboardComponent` with student list + session review |
| 11 | Create parent dashboard | `ParentDashboardComponent` with child sessions + sign-off |
| 12 | Update session detail | Add reviews panel |
| 13 | Update user admin | Add role multi-select + relationship management |
| 14 | Update quiz rendering | Add `render_html` to prompt JSONB |
| 15 | Fix Google SSO prompt | Change `consent` → `select_account` |
| 16 | Drop legacy `role` column from `users` | Only after confirming multi-role system works end-to-end |

---

## 13. Implementation Checklist

### Backend

- [ ] Migration `0010_multi_role_rbac.sql` — tables + seed + data migration
- [ ] Query functions: `get_user_roles()`, `set_user_roles()`, role CRUD
- [ ] Query functions: teacher–student and parent–student assignment CRUD
- [ ] Query functions: `quiz_reviews` CRUD
- [ ] Update `dependencies.py` — `require_roles()` factory
- [ ] Update `auth.py` — JWT payload with `roles` list
- [ ] Update `routers/auth.py` — `/auth/me` returns `roles`, register assigns `student` role
- [ ] New `routers/teacher.py` — 5 teacher endpoints
- [ ] New `routers/parent.py` — 4 parent endpoints
- [ ] Update `routers/users.py` — role management endpoints, relationship CRUD
- [ ] Update `generator.py` — add `render_html` to prompt JSONB
- [ ] Schemas: `ReviewRequest`, `SignoffRequest`, `ReviewOut`, `RoleAssignment`

### Frontend

- [ ] Update `AuthUser` model — add `roles: string[]`
- [ ] Update `AuthService` — `isTeacher`, `isParent`, `userRoles` computed signals
- [ ] Add `teacherGuard`, `parentGuard` route guards
- [ ] Update `ApiService` — teacher, parent, role management methods
- [ ] Create `TeacherDashboardComponent` — student list + session review
- [ ] Create `ParentDashboardComponent` — child sessions + sign-off
- [ ] Update session detail page — reviews panel
- [ ] Update user admin page — role multi-select
- [ ] Create relationship management UI (admin)
- [ ] Update header nav — role-based links
- [ ] Add routes: `/teacher`, `/parent`
- [ ] Fix Google SSO prompt parameter
- [ ] Update quiz/history rendering to use `render_html`

### Database

- [ ] Seed 4 roles
- [ ] Migrate existing `users.role` → `user_roles`
- [ ] Verify FK constraints on `quiz_reviews` (cascade on session delete)
- [ ] Verify teacher/parent assignment constraints (no self-assignment)

---

## 14. Safety Rules

- A user cannot be assigned as their own teacher or parent
- Deleting a quiz session cascades to its reviews
- Teachers can only view sessions of their assigned students (enforced at query level)
- Parents can only view sessions of their assigned children (enforced at query level)
- Admin bypasses all relationship checks (can view/manage everything)
- Role changes take effect on next token refresh (JWT contains roles snapshot)
- The legacy `users.role` column is kept during transition but not used for authorization after `user_roles` is active
