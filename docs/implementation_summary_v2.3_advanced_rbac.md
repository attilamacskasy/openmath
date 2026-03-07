# OpenMath v2.3 — Implementation Summary

**Date:** March 2026  
**Scope:** Angular 18 + FastAPI (python-api) stack  
**Spec:** `spec_v2.3_advanced_rbac.md`  
**Depends on:** v2.2.1 (`students` → `users` rename), v2.2 (quiz type editor)

---

## Overview

This release adds multi-role RBAC, teacher/parent roles with a quiz review workflow, server-side quiz rendering, and a Google SSO UX improvement. Users can now hold multiple roles simultaneously (e.g. teacher + parent), teachers can review students' quizzes, and parents can view and sign off on reviews.

---

## Architecture

```
┌──────────────────┐                           ┌────────────────┐
│   Angular 18     │──── GET /teacher/* ──────►│  FastAPI 2.3   │
│   + PrimeNG 17   │──── GET /parent/*  ──────►│  8 routers     │
│   (port 4200)    │──── PUT /users/*/roles ──►│  (port 8000)   │
└──────────────────┘     Bearer JWT + roles     └───────┬────────┘
                                                        │ asyncpg
                                                        ▼
                                                ┌────────────────┐
                                                │  PostgreSQL 16  │
                                                │  10 tables      │
                                                │  (port 5432)    │
                                                └────────────────┘
```

**RBAC model:** JWT payload now carries `roles: string[]` alongside the legacy `role: string`. Authorization checks query the `user_roles` junction table via `require_roles()` factory dependency. Admin role bypasses all relationship checks.

**Review workflow:** Student completes quiz → teacher reviews + comments → parent reads review + signs off.

---

## Database Changes

### New migration: `db/migrations/0010_multi_role_rbac.sql`

5 new tables created:

| Table | Purpose | Key constraints |
|---|---|---|
| `roles` | Role definitions | `name UNIQUE` — seeded: admin, student, teacher, parent |
| `user_roles` | User ↔ role junction | `UNIQUE (user_id, role_id)`, cascade delete |
| `teacher_students` | Teacher ↔ student assignments | `UNIQUE (teacher_id, student_id)`, cascade delete |
| `parent_students` | Parent ↔ student assignments | `UNIQUE (parent_id, student_id)`, cascade delete |
| `quiz_reviews` | Teacher reviews + parent sign-offs | `reviewer_role CHECK (teacher/parent)`, `status CHECK (pending/reviewed/signed)` |

**Data migration:** Existing `users.role` values are copied into `user_roles` via `INSERT ... SELECT ... ON CONFLICT DO NOTHING`. The legacy `role` column is retained for backward compatibility.

### Migration fixes applied

| Migration | Issue | Fix |
|---|---|---|
| `0005_jsonb_modernization.sql` | Referenced `student_id` (renamed to `user_id` in v2.2.1) | Changed to `user_id` |
| `0009_rename_students_to_users.sql` | Not idempotent — failed on re-run when `users` already existed | Wrapped in `DO $$` block: drops phantom `students` table if `users` exists |
| `0007_quiz_type_editor.sql` | `ON CONFLICT DO NOTHING` preserved corrupted Unicode | Changed to `ON CONFLICT DO UPDATE SET description = EXCLUDED.description` |
| `scripts/apply-migrations.ps1` | `psql` mangled Unicode (×, ÷, →, ≤, ≥, −, …) | Added `PGCLIENTENCODING=UTF8` environment variable |

### Final table inventory (10 tables)

`users` · `roles` · `user_roles` · `teacher_students` · `parent_students` · `quiz_types` · `quiz_sessions` · `questions` · `answers` · `quiz_reviews`

---

## Backend Changes (python-api)

### New Files

| File | Purpose |
|---|---|
| `app/routers/teacher.py` | 5 teacher endpoints: list students, student sessions, session detail, submit review, list reviews |
| `app/routers/parent.py` | 4 parent endpoints: list children, child sessions, session detail, sign off |

### Modified Files

| File | Changes |
|---|---|
| `app/main.py` | Version → 2.3.0; registered `teacher` and `parent` routers at `/api` prefix |
| `app/queries.py` | +18 query functions: role CRUD (`get_user_roles`, `set_user_roles`, `add_user_role`, `get_all_roles`), teacher–student CRUD, parent–student CRUD, quiz review CRUD, `get_session_owner_id`, updated `list_users_admin` to include roles subquery |
| `app/schemas/auth.py` | `AuthUser.roles: list[str]`, expanded `AdminCreateUserRequest.role` pattern to include teacher/parent, new schemas: `ReviewRequest`, `SignoffRequest`, `RoleAssignment`, `RelationshipRequest` |
| `app/dependencies.py` | New `require_roles(*roles)` factory returning dependency that checks `user_roles` table; updated `require_admin` to use table-based lookup |
| `app/auth.py` | `create_access_token` now accepts `roles: list[str]` parameter; JWT payload includes both `role` and `roles` |
| `app/routers/auth.py` | `_build_auth_user` / `_build_tokens` now async — fetch roles from `user_roles`; register assigns student role via `add_user_role()`; Google auth assigns student role for new users; `/me` returns roles list |
| `app/routers/users.py` | Role management: `GET/PUT /users/{id}/roles`; relationship CRUD: `GET/POST/DELETE /admin/teacher-students` and `/admin/parent-students`; role checks updated to use `get_user_roles()` |
| `app/routers/sessions.py` | Session list/detail use `get_user_roles()` for access control; session detail includes reviews via `get_reviews_for_session()` |
| `app/services/generator.py` | New `_render_to_html()` helper (× → `&times;`, ÷ → `&divide;`, − → `&minus;`); `_make_prompt()` now includes `render_html` key |

### API Endpoints — New

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teacher/students` | teacher/admin | Teacher's assigned students |
| GET | `/api/teacher/students/{id}/sessions` | teacher/admin | Student's sessions with review status |
| GET | `/api/teacher/sessions/{id}` | teacher/admin | Session detail + questions + reviews |
| POST | `/api/teacher/sessions/{id}/review` | teacher/admin | Submit review comment + mark reviewed |
| GET | `/api/teacher/reviews` | teacher/admin | All reviews by current teacher |
| GET | `/api/parent/children` | parent/admin | Parent's assigned children |
| GET | `/api/parent/children/{id}/sessions` | parent/admin | Child's sessions with review/signoff status |
| GET | `/api/parent/sessions/{id}` | parent/admin | Session detail + reviews |
| POST | `/api/parent/sessions/{id}/signoff` | parent/admin | Sign off on reviewed session |
| GET | `/api/users/{id}/roles` | admin | Get user's assigned roles |
| PUT | `/api/users/{id}/roles` | admin | Replace user's roles |
| GET | `/api/admin/teacher-students` | admin | All teacher–student assignments |
| POST | `/api/admin/teacher-students` | admin | Create assignment |
| DELETE | `/api/admin/teacher-students/{id}` | admin | Remove assignment |
| GET | `/api/admin/parent-students` | admin | All parent–student assignments |
| POST | `/api/admin/parent-students` | admin | Create assignment |
| DELETE | `/api/admin/parent-students/{id}` | admin | Remove assignment |

### API Endpoints — Modified

| Method | Path | Change |
|---|---|---|
| GET | `/api/auth/me` | Returns `roles: string[]` from `user_roles` table |
| POST | `/api/auth/register` | Assigns `student` role in `user_roles` after creation |
| POST | `/api/auth/google` | Assigns `student` role for new Google users |
| GET | `/api/sessions` | Access control uses `user_roles` table instead of JWT `role` field |
| GET | `/api/sessions/{id}` | Includes reviews array; access control via `user_roles` |
| GET | `/api/users` | Admin list includes `roles` array per user (subquery) |

---

## Frontend Changes (angular-app)

### New Files

| File | Purpose |
|---|---|
| `features/teacher/teacher-dashboard.component.ts` | Teacher dashboard — student listbox (left panel), session table (right panel), review dialog with question table + comment textarea |
| `features/parent/parent-dashboard.component.ts` | Parent dashboard — child dropdown selector, session table, detail dialog with questions + reviews + sign-off button |

### Modified Files

| File | Changes |
|---|---|
| `models/auth.model.ts` | `AuthUser.roles: string[]` added; `MeResponse.roles` added |
| `core/services/auth.service.ts` | New computed signals: `isTeacher`, `isParent`, `userRoles`; `isAdmin` updated to check `roles.includes('admin')` |
| `core/guards/auth.guard.ts` | New guards: `teacherGuard` (teacher or admin), `parentGuard` (parent or admin) |
| `app.routes.ts` | New routes: `/teacher` (TeacherDashboardComponent), `/parent` (ParentDashboardComponent) — both lazy-loaded with dual guard |
| `core/services/api.service.ts` | +15 methods: teacher API (5), parent API (4), role management (2), relationship management (6) |
| `features/history/session-detail.component.ts` | Question rendering via `render_html` + `[innerHTML]` with fallback; reviews panel showing teacher reviews + parent sign-offs |
| `features/user-admin/user-admin.component.ts` | Role column: `p-tag` chips per role (color-coded); dialog: `p-multiSelect` for role assignment; 4 role options (student/teacher/parent/admin); save calls `setUserRoles()` API |
| `features/auth/login.component.ts` | Google OAuth: `prompt=consent` → `prompt=select_account` |
| `shared/components/header/header.component.ts` | Role-based nav links: "My Students" (`/teacher`) for teachers, "My Child" (`/parent`) for parents — between History and User Guide |

### Route Guards

| Guard | Allows | Redirect |
|---|---|---|
| `authGuard` | Any authenticated user | → `/login` |
| `adminGuard` | Admin role | → `/` |
| `teacherGuard` | Teacher or admin | → `/` |
| `parentGuard` | Parent or admin | → `/` |

### Teacher Dashboard

- **Left panel:** `p-listbox` with student names + computed age badges
- **Right panel:** `p-table` showing quiz type, difficulty, score%, date, review status tag
- **Review dialog:** Session summary → question-by-question table (uses `render_html` with `[innerHTML]`) → existing reviews → comment textarea → "Mark as Reviewed" button
- Calls `submitTeacherReview()` with status `"reviewed"`

### Parent Dashboard

- **Child selector:** `p-dropdown` (auto-selects when only one child)
- **Session table:** Quiz type, difficulty, score%, date, review status, sign-off status
- **Detail dialog:** Question table → existing reviews → optional comment → "Sign Off" button
- Calls `submitParentSignoff()` with status `"signed"`

### User Admin Updates

- Role display: color-coded `p-tag` chips per role (admin=warning, teacher=success, parent=secondary, student=info)
- Role editing: `p-multiSelect` with chip display in create/edit dialog
- Save flow: profile update → `setUserRoles()` API call → reload list
- Create flow: sends primary role to backend + sets additional roles if needed

---

## Review Workflow

```
Student completes quiz
        │
        ▼
  Session: completed
  Review: pending (⏳ gray)
        │
        ▼
  Teacher opens session
  Teacher adds comment
  Teacher marks "reviewed"
        │
        ▼
  Review: reviewed (✅ blue)
  Comment visible to student + parent
        │
        ▼
  Parent opens session
  Parent reads teacher comment
  Parent signs off + optional comment
        │
        ▼
  Review: signed (✍️ green)
```

---

## Server-Side Quiz Rendering

Quiz expressions now include a `render_html` field in the JSONB `prompt` column, generated at question creation time:

```json
{
  "render": "3 × 7",
  "render_html": "<span class='om-expr'>3 &times; 7</span>"
}
```

**Character mappings:** `×` → `&times;`, `÷` → `&divide;`, `−` → `&minus;`

All display contexts (quiz play, history, teacher review, parent review) use `[innerHTML]="question.render_html"` with plain-text fallback when `render_html` is absent.

---

## Google SSO Improvement

Changed `prompt=consent` → `prompt=select_account` in the Google OAuth redirect URL. Users who previously authorized OpenMath now skip the consent screen and go straight to account selection.

---

## Files Changed Summary

### Created (5 files)

| File | Lines |
|---|---|
| `db/migrations/0010_multi_role_rbac.sql` | ~95 |
| `python-api/app/routers/teacher.py` | ~130 |
| `python-api/app/routers/parent.py` | ~100 |
| `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` | ~280 |
| `angular-app/src/app/features/parent/parent-dashboard.component.ts` | ~270 |

### Modified (18 files)

| File | Nature of change |
|---|---|
| `python-api/app/main.py` | Version bump, 2 new router imports |
| `python-api/app/queries.py` | +18 query functions (~300 lines) |
| `python-api/app/schemas/auth.py` | 4 new schemas, expanded patterns |
| `python-api/app/dependencies.py` | `require_roles()` factory |
| `python-api/app/auth.py` | JWT roles parameter |
| `python-api/app/routers/auth.py` | Async role lookup, register assigns role |
| `python-api/app/routers/users.py` | Role management + relationship CRUD |
| `python-api/app/routers/sessions.py` | Reviews in session detail, role-based access |
| `python-api/app/services/generator.py` | `render_html` generation |
| `angular-app/src/app/models/auth.model.ts` | roles array |
| `angular-app/src/app/core/services/auth.service.ts` | isTeacher, isParent signals |
| `angular-app/src/app/core/guards/auth.guard.ts` | teacherGuard, parentGuard |
| `angular-app/src/app/app.routes.ts` | /teacher, /parent routes |
| `angular-app/src/app/core/services/api.service.ts` | +15 API methods |
| `angular-app/src/app/features/history/session-detail.component.ts` | render_html + reviews panel |
| `angular-app/src/app/features/user-admin/user-admin.component.ts` | Role multi-select UI |
| `angular-app/src/app/features/auth/login.component.ts` | prompt=select_account |
| `angular-app/src/app/shared/components/header/header.component.ts` | Role-based nav links |

### Migration fixes (4 files)

| File | Fix |
|---|---|
| `db/migrations/0005_jsonb_modernization.sql` | `student_id` → `user_id` |
| `db/migrations/0007_quiz_type_editor.sql` | `ON CONFLICT DO UPDATE` for Unicode preservation |
| `db/migrations/0009_rename_students_to_users.sql` | Idempotent `DO $$` block |
| `scripts/apply-migrations.ps1` | `PGCLIENTENCODING=UTF8` |
