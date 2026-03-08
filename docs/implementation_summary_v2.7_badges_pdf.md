# Implementation Summary — v2.7 Badge System, Achievements & Session PDF Export

**Version:** 2.7  
**Spec:** `docs/spec_v2_7_incentive_badge_system.md`  
**Status:** ✅ Complete  
**Build:** `ng build` passes — zero compilation errors  
**Depends on:** v2.6 (localization & multi-language support)

---

## Overview

v2.7 adds a complete gamification layer to OpenMath: an automatic badge/achievement evaluation engine, timetable mastery tracking, session PDF export, and badge display across profile and dashboards. After completing a quiz, the server evaluates all badge rules against the student's history and awards any newly earned badges. Badges are shown as toasts immediately on quiz completion, displayed on the profile page in a grid, and badge counts appear on teacher/parent dashboards. Any quiz session can be exported as a styled PDF report.

---

## Database Changes

### Migration `0018_badges.sql`

- Created `badges` table with columns:
  - `id` UUID PK, `code` TEXT UNIQUE, `name_en`, `name_hu`, `description_en`, `description_hu`
  - `icon` TEXT (PrimeIcons class, e.g. `pi pi-trophy`)
  - `category` TEXT with CHECK constraint: `general`, `speed`, `accuracy`, `consistency`, `mastery`
  - `rule` JSONB — machine-readable rule definition for the evaluation engine
  - `sort_order` INT, `is_active` BOOLEAN, `created_at` TIMESTAMPTZ
- Seeded 8 initial badges with `ON CONFLICT (code) DO NOTHING`:

| Code | Name (EN) | Category | Rule Type |
|------|-----------|----------|-----------|
| `first_quiz` | First Quiz | general | `session_count` (≥1) |
| `perfect_score` | Perfect Score | accuracy | `perfect_score` (100%) |
| `speed_demon` | Speed Demon | speed | `speed` (10q in <60s) |
| `streak_master` | Streak Master | accuracy | `streak` (20 correct in a row) |
| `practice_50` | Practice Makes Perfect | consistency | `session_count` (≥50) |
| `daily_7` | Daily Learner | consistency | `daily_streak` (7 days) |
| `timetable_champ` | Timetable Champion | mastery | `timetable_mastery` (90%+ hard, tables 1–10) |
| `multi_talent` | Multi-Talent | mastery | `multi_quiz_type` (80%+ on 5 types) |

### Migration `0019_user_badges.sql`

- Created `user_badges` junction table:
  - `id` UUID PK, `user_id` FK → `users`, `badge_id` FK → `badges`, `session_id` FK → `quiz_sessions` (nullable)
  - `awarded_at` TIMESTAMPTZ, `UNIQUE(user_id, badge_id)`
- Created indexes: `idx_user_badges_user`, `idx_user_badges_badge`

---

## Backend Changes (Python API)

### New Files

| File | Purpose |
|------|---------|
| `app/schemas/badge.py` | `BadgeOut`, `UserBadgeOut`, `BadgeSummary` Pydantic models |
| `app/services/badges.py` | `evaluate_badges()` engine + `_check_rule()` dispatcher |
| `app/routers/badges.py` | 4 badge endpoints with RBAC |

### Schemas (`app/schemas/badge.py`)

- **`BadgeOut`** — full badge shape (id, code, name_en/hu, description_en/hu, icon, category, sort_order)
- **`UserBadgeOut`** — earned badge with nested `BadgeOut`, `awarded_at`, optional `session_id`
- **`BadgeSummary`** — lightweight (code, name_en, name_hu, icon) for inline answer response

### Schemas (`app/schemas/answer.py`)

- Added `BadgeSummary` import
- Added `newBadges: list[BadgeSummary] | None = None` field to `SubmitAnswerResponse`

### Queries (`app/queries.py`)

10 new async functions added (~200 lines):

| Function | Purpose |
|----------|---------|
| `list_badges()` | All active badges ordered by `sort_order` |
| `list_user_badges(user_id)` | Earned badges with joined badge details, nested dict structure |
| `award_badge(user_id, badge_id, session_id)` | INSERT with `ON CONFLICT DO NOTHING`, returns boolean |
| `count_user_badges(user_id)` | Count for dashboard badge display |
| `get_user_completed_session_count(user_id)` | For `session_count` rule evaluation |
| `get_user_daily_streak(user_id)` | Consecutive distinct practice days |
| `get_user_timetable_stats(user_id, difficulty)` | Per-timetable accuracy via `questions.a` GROUP BY, mastered flag (≥90% AND ≥10 attempts) |
| `get_user_quiz_type_scores(user_id)` | Avg score per quiz type for `multi_quiz_type` rule |
| `get_session_answers_in_order(session_id)` | Ordered answers for in-session streak calculation |
| `get_session_full_detail(session_id)` | Full session + questions + answers + reviews for PDF generation |

### Badge Evaluation Service (`app/services/badges.py`)

- **`evaluate_badges(user_id, session)`** — main entry point, called after quiz completion:
  1. Loads all active badges
  2. Filters out already-earned badges
  3. Evaluates remaining rules via `_check_rule()`
  4. Awards new badges and creates `badge_earned` notifications
  5. Returns list of `BadgeSummary` dicts for the API response
  6. Wrapped in try/except — returns empty list on failure (non-blocking)

- **`_check_rule(rule, user_id, session)`** — dispatches to 7 rule type handlers:
  - `session_count` — total completed sessions ≥ threshold
  - `perfect_score` — current session score == 100%
  - `speed` — session duration ≤ max_seconds with ≥ min_questions
  - `streak` — max consecutive correct answers in session ≥ threshold
  - `daily_streak` — consecutive practice days ≥ required days
  - `timetable_mastery` — all specified tables at ≥ min_accuracy on given difficulty
  - `multi_quiz_type` — avg score ≥ min on ≥ N distinct quiz types

### Badges Router (`app/routers/badges.py`)

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/badges` | GET | Authenticated | All active badge definitions |
| `/badges/me` | GET | Authenticated | Current user's earned badges |
| `/badges/user/{id}` | GET | Own / teacher-of / parent-of / admin | User's earned badges |
| `/badges/user/{id}/count` | GET | Own / teacher-of / parent-of / admin | Earned badge count |

### Answers Router (`app/routers/answers.py`)

- Rewritten session completion logic:
  - Clean session completion detection (counts remaining unanswered questions)
  - After session finished: builds `session_data` dict with id, score_percent, total_questions, difficulty, timestamps
  - Calls `evaluate_badges(student_id, session_data)`
  - Includes `newBadges` in response if any badges were earned

### Sessions Router (`app/routers/sessions.py`)

- New endpoint: `GET /sessions/{session_id}/export-pdf`
  - RBAC: own session, teacher-of, parent-of, or admin
  - Returns `StreamingResponse` with `application/pdf` content type
  - `_generate_session_pdf(detail)` function using **reportlab**:
    - A4 page with title, summary info (student, date, quiz type, difficulty, score, duration)
    - Questions table with styled headers
    - Reviews section
    - Footer with generation timestamp

### Users Router (`app/routers/users.py`)

- New endpoint: `GET /users/{id}/mastery`
  - Returns per-timetable mastery stats for a user
  - RBAC: own, teacher-of, parent-of, admin

### Main App (`app/main.py`)

- Imported and registered `badges` router with `/api` prefix

### Dependencies

- Added `reportlab>=4.1.0` to `requirements.txt` (PDF generation library)

---

## Frontend Changes (Angular)

### New Files

| File | Purpose |
|------|---------|
| `app/models/badge.model.ts` | `Badge`, `UserBadge`, `BadgeSummary`, `TimetableMastery` interfaces |

### API Service (`core/services/api.service.ts`)

6 new methods:

| Method | Return Type | Description |
|--------|-------------|-------------|
| `getBadges()` | `Observable<Badge[]>` | All active badges |
| `getMyBadges()` | `Observable<UserBadge[]>` | Current user's earned badges |
| `getUserBadges(userId)` | `Observable<UserBadge[]>` | Specific user's badges |
| `getUserBadgeCount(userId)` | `Observable<{count: number}>` | Badge count for dashboard |
| `getUserMastery(userId)` | `Observable<TimetableMastery[]>` | Timetable mastery stats |
| `exportSessionPdf(sessionId)` | `Observable<Blob>` | Download session PDF |

### Answer Model (`models/answer.model.ts`)

- Added `BadgeSummary` import
- Added `newBadges?: BadgeSummary[]` field to `SubmitAnswerResponse`

### Profile Component (`features/profile/profile.component.ts`)

- Added `ProgressBarModule`, `TooltipModule` to imports
- New signals: `allBadges`, `earnedBadges`, `masteryData`
- **Badges grid section**: 4-column desktop / 2-column mobile layout, earned badges with colored icons and award dates, locked badges with grayed-out styling
- **Mastery progress bars**: per-timetable progress bars with color coding (green ≥90%, orange ≥70%, red), attempt counts, "Mastered" tag
- Helper methods: `isBadgeEarned()`, `getBadgeName()`, `getBadgeDescription()`, `getEarnedDate()`
- API calls added to `loadProfile()`: `getBadges()`, `getMyBadges()`, `getUserMastery()`

### Quiz Component (`features/quiz/quiz.component.ts`)

- Added `ToastModule`, `MessageService`, `TranslocoService`, `LocaleService`, `BadgeSummary`
- **Badge toast on completion**: iterates `res.newBadges`, shows PrimeNG toast per badge with locale-aware name, icon, and translated "badge earned" message
- `<p-toast>` added to template

### Session Detail Component (`features/history/session-detail.component.ts`)

- Added `ButtonModule`, `ToastModule`, `MessageService`, `TranslocoService`
- **PDF export button** in header bar (right-aligned, info severity, outlined, with loading state)
- **`exportPdf()` method**: calls `api.exportSessionPdf()`, creates blob download via `URL.createObjectURL`, shows error toast on failure
- `exporting` signal for button loading state

### History List Component (`features/history/history-list.component.ts`)

- Added `TooltipModule` to imports
- **PDF icon button column** per session row (before admin delete column)
- `exportPdf(s)` method with blob download and error toast

### Teacher Dashboard (`features/teacher/teacher-dashboard.component.ts`)

- `badgeCounts` signal: `Record<string, number>`
- **Badge count badge** displayed per student in listbox (🏆 icon with count, warning severity)
- `loadBadgeCounts()` method fetches counts for all students after load

### Parent Dashboard (`features/parent/parent-dashboard.component.ts`)

- `badgeCounts` signal: `Record<string, number>`
- **Badge count** displayed next to child name (🏆 icon with count, tooltip)
- `loadBadgeCounts()` method fetches counts for all children after load

---

## Translation Keys

### English (`assets/i18n/en.json`)

```
session.exportPdf          → "Export PDF"
session.exportFailed       → "Failed to export PDF"
badge.title                → "Badges & Achievements"
badge.earned               → "Earned"
badge.locked               → "Locked"
badge.earnedOn             → "Earned on"
badge.earnedCount          → "{{count}} badge(s) earned"
badge.noBadges             → "No badges earned yet. Keep practising!"
badge.newBadge             → "New Badge!"
badge.badgeEarned          → "You earned a new badge!"
badge.category.general     → "General"
badge.category.speed       → "Speed"
badge.category.accuracy    → "Accuracy"
badge.category.consistency → "Consistency"
badge.category.mastery     → "Mastery"
mastery.title              → "Timetable Mastery"
mastery.table              → "Table"
mastery.mastered           → "Mastered"
mastery.noData             → "No mastery data yet. Complete some quizzes to see your progress!"
mastery.attempts           → "attempts"
```

### Hungarian (`assets/i18n/hu.json`)

```
session.exportPdf          → "PDF exportálás"
session.exportFailed       → "A PDF exportálás sikertelen"
badge.title                → "Jelvények és eredmények"
badge.earned               → "Megszerzett"
badge.locked               → "Zárolva"
badge.earnedOn             → "Megszerzés dátuma"
badge.earnedCount          → "{{count}} jelvény megszerzve"
badge.noBadges             → "Még nincsenek jelvények. Gyakorolj tovább!"
badge.newBadge             → "Új jelvény!"
badge.badgeEarned          → "Új jelvényt szereztél!"
badge.category.general     → "Általános"
badge.category.speed       → "Gyorsaság"
badge.category.accuracy    → "Pontosság"
badge.category.consistency → "Kitartás"
badge.category.mastery     → "Mesterség"
mastery.title              → "Szorzótábla elsajátítás"
mastery.table              → "Tábla"
mastery.mastered           → "Elsajátítva"
mastery.noData             → "Még nincsenek adatok. Fejezz be néhány kvízt a haladásod megtekintéséhez!"
mastery.attempts           → "próbálkozás"
```

---

## Files Changed Summary

### New Files (7)

| File | Lines |
|------|-------|
| `db/migrations/0018_badges.sql` | ~30 |
| `db/migrations/0019_user_badges.sql` | ~13 |
| `python-api/app/schemas/badge.py` | ~35 |
| `python-api/app/services/badges.py` | ~148 |
| `python-api/app/routers/badges.py` | ~69 |
| `angular-app/src/app/models/badge.model.ts` | ~33 |

### Modified Files (13)

| File | Changes |
|------|---------|
| `python-api/app/queries.py` | +~200 lines (10 new query functions) |
| `python-api/app/routers/answers.py` | Rewritten — badge evaluation on completion |
| `python-api/app/routers/sessions.py` | +PDF export endpoint + `_generate_session_pdf()` |
| `python-api/app/routers/users.py` | +mastery endpoint |
| `python-api/app/schemas/answer.py` | +BadgeSummary class, +newBadges field |
| `python-api/app/main.py` | +badges router registration |
| `python-api/requirements.txt` | +reportlab>=4.1.0 |
| `angular-app/src/app/models/answer.model.ts` | +newBadges field |
| `angular-app/src/app/core/services/api.service.ts` | +6 new methods |
| `angular-app/src/app/features/profile/profile.component.ts` | +badges grid, +mastery bars |
| `angular-app/src/app/features/quiz/quiz.component.ts` | +badge toast on completion |
| `angular-app/src/app/features/history/session-detail.component.ts` | +PDF export button |
| `angular-app/src/app/features/history/history-list.component.ts` | +PDF icon per row |
| `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` | +badge count per student |
| `angular-app/src/app/features/parent/parent-dashboard.component.ts` | +badge count per child |
| `angular-app/src/assets/i18n/en.json` | +20 translation keys |
| `angular-app/src/assets/i18n/hu.json` | +20 translation keys |

---

## Architecture & Flow

```
Quiz Completion Flow:
  Student submits final answer
    → answers.py detects session complete
    → Calls evaluate_badges(user_id, session_data)
      → badges.py loads all active badges
      → Filters already-earned
      → Evaluates each rule via _check_rule()
      → Awards new badges + creates notifications
      → Returns BadgeSummary list
    → Response includes newBadges[]
    → Frontend shows toast per new badge

Profile Page:
  → getBadges() + getMyBadges() → badge grid (earned/locked)
  → getUserMastery() → timetable progress bars

Teacher/Parent Dashboard:
  → getUserBadgeCount(studentId) → 🏆 count per student/child

PDF Export:
  → GET /sessions/{id}/export-pdf
  → reportlab generates A4 PDF with summary + questions table + reviews
  → Browser downloads blob as session_{id}.pdf
```
