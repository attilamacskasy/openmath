# OpenMath v2.4 — Implementation Summary

**Date:** March 2026  
**Scope:** Angular 18 + FastAPI (python-api) stack  
**Spec:** `spec_v2.4_ux_improvements.md`  
**Depends on:** v2.3 (multi-role RBAC, teacher/parent dashboards, review workflow)

---

## Overview

This release adds self-service student/child association for teachers and parents, modernizes the header with role tags and provider badges, adds nav link hover styling, cleans up arrow characters in quiz descriptions, adds Google SSO guardrails in User Admin, and completely rewrites the User Guide with role-based sections.

---

## Database Changes

### New migration: `db/migrations/0011_max_parents_constraint.sql`

Adds a `BEFORE INSERT` trigger on `parent_students` that limits each student to at most 2 parent associations.

| Object | Type | Purpose |
|---|---|---|
| `check_max_parents()` | Function | Counts existing parents for the student; raises exception if ≥ 2 |
| `trg_max_parents` | Trigger | `BEFORE INSERT ON parent_students FOR EACH ROW` |

Error message: `'A student can have at most 2 parents'`

### New migration: `db/migrations/0012_fix_quiz_descriptions.sql`

Replaces `→` with `=` in all quiz type descriptions:

```sql
UPDATE quiz_types SET description = REPLACE(description, '→', '=') WHERE description LIKE '%→%';
```

Affects 4 rows: `roman_to_arabic`, `arabic_to_roman`, `measure_dm_to_cm`, `measure_m_to_cm`.

### Modified migration: `db/migrations/0007_quiz_type_editor.sql`

Updated 4 seed descriptions to use `=` instead of `→`:

| Before | After |
|---|---|
| `'Roman → Arabic (XIV = ?)'` | `'Roman = Arabic (XIV = ?)'` |
| `'Arabic → Roman (27 = ?)'` | `'Arabic = Roman (27 = ?)'` |
| `'Conversion: dm → cm (5 dm = ? cm)'` | `'Conversion: dm = cm (5 dm = ? cm)'` |
| `'Conversion: m → cm (2 m = ? cm)'` | `'Conversion: m = cm (2 m = ? cm)'` |

### Final table inventory (10 tables — unchanged)

`users` · `roles` · `user_roles` · `teacher_students` · `parent_students` · `quiz_types` · `quiz_sessions` · `questions` · `answers` · `quiz_reviews`

---

## Backend Changes (python-api)

### Modified Files

| File | Changes |
|---|---|
| `app/routers/teacher.py` | +2 endpoints: `POST /students` (email-based self-association), `DELETE /students/{student_id}` (remove from own class). New imports: `AssociateByEmailRequest`, `find_user_by_email`, `get_user_roles`, `create_teacher_student`, `delete_teacher_student_by_pair` |
| `app/routers/parent.py` | +2 endpoints: `POST /children` (email-based self-association), `DELETE /children/{child_id}` (remove from own account). Same import pattern as teacher. Handles max-2-parents DB trigger exception. |
| `app/queries.py` | +2 query functions: `delete_teacher_student_by_pair(teacher_id, student_id)`, `delete_parent_student_by_pair(parent_id, student_id)` — both use pair-based `DELETE WHERE teacher/parent_id = $1 AND student_id = $2` |
| `app/schemas/auth.py` | +1 Pydantic model: `AssociateByEmailRequest(BaseModel)` with `email: str` field |

### API Endpoints — New

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/teacher/students` | teacher/admin | Add student by email lookup |
| `DELETE` | `/api/teacher/students/{student_id}` | teacher/admin | Remove student from own class |
| `POST` | `/api/parent/children` | parent/admin | Add child by email lookup |
| `DELETE` | `/api/parent/children/{child_id}` | parent/admin | Remove child from own account |

### Self-association endpoint logic

Both `POST` endpoints follow the same pattern:

1. Look up user by email via `find_user_by_email()`
2. Verify the found user has the `student` role
3. Reject self-association (teacher/parent cannot add themselves)
4. Create the assignment; handle duplicate (409) and max-parents (409) exceptions
5. Return the created assignment record

**Privacy:** No user list/search is exposed. The caller must know the student's exact registered email.

---

## Frontend Changes (angular-app)

### Modified Files

| File | Changes |
|---|---|
| `features/teacher/teacher-dashboard.component.ts` | "Add Student" button in card subtitle, remove button (× icon) per student in listbox, "Add Student" dialog with email input, `addStudent()` / `removeStudent()` / `loadStudents()` methods, 3 new signals |
| `features/parent/parent-dashboard.component.ts` | "Add Child" button in header area, remove button next to child selector/name, "Add Child" dialog with email input, `addChild()` / `removeChild()` / `loadChildren()` methods, 3 new signals |
| `core/services/api.service.ts` | +4 methods: `addTeacherStudent(email)`, `removeTeacherStudent(studentId)`, `addParentChild(email)`, `removeParentChild(childId)` |
| `shared/components/header/header.component.ts` | Complete rewrite — removed `providerLabel()` / `providerClass()` methods and emoji badges; added `TagModule` import, email in parentheses, inline provider badge with color backgrounds, role `p-tag` chips via `roleSeverity()`, nav link hover CSS |
| `features/quiz-type-editor/quiz-type-editor.component.ts` | 2 arrow fixes: `→` to `=` in preview template (lines 201, 232) |
| `features/start/start.component.ts` | 1 arrow fix: `→` to `=` in quiz preview (line 102) |
| `features/user-admin/user-admin.component.ts` | Reset password button hidden for Google-only users (`@if (s.auth_provider !== 'google')`); email input disabled for Google SSO users with helper text |
| `features/user-guide/user-guide.component.ts` | Complete template rewrite — new sections: Introduction, Purpose, Core Features, combined Getting Started + Authentication; role-gated sections for Teacher (`@if auth.isTeacher()`), Parent (`@if auth.isParent()`); expanded Admin section with Quiz Type Editor |

### Teacher Dashboard — Add/Remove UI

- **Add Student button:** Inside `<ng-template pTemplate="subtitle">` of the Students card
- **Remove button:** `pi pi-times` icon per student in listbox item template, with `event.stopPropagation()` to prevent selection
- **Dialog:** Modal with email input, Cancel/Add buttons, loading state via signal
- **Flow:** Email → `POST /teacher/students` → success toast → `loadStudents()` refresh

### Parent Dashboard — Add/Remove UI

- **Add Child button:** Flex layout between `<h2>My Child</h2>` and button
- **Remove button:** Next to child dropdown (multiple children) or next to child name (single child)
- **Dialog:** Same pattern as teacher — email input, Cancel/Add buttons, loading signal
- **Max parents error:** Backend returns 409 with "maximum of 2 parents" message, displayed in error toast

### Header Modernization

**Before:**
- `user.name` + emoji provider badge (`🔵 Google` / `🔗 Google + Local` / `🔑 Local`)
- No roles, no email

**After:**
- `user.name` + `(user.email)` + color provider badge + role `p-tag` chips + Logout button

**Provider badge colors:**

| Provider | Background | Text |
|---|---|---|
| `google` | `#c8e6c9` (light green) | `#2e7d32` (dark green) |
| `both` | `#c8e6c9` (light green) | `#2e7d32` (dark green) |
| `local` | `#e0e0e0` (light gray) | `#424242` (dark gray) |

**Role tag severities:**

| Role | PrimeNG Severity | Color |
|---|---|---|
| admin | `danger` | Red |
| teacher | `warning` | Orange |
| parent | `secondary` | Gray |
| student | `info` | Blue |

### Menu Hover Styling

Added `styles` block to `HeaderComponent`:

```css
nav a {
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  transition: background-color 0.15s;
}
nav a:hover {
  background-color: #f0f0f0;
}
```

### Arrow-to-Equals Cleanup

3 template locations updated:

| File | Line | Before | After |
|---|---|---|---|
| `quiz-type-editor.component.ts` | 201 | `{{ p.render }} → {{ p.correct }}` | `{{ p.render }} = {{ p.correct }}` |
| `quiz-type-editor.component.ts` | 232 | `→ {{ p.correct }}` | `= {{ p.correct }}` |
| `start.component.ts` | 102 | `→ {{ p.correct }}` | `= {{ p.correct }}` |

### User Admin — Google Guardrails

| Feature | Implementation |
|---|---|
| Hide reset password | `@if (s.auth_provider !== 'google')` wrapping the `pi pi-key` button |
| Disable email change | `[disabled]="editingUser !== null && editingUser.auth_provider === 'google'"` on email `<input>` |
| Helper text | `<small class="text-500">Email cannot be changed for Google SSO accounts.</small>` shown for Google users |

**Logic:** Google-only users have no local password (reset is meaningless) and their email is managed by Google (change could break SSO). Users with `both` or `local` provider are unaffected.

### User Guide Rewrite

**Previous structure (7 sections):**
Getting Started → Authentication → Taking a Quiz → Quiz Types (2 listed) → Difficulty Levels → Your Profile → History → Admin (×2, gated by `isAdmin`)

**New structure (12 sections):**

| # | Section | Visibility |
|---|---|---|
| 1 | Introduction | All users |
| 2 | Purpose | All users |
| 3 | Core Features (23 quiz types listed) | All users |
| 4 | Getting Started + Authentication (combined) | All users |
| 5 | Taking a Quiz | All users |
| 6 | Your Profile | All users |
| 7 | History | All users |
| 8 | Teacher — My Students | `@if (auth.isTeacher())` |
| 9 | Parent — My Child | `@if (auth.isParent())` |
| 10 | Admin — User Management | `@if (auth.isAdmin())` |
| 11 | Admin — Quiz Type Editor | `@if (auth.isAdmin())` |
| 12 | Admin — Database & Statistics | `@if (auth.isAdmin())` |

Key improvements: quiz type count updated to 23, teacher/parent sections explain add/remove and review/sign-off workflows, admin section covers all 3 admin areas.

---

## Files Changed Summary

### Created (2 files)

| File | Lines |
|---|---|
| `db/migrations/0011_max_parents_constraint.sql` | 19 |
| `db/migrations/0012_fix_quiz_descriptions.sql` | 4 |

### Modified (11 files)

| File | Nature of change |
|---|---|
| `db/migrations/0007_quiz_type_editor.sql` | 4 arrow→equals in seed descriptions |
| `python-api/app/routers/teacher.py` | +2 endpoints (self-association + remove) |
| `python-api/app/routers/parent.py` | +2 endpoints (self-association + remove) |
| `python-api/app/queries.py` | +2 query functions (delete by pair) |
| `python-api/app/schemas/auth.py` | +1 Pydantic schema |
| `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` | Add/remove student UI + dialog |
| `angular-app/src/app/features/parent/parent-dashboard.component.ts` | Add/remove child UI + dialog |
| `angular-app/src/app/core/services/api.service.ts` | +4 HTTP methods |
| `angular-app/src/app/shared/components/header/header.component.ts` | Complete rewrite (provider badge, role tags, hover CSS) |
| `angular-app/src/app/features/quiz-type-editor/quiz-type-editor.component.ts` | 2 arrow→equals |
| `angular-app/src/app/features/start/start.component.ts` | 1 arrow→equals |
| `angular-app/src/app/features/user-admin/user-admin.component.ts` | Google guardrails (reset password + email) |
| `angular-app/src/app/features/user-guide/user-guide.component.ts` | Complete template rewrite |

---

## Build Verification

Angular build passes successfully. Only pre-existing bundle size budget warning remains (initial bundle 962 KB vs 512 KB budget).

One build fix applied during implementation: PrimeNG `p-tag` severity type uses `'warning'` (not `'warn'`). The `roleSeverity()` return type was corrected to match `'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'`.

---

## Post-Implementation Steps

1. Apply migrations `0011` and `0012` via `dev.ps1` option 5 or `scripts/apply-migrations.ps1`
2. Verify max-parents trigger: attempt to add a 3rd parent to a student — should return 409
3. End-to-end test: teacher adds student by email, parent adds child by email
4. Verify header displays correctly for users with multiple roles
5. Confirm reset password button is hidden for Google-only users in User Admin
