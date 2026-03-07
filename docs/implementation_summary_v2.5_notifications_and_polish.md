# OpenMath v2.5 — Implementation Summary

**Date:** March 2026  
**Scope:** Angular 18 + FastAPI (python-api) stack  
**Spec:** `spec_v2.5_notifications_and_polish.md`  
**Depends on:** v2.4 (self-association, header modernization, user guide rewrite)

---

## Overview

This release adds a full notification system with bell icon, review template dropdowns for teachers and parents, a parent sign-off guard requiring teacher review, SVG logo across all pages, modernized footer, student profile associations, cross-role history access, and example question card styling.

---

## Database Changes

### New migration: `db/migrations/0013_review_templates.sql`

Creates the `review_templates` table and seeds 18 template responses (9 teacher, 9 parent).

| Object | Type | Purpose |
|---|---|---|
| `review_templates` | Table | Stores pre-defined feedback messages for reviewers |

**Columns:** `id` (UUID PK), `reviewer_role` (teacher\|parent), `sentiment` (positive\|neutral\|negative), `label`, `message`, `sort_order`, `created_at`

**Seed data:** 3 templates per sentiment per role (18 total):

| Role | Sentiment | Labels |
|---|---|---|
| teacher | positive | Excellent work, Well done, Great improvement |
| teacher | neutral | Good effort, Keep practicing, Room for growth |
| teacher | negative | Needs more work, Below expectations, Please retry |
| parent | positive | So proud!, Wonderful job, Keep shining |
| parent | neutral | Good try, Practice makes perfect, Almost there |
| parent | negative | Let's review, Need to focus, Try again |

### New migration: `db/migrations/0014_notifications.sql`

Creates the `notifications` table with two indexes.

| Object | Type | Purpose |
|---|---|---|
| `notifications` | Table | Tracks all system notifications per user |
| `idx_notifications_user` | Index | Fast lookup by user_id |
| `idx_notifications_user_unread` | Partial index | Fast unread count (WHERE is_read = false) |

**Columns:** `id` (UUID PK), `user_id` (FK → users), `type`, `title`, `message`, `metadata` (JSONB), `is_read` (default false), `created_at`, `read_at`

### New migration: `db/migrations/0015_student_associations_view.sql`

Adds `created_at TIMESTAMPTZ` to `teacher_students` and `parent_students`, then creates the `student_associations` view.

| Object | Type | Purpose |
|---|---|---|
| `teacher_students.created_at` | Column | Timestamp for teacher-student association |
| `parent_students.created_at` | Column | Timestamp for parent-student association |
| `student_associations` | View | UNION ALL of teacher + parent associations with user info |

**View columns:** `student_id`, `relationship` (teacher\|parent), `related_user_id`, `related_name`, `related_email`, `associated_at`

### Final table inventory (12 tables + 1 view)

`users` · `roles` · `user_roles` · `teacher_students` · `parent_students` · `quiz_types` · `quiz_sessions` · `questions` · `answers` · `quiz_reviews` · `review_templates` · `notifications` · `student_associations` (view)

---

## Backend Changes (python-api)

### New Files

| File | Lines | Purpose |
|---|---|---|
| `app/routers/notifications.py` | 78 | Notification CRUD + review template endpoints |
| `app/services/notifications.py` | 42 | Helper functions for creating and broadcasting notifications |

### Modified Files

| File | Changes |
|---|---|
| `app/main.py` | Version → `2.5.0`, imports + registers `notifications.router` |
| `app/queries.py` | +10 query functions (134 lines) for templates, notifications, associations, session info |
| `app/routers/teacher.py` | Notification triggers on associate/remove/review |
| `app/routers/parent.py` | Sign-off guard (teacher review required), notification triggers on associate/remove/signoff |
| `app/routers/answers.py` | Quiz completion notification to all teachers of the student |
| `app/routers/users.py` | `GET /users/{id}/associations` endpoint, role-change notification |
| `app/routers/sessions.py` | `user_id` query param for `GET /sessions`, teacher/parent access for `GET /sessions/{id}` |

### New Query Functions in `queries.py`

| Function | Returns | Purpose |
|---|---|---|
| `list_review_templates(role)` | `list[dict]` | All templates for a reviewer role, ordered by sort_order |
| `insert_notification(user_id, ntype, title, message, metadata)` | `dict` | Insert notification, return full row |
| `get_notifications(user_id, unread_only)` | `list[dict]` | User's notifications (limit 100), newest first |
| `count_unread_notifications(user_id)` | `int` | Count of unread notifications |
| `mark_notification_read(notification_id, user_id)` | `bool` | Mark single notification read |
| `mark_all_notifications_read(user_id)` | `int` | Mark all unread as read, return count |
| `get_teachers_for_student(student_id)` | `list[dict]` | All teachers associated with a student |
| `get_parents_for_student(student_id)` | `list[dict]` | All parents associated with a student |
| `get_student_associations(user_id)` | `list[dict]` | Query student_associations view |
| `get_session_with_quiz_info(session_id)` | `dict \| None` | Session with user name + quiz type info |

### API Endpoints — New

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | any | List notifications (optional `unread_only` query param) |
| `GET` | `/api/notifications/unread-count` | any | Returns `{count: int}` |
| `PATCH` | `/api/notifications/{id}/read` | any | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | any | Mark all notifications as read |
| `GET` | `/api/review-templates` | any | Templates filtered by `role` and optional `score_percent` |
| `GET` | `/api/users/{id}/associations` | self/admin | Student's associated teachers and parents |

### API Endpoints — Modified

| Method | Path | Change |
|---|---|---|
| `GET` | `/api/sessions` | New optional `user_id` query param (admin/teacher/parent verified) |
| `GET` | `/api/sessions/{id}` | Now allows teacher-of-student and parent-of-child access |
| `POST` | `/api/teacher/students` | Now notifies student |
| `DELETE` | `/api/teacher/students/{id}` | Now notifies student |
| `POST` | `/api/teacher/sessions/{id}/review` | Now notifies student + all parents |
| `POST` | `/api/parent/children` | Now notifies child |
| `DELETE` | `/api/parent/children/{id}` | Now notifies child |
| `POST` | `/api/parent/sessions/{id}/signoff` | Guard: 400 if no teacher review. Now notifies child |
| `POST` | `/api/answers` | On quiz completion, notifies all teachers with score |
| `PATCH` | `/api/users/{id}/roles` | Now notifies affected user |

### Notification Types

| Type | Trigger | Recipient |
|---|---|---|
| `student_associated_teacher` | Teacher adds student | Student |
| `student_associated_parent` | Parent adds child | Student |
| `student_removed_teacher` | Teacher removes student | Student |
| `student_removed_parent` | Parent removes child | Student |
| `quiz_completed` | Student finishes quiz | All teachers of that student |
| `review_submitted` | Teacher reviews session | Student + all parents |
| `signoff_submitted` | Parent signs off | Student |
| `role_changed` | Admin changes user roles | Affected user |

### Review Template Sentiment Thresholds

| Score % | Sentiment | Templates returned |
|---|---|---|
| ≥ 70% | positive | 3 encouraging templates |
| 40–69% | neutral | 3 moderate templates |
| < 40% | negative | 3 corrective templates |

### Parent Sign-Off Guard

`POST /parent/sessions/{id}/signoff` now raises HTTP 400 `"Cannot sign off until a teacher has reviewed this session"` if no `quiz_reviews` row with `reviewer_role = 'teacher'` and `status = 'reviewed'` exists for the session.

---

## Frontend Changes (angular-app)

### New Files

| File | Lines | Purpose |
|---|---|---|
| `models/notification.model.ts` | 12 | `Notification` interface |

### Modified Files

| File | Nature of change |
|---|---|
| `core/services/api.service.ts` | +7 methods: `getReviewTemplates`, `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead`, `getUserAssociations`, `getUserSessions` |
| `shared/components/header/header.component.ts` | Complete rewrite: SVG logo, provider `p-tag`, notification bell with badge, overlay panel |
| `shared/components/footer/footer.component.ts` | Rewrite: version 2.5, correct GitHub source link, SVG logo, tech stack text |
| `features/auth/login.component.ts` | SVG logo replaces `🧮` emoji |
| `features/auth/register.component.ts` | SVG logo replaces `🧮` emoji |
| `features/profile/profile.component.ts` | Provider `p-tag`, "My Teachers & Parents" associations card |
| `features/start/start.component.ts` | Example questions rendered as cards (not bullet points) |
| `features/teacher/teacher-dashboard.component.ts` | Quick Feedback template dropdown, View History button per student |
| `features/parent/parent-dashboard.component.ts` | Quick Feedback template dropdown, Sign Off guard (disabled until teacher review), View History button per child |
| `features/history/history-list.component.ts` | Supports `userId` route param for cross-role history access |
| `features/user-guide/user-guide.component.ts` | New Notifications section, associations section, updated teacher/parent docs |
| `app.routes.ts` | New route `history/user/:userId` |

### Header — Notification Bell

The header now includes a bell icon (`pi pi-bell`) with a red badge showing the unread notification count. Clicking the bell opens a PrimeNG `OverlayPanel` with:

- List of recent notifications (newest first)
- "Mark as read" button per notification
- "Accept All" button to dismiss all at once
- Empty-state message when no unread notifications

Unread count is polled every 30 seconds via `interval()` and auto-cleaned up with `takeUntilDestroyed()`.

### Header — SVG Logo

All `🧮` emoji instances replaced with the Nuxt app's SVG logo (blue-to-green gradient circle with × left eye, ✓ right eye, smile curve). Each component uses a unique gradient ID to avoid SVG conflicts when multiple instances are on the same page:

| Component | Gradient ID | Size |
|---|---|---|
| Header | `om-grad-h` | 28px |
| Login | `om-grad-l` | 40px |
| Register | `om-grad-r` | 40px |
| Footer | `om-grad-f` | 20px |

### Header — Provider Tag

Provider display moved before name and switched from inline `<span>` with background color to PrimeNG `p-tag`:

| Provider | Label | Severity |
|---|---|---|
| `google` | Google | `success` |
| `both` | Google + Local | `success` |
| `local` | Local | `secondary` |

### Footer Modernization

**Before:** `OpenMath v2.1` with generic `github.com` link, `surface-ground` background

**After:** SVG logo (20px) + `OpenMath v2.5 · Angular 18 · PrimeNG 17 · FastAPI · PostgreSQL` + GitHub icon link to `github.com/attilamacskasy/openmath`, `surface-card` background

### Profile — Associations Card

New "My Teachers & Parents" card below performance stats on the Profile page:

- Uses `p-table` with columns: Relationship, Name, Email, Since
- Data loaded via `GET /api/users/{id}/associations`
- Only shown to students (displays teachers and parents linked to their account)

### Profile — Provider Tag

Replaced emoji-based provider `<span>` (`🔵 Google` / `🔗 Google + Local` / `🔑 Local`) with PrimeNG `p-tag` using same severity scheme as the header.

### Start Page — Example Questions

**Before:** Bullet points (`• {{ p.render }} = {{ p.correct }}`) inside a `surface-50` container

**After:** Individual cards with `surface-50 p-3 border-round` styling, flex layout with question text in bold and answer in green (`text-green-600`). Matches the admin quiz-type-editor preview style.

### Teacher Dashboard — Review Templates

Added "Quick Feedback" dropdown above the comment textarea in the review dialog:

- Templates loaded via `GET /api/review-templates?role=teacher&score_percent={n}` when opening a review
- Selecting a template auto-fills the comment textarea
- Dropdown can be cleared to type a custom comment
- "View History" button (`pi pi-history`) added per student in the sidebar

### Parent Dashboard — Sign-Off Guard & Templates

Added "Quick Feedback" dropdown above the comment textarea in the sign-off dialog (same pattern as teacher):

- Templates loaded via `GET /api/review-templates?role=parent&score_percent={n}` when opening a session
- Sign Off button is `[disabled]` until `hasTeacherReview()` returns true
- `hasTeacherReview()` checks `sessionDetail().reviews` for a row with `reviewer_role === 'teacher'` and `status === 'reviewed'`
- Tooltip shows "Waiting for teacher review" when disabled
- "View History" button (`pi pi-history`) added next to child name

### History — Cross-Role Access

New route `history/user/:userId` reuses `HistoryListComponent`:

- `ActivatedRoute` injected to read `userId` param
- When `userId` is present, sessions loaded via `getUserSessions(userId)` instead of `getSessions()`
- Page title shows `"{name}'s Session History"` instead of `"Session History"`
- User name fetched via `getUser(userId)`
- Teachers navigate here via the "View History" button on teacher dashboard
- Parents navigate here via the "View History" button on parent dashboard

### User Guide — New Sections

Added to the user guide:

| Section | Content |
|---|---|
| Notifications | Bell icon, unread count, notification triggers (reviews, sign-offs, associations, role changes) |
| My Teachers & Parents | Associations card on profile page |
| Teacher — View History | History icon per student |
| Teacher — Quick Feedback | Template dropdown in review dialog |
| Parent — Sign-Off Guard | Sign-off requires teacher review first |
| Parent — Quick Feedback | Template dropdown in sign-off dialog |

---

## Files Changed Summary

### Created (5 files)

| File | Lines | Purpose |
|---|---|---|
| `db/migrations/0013_review_templates.sql` | 37 | review_templates table + seed data |
| `db/migrations/0014_notifications.sql` | 16 | notifications table + indexes |
| `db/migrations/0015_student_associations_view.sql` | 25 | created_at columns + associations view |
| `python-api/app/routers/notifications.py` | 78 | Notification + review template endpoints |
| `python-api/app/services/notifications.py` | 42 | Notification broadcast helpers |
| `angular-app/src/app/models/notification.model.ts` | 12 | Notification TypeScript interface |

### Modified (16 files)

| File | Nature of change |
|---|---|
| `python-api/app/main.py` | Version 2.5.0, notifications router registration |
| `python-api/app/queries.py` | +10 query functions (134 lines) |
| `python-api/app/routers/teacher.py` | Notification triggers (associate, remove, review) |
| `python-api/app/routers/parent.py` | Sign-off guard + notification triggers |
| `python-api/app/routers/answers.py` | Quiz completion notification to teachers |
| `python-api/app/routers/users.py` | Associations endpoint + role-change notification |
| `python-api/app/routers/sessions.py` | user_id param + teacher/parent access |
| `angular-app/src/app/app.routes.ts` | New `history/user/:userId` route |
| `angular-app/src/app/core/services/api.service.ts` | +7 HTTP methods |
| `angular-app/src/app/shared/components/header/header.component.ts` | SVG logo, bell + overlay, provider p-tag |
| `angular-app/src/app/shared/components/footer/footer.component.ts` | Version, source link, SVG logo, tech stack |
| `angular-app/src/app/features/auth/login.component.ts` | SVG logo |
| `angular-app/src/app/features/auth/register.component.ts` | SVG logo |
| `angular-app/src/app/features/profile/profile.component.ts` | Provider p-tag, associations card |
| `angular-app/src/app/features/start/start.component.ts` | Example question cards |
| `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` | Template dropdown, view history button |
| `angular-app/src/app/features/parent/parent-dashboard.component.ts` | Template dropdown, sign-off guard, view history button |
| `angular-app/src/app/features/history/history-list.component.ts` | userId route param support |
| `angular-app/src/app/features/user-guide/user-guide.component.ts` | Notifications, templates, guard docs |

---

## Build Verification

- **Angular:** Build passes. Only pre-existing bundle size budget warning (initial bundle ~962 KB vs 512 KB budget).
- **Python:** All imports resolve successfully (`from app.main import app` — OK).

---

## Post-Implementation Steps

1. Apply migrations `0013`, `0014`, `0015` via `dev.ps1` option 5 or `scripts/apply-migrations.ps1`
2. Verify review templates appear when opening a teacher review or parent sign-off dialog
3. Test sign-off guard: attempt parent sign-off before teacher review — button should be disabled
4. Test notifications: add a student, complete a quiz, submit a review — verify bell badge increments
5. Verify notification overlay: click bell, mark individual/all as read
6. Verify `history/user/:userId` route: teacher clicks "View History" for a student
7. Verify profile shows "My Teachers & Parents" card with correct associations
8. Verify SVG logo appears on login, register, header, and footer
