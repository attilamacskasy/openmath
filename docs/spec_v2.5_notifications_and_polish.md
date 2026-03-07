# OpenMath v2.5 — Notifications, Review Templates & Polish

## Feature Summary

**Version:** 2.5  
**Scope:** Notification system, review template responses, header/footer/login/profile polish, sign-off guard, example question styling, student profile associations, history access for teachers/parents, logo replacement  
**Depends on:** v2.4 (self-association, header modernization, user guide rewrite)  
**Tech stack:** Angular 18 + PrimeNG 17 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

### Current state (v2.4)

- **Header**: Provider shown as inline `<span>` with background color (green/gray) — not a `p-tag`. Provider badge appears after name+email, before role tags.
- **Profile – Auth Provider**: Uses emoji-based `<span>` with `ngClass` (`🔵 Google`, `🔗 Google + Local`, `🔑 Local`) and background color classes (`bg-blue-100`, etc.).
- **Start page – Example questions**: Rendered as bullet points (`• {{ p.render }} = {{ p.correct }}`) inside a `surface-50` container. Admin quiz-type-editor uses card layout (`surface-50 p-3 border-round flex justify-content-between`) without bullet points.
- **Parent sign-off**: Always enabled — parent can sign off even if no teacher has reviewed the session yet.
- **Review workflow**: Teacher review and parent sign-off both have a plain `<textarea>` for free-text comments. No template/suggested responses.
- **History access**: Teachers and parents can only view student/child sessions from their own dashboards (`/teacher`, `/parent`). They cannot navigate to `/history` to see those sessions.
- **Login page**: Enter key works on both email and password fields to submit — already implemented via `(keyup.enter)` and `onPasswordKeyup`.
- **Logo**: Login page header shows `🧮 OpenMath` (emoji). Nuxt app has an SVG logo (blue-to-green gradient circle with × and ✓ eyes and a smile).
- **Footer**: Shows `OpenMath v2.1` — outdated. Source link points to `https://github.com` (generic).
- **Student profile**: No information about associated teachers or parents.
- **Notifications**: No notification system exists. No bell icon in header. No tracking of events.

### v2.5 delivers

1. **Header provider → p-tag** — move provider tag before name, use PrimeNG `p-tag` matching role tag style, keep color scheme
2. **Profile provider → p-tag** — replace emoji `<span>` with PrimeNG `p-tag` in Edit Profile
3. **Start page example questions** — remove bullet points, render as cards matching admin preview style
4. **Parent sign-off guard** — disable sign-off until teacher has reviewed the session
5. **Review template responses** — dropdown of pre-defined feedback messages for teachers and parents, auto-fills comment textarea, stored in new DB table
6. **Teacher/parent → student history** — allow teachers and parents to view associated students' full History page
7. **Login Enter key** — already works (no change needed)
8. **Logo replacement** — replace `🧮` emoji with SVG logo from Nuxt app on login page and header
9. **Footer modernization** — update version to v2.5, correct source link, modernize styling
10. **Student profile associations** — show associated teachers and parents with name, email, and association date
11. **Notification system** — bell icon in header, unread count badge, notification list, accept/accept-all, DB table for all events

---

## 2. Database Changes

### 2.1 Migration `0013_review_templates.sql`

Create a table to store template review responses.

```sql
-- v2.5: Template review responses for teachers and parents
CREATE TABLE IF NOT EXISTS review_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('teacher', 'parent')),
    sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    label TEXT NOT NULL,
    message TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed teacher templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order) VALUES
  ('teacher', 'positive', 'Excellent work',     'Excellent work! You showed great understanding of the material. Keep it up!', 1),
  ('teacher', 'positive', 'Well done',          'Well done! Your effort really shows. I''m proud of your progress.', 2),
  ('teacher', 'positive', 'Great improvement',  'Great improvement since your last session. You''re getting much stronger at this!', 3),
  ('teacher', 'neutral',  'Good effort',        'Good effort. Review the questions you got wrong and try again to improve your score.', 4),
  ('teacher', 'neutral',  'Keep practicing',    'Keep practicing — you''re on the right track but need more repetition to build fluency.', 5),
  ('teacher', 'neutral',  'Room for growth',    'Solid attempt. Focus on the areas where you made mistakes and ask for help if needed.', 6),
  ('teacher', 'negative', 'Needs more work',    'This topic needs more practice. Please review the material and try again.', 7),
  ('teacher', 'negative', 'Below expectations', 'Your score is below expectations. Let''s work together to identify what''s giving you trouble.', 8),
  ('teacher', 'negative', 'Please retry',       'Too many errors on this session. Please try again after reviewing the correct answers.', 9)
ON CONFLICT DO NOTHING;

-- Seed parent templates
INSERT INTO review_templates (reviewer_role, sentiment, label, message, sort_order) VALUES
  ('parent', 'positive', 'So proud!',           'So proud of you! Your hard work is paying off. Amazing result!', 1),
  ('parent', 'positive', 'Wonderful job',       'Wonderful job! You did really well on this quiz. Let''s celebrate!', 2),
  ('parent', 'positive', 'Keep shining',        'Fantastic effort! You''re doing an incredible job with your maths practice.', 3),
  ('parent', 'neutral',  'Good try',            'Good try! Let''s go over the ones you missed together and see if we can do better next time.', 4),
  ('parent', 'neutral',  'Practice makes perfect', 'Not bad! A bit more practice and you''ll get there. Want to try again together?', 5),
  ('parent', 'neutral',  'Almost there',        'You''re getting closer! Let''s focus on the tricky parts and do one more round.', 6),
  ('parent', 'negative', 'Let''s review',       'This was a tough one. Let''s sit down together and review the questions you found difficult.', 7),
  ('parent', 'negative', 'Need to focus',       'Your score shows we need to spend more time on this topic. Let''s practice together this week.', 8),
  ('parent', 'negative', 'Try again',           'Don''t worry — everyone struggles sometimes. Let''s go through the answers and try again.', 9)
ON CONFLICT DO NOTHING;
```

### 2.2 Migration `0014_notifications.sql`

Create a table to track all system notifications.

```sql
-- v2.5: Notification system
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

**Notification types:**

| Type | Trigger | Recipient | Example message |
|---|---|---|---|
| `student_associated_teacher` | Teacher adds student | Student | "Teacher {name} has added you to their class" |
| `student_associated_parent` | Parent adds child | Student | "Parent {name} has linked your account" |
| `student_removed_teacher` | Teacher removes student | Student | "You have been removed from {name}'s class" |
| `student_removed_parent` | Parent removes child | Student | "Parent {name} has unlinked your account" |
| `quiz_completed` | Student finishes quiz | Teacher(s) of that student | "Student {name} completed {quiz_type} — Score: {score}%" |
| `review_submitted` | Teacher reviews session | Student + Parent(s) of that student | "Teacher {name} reviewed your {quiz_type} session" |
| `signoff_submitted` | Parent signs off | Student | "Parent {name} signed off on your {quiz_type} session" |
| `role_changed` | Admin changes user roles | Affected user | "Your roles have been updated to: {roles}" |

### 2.3 Migration `0015_student_associations_view.sql`

No new tables needed — but add a query-friendly view for association timestamps.

```sql
-- v2.5: View for student association info (teachers + parents with timestamps)
CREATE OR REPLACE VIEW student_associations AS
SELECT
    ts.student_id,
    'teacher' AS relationship,
    ts.teacher_id AS related_user_id,
    u.name AS related_name,
    u.email AS related_email,
    ts.created_at AS associated_at
FROM teacher_students ts
JOIN users u ON u.id = ts.teacher_id
UNION ALL
SELECT
    ps.student_id,
    'parent' AS relationship,
    ps.parent_id AS related_user_id,
    u.name AS related_name,
    u.email AS related_email,
    ps.created_at AS associated_at
FROM parent_students ps
JOIN users u ON u.id = ps.parent_id;
```

> **Note:** If `teacher_students` and `parent_students` lack a `created_at` column, add them first:

```sql
-- Add created_at to association tables if missing
ALTER TABLE teacher_students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE parent_students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
```

---

## 3. Backend Changes (FastAPI)

### 3.1 Review templates endpoint

**File:** `python-api/app/routers/sessions.py` (or new `templates.py`)

```python
@router.get("/review-templates")
async def get_review_templates(
    role: str = Query(pattern=r"^(teacher|parent)$"),
    score_percent: int | None = Query(default=None, ge=0, le=100),
    user: dict = Depends(get_current_user),
):
    """Return template responses filtered by role and score-based sentiment."""
    templates = await list_review_templates(role)
    if score_percent is not None:
        if score_percent >= 70:
            sentiment = 'positive'
        elif score_percent >= 40:
            sentiment = 'neutral'
        else:
            sentiment = 'negative'
        templates = [t for t in templates if t['sentiment'] == sentiment]
    return templates
```

**Sentiment thresholds:**

| Score % | Sentiment | Templates shown |
|---|---|---|
| ≥ 70% | positive | 3 positive templates |
| 40–69% | neutral | 3 neutral templates |
| < 40% | negative | 3 negative templates |

### 3.2 Notification endpoints

**File:** `python-api/app/routers/notifications.py` (new file)

```python
router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("")
async def list_notifications(
    unread_only: bool = Query(default=False),
    user: dict = Depends(get_current_user),
):
    """List notifications for the current user."""
    return await get_notifications(user["sub"], unread_only)

@router.get("/unread-count")
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Return the count of unread notifications."""
    count = await count_unread_notifications(user["sub"])
    return {"count": count}

@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    user: dict = Depends(get_current_user),
):
    """Mark a single notification as read."""
    success = await mark_notification_read(notification_id, user["sub"])
    if not success:
        raise HTTPException(404, "Notification not found")
    return {"ok": True}

@router.patch("/read-all")
async def mark_all_as_read(user: dict = Depends(get_current_user)):
    """Mark all notifications as read."""
    count = await mark_all_notifications_read(user["sub"])
    return {"count": count}
```

### 3.3 Notification creation helper

**File:** `python-api/app/services/notifications.py` (new file)

```python
async def create_notification(
    user_id: str,
    type: str,
    title: str,
    message: str,
    metadata: dict | None = None,
) -> dict:
    """Insert a notification and return it."""
    return await insert_notification(user_id, type, title, message, metadata or {})

async def notify_teachers_of_student(student_id: str, type: str, title: str, message: str, metadata: dict | None = None):
    """Notify all teachers associated with a student."""
    teachers = await get_teachers_for_student(student_id)
    for t in teachers:
        await create_notification(str(t["teacher_id"]), type, title, message, metadata)

async def notify_parents_of_student(student_id: str, type: str, title: str, message: str, metadata: dict | None = None):
    """Notify all parents associated with a student."""
    parents = await get_parents_for_student(student_id)
    for p in parents:
        await create_notification(str(p["parent_id"]), type, title, message, metadata)
```

### 3.4 Add notification triggers to existing endpoints

Notifications are fired from the following existing endpoints:

| Endpoint | Notification |
|---|---|
| `POST /teacher/students` (associate) | → Student: "Teacher {name} has added you to their class" |
| `DELETE /teacher/students/{id}` (remove) | → Student: "You have been removed from {name}'s class" |
| `POST /parent/children` (associate) | → Student: "Parent {name} has linked your account" |
| `DELETE /parent/children/{id}` (remove) | → Student: "Parent {name} has unlinked your account" |
| `POST /answers` (when session completes) | → All teachers of student: "Student {name} completed {quiz_type} — Score: {score}%" |
| `POST /teacher/sessions/{id}/review` | → Student: "Teacher {name} reviewed your {quiz_type} session" |
| | → All parents of student: "Teacher {name} reviewed {student_name}'s {quiz_type} session" |
| `POST /parent/sessions/{id}/signoff` | → Student: "Parent {name} signed off on your {quiz_type} session" |
| `PUT /users/{id}/roles` (role change) | → User: "Your roles have been updated to: {roles}" |

### 3.5 Parent sign-off guard

**File:** `python-api/app/routers/parent.py`

Add a check in the `signoff` endpoint:

```python
@router.post("/sessions/{session_id}/signoff")
async def signoff_session(...):
    # ... existing ownership checks ...

    # NEW: Check teacher has reviewed first
    reviews = await get_reviews_for_session(session_id)
    teacher_reviewed = any(
        r["reviewer_role"] == "teacher" and r["status"] == "reviewed"
        for r in reviews
    )
    if not teacher_reviewed:
        raise HTTPException(400, "Cannot sign off until a teacher has reviewed this session")

    # ... existing sign-off logic ...
```

### 3.6 Student associations endpoint

**File:** `python-api/app/routers/users.py`

```python
@router.get("/users/{user_id}/associations")
async def get_user_associations(
    user_id: str,
    user: dict = Depends(get_current_user),
):
    """Get teachers and parents associated with a student."""
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles and user["sub"] != user_id:
        raise HTTPException(403, "Access denied")
    return await get_student_associations(user_id)
```

### 3.7 New query functions

**File:** `python-api/app/queries.py`

```python
# ── Review Templates (v2.5) ─────────────────────────

async def list_review_templates(role: str) -> list[dict]:
    """List all templates for a given reviewer role."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, reviewer_role, sentiment, label, message FROM review_templates WHERE reviewer_role = $1 ORDER BY sort_order",
        role,
    )
    return [dict(r) for r in rows]

# ── Notifications (v2.5) ────────────────────────────

async def insert_notification(user_id, type, title, message, metadata) -> dict: ...
async def get_notifications(user_id, unread_only=False) -> list[dict]: ...
async def count_unread_notifications(user_id) -> int: ...
async def mark_notification_read(notification_id, user_id) -> bool: ...
async def mark_all_notifications_read(user_id) -> int: ...
async def get_teachers_for_student(student_id) -> list[dict]: ...
async def get_parents_for_student(student_id) -> list[dict]: ...

# ── Student Associations (v2.5) ─────────────────────

async def get_student_associations(user_id) -> list[dict]:
    """Get all teachers and parents associated with a student."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM student_associations WHERE student_id = $1 ORDER BY relationship, associated_at",
        UUID(user_id),
    )
    return [dict(r) for r in rows]
```

### 3.8 API Endpoint Summary — New

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/review-templates?role=teacher&score_percent=85` | Any auth | Get filtered template responses |
| `GET` | `/api/notifications` | Any auth | List notifications (optional `?unread_only=true`) |
| `GET` | `/api/notifications/unread-count` | Any auth | Get unread notification count |
| `PATCH` | `/api/notifications/{id}/read` | Any auth | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | Any auth | Mark all notifications as read |
| `GET` | `/api/users/{id}/associations` | Self or admin | Get associated teachers/parents |

---

## 4. Frontend Changes (Angular)

### 4.1 Header — provider tag moved + p-tag

**File:** `angular-app/src/app/shared/components/header/header.component.ts`

#### Current state
```html
<span class="text-sm font-semibold">{{ user.name }}</span>
<span class="text-xs text-500">({{ user.email }})</span>
<span class="text-xs border-round px-2 py-1 font-semibold"
  [style.background-color]="..."
  [style.color]="...">
  {{ ... provider label ... }}
</span>
@for (role of user.roles; track role) {
  <p-tag [value]="role" [severity]="roleSeverity(role)"></p-tag>
}
```

#### New design
```html
<!-- Provider + Role tags BEFORE name -->
<p-tag
  [value]="providerLabel(user.authProvider)"
  [severity]="user.authProvider === 'local' ? 'secondary' : 'success'"
></p-tag>
@for (role of user.roles; track role) {
  <p-tag [value]="role" [severity]="roleSeverity(role)"></p-tag>
}
<span class="text-sm font-semibold">{{ user.name }}</span>
<span class="text-xs text-500">({{ user.email }})</span>
```

**New method:**
```typescript
providerLabel(provider: string): string {
  switch (provider) {
    case 'google': return 'Google';
    case 'both': return 'Google + Local';
    default: return 'Local';
  }
}
```

**Provider p-tag severity mapping:**

| Provider | Severity | Appearance |
|---|---|---|
| `google` | `success` | Green |
| `both` | `success` | Green |
| `local` | `secondary` | Gray |

Remove the old inline `<span>` with `[style.background-color]` and `[style.color]`.

### 4.2 Header — notification bell

**File:** `angular-app/src/app/shared/components/header/header.component.ts`

Add a bell icon with unread count badge between the role tags and the Logout button:

```html
<!-- Notification bell — after role tags, before Logout -->
<div class="relative cursor-pointer" (click)="toggleNotifications()">
  <i class="pi pi-bell text-xl"></i>
  @if (unreadCount() > 0) {
    <span class="absolute"
      style="top: -8px; right: -8px; background: #e53935; color: white;
             border-radius: 50%; min-width: 18px; height: 18px;
             font-size: 0.7rem; display: flex; align-items: center;
             justify-content: center; padding: 0 4px; font-weight: bold;">
      {{ unreadCount() > 99 ? '99+' : unreadCount() }}
    </span>
  }
</div>
```

**Notification panel** — use `p-overlayPanel` (PrimeNG OverlayPanel) anchored to the bell icon:

```html
<p-overlayPanel #notifPanel [style]="{ width: '400px', maxHeight: '500px' }">
  <div class="flex justify-content-between align-items-center mb-2">
    <span class="font-semibold text-lg">Notifications</span>
    @if (unreadCount() > 0) {
      <p-button label="Accept All" icon="pi pi-check-circle" size="small"
        severity="secondary" [text]="true" (onClick)="acceptAll()"></p-button>
    }
  </div>
  <div class="flex flex-column gap-1" style="max-height: 400px; overflow-y: auto;">
    @for (notif of notifications(); track notif.id) {
      <div class="p-3 border-round surface-hover flex justify-content-between align-items-start gap-2"
        [class.surface-100]="!notif.is_read" [class.surface-50]="notif.is_read">
        <div class="flex-1">
          <div class="font-semibold text-sm">{{ notif.title }}</div>
          <div class="text-sm text-700">{{ notif.message }}</div>
          <div class="text-xs text-500 mt-1">{{ notif.created_at | date:'short' }}</div>
        </div>
        @if (!notif.is_read) {
          <p-button icon="pi pi-check" [rounded]="true" [text]="true" size="small"
            severity="success" pTooltip="Accept"
            (onClick)="acceptNotification(notif)"></p-button>
        }
      </div>
    }
    @if (notifications().length === 0) {
      <div class="text-center text-500 py-3">No notifications</div>
    }
  </div>
</p-overlayPanel>
```

**Component additions:**
```typescript
unreadCount = signal(0);
notifications = signal<Notification[]>([]);
@ViewChild('notifPanel') notifPanel!: OverlayPanel;

// Poll unread count every 30 seconds
ngOnInit() {
  this.loadUnreadCount();
  interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUnreadCount());
}

loadUnreadCount() {
  this.api.getUnreadNotificationCount().subscribe(r => this.unreadCount.set(r.count));
}

toggleNotifications(event: Event) {
  this.notifPanel.toggle(event);
  this.api.getNotifications().subscribe(n => this.notifications.set(n));
}

acceptNotification(notif: Notification) {
  this.api.markNotificationRead(notif.id).subscribe(() => {
    notif.is_read = true;
    this.unreadCount.update(c => Math.max(0, c - 1));
  });
}

acceptAll() {
  this.api.markAllNotificationsRead().subscribe(() => {
    this.notifications.update(list => list.map(n => ({ ...n, is_read: true })));
    this.unreadCount.set(0);
  });
}
```

**New imports:** `OverlayPanelModule`, `TooltipModule`, `interval` from `rxjs`, `takeUntilDestroyed` from `@angular/core/rxjs-interop`.

### 4.3 Header — Logo replacement

**File:** `angular-app/src/app/shared/components/header/header.component.ts`

Add the OpenMath SVG logo as an inline component or as a shared asset. Place it at the start of the nav:

```html
<nav class="flex gap-3 align-items-center">
  <a routerLink="/" class="no-underline flex align-items-center gap-2">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="28" height="28">
      <defs>
        <linearGradient id="om-grad" x1="80" y1="60" x2="430" y2="460" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#2D9CDB" />
          <stop offset="1" stop-color="#27AE60" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="210" fill="url(#om-grad)" />
      <circle cx="256" cy="256" r="210" fill="none" stroke="#0B1B2B" stroke-opacity=".15" stroke-width="14" />
      <g stroke="#fff" stroke-width="24" stroke-linecap="round">
        <line x1="176" y1="190" x2="220" y2="234" />
        <line x1="220" y1="190" x2="176" y2="234" />
      </g>
      <g stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M300 220 L325 245 L360 200" />
      </g>
      <path d="M176 300 Q256 380 336 300" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" />
    </svg>
  </a>
  <a routerLink="/" routerLinkActive="font-bold" ...>Start</a>
  ...
</nav>
```

### 4.4 Login page — Logo replacement

**File:** `angular-app/src/app/features/auth/login.component.ts`

Replace header:
```html
<!-- Before -->
<h2 class="m-0">🧮 OpenMath</h2>

<!-- After -->
<div class="flex align-items-center justify-content-center gap-2">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="40" height="40">
    <!-- same SVG as header -->
  </svg>
  <h2 class="m-0">OpenMath</h2>
</div>
```

Also apply the same SVG to the **Register** page (`register.component.ts`).

### 4.5 Profile — Auth Provider as p-tag

**File:** `angular-app/src/app/features/profile/profile.component.ts`

Replace:
```html
<!-- Before -->
<label class="font-semibold">Auth Provider</label>
<div class="flex align-items-center gap-2 py-2">
  <span class="border-round px-2 py-1 text-sm" [ngClass]="providerClass">{{ providerLabel }}</span>
</div>
```

```html
<!-- After -->
<label class="font-semibold">Auth Provider</label>
<div class="flex align-items-center gap-2 py-2">
  <p-tag
    [value]="providerTagLabel"
    [severity]="providerTagSeverity"
  ></p-tag>
</div>
```

**Add import:** `TagModule` from `primeng/tag`.

**Component properties:**
```typescript
get providerTagLabel(): string {
  const p = this.auth.currentUser()?.authProvider || 'local';
  return p === 'google' ? 'Google' : p === 'both' ? 'Google + Local' : 'Local';
}

get providerTagSeverity(): 'success' | 'secondary' {
  const p = this.auth.currentUser()?.authProvider || 'local';
  return p === 'local' ? 'secondary' : 'success';
}
```

**Remove:** `providerLabel` and `providerClass` getters (replaced).

### 4.6 Profile — Student associations (teachers & parents)

**File:** `angular-app/src/app/features/profile/profile.component.ts`

Add a new card below the Performance card (or below Edit Profile):

```html
<!-- Associations card — only for students -->
@if (associations().length > 0) {
  <div class="col-12">
    <p-card header="My Teachers & Parents">
      <p-table [value]="associations()" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th>Relationship</th>
            <th>Name</th>
            <th>Email</th>
            <th>Since</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-a>
          <tr>
            <td>
              <p-tag
                [value]="a.relationship === 'teacher' ? 'Teacher' : 'Parent'"
                [severity]="a.relationship === 'teacher' ? 'warning' : 'secondary'"
              ></p-tag>
            </td>
            <td>{{ a.related_name }}</td>
            <td>{{ a.related_email }}</td>
            <td>{{ a.associated_at | date:'mediumDate' }}</td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4" class="text-center text-500">No associations found.</td></tr>
        </ng-template>
      </p-table>
    </p-card>
  </div>
}
```

**Component additions:**
```typescript
associations = signal<any[]>([]);

// In loadProfile():
this.api.getUserAssociations(user.id).subscribe(a => this.associations.set(a));
```

### 4.7 Start page — Example questions without bullet points

**File:** `angular-app/src/app/features/start/start.component.ts`

Replace the preview section:

```html
<!-- Before -->
@if (previewQuestions().length > 0 && !previewLoading()) {
  <div class="surface-50 p-3 border-round">
    <div class="font-semibold mb-2 text-sm">Example questions:</div>
    @for (p of previewQuestions(); track p.render) {
      <div class="text-sm mb-1">
        • {{ p.render }} <span class="text-500">= {{ p.correct }}</span>
      </div>
    }
  </div>
}

<!-- After -->
@if (previewQuestions().length > 0 && !previewLoading()) {
  <div>
    <div class="font-semibold mb-2 text-sm">Example questions:</div>
    <div class="flex flex-column gap-2">
      @for (p of previewQuestions(); track p.render) {
        <div class="surface-50 p-3 border-round flex justify-content-between">
          <span class="font-semibold">{{ p.render }}</span>
          <span class="text-green-600">= {{ p.correct }}</span>
        </div>
      }
    </div>
  </div>
}
```

This matches the admin quiz-type-editor `Preview Questions` dialog styling: each question is a separate `surface-50` card with `flex justify-content-between`, question on the left (bold), answer on the right (green).

### 4.8 Parent sign-off guard (frontend)

**File:** `angular-app/src/app/features/parent/parent-dashboard.component.ts`

Conditionally disable the "Sign Off" button when no teacher review exists:

```html
<!-- Before -->
<p-button
  label="Sign Off"
  icon="pi pi-check-circle"
  severity="success"
  (onClick)="submitSignoff()"
  [loading]="signoffSubmitting()"
></p-button>

<!-- After -->
<p-button
  label="Sign Off"
  icon="pi pi-check-circle"
  severity="success"
  (onClick)="submitSignoff()"
  [loading]="signoffSubmitting()"
  [disabled]="!hasTeacherReview()"
  [pTooltip]="hasTeacherReview() ? '' : 'Waiting for teacher review'"
></p-button>
```

**Component addition:**
```typescript
hasTeacherReview(): boolean {
  const reviews = this.sessionDetail()?.reviews || [];
  return reviews.some(r => r.reviewer_role === 'teacher' && r.status === 'reviewed');
}
```

### 4.9 Review template responses — Teacher dashboard

**File:** `angular-app/src/app/features/teacher/teacher-dashboard.component.ts`

Add a template dropdown above the "Your Comment" textarea in the review dialog:

```html
<!-- Template response selector -->
<div class="flex flex-column gap-2 mt-3">
  <label class="font-semibold">Quick Feedback</label>
  <p-dropdown
    [options]="reviewTemplates()"
    optionLabel="label"
    optionValue="message"
    placeholder="Select a template response..."
    [showClear]="true"
    (onChange)="onTemplateSelect($event)"
  ></p-dropdown>
</div>

<div class="flex flex-column gap-2 mt-3">
  <label class="font-semibold">Your Comment</label>
  <textarea pInputTextarea [(ngModel)]="reviewComment" rows="3" class="w-full"
    placeholder="Add your review comment..."></textarea>
</div>
```

**Component additions:**
```typescript
reviewTemplates = signal<any[]>([]);

// When opening review dialog, load templates based on session score:
openReviewDialog(session: any) {
  // ... existing logic to load session detail ...
  this.api.getReviewTemplates('teacher', session.score_percent).subscribe(
    t => this.reviewTemplates.set(t)
  );
}

onTemplateSelect(event: any) {
  if (event.value) {
    this.reviewComment = event.value;
  }
}
```

### 4.10 Review template responses — Parent dashboard

**File:** `angular-app/src/app/features/parent/parent-dashboard.component.ts`

Same pattern as teacher — add template dropdown above the comment textarea:

```html
<!-- Template response selector -->
<div class="flex flex-column gap-2 mt-3">
  <label class="font-semibold">Quick Feedback</label>
  <p-dropdown
    [options]="signoffTemplates()"
    optionLabel="label"
    optionValue="message"
    placeholder="Select a template response..."
    [showClear]="true"
    (onChange)="onTemplateSelect($event)"
  ></p-dropdown>
</div>

<div class="flex flex-column gap-2 mt-3">
  <label class="font-semibold">Your Comment (optional)</label>
  <textarea pInputTextarea [(ngModel)]="signoffComment" rows="3" class="w-full"
    placeholder="Add a comment..."></textarea>
</div>
```

**Component additions:**
```typescript
signoffTemplates = signal<any[]>([]);

// When opening detail dialog, load templates:
openSessionDetail(session: any) {
  // ... existing logic ...
  this.api.getReviewTemplates('parent', session.score_percent).subscribe(
    t => this.signoffTemplates.set(t)
  );
}

onTemplateSelect(event: any) {
  if (event.value) {
    this.signoffComment = event.value;
  }
}
```

### 4.11 Teacher/Parent — access to student/child History page

**File:** `angular-app/src/app/features/teacher/teacher-dashboard.component.ts`

Add a "View Full History" button per student in the student listbox or a link next to the student name:

```html
<ng-template let-item pTemplate="item">
  <div class="flex align-items-center justify-content-between w-full">
    <span>{{ item.name }}</span>
    <div class="flex align-items-center gap-1">
      @if (calculateAge(item.birthday) !== null) {
        <p-badge [value]="calculateAge(item.birthday)!.toString()" severity="info"></p-badge>
      }
      <p-button icon="pi pi-history" [rounded]="true" [text]="true" size="small"
        severity="info" pTooltip="View History"
        (onClick)="viewStudentHistory(item, $event)"></p-button>
      <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small"
        severity="danger" pTooltip="Remove"
        (onClick)="removeStudent(item, $event)"></p-button>
    </div>
  </div>
</ng-template>
```

**Route change:** Add a new route that allows teacher/parent to view a specific user's history:

**File:** `angular-app/src/app/app.routes.ts`

```typescript
{
  path: 'history/user/:userId',
  loadComponent: () => import('./features/history/history-list.component').then(m => m.HistoryListComponent),
  canActivate: [authGuard],
},
```

**File:** `angular-app/src/app/features/history/history-list.component.ts`

Modify to accept an optional `userId` route param:

```typescript
private route = inject(ActivatedRoute);

ngOnInit() {
  const userId = this.route.snapshot.paramMap.get('userId');
  // If userId is present and user is teacher/parent/admin, load that user's sessions
  // Otherwise load own sessions (current behavior)
  this.loadSessions(userId || undefined);
}

loadSessions(userId?: string) {
  const obs = userId
    ? this.api.getUserSessions(userId)   // new API method
    : this.api.getSessions();
  obs.subscribe({
    next: (sessions) => { ... },
    error: () => this.loading.set(false),
  });
}
```

**Backend support:**

**File:** `python-api/app/routers/sessions.py`

```python
@router.get("/sessions")
async def list_sessions(
    user_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    """List sessions. If user_id is provided, verify teacher/parent relationship."""
    if user_id and user_id != user["sub"]:
        roles = await get_user_roles(user["sub"])
        if "admin" in roles:
            pass  # admin can view anyone
        elif "teacher" in roles and await is_teacher_of_student(user["sub"], user_id):
            pass  # teacher viewing their student
        elif "parent" in roles and await is_parent_of_student(user["sub"], user_id):
            pass  # parent viewing their child
        else:
            raise HTTPException(403, "Access denied")
        return await list_sessions_for_user(user_id)
    return await list_sessions_for_user(user["sub"])
```

**Teacher dashboard navigation:**
```typescript
viewStudentHistory(student: any, event: Event) {
  event.stopPropagation();
  this.router.navigate(['/history/user', student.id]);
}
```

**Parent dashboard** — same pattern, add a "View History" link for the selected child.

### 4.12 Footer modernization

**File:** `angular-app/src/app/shared/components/footer/footer.component.ts`

```typescript
@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="surface-card border-top-1 border-300 px-4 py-3 mt-4">
      <div class="flex align-items-center justify-content-between text-sm text-500">
        <div class="flex align-items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
            <defs>
              <linearGradient id="om-grad-f" x1="80" y1="60" x2="430" y2="460" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2D9CDB" />
                <stop offset="1" stop-color="#27AE60" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="210" fill="url(#om-grad-f)" />
            <circle cx="256" cy="256" r="210" fill="none" stroke="#0B1B2B" stroke-opacity=".15" stroke-width="14" />
            <g stroke="#fff" stroke-width="24" stroke-linecap="round">
              <line x1="176" y1="190" x2="220" y2="234" />
              <line x1="220" y1="190" x2="176" y2="234" />
            </g>
            <g stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <path d="M300 220 L325 245 L360 200" />
            </g>
            <path d="M176 300 Q256 380 336 300" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" />
          </svg>
          <span>OpenMath v2.5</span>
          <span>&mdash;</span>
          <span>Angular + FastAPI + PrimeNG + PostgreSQL</span>
        </div>
        <a href="https://github.com/attilamacskasy/openmath" target="_blank"
          class="text-500 no-underline hover:text-primary flex align-items-center gap-1">
          <i class="pi pi-github"></i>
          Source
        </a>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
```

**Changes:**
- Version updated: `v2.1` → `v2.5`
- Source link: `https://github.com` → `https://github.com/attilamacskasy/openmath`
- Layout: flexbox with space-between instead of centered text
- Added OpenMath SVG logo (20px)
- Added GitHub icon (`pi pi-github`) next to Source link
- Background: `surface-card` instead of `surface-ground` (slight elevation)

### 4.13 ApiService additions

**File:** `angular-app/src/app/core/services/api.service.ts`

```typescript
// ── Review Templates ──────────────────────────────────
getReviewTemplates(role: string, scorePercent?: number): Observable<any[]> {
  let params = `role=${role}`;
  if (scorePercent !== undefined) params += `&score_percent=${scorePercent}`;
  return this.http.get<any[]>(`${this.baseUrl}/review-templates?${params}`);
}

// ── Notifications ─────────────────────────────────────
getNotifications(unreadOnly = false): Observable<Notification[]> {
  const params = unreadOnly ? '?unread_only=true' : '';
  return this.http.get<Notification[]>(`${this.baseUrl}/notifications${params}`);
}

getUnreadNotificationCount(): Observable<{ count: number }> {
  return this.http.get<{ count: number }>(`${this.baseUrl}/notifications/unread-count`);
}

markNotificationRead(id: string): Observable<any> {
  return this.http.patch(`${this.baseUrl}/notifications/${id}/read`, {});
}

markAllNotificationsRead(): Observable<any> {
  return this.http.patch(`${this.baseUrl}/notifications/read-all`, {});
}

// ── Student Associations ──────────────────────────────
getUserAssociations(userId: string): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/users/${userId}/associations`);
}

// ── User Sessions (teacher/parent viewing student) ────
getUserSessions(userId: string): Observable<SessionListItem[]> {
  return this.http.get<SessionListItem[]>(`${this.baseUrl}/sessions?user_id=${userId}`);
}
```

### 4.14 Notification model

**File:** `angular-app/src/app/models/notification.model.ts` (new file)

```typescript
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}
```

---

## 5. Implementation Steps

| # | Area | Task | Files |
|---|---|---|---|
| 1 | DB | Create migration `0013_review_templates.sql` with seed data | `db/migrations/` |
| 2 | DB | Create migration `0014_notifications.sql` | `db/migrations/` |
| 3 | DB | Create migration `0015_student_associations_view.sql` (add `created_at` to association tables + view) | `db/migrations/` |
| 4 | Backend | Add review templates query + endpoint | `queries.py`, `sessions.py` or new `templates.py` |
| 5 | Backend | Add notification query functions (6 functions) | `queries.py` |
| 6 | Backend | Create notifications router (`notifications.py`) with 4 endpoints | `routers/notifications.py` |
| 7 | Backend | Create notification service helper (`services/notifications.py`) | `services/notifications.py` |
| 8 | Backend | Add notification triggers to teacher/parent/sessions/users endpoints | `teacher.py`, `parent.py`, `sessions.py`, `users.py` |
| 9 | Backend | Add parent sign-off guard (teacher review required) | `parent.py` |
| 10 | Backend | Add student associations endpoint | `users.py` |
| 11 | Backend | Add `user_id` query param to sessions list endpoint | `sessions.py` |
| 12 | Backend | Register notifications router in `main.py` | `main.py` |
| 13 | Frontend | Header: provider → p-tag, move before name | `header.component.ts` |
| 14 | Frontend | Header: notification bell + overlay panel | `header.component.ts` |
| 15 | Frontend | Header: SVG logo in nav | `header.component.ts` |
| 16 | Frontend | Login: replace emoji with SVG logo | `login.component.ts`, `register.component.ts` |
| 17 | Frontend | Profile: auth provider → p-tag | `profile.component.ts` |
| 18 | Frontend | Profile: student associations table | `profile.component.ts` |
| 19 | Frontend | Start: example questions card layout (no bullets) | `start.component.ts` |
| 20 | Frontend | Parent: sign-off guard (disable until teacher reviewed) | `parent-dashboard.component.ts` |
| 21 | Frontend | Teacher: review template dropdown | `teacher-dashboard.component.ts` |
| 22 | Frontend | Parent: sign-off template dropdown | `parent-dashboard.component.ts` |
| 23 | Frontend | Teacher: "View History" button per student | `teacher-dashboard.component.ts` |
| 24 | Frontend | Parent: "View History" link for child | `parent-dashboard.component.ts` |
| 25 | Frontend | History: support `userId` route param for shared viewing | `history-list.component.ts`, `app.routes.ts` |
| 26 | Frontend | ApiService: 7 new methods | `api.service.ts` |
| 27 | Frontend | Notification model | `notification.model.ts` |
| 28 | Frontend | Footer: modernize, update version, correct source URL, add logo | `footer.component.ts` |
| 29 | Frontend | User guide: update with v2.5 features | `user-guide.component.ts` |
| 30 | Test | Apply migrations, verify templates load, test notification flow | manual |

---

## 6. Review Template UX Flow

### Teacher reviewing a session

1. Teacher clicks eye icon on a student's session → review dialog opens
2. Template dropdown loads 3 templates based on session `score_percent`:
   - Score ≥ 70% → "Excellent work", "Well done", "Great improvement"
   - Score 40–69% → "Good effort", "Keep practicing", "Room for growth"
   - Score < 40% → "Needs more work", "Below expectations", "Please retry"
3. Teacher selects a template → message auto-fills into "Your Comment" textarea
4. Teacher can edit the text or leave it as-is
5. Teacher clicks "Mark as Reviewed" → review is saved with the comment

### Parent signing off a session

1. Parent clicks eye icon on a child's session → detail dialog opens
2. "Sign Off" button is **disabled** if no teacher review exists (with tooltip: "Waiting for teacher review")
3. Template dropdown loads 3 parent templates based on session `score_percent`
4. Parent selects a template → message auto-fills into "Your Comment" textarea
5. Parent can edit or accept as-is
6. Parent clicks "Sign Off" → sign-off is saved with the comment

---

## 7. Notification Lifecycle

```
Event occurs (e.g. student finishes quiz)
        │
        ▼
Backend creates notification row(s)
  → INSERT INTO notifications (user_id, type, title, message, metadata)
  → One row per recipient
        │
        ▼
Frontend polls /notifications/unread-count every 30s
  → Red badge on bell icon updates
        │
        ▼
User clicks bell → overlay panel loads full notification list
  → Unread items highlighted (surface-100 background)
        │
        ▼
User clicks ✓ on a notification → PATCH /notifications/{id}/read
  → Badge decrements
  → Item fades to read state (surface-50)
        │
        ▼
User clicks "Accept All" → PATCH /notifications/read-all
  → All items marked read
  → Badge goes to 0
```

---

## 8. Data Protection Notes

- **Notifications** are scoped per user — users can only see their own notifications
- **Student associations view** is only accessible by the student themselves or admins
- **History sharing** (`/history/user/:userId`) verifies teacher-of-student or parent-of-student relationship server-side
- **Review templates** are public to any authenticated user (non-sensitive static content)
- **Notification polling** (30s interval) is lightweight — only returns a count integer, not full payloads
