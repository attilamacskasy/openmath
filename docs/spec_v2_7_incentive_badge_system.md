# OpenMath v2.7 — Badge System, Achievements & Session PDF Export

## Feature Summary

**Version:** 2.7  
**Scope:** Badge / achievement system with automatic evaluation, timetable mastery tracking, session PDF export, badge display on profile & dashboards  
**Depends on:** v2.6 (localization & multi-language support)  
**Tech stack:** Angular 18 + PrimeNG 17 + Transloco 8 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

### Current state (v2.6)

- **Gamification**: None. No badges, achievements, streaks, or progress indicators exist. After completing a quiz, students see their score and that's it — no recognition of milestones or improvement.
- **Session export**: No way to export quiz sessions to PDF. Teachers and parents can only view sessions on screen.
- **Progress tracking**: Profile shows basic aggregated stats (total sessions, questions, avg score) but no per-timetable or per-quiz-type breakdown.
- **Motivation**: No incentive system beyond the score itself. No visual mastery indicators, no streak tracking.
- **Notifications**: v2.5 notification system exists (`notifications` table, bell icon, polling) but only covers association/review/signoff events. No badge-related notification types.

### v2.7 delivers

1. **Badge definitions table** — `badges` table with code, name (EN/HU), description (EN/HU), icon (PrimeIcons class), category, and rule definition (JSONB)
2. **User badges table** — `user_badges` junction table tracking which users earned which badges and when
3. **Achievement evaluation engine** — server-side Python service that runs after each quiz completion, evaluating all badge rules against user history
4. **8 initial badges** — First Quiz, Perfect Score, Speed Demon, Streak Master, Practice Makes Perfect, Daily Learner, Timetable Champion, Multi-Talent
5. **Badge display on profile** — earned badges grid with icons, names, dates; unearned badges shown as locked
6. **Badge notification** — new `badge_earned` notification type using existing notification system
7. **Teacher/parent dashboard badges** — earned badge count visible per student/child
8. **Session PDF export** — server-side PDF generation of session detail (questions, answers, score, review) downloadable by student/teacher/parent
9. **Timetable mastery progress** — per-timetable accuracy bars on profile page
10. **Translation keys** — all badge names, descriptions, and UI labels in both `en.json` and `hu.json`

---

## 2. Database Changes

### 2.1 Migration `0018_badges.sql`

```sql
-- v2.7: Badge definitions
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_hu TEXT NOT NULL,
    description_en TEXT NOT NULL,
    description_hu TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'pi pi-star',
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'speed', 'accuracy', 'consistency', 'mastery')),
    rule JSONB NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial badges
INSERT INTO badges (code, name_en, name_hu, description_en, description_hu, icon, category, rule, sort_order) VALUES
  ('first_quiz',       'First Quiz',            'Első kvíz',              'Complete your first quiz session',                         'Teljesítsd az első kvíz munkameneted',                      'pi pi-play',        'general',     '{"type": "session_count", "threshold": 1}',                    1),
  ('perfect_score',    'Perfect Score',         'Tökéletes pontszám',     'Score 100% on any quiz session',                           'Szerezz 100%-ot bármelyik kvízen',                          'pi pi-check-circle','accuracy',    '{"type": "perfect_score"}',                                    2),
  ('speed_demon',      'Speed Demon',           'Villámgyors',            'Complete a 10-question quiz in under 60 seconds',           'Teljesíts egy 10 kérdéses kvízt 60 másodperc alatt',        'pi pi-bolt',        'speed',       '{"type": "speed", "max_seconds": 60, "min_questions": 10}',    3),
  ('streak_master',    'Streak Master',         'Sorozatbajnok',          'Answer 20 questions correctly in a row within one session', '20 egymást követő helyes válasz egy munkamenetben',         'pi pi-forward',     'accuracy',    '{"type": "streak", "threshold": 20}',                          4),
  ('practice_50',      'Practice Makes Perfect','A gyakorlat teszi a mestert','Complete 50 quiz sessions',                            'Teljesíts 50 kvíz munkamenetet',                            'pi pi-heart',       'consistency', '{"type": "session_count", "threshold": 50}',                   5),
  ('daily_7',          'Daily Learner',         'Napi tanuló',            'Complete at least one quiz per day for 7 consecutive days', 'Teljesíts legalább egy kvízt naponta 7 egymást követő napon','pi pi-calendar',    'consistency', '{"type": "daily_streak", "days": 7}',                          6),
  ('timetable_champ',  'Timetable Champion',    'Szorzótábla bajnok',     'Achieve 90%+ accuracy on hard difficulty for all timetables (1–10)', '90%+ pontosság nehéz szinten az összes szorzótáblán (1–10)','pi pi-trophy',  'mastery',     '{"type": "timetable_mastery", "min_accuracy": 90, "difficulty": "hard", "tables": [1,2,3,4,5,6,7,8,9,10]}', 7),
  ('multi_talent',     'Multi-Talent',          'Sokoldalú tehetség',     'Score above 80% on at least 5 different quiz types',       'Szerezz 80% feletti pontszámot legalább 5 különböző kvíztípuson', 'pi pi-sitemap', 'mastery',  '{"type": "multi_quiz_type", "min_score": 80, "min_types": 5}', 8)
ON CONFLICT (code) DO NOTHING;
```

### 2.2 Migration `0019_user_badges.sql`

```sql
-- v2.7: User badge awards
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    session_id UUID REFERENCES quiz_sessions(id) ON DELETE SET NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
```

---

## 3. Backend Changes (FastAPI)

### 3.1 Badge schemas

**File:** `python-api/app/schemas/badge.py` (new)

```python
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class BadgeOut(BaseModel):
    id: UUID
    code: str
    name_en: str
    name_hu: str
    description_en: str
    description_hu: str
    icon: str
    category: str
    sort_order: int

class UserBadgeOut(BaseModel):
    id: UUID
    badge: BadgeOut
    awarded_at: datetime
    session_id: UUID | None = None
```

### 3.2 Badge queries

**File:** `python-api/app/queries.py` (add functions)

```python
async def list_badges(pool) -> list[dict]:
    """Return all active badges ordered by sort_order."""

async def list_user_badges(pool, user_id: UUID) -> list[dict]:
    """Return all badges earned by a user, joined with badge details."""

async def award_badge(pool, user_id: UUID, badge_id: UUID, session_id: UUID | None) -> dict | None:
    """Insert into user_badges. Returns None if already awarded (UNIQUE conflict)."""

async def count_user_badges(pool, user_id: UUID) -> int:
    """Return count of badges earned by a user."""

async def get_user_session_count(pool, user_id: UUID) -> int:
    """Return count of completed sessions for a user."""

async def get_user_perfect_sessions(pool, user_id: UUID) -> list[dict]:
    """Return sessions where score_percent = 100."""

async def get_user_daily_streak(pool, user_id: UUID) -> int:
    """Return current consecutive days with at least one completed session."""

async def get_user_timetable_stats(pool, user_id: UUID, difficulty: str) -> list[dict]:
    """Return per-timetable accuracy stats for multiplication quizzes."""

async def get_user_quiz_type_scores(pool, user_id: UUID) -> list[dict]:
    """Return avg score per quiz type (only types with completed sessions)."""
```

### 3.3 Achievement evaluation service

**File:** `python-api/app/services/badges.py` (new)

```python
async def evaluate_badges(pool, user_id: UUID, session: dict) -> list[dict]:
    """
    Run after quiz completion. Evaluates all active badge rules
    against user history. Awards any newly earned badges.
    Returns list of newly awarded badges for notification.
    
    Steps:
    1. Load all active badges
    2. Load user's existing badges (skip already-awarded)
    3. For each unevaluated badge, check rule against user data
    4. Award new badges via insert
    5. Create notification for each new badge
    6. Return list of newly awarded badge details
    """
```

**Rule evaluation logic per `rule.type`:**

| Rule type | Fields | Logic |
|---|---|---|
| `session_count` | `threshold` | Count completed sessions ≥ threshold |
| `perfect_score` | — | Current session `score_percent == 100` |
| `speed` | `max_seconds`, `min_questions` | Current session duration ≤ max_seconds AND total_questions ≥ min_questions |
| `streak` | `threshold` | Check answers in current session for consecutive correct ≥ threshold |
| `daily_streak` | `days` | Count consecutive calendar days with ≥ 1 completed session |
| `timetable_mastery` | `min_accuracy`, `difficulty`, `tables` | For each table in list, avg accuracy on hard multiplication ≥ min_accuracy |
| `multi_quiz_type` | `min_score`, `min_types` | Count distinct quiz types with avg score_percent ≥ min_score |

### 3.4 Badge evaluation trigger

**File:** `python-api/app/routers/answers.py` (modify existing)

Add badge evaluation call after quiz session is completed (when final answer is submitted and session gets `finished_at`):

```python
# After session completion (existing code updates score, sets finished_at)
# Add:
from app.services.badges import evaluate_badges

# Inside submit_answer, after session is marked complete:
new_badges = await evaluate_badges(pool, user_id, session)
# Notifications are created inside evaluate_badges
```

### 3.5 Badge API endpoints

**File:** `python-api/app/routers/badges.py` (new)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/badges` | Authenticated | List all active badge definitions |
| GET | `/badges/user/{user_id}` | Authenticated | List badges earned by a user (own, or teacher's student, or parent's child, or admin) |
| GET | `/badges/me` | Authenticated | Shortcut for own badges |

```python
@router.get("/badges")
async def list_all_badges(user: dict = Depends(get_current_user)):
    """Return all active badge definitions (for showing locked/unlocked grid)."""

@router.get("/badges/me")
async def get_my_badges(user: dict = Depends(get_current_user)):
    """Return current user's earned badges."""

@router.get("/badges/user/{user_id}")
async def get_user_badges(
    user_id: UUID,
    user: dict = Depends(get_current_user),
):
    """Return badges for a specific user. Access: own, teacher-of, parent-of, admin."""
```

### 3.6 Session PDF export

**File:** `python-api/app/routers/sessions.py` (modify existing)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/sessions/{id}/export-pdf` | Authenticated | Generate and return session PDF |

```python
@router.get("/sessions/{id}/export-pdf")
async def export_session_pdf(
    id: UUID,
    user: dict = Depends(get_current_user),
):
    """
    Generate PDF for a session. Access: own session, teacher-of-student,
    parent-of-student, or admin.
    Returns StreamingResponse with content-type application/pdf.
    """
```

**PDF library:** `reportlab` (add to `requirements.txt`)

**PDF contents:**

- OpenMath logo + branding header
- Student name, date, quiz type, difficulty
- Score summary (correct/total, percentage, duration)
- Questions table: #, question text, student answer, correct answer, ✓/✗
- Teacher review (if exists): reviewer name, comment, date
- Parent sign-off (if exists): reviewer name, comment, date
- Footer: "Generated by OpenMath on {date}"

### 3.7 Timetable mastery endpoint

**File:** `python-api/app/routers/users.py` (modify existing)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/{id}/mastery` | Authenticated | Per-timetable accuracy stats |

```python
@router.get("/users/{id}/mastery")
async def get_timetable_mastery(
    id: UUID,
    user: dict = Depends(get_current_user),
):
    """
    Return per-timetable accuracy for multiplication quizzes.
    Response: list of { table: int, attempts: int, accuracy: float, mastered: bool }
    Mastery = accuracy >= 90% AND attempts >= 10.
    Access: own, teacher-of, parent-of, admin.
    """
```

### 3.8 Badge notification type

Extends existing notification system (`python-api/app/services/notifications.py`):

| Type | Trigger | Recipient | Message (EN) | Message (HU) |
|---|---|---|---|---|
| `badge_earned` | Badge awarded | Student | "You earned the '{badge_name}' badge!" | "Megszerezted a '{badge_name}' kitűzőt!" |

Notification `metadata` includes `{ "badge_id": "...", "badge_code": "..." }` for frontend linking.

### 3.9 Register router

**File:** `python-api/app/main.py`

```python
from app.routers import badges
app.include_router(badges.router, prefix="/api")
```

---

## 4. Frontend Changes (Angular)

### 4.1 Badge model

**File:** `angular-app/src/app/models/badge.model.ts` (new)

```typescript
export interface Badge {
  id: string;
  code: string;
  name_en: string;
  name_hu: string;
  description_en: string;
  description_hu: string;
  icon: string;
  category: string;
  sort_order: number;
}

export interface UserBadge {
  id: string;
  badge: Badge;
  awarded_at: string;
  session_id: string | null;
}

export interface TimetableMastery {
  table: number;
  attempts: number;
  accuracy: number;
  mastered: boolean;
}
```

### 4.2 API service additions

**File:** `angular-app/src/app/core/services/api.service.ts` (modify)

```typescript
// Badge endpoints
getBadges(): Observable<Badge[]>
getMyBadges(): Observable<UserBadge[]>
getUserBadges(userId: string): Observable<UserBadge[]>

// Mastery endpoint
getUserMastery(userId: string): Observable<TimetableMastery[]>

// PDF export
exportSessionPdf(sessionId: string): Observable<Blob>
```

`exportSessionPdf` uses `this.http.get(url, { responseType: 'blob' })` and triggers a browser download via `URL.createObjectURL`.

### 4.3 Profile page — badges section

**File:** `angular-app/src/app/features/profile/profile.component.ts` (modify)

Add a **Badges** section below existing performance stats:

- Load all badges (`getBadges()`) and user's earned badges (`getMyBadges()`)
- Display grid of badge cards (4 per row on desktop, 2 on mobile)
- **Earned badges**: full color icon, name, description, "Earned {date}" subtitle
- **Locked badges**: grayed-out icon, name, description, lock overlay
- Badge name/description selected by active locale (`badge.name_en` or `badge.name_hu` based on `localeService.getLocale()`)

### 4.4 Profile page — timetable mastery

**File:** `angular-app/src/app/features/profile/profile.component.ts` (modify)

Add a **Timetable Mastery** section below badges:

- Load mastery data from `getUserMastery(userId)`
- Display 10 progress bars (one per timetable 1–10)
- Each bar shows: `{n} × table` label, PrimeNG `p-progressBar` with percentage, checkmark icon if mastered
- Color coding: green (≥ 90%), yellow (60–89%), red (< 60%), gray (no attempts)

### 4.5 Teacher/parent dashboard — badge count

**File:** `angular-app/src/app/features/teacher/teacher-dashboard.component.ts` (modify)  
**File:** `angular-app/src/app/features/parent/parent-dashboard.component.ts` (modify)

- Show badge count next to each student/child name (e.g., `🏆 5`)
- Load badge counts via `getUserBadges(studentId)` per student

### 4.6 Session detail — PDF export button

**File:** `angular-app/src/app/features/history/session-detail.component.ts` (modify)

- Add "Export PDF" button (`pi pi-file-pdf` icon) in the session detail header
- Calls `api.exportSessionPdf(sessionId)` and triggers download
- Button visible to: session owner, teacher-of-student, parent-of-student, admin

### 4.7 History list — PDF export column

**File:** `angular-app/src/app/features/history/history-list.component.ts` (modify)

- Add PDF icon button in each session row (right side, beside delete button for admin)
- Calls `api.exportSessionPdf(sessionId)` and triggers download

### 4.8 Quiz completion — badge toast

**File:** `angular-app/src/app/features/quiz/quiz.component.ts` (modify)

After quiz completion, if the answer response includes newly awarded badges:

- Show PrimeNG toast per badge: icon + badge name + "Badge earned!"
- Optionally show a congratulatory dialog for special badges (first_quiz, timetable_champ)

> **Note:** The answer submission response (`SubmitAnswerResponse`) needs a new optional field `new_badges?: Badge[]` returned only on the final answer when the session is completed.

### 4.9 Translation keys

**File:** `angular-app/src/assets/i18n/en.json` (modify)  
**File:** `angular-app/src/assets/i18n/hu.json` (modify)

```json
{
  "badge.title": "Badges",
  "badge.earned": "Earned",
  "badge.locked": "Locked",
  "badge.earnedOn": "Earned on",
  "badge.earnedCount": "badges earned",
  "badge.noBadges": "No badges earned yet. Complete quizzes to unlock achievements!",
  "badge.newBadge": "New Badge!",
  "badge.badgeEarned": "You earned the '{{name}}' badge!",
  "badge.category.general": "General",
  "badge.category.speed": "Speed",
  "badge.category.accuracy": "Accuracy",
  "badge.category.consistency": "Consistency",
  "badge.category.mastery": "Mastery",
  "mastery.title": "Timetable Mastery",
  "mastery.table": "× table",
  "mastery.mastered": "Mastered",
  "mastery.noData": "No multiplication quiz data yet.",
  "mastery.attempts": "attempts",
  "session.exportPdf": "Export PDF",
  "session.exportFailed": "Failed to export PDF"
}
```

Hungarian equivalents in `hu.json`:

```json
{
  "badge.title": "Kitűzők",
  "badge.earned": "Megszerzett",
  "badge.locked": "Zárolva",
  "badge.earnedOn": "Megszerzés dátuma",
  "badge.earnedCount": "megszerzett kitűző",
  "badge.noBadges": "Még nincs kitűződ. Teljesíts kvízeket a kitűzők feloldásához!",
  "badge.newBadge": "Új kitűző!",
  "badge.badgeEarned": "Megszerezted a '{{name}}' kitűzőt!",
  "badge.category.general": "Általános",
  "badge.category.speed": "Gyorsaság",
  "badge.category.accuracy": "Pontosság",
  "badge.category.consistency": "Kitartás",
  "badge.category.mastery": "Mesterség",
  "mastery.title": "Szorzótábla mesterség",
  "mastery.table": "× tábla",
  "mastery.mastered": "Elsajátítva",
  "mastery.noData": "Még nincs szorzótábla kvíz adat.",
  "mastery.attempts": "kísérlet",
  "session.exportPdf": "PDF exportálás",
  "session.exportFailed": "A PDF exportálás sikertelen"
}
```

---

## 5. Implementation Steps

| # | Area | Task | Files |
|---|---|---|---|
| 1 | DB | Create migration `0018_badges.sql` with badge definitions + seed data | `db/migrations/` |
| 2 | DB | Create migration `0019_user_badges.sql` | `db/migrations/` |
| 3 | DB | Apply migrations | `scripts/apply-migrations.ps1` |
| 4 | Backend | Add badge schemas (`BadgeOut`, `UserBadgeOut`) | `schemas/badge.py` |
| 5 | Backend | Add badge query functions (8 functions) | `queries.py` |
| 6 | Backend | Create badge evaluation service | `services/badges.py` |
| 7 | Backend | Create badges router (3 endpoints) | `routers/badges.py` |
| 8 | Backend | Add PDF export endpoint + reportlab dependency | `routers/sessions.py`, `requirements.txt` |
| 9 | Backend | Add mastery endpoint | `routers/users.py` |
| 10 | Backend | Wire badge evaluation into answer submission | `routers/answers.py` |
| 11 | Backend | Add `badge_earned` notification type to notification service | `services/notifications.py` |
| 12 | Backend | Extend `SubmitAnswerResponse` with optional `new_badges` field | `schemas/answer.py` |
| 13 | Backend | Register badges router in main | `main.py` |
| 14 | Frontend | Create Badge model | `models/badge.model.ts` |
| 15 | Frontend | Add API methods (badges, mastery, PDF export) | `api.service.ts` |
| 16 | Frontend | Profile: badges grid section | `profile.component.ts` |
| 17 | Frontend | Profile: timetable mastery progress bars | `profile.component.ts` |
| 18 | Frontend | Quiz: badge earned toast on completion | `quiz.component.ts` |
| 19 | Frontend | Session detail: PDF export button | `session-detail.component.ts` |
| 20 | Frontend | History list: PDF export column | `history-list.component.ts` |
| 21 | Frontend | Teacher dashboard: badge count per student | `teacher-dashboard.component.ts` |
| 22 | Frontend | Parent dashboard: badge count per child | `parent-dashboard.component.ts` |
| 23 | Frontend | Add badge + mastery + PDF translation keys (EN + HU) | `en.json`, `hu.json` |
| 24 | Frontend | Update answer model with `new_badges` field | `answer.model.ts` |
| 25 | Test | Apply migrations, complete quizzes, verify badge awarding + notifications | manual |

---

## 6. Badge Evaluation Lifecycle

```
Student submits final answer
        │
        ▼
answers.py: session marked finished (score calculated, finished_at set)
        │
        ▼
evaluate_badges(pool, user_id, session) called
        │
        ├── Load all active badges from DB
        ├── Load user's existing user_badges (skip already earned)
        │
        ▼
For each unevaluated badge:
        │
        ├── session_count  → query completed session count
        ├── perfect_score  → check current session score_percent == 100
        ├── speed          → check session duration ≤ max_seconds
        ├── streak         → query answers in current session for consecutive correct
        ├── daily_streak   → query distinct dates of completed sessions
        ├── timetable_mastery → query per-table accuracy on hard multiplication
        └── multi_quiz_type → query avg score per quiz type
        │
        ▼
New badges earned?
        │
    Yes ──► INSERT into user_badges
        │   CREATE notification (badge_earned) for student
        │   Return new badges list to caller
        │
    No  ──► Return empty list
        │
        ▼
answers.py: include new_badges in SubmitAnswerResponse (final answer only)
        │
        ▼
Frontend: show toast per new badge
```

---

## 7. Session PDF Layout

```
┌─────────────────────────────────────────────────┐
│  [OpenMath Logo]    OpenMath — Session Report    │
├─────────────────────────────────────────────────┤
│  Student: Anna Kovács                            │
│  Date: 2026-03-08                                │
│  Quiz Type: Multiplication (factors 1–10)        │
│  Difficulty: Hard                                │
│  Score: 9/10 (90%)                               │
│  Duration: 45 seconds                            │
├─────────────────────────────────────────────────┤
│  #  │ Question    │ Your Answer │ Correct │  ✓/✗ │
│  1  │ 7 × 8       │ 56          │ 56      │  ✓   │
│  2  │ 6 × 9       │ 45          │ 54      │  ✗   │
│  ...│             │             │         │      │
├─────────────────────────────────────────────────┤
│  Teacher Review (by Test Teacher)                │
│  "Excellent work! Keep it up!"                   │
│  Reviewed: 2026-03-08                            │
├─────────────────────────────────────────────────┤
│  Parent Sign-off (by Parent Name)                │
│  "So proud of you!"                              │
│  Signed: 2026-03-08                              │
├─────────────────────────────────────────────────┤
│  Generated by OpenMath on 2026-03-08             │
└─────────────────────────────────────────────────┘
```

---

## 8. Data Protection Notes

- **Badge data** is scoped per user — users can only view their own badges or badges of their associated students/children
- **Mastery data** follows the same access rules as user profile (own, teacher-of, parent-of, admin)
- **PDF export** enforces the same session access rules as the existing session detail endpoint (own session, teacher-of-student, parent-of-student, admin)
- **Badge evaluation** runs server-side only — the client cannot award badges directly
- **Notification metadata** for `badge_earned` contains only badge ID and code (no sensitive data)
