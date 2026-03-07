# OpenMath v2.4 — UX Improvements & Self-Association

## Feature Summary

**Version:** 2.4  
**Scope:** Self-service student association for teachers/parents, header modernization, menu hover, arrow-to-equals cleanup, Google-provider guardrails in User Admin, user guide rewrite  
**Depends on:** v2.3 (multi-role RBAC, teacher/parent dashboards, review workflow, server-side rendering)  
**Tech stack:** Angular 18 + PrimeNG 17 | FastAPI + asyncpg | PostgreSQL 16

---

## 1. Overview

### Current state (v2.3)

- **Teacher dashboard** (`/teacher`): List of assigned students (left sidebar), click to view sessions, review & comment. No UI to add/remove students — assignments are admin-only via **Users → Admin → Teacher-Students** CRUD endpoints.
- **Parent dashboard** (`/parent`): Child list via dropdown (auto-selects if only one), view sessions, sign off. No UI to add/remove children — admin-only.
- **Header**: Shows `user.name` + emoji provider badge (`🔵 Google` / `🔗 Google + Local` / `🔑 Local`) + Logout button. No roles shown. No email visible.
- **Menu links**: Plain `<a>` tags with `text-primary` color, no hover background.
- **Quiz type descriptions**: 4 descriptions use `→` arrow: `Roman → Arabic`, `Arabic → Roman`, `dm → cm`, `m → cm`.
- **Angular preview templates**: Quiz-type-editor and start page show `{{ p.render }} → {{ p.correct }}` with `→` separating question from answer.
- **User Admin**: Reset password button shown for all users regardless of provider. Email field is `<input>` in the create/edit dialog (though edit mode doesn't send email in `saveUser()`).
- **User Guide**: Static single-page content in `p-card`. Only has admin-gated sections (`@if(auth.isAdmin())`). Lists only 2 quiz types (outdated). No teacher/parent sections.

### v2.4 delivers

1. **Parent self-association** — parents can add their own children on My Child page via email lookup, max 2 parents per student
2. **Teacher self-association** — teachers can add their own students on My Students page via email lookup
3. **Header modernization** — show roles as PrimeNG tags, email in parentheses, provider color background (no icons)
4. **Menu hover** — lightgray hover background on nav links
5. **Arrow-to-equals cleanup** — replace `→` with `=` in quiz descriptions and preview templates
6. **Google user guardrails** — hide reset password, disable email change for Google SSO users in User Admin
7. **User guide rewrite** — role-based sections, complete restructure

---

## 2. Database Changes

### 2.1 Migration `0011_max_parents_constraint.sql`

Add a CHECK constraint limiting each student to at most 2 parent associations.

```sql
-- v2.4: Limit each student to max 2 parents
CREATE OR REPLACE FUNCTION check_max_parents()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM parent_students WHERE student_id = NEW.student_id) >= 2 THEN
    RAISE EXCEPTION 'A student can have at most 2 parents';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_parents ON parent_students;
CREATE TRIGGER trg_max_parents
  BEFORE INSERT ON parent_students
  FOR EACH ROW
  EXECUTE FUNCTION check_max_parents();
```

### 2.2 Migration `0012_fix_quiz_descriptions.sql`

Replace `→` with `=` in quiz type descriptions.

```sql
-- v2.4: Replace → with = in quiz type descriptions
UPDATE quiz_types SET description = REPLACE(description, '→', '=') WHERE description LIKE '%→%';
```

> **Note:** This updates 4 rows: `roman_to_arabic`, `arabic_to_roman`, `measure_dm_to_cm`, `measure_m_to_cm`. The `ON CONFLICT DO UPDATE` clause in migration `0007` ensures re-runs also use the corrected text once the seed SQL is updated.

---

## 3. Backend Changes (FastAPI)

### 3.1 Teacher self-association endpoint

**File:** `python-api/app/routers/teacher.py`

Add a new endpoint allowing authenticated teachers to associate students by email:

```python
class AssociateStudentRequest(BaseModel):
    email: str

@router.post("/teacher/students")
async def associate_student(body: AssociateStudentRequest, user=Depends(require_teacher)):
    """Teacher self-associates a student by email lookup."""
    student = await get_user_by_email(body.email)
    if not student:
        raise HTTPException(404, "No registered student found with that email address")
    student_roles = await get_user_roles(student["id"])
    if "student" not in student_roles:
        raise HTTPException(400, "That user does not have the student role")
    if student["id"] == user["id"]:
        raise HTTPException(400, "You cannot add yourself")
    try:
        result = await create_teacher_student(user["id"], student["id"])
    except Exception:
        raise HTTPException(409, "This student is already in your class")
    return result
```

**Dependencies:**  
- `require_teacher` — new dependency (or reuse existing role check) ensuring current user has `teacher` role
- `get_user_by_email` — existing query function

### 3.2 Teacher remove-student endpoint

```python
@router.delete("/teacher/students/{student_id}")
async def remove_student(student_id: str, user=Depends(require_teacher)):
    """Teacher removes a student from their own class."""
    # Verify ownership
    if not await is_teacher_of_student(user["id"], student_id):
        raise HTTPException(404, "Student not found in your class")
    await delete_teacher_student_by_pair(user["id"], student_id)
    return {"ok": True}
```

**New query function** `delete_teacher_student_by_pair(teacher_id, student_id)`:

```python
async def delete_teacher_student_by_pair(teacher_id: str, student_id: str):
    await execute(
        "DELETE FROM teacher_students WHERE teacher_id = $1 AND student_id = $2",
        teacher_id, student_id,
    )
```

### 3.3 Parent self-association endpoint

**File:** `python-api/app/routers/parent.py`

```python
class AssociateChildRequest(BaseModel):
    email: str

@router.post("/parent/children")
async def associate_child(body: AssociateChildRequest, user=Depends(require_parent)):
    """Parent self-associates a child by email lookup."""
    student = await get_user_by_email(body.email)
    if not student:
        raise HTTPException(404, "No registered student found with that email address")
    student_roles = await get_user_roles(student["id"])
    if "student" not in student_roles:
        raise HTTPException(400, "That user does not have the student role")
    if student["id"] == user["id"]:
        raise HTTPException(400, "You cannot add yourself")
    # Max 2 parents check is enforced by DB trigger, handle gracefully
    try:
        result = await create_parent_student(user["id"], student["id"])
    except Exception as e:
        if "at most 2 parents" in str(e):
            raise HTTPException(409, "This student already has the maximum of 2 parents")
        raise HTTPException(409, "This child is already assigned to your account")
    return result
```

### 3.4 Parent remove-child endpoint

```python
@router.delete("/parent/children/{child_id}")
async def remove_child(child_id: str, user=Depends(require_parent)):
    """Parent removes a child from their own account."""
    if not await is_parent_of_student(user["id"], child_id):
        raise HTTPException(404, "Child not found on your account")
    await delete_parent_student_by_pair(user["id"], child_id)
    return {"ok": True}
```

**New query function** `delete_parent_student_by_pair(parent_id, student_id)`:

```python
async def delete_parent_student_by_pair(parent_id: str, student_id: str):
    await execute(
        "DELETE FROM parent_students WHERE parent_id = $1 AND student_id = $2",
        parent_id, student_id,
    )
```

### 3.5 Role-check dependencies

**File:** `python-api/app/routers/auth.py` (or shared deps module)

```python
async def require_teacher(user=Depends(get_current_user)):
    roles = await get_user_roles(user["id"])
    if "teacher" not in roles:
        raise HTTPException(403, "Teacher role required")
    return user

async def require_parent(user=Depends(get_current_user)):
    roles = await get_user_roles(user["id"])
    if "parent" not in roles:
        raise HTTPException(403, "Parent role required")
    return user
```

---

## 4. Frontend Changes (Angular)

### 4.1 Teacher self-association UI

**File:** `angular-app/src/app/features/teacher/teacher-dashboard.component.ts`

#### Current state
- Left panel: `<p-card header="Students">` with `<p-listbox>` or "No students assigned." text
- No add/remove buttons

#### Changes
1. **Add "Add Student" button** inside the Students card header area:
   ```html
   <p-card header="Students">
     <ng-template pTemplate="subtitle">
       <p-button label="Add Student" icon="pi pi-plus" size="small"
         (onClick)="addStudentDialogVisible = true"></p-button>
     </ng-template>
     <!-- existing listbox -->
   </p-card>
   ```

2. **Add "Remove" button** next to each student in the listbox item template:
   ```html
   <ng-template let-item pTemplate="item">
     <div class="flex align-items-center justify-content-between w-full">
       <span>{{ item.name }}</span>
       <div class="flex align-items-center gap-1">
         @if (calculateAge(item.birthday) !== null) {
           <p-badge [value]="calculateAge(item.birthday)!.toString()" severity="info"></p-badge>
         }
         <p-button icon="pi pi-times" [rounded]="true" [text]="true" size="small"
           severity="danger" pTooltip="Remove"
           (onClick)="removeStudent(item, $event)"></p-button>
       </div>
     </div>
   </ng-template>
   ```

3. **Add Student dialog** — email input for lookup:
   ```html
   <p-dialog [(visible)]="addStudentDialogVisible" header="Add Student" [modal]="true" [style]="{ width: '400px' }">
     <p class="mb-3">Enter the email address of the student you want to add to your class.</p>
     <label class="font-semibold">Student Email *</label>
     <input pInputText [(ngModel)]="addStudentEmail" class="w-full" type="email"
       placeholder="student@example.com" />
     <ng-template pTemplate="footer">
       <p-button label="Cancel" severity="secondary"
         (onClick)="addStudentDialogVisible = false"></p-button>
       <p-button label="Add" icon="pi pi-plus"
         (onClick)="addStudent()" [disabled]="!addStudentEmail"
         [loading]="addStudentLoading()"></p-button>
     </ng-template>
   </p-dialog>
   ```

4. **Component properties & methods:**
   ```typescript
   addStudentDialogVisible = false;
   addStudentEmail = '';
   addStudentLoading = signal(false);

   addStudent() {
     this.addStudentLoading.set(true);
     this.api.addTeacherStudent(this.addStudentEmail).subscribe({
       next: () => {
         this.addStudentLoading.set(false);
         this.addStudentDialogVisible = false;
         this.addStudentEmail = '';
         this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Student added to your class' });
         this.loadStudents();
       },
       error: (err) => {
         this.addStudentLoading.set(false);
         this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.detail || 'Failed to add student' });
       },
     });
   }

   removeStudent(student: any, event: Event) {
     event.stopPropagation(); // prevent listbox selection
     this.api.removeTeacherStudent(student.id).subscribe({
       next: () => {
         this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${student.name} removed from your class` });
         this.loadStudents();
         if (this.selectedStudent?.id === student.id) {
           this.selectedStudent = null;
           this.sessions.set([]);
         }
       },
       error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove student' }),
     });
   }

   private loadStudents() {
     this.api.getTeacherStudents().subscribe(s => this.students.set(s));
   }
   ```

#### ApiService additions
```typescript
addTeacherStudent(email: string) {
  return this.http.post<any>(`${this.base}/teacher/students`, { email });
}

removeTeacherStudent(studentId: string) {
  return this.http.delete<any>(`${this.base}/teacher/students/${studentId}`);
}
```

### 4.2 Parent self-association UI

**File:** `angular-app/src/app/features/parent/parent-dashboard.component.ts`

#### Current state
- Shows "No children assigned to your account." when empty
- Dropdown to select child when multiple are assigned
- No add/remove buttons

#### Changes
1. **Add "Add Child" button** — shown always at the top:
   ```html
   <div class="flex align-items-center justify-content-between mb-3">
     <h2 class="mt-0 mb-0">My Child</h2>
     <p-button label="Add Child" icon="pi pi-plus" size="small"
       (onClick)="addChildDialogVisible = true"></p-button>
   </div>
   ```

2. **Add "Remove" button** next to child dropdown or child name display:
   - When multiple children: add remove icon in dropdown item template
   - When single child: show `<p-button icon="pi pi-times">` next to child name

3. **Add Child dialog** — same pattern as teacher:
   ```html
   <p-dialog [(visible)]="addChildDialogVisible" header="Add Child" [modal]="true" [style]="{ width: '400px' }">
     <p class="mb-3">Enter the email address of your child to add them to your account.</p>
     <label class="font-semibold">Child's Email *</label>
     <input pInputText [(ngModel)]="addChildEmail" class="w-full" type="email"
       placeholder="child@example.com" />
     <ng-template pTemplate="footer">
       <p-button label="Cancel" severity="secondary"
         (onClick)="addChildDialogVisible = false"></p-button>
       <p-button label="Add" icon="pi pi-plus"
         (onClick)="addChild()" [disabled]="!addChildEmail"
         [loading]="addChildLoading()"></p-button>
     </ng-template>
   </p-dialog>
   ```

4. **Component properties & methods:**
   ```typescript
   addChildDialogVisible = false;
   addChildEmail = '';
   addChildLoading = signal(false);

   addChild() {
     this.addChildLoading.set(true);
     this.api.addParentChild(this.addChildEmail).subscribe({
       next: () => {
         this.addChildLoading.set(false);
         this.addChildDialogVisible = false;
         this.addChildEmail = '';
         this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Child added to your account' });
         this.loadChildren();
       },
       error: (err) => {
         this.addChildLoading.set(false);
         const msg = err.error?.detail || 'Failed to add child';
         this.messageService.add({ severity: 'error', summary: 'Error', detail: msg });
       },
     });
   }

   removeChild(child: any) {
     this.api.removeParentChild(child.id).subscribe({
       next: () => {
         this.messageService.add({ severity: 'success', summary: 'Removed', detail: `${child.name} removed` });
         this.loadChildren();
         if (this.selectedChild?.id === child.id) {
           this.selectedChild = null;
           this.sessions.set([]);
         }
       },
       error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to remove child' }),
     });
   }

   private loadChildren() {
     this.api.getParentChildren().subscribe(c => {
       this.children.set(c);
       if (c.length === 1) { this.selectedChild = c[0]; this.onChildSelect(c[0]); }
     });
   }
   ```

#### ApiService additions
```typescript
addParentChild(email: string) {
  return this.http.post<any>(`${this.base}/parent/children`, { email });
}

removeParentChild(childId: string) {
  return this.http.delete<any>(`${this.base}/parent/children/${childId}`);
}
```

### 4.3 Header modernization

**File:** `angular-app/src/app/shared/components/header/header.component.ts`

#### Current state
```html
<span class="text-sm font-semibold">{{ user.name }}</span>
<span class="text-xs border-round px-2 py-1" [ngClass]="providerClass(user.authProvider)">{{ providerLabel(user.authProvider) }}</span>
```
- Provider badge: emoji-based (`🔵 Google`, `🔗 Google + Local`, `🔑 Local`)
- No roles displayed
- No email visible

#### New design

Replace the user info section:

```html
<div class="flex align-items-center gap-2">
  @if (auth.currentUser(); as user) {
    <span class="text-sm font-semibold">{{ user.name }}</span>
    <span class="text-xs text-500">({{ user.email }})</span>

    <!-- Provider badge: background color only, no icons -->
    <span class="text-xs border-round px-2 py-1 font-semibold"
      [style.background-color]="user.authProvider === 'local' ? '#e0e0e0' : '#c8e6c9'"
      [style.color]="user.authProvider === 'local' ? '#424242' : '#2e7d32'">
      {{ user.authProvider === 'google' ? 'Google' : user.authProvider === 'both' ? 'Google + Local' : 'Local' }}
    </span>

    <!-- Role tags: same design as Users page roles column -->
    @for (role of user.roles; track role) {
      <p-tag [value]="role" [severity]="roleSeverity(role)"></p-tag>
    }

    <p-button
      label="Logout"
      icon="pi pi-sign-out"
      severity="secondary"
      [text]="true"
      size="small"
      (onClick)="auth.logout()"
    ></p-button>
  }
</div>
```

**Component method:**
```typescript
roleSeverity(role: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  switch (role) {
    case 'admin': return 'danger';
    case 'teacher': return 'warn';
    case 'parent': return 'secondary';
    default: return 'info'; // student
  }
}
```

**Provider color scheme** (no icons):

| Provider | Background | Text color |
|---|---|---|
| `google` | `#c8e6c9` (light green) | `#2e7d32` (dark green) |
| `both` | `#c8e6c9` (light green) | `#2e7d32` (dark green) |
| `local` | `#e0e0e0` (light gray) | `#424242` (dark gray) |

**Remove:** `providerLabel()` and `providerClass()` methods (replaced by inline logic).

**Add import:** `TagModule` from `primeng/tag`.

### 4.4 Menu hover styling

**File:** `angular-app/src/app/shared/components/header/header.component.ts`

Add a `styles` block to the component:

```typescript
styles: [`
  nav a {
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    transition: background-color 0.15s;
  }
  nav a:hover {
    background-color: #f0f0f0;
  }
`]
```

This matches the table-row hover pattern (light gray background `#f0f0f0`).

### 4.5 Arrow-to-equals cleanup

Replace `→` with `=` in three locations:

#### 4.5.1 Quiz type descriptions (migration)

**File:** `db/migrations/0007_quiz_type_editor.sql`

| Before | After |
|---|---|
| `'Roman → Arabic (XIV = ?)'` | `'Roman = Arabic (XIV = ?)'` |
| `'Arabic → Roman (27 = ?)'` | `'Arabic = Roman (27 = ?)'` |
| `'Conversion: dm → cm (5 dm = ? cm)'` | `'Conversion: dm = cm (5 dm = ? cm)'` |
| `'Conversion: m → cm (2 m = ? cm)'` | `'Conversion: m = cm (2 m = ? cm)'` |

> **Note:** These descriptions are also updated in the DB by migration `0012_fix_quiz_descriptions.sql` (section 2.2).

#### 4.5.2 Quiz-type-editor preview

**File:** `angular-app/src/app/features/quiz-type-editor/quiz-type-editor.component.ts`

| Line | Before | After |
|---|---|---|
| 201 | `• {{ p.render }} → {{ p.correct }}` | `• {{ p.render }} = {{ p.correct }}` |
| 232 | `<span class="text-green-600">→ {{ p.correct }}</span>` | `<span class="text-green-600">= {{ p.correct }}</span>` |

#### 4.5.3 Start page quiz preview

**File:** `angular-app/src/app/features/start/start.component.ts`

| Line | Before | After |
|---|---|---|
| 102 | `• {{ p.render }} <span class="text-500">→ {{ p.correct }}</span>` | `• {{ p.render }} <span class="text-500">= {{ p.correct }}</span>` |

### 4.6 User Admin — Google provider guardrails

**File:** `angular-app/src/app/features/user-admin/user-admin.component.ts`

#### 4.6.1 Hide "Reset Password" button for Google-only users

In the table row actions, wrap the reset password button with a provider check:

```html
<!-- Before -->
<p-button icon="pi pi-key" [rounded]="true" [text]="true" size="small"
  severity="warning" pTooltip="Reset password"
  (onClick)="openResetPasswordDialog(s)"></p-button>

<!-- After -->
@if (s.auth_provider !== 'google') {
  <p-button icon="pi pi-key" [rounded]="true" [text]="true" size="small"
    severity="warning" pTooltip="Reset password"
    (onClick)="openResetPasswordDialog(s)"></p-button>
}
```

> **Logic:** `google`-only users have no local password — reset makes no sense. Users with `both` or `local` providers DO have a local password and can still have it reset.

#### 4.6.2 Disable email change for Google-only users

In the create/edit dialog, conditionally disable the email field when editing a Google-only user:

```html
<!-- Before -->
<label class="font-semibold">Email *</label>
<input pInputText [(ngModel)]="dialogEmail" class="w-full" type="email" />

<!-- After -->
<label class="font-semibold">Email *</label>
<input pInputText [(ngModel)]="dialogEmail" class="w-full" type="email"
  [disabled]="editingUser && editingUser.auth_provider === 'google'" />
@if (editingUser?.auth_provider === 'google') {
  <small class="text-500">Email cannot be changed for Google SSO accounts.</small>
}
```

> **Note:** `editingUser` is the user object being edited (null when creating). `auth_provider` must be available on the user objects returned by the users list endpoint.

### 4.7 User Guide rewrite

**File:** `angular-app/src/app/features/user-guide/user-guide.component.ts`

Complete rewrite of the template. New structure:

```html
<p-card header="User Guide">
  <div class="flex flex-column gap-4 line-height-3">

    <!-- 1. Introduction (all users) -->
    <section>
      <h3>Introduction</h3>
      <p>
        <strong>OpenMath</strong> is an interactive mathematics practice tool for primary
        school students. It provides timed quizzes across a wide range of arithmetic topics
        — from basic addition and multiplication to Roman numerals and unit conversions.
      </p>
    </section>

    <section>
      <h3>Purpose</h3>
      <p>
        OpenMath helps students build fluency and confidence in mental arithmetic through
        repeated, randomized practice. Teachers can monitor progress and provide feedback,
        while parents can review their child's work and sign off on completed sessions.
      </p>
    </section>

    <section>
      <h3>Core Features</h3>
      <ul>
        <li><strong>23 quiz types</strong> covering addition, subtraction, multiplication,
          division, Roman numerals, counting patterns, measurement conversions, and more.</li>
        <li><strong>3 difficulty levels</strong> — Low, Medium, Hard — controlling number
          ranges and complexity.</li>
        <li><strong>Timetable focus</strong> — quizzes adapt to which timetables a student
          has learned (configurable on your Profile).</li>
        <li><strong>Instant feedback</strong> — see whether each answer is correct
          immediately after submitting.</li>
        <li><strong>Session history</strong> — review past quizzes, scores, and individual
          questions.</li>
        <li><strong>Profile management</strong> — update your name, birthday, gender, and
          learned timetables.</li>
      </ul>
    </section>

    <section>
      <h3>Getting Started</h3>
      <ol>
        <li>Register with your email or sign in with Google on the Login page.</li>
        <li>Navigate to <strong>Start</strong> to begin a quiz.</li>
        <li>Choose a quiz type, difficulty level, and number of questions.</li>
        <li>Click <strong>Start Quiz</strong> to begin.</li>
      </ol>
      <p>
        <strong>Authentication:</strong> You can register with email + password (min 6
        characters) or use Google SSO. If you register locally and later sign in with
        Google using the same email, both methods are linked automatically. Your session
        stays active for 30 minutes and refreshes automatically.
      </p>
    </section>

    <!-- 2. Student section (all authenticated users can take quizzes) -->
    <section>
      <h3>Taking a Quiz</h3>
      <ul>
        <li>Each question is shown one at a time.</li>
        <li>Type your answer and press <strong>Enter</strong> or click <strong>Submit</strong>.</li>
        <li>You receive immediate feedback after each answer.</li>
        <li>Click <strong>Next</strong> to proceed to the next question.</li>
        <li>After the last question, you are taken to the session results page.</li>
        <li>In-progress sessions can be resumed from the <strong>History</strong> page.</li>
      </ul>
    </section>

    <section>
      <h3>Your Profile</h3>
      <p>
        On the <strong>Profile</strong> page you can update your name, birthday, gender,
        and which timetables you've learned. Your email and auth provider are shown as
        read-only. Age is computed from your birthday.
      </p>
    </section>

    <section>
      <h3>History</h3>
      <p>
        The <strong>History</strong> page shows your quiz sessions grouped by quiz type.
        Click a session to view the question-by-question results.
        In-progress sessions can be resumed by clicking the "In progress" link.
      </p>
    </section>

    <!-- 3. Teacher section -->
    @if (auth.isTeacher()) {
      <section>
        <h3>Teacher — My Students</h3>
        <p>
          The <strong>My Students</strong> page displays your assigned students in a
          sidebar list. Click a student to view their quiz sessions, scores, and review
          status.
        </p>
        <ul>
          <li><strong>Add a student:</strong> Click "Add Student" and enter the student's
            registered email address. The student must already have an account and the
            student role.</li>
          <li><strong>Remove a student:</strong> Click the remove button (×) next to the
            student's name in the sidebar.</li>
          <li><strong>Review a session:</strong> Click the eye icon on any session row to
            view the full question list, add a comment, and mark it as "Reviewed".</li>
          <li>Students can see your review comments and status on their own session
            history.</li>
        </ul>
      </section>
    }

    <!-- 4. Parent section -->
    @if (auth.isParent()) {
      <section>
        <h3>Parent — My Child</h3>
        <p>
          The <strong>My Child</strong> page shows your child's quiz sessions. If you
          have multiple children assigned, use the dropdown to switch between them.
        </p>
        <ul>
          <li><strong>Add a child:</strong> Click "Add Child" and enter your child's
            registered email address. A student can have at most 2 parents.</li>
          <li><strong>Remove a child:</strong> Click the remove button next to your
            child's name.</li>
          <li><strong>View sessions:</strong> See scores, difficulty, and the teacher's
            review status for each session.</li>
          <li><strong>Sign off:</strong> Click the eye icon to view the session detail,
            read the teacher's review, add an optional comment, and click "Sign Off".</li>
        </ul>
      </section>
    }

    <!-- 5. Admin section -->
    @if (auth.isAdmin()) {
      <section>
        <h3>Admin — User Management</h3>
        <p>
          The <strong>Users</strong> page lets you view all registered users, create
          new user accounts, reset passwords, and manage role assignments. Each user
          can have multiple roles: <em>student</em>, <em>teacher</em>, <em>parent</em>,
          and <em>admin</em>.
        </p>
        <ul>
          <li><strong>Create user:</strong> Provide name, email, password, and select
            one or more roles.</li>
          <li><strong>Edit user:</strong> Update name and roles. Email cannot be changed
            for Google SSO accounts.</li>
          <li><strong>Reset password:</strong> Available for local and dual-auth accounts
            only (not Google-only accounts).</li>
          <li><strong>Teacher-Student assignments:</strong> Navigate to the teacher/parent
            admin pages to manage class assignments.</li>
        </ul>
      </section>

      <section>
        <h3>Admin — Quiz Type Editor</h3>
        <p>
          The <strong>Quiz Types</strong> page lets you manage quiz type definitions.
          Toggle quiz types active/inactive, edit descriptions, preview generated
          questions, and verify rendering.
        </p>
      </section>

      <section>
        <h3>Admin — Database &amp; Statistics</h3>
        <ul>
          <li>The <strong>Admin</strong> page shows database statistics and allows browsing
            raw table data.</li>
          <li>Use "Delete All Data" (with confirmation) to reset all user and session data
            while keeping quiz type definitions.</li>
          <li>Admins can see all users' sessions in <strong>History</strong> and delete
            individual sessions.</li>
        </ul>
      </section>
    }

  </div>
</p-card>
```

**Key changes vs. current:**
- Added Introduction, Purpose, and Core Features sections (visible to all)
- Moved Getting Started and Authentication into one combined section
- Added Teacher section gated by `@if (auth.isTeacher())`
- Added Parent section gated by `@if (auth.isParent())`
- Expanded Admin section to cover Quiz Type Editor
- Updated quiz type count to 23 (was 2)
- Each role section explains what that role allows you to do

---

## 5. Implementation Steps

| # | Area | Task | Files |
|---|---|---|---|
| 1 | DB | Create migration `0011_max_parents_constraint.sql` | `db/migrations/` |
| 2 | DB | Create migration `0012_fix_quiz_descriptions.sql` | `db/migrations/` |
| 3 | DB | Update migration `0007`: change `→` to `=` in seed descriptions | `db/migrations/0007_quiz_type_editor.sql` |
| 4 | Backend | Add `require_teacher` / `require_parent` dependencies | `python-api/app/routers/auth.py` |
| 5 | Backend | Add `POST /teacher/students` (email-based self-association) | `python-api/app/routers/teacher.py` |
| 6 | Backend | Add `DELETE /teacher/students/{student_id}` | `python-api/app/routers/teacher.py` |
| 7 | Backend | Add `POST /parent/children` (email-based self-association) | `python-api/app/routers/parent.py` |
| 8 | Backend | Add `DELETE /parent/children/{child_id}` | `python-api/app/routers/parent.py` |
| 9 | Backend | Add query functions: `delete_teacher_student_by_pair`, `delete_parent_student_by_pair` | `python-api/app/queries.py` |
| 10 | Frontend | Teacher dashboard: add/remove student UI + dialog | `teacher-dashboard.component.ts` |
| 11 | Frontend | Parent dashboard: add/remove child UI + dialog | `parent-dashboard.component.ts` |
| 12 | Frontend | ApiService: 4 new methods (add/remove teacher student, add/remove parent child) | `api.service.ts` |
| 13 | Frontend | Header: roles as p-tag, email visible, provider background color, remove emoji | `header.component.ts` |
| 14 | Frontend | Header: nav link hover style (lightgray) | `header.component.ts` |
| 15 | Frontend | Arrow cleanup: `→` to `=` in quiz-type-editor + start component templates | 2 files |
| 16 | Frontend | User admin: hide reset password for Google users | `user-admin.component.ts` |
| 17 | Frontend | User admin: disable email for Google users | `user-admin.component.ts` |
| 18 | Frontend | User guide: full rewrite with role-based sections | `user-guide.component.ts` |
| 19 | Test | Apply migrations, verify max-parents trigger | manual |
| 20 | Test | End-to-end: teacher adds student by email, parent adds child by email | manual |

---

## 6. API Endpoint Summary

### New endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/teacher/students` | Teacher | Add student by email lookup |
| `DELETE` | `/teacher/students/{student_id}` | Teacher | Remove student from own class |
| `POST` | `/parent/children` | Parent | Add child by email lookup |
| `DELETE` | `/parent/children/{child_id}` | Parent | Remove child from own account |

### Existing endpoints (unchanged)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/teacher/students` | Teacher | List assigned students |
| `GET` | `/teacher/students/{id}/sessions` | Teacher | Student's sessions |
| `GET` | `/teacher/sessions/{id}` | Teacher | Session detail |
| `POST` | `/teacher/sessions/{id}/review` | Teacher | Submit review |
| `GET` | `/parent/children` | Parent | List assigned children |
| `GET` | `/parent/children/{id}/sessions` | Parent | Child's sessions |
| `GET` | `/parent/sessions/{id}` | Parent | Session detail |
| `POST` | `/parent/sessions/{id}/signoff` | Parent | Sign off session |

---

## 7. Data Protection Notes

**Email-based lookup rationale:** To associate a student, the teacher/parent must know the student's exact registered email address. This acts as a privacy gate:
- No user list or search is exposed to teacher/parent roles
- The endpoint only confirms "student found" or "not found" — no personal data is leaked on failure
- The student must already be registered and have the `student` role
- Teachers and parents can only manage their own associations (not other teachers'/parents')

**Max 2 parents constraint:** Enforced at the database level via a `BEFORE INSERT` trigger on `parent_students`. The FastAPI endpoint catches the exception and returns a clear 409 error message.
