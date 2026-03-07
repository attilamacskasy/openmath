# OpenMath v2.2.1 — Rename `students` Table to `users`

## Patch Summary

**Version:** 2.2.1  
**Scope:** Rename the `students` table to `users` across the entire stack — database, Python API, Angular frontend, Nuxt frontend, Python CLI app  
**Depends on:** v2.2 (includes migration 0008)  
**Migration:** `0009_rename_students_to_users.sql`  
**Breaking:** Yes — all three apps must be restarted after applying the migration

> **Why:** The `students` table has served as the de-facto users table since auth was added in v2.1. Renaming it to `users` eliminates the semantic mismatch before v2.3 adds multi-role RBAC (teacher, parent roles make "students" misleading).

---

## 1. Database Migration — `0009_rename_students_to_users.sql`

### 1.1 Rename table

```sql
ALTER TABLE students RENAME TO users;
```

### 1.2 Rename FK column in `quiz_sessions`

```sql
ALTER TABLE quiz_sessions RENAME COLUMN student_id TO user_id;
```

### 1.3 Rename constraints

```sql
-- CHECK constraints on users table (from migration 0004)
ALTER TABLE users RENAME CONSTRAINT students_age_check TO users_age_check;
ALTER TABLE users RENAME CONSTRAINT students_gender_check TO users_gender_check;

-- FK constraint on quiz_sessions referencing users
ALTER TABLE quiz_sessions RENAME CONSTRAINT quiz_sessions_student_id_fkey TO quiz_sessions_user_id_fkey;
```

### 1.4 Rename indexes

```sql
-- Index on quiz_sessions.user_id (was student_id, from migration 0005)
ALTER INDEX idx_sessions_student RENAME TO idx_sessions_user;

-- Indexes on users table (from migration 0006)
ALTER INDEX idx_students_email RENAME TO idx_users_email;
ALTER INDEX idx_students_google_sub RENAME TO idx_users_google_sub;
ALTER INDEX idx_students_role RENAME TO idx_users_role;
```

### 1.5 Full migration file

```sql
-- Migration 0009: Rename students table to users
-- This is a preparatory step for v2.3 multi-role RBAC

BEGIN;

-- 1. Rename the table
ALTER TABLE students RENAME TO users;

-- 2. Rename FK column
ALTER TABLE quiz_sessions RENAME COLUMN student_id TO user_id;

-- 3. Rename constraints
ALTER TABLE users RENAME CONSTRAINT students_age_check TO users_age_check;
ALTER TABLE users RENAME CONSTRAINT students_gender_check TO users_gender_check;
ALTER TABLE quiz_sessions RENAME CONSTRAINT quiz_sessions_student_id_fkey TO quiz_sessions_user_id_fkey;

-- 4. Rename indexes
ALTER INDEX idx_sessions_student RENAME TO idx_sessions_user;
ALTER INDEX idx_students_email RENAME TO idx_users_email;
ALTER INDEX idx_students_google_sub RENAME TO idx_users_google_sub;
ALTER INDEX idx_students_role RENAME TO idx_users_role;

COMMIT;
```

### 1.6 Verify after migration

```sql
-- Should show 'users' table, not 'students'
\dt users

-- FK should reference users(id)
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname = 'quiz_sessions_user_id_fkey';

-- Indexes should exist
SELECT indexname FROM pg_indexes WHERE tablename = 'users';
SELECT indexname FROM pg_indexes WHERE tablename = 'quiz_sessions' AND indexname = 'idx_sessions_user';
```

---

## 2. Python API (`python-api/app/`)

### 2.1 File renames

| Old path | New path |
|---|---|
| `app/routers/students.py` | `app/routers/users.py` |
| `app/schemas/student.py` | `app/schemas/user.py` |

### 2.2 `app/main.py`

| Line | Old | New |
|---|---|---|
| Import | `from app.routers import answers, auth, quiz_types, sessions, stats, students` | `from app.routers import answers, auth, quiz_types, sessions, stats, users` |
| Router registration | `app.include_router(students.router, prefix="/api")` | `app.include_router(users.router, prefix="/api")` |

### 2.3 `app/queries.py` — Function renames

| Old function name | New function name |
|---|---|
| `list_students()` | `list_users()` |
| `get_student_profile(student_id)` | `get_user_profile(user_id)` |
| `get_student_performance_stats(student_id)` | `get_user_performance_stats(user_id)` |
| `update_student_profile(student_id, ...)` | `update_user_profile(user_id, ...)` |
| `find_student_by_email(email)` | `find_user_by_email(email)` |
| `find_student_by_google_sub(google_sub)` | `find_user_by_google_sub(google_sub)` |
| `find_student_by_id(user_id)` | `find_user_by_id(user_id)` |
| `create_student_with_auth(...)` | `create_user_with_auth(...)` |
| `update_student_google_link(...)` | `update_user_google_link(...)` |
| `update_student_password(...)` | `update_user_password(...)` |
| `list_students_admin()` | `list_users_admin()` |
| `update_student_profile_v2(...)` | `update_user_profile_v2(...)` |
| `list_sessions_for_student(student_id)` | `list_sessions_for_user(user_id)` |

### 2.4 `app/queries.py` — SQL string changes

Every SQL query referencing the old table/column names:

| Old SQL fragment | New SQL fragment |
|---|---|
| `FROM students` | `FROM users` |
| `INSERT INTO students` | `INSERT INTO users` |
| `UPDATE students` | `UPDATE users` |
| `LEFT JOIN students` | `LEFT JOIN users` |
| `JOIN students` | `JOIN users` |
| `students.id` | `users.id` |
| `students.name` | `users.name` |
| `quiz_sessions.student_id` | `quiz_sessions.user_id` |
| `s.student_id` (alias for quiz_sessions) | `s.user_id` |
| `$1` parameter named `student_id` | `$1` parameter named `user_id` |

### 2.5 `app/queries.py` — Parameter & variable renames

| Old | New |
|---|---|
| `student_id` (parameter) | `user_id` |
| `resolved_student_id` | `resolved_user_id` |
| `student_name` (variable) | `user_name` |

### 2.6 `app/queries.py` — `STATS_TABLE_NAMES` constant

```python
# Old
STATS_TABLE_NAMES = {"quiz_types", "quiz_sessions", "questions", "answers", "students"}

# New
STATS_TABLE_NAMES = {"quiz_types", "quiz_sessions", "questions", "answers", "users"}
```

### 2.7 `app/queries.py` — Reset function

The `reset_all_data()` function deletes from students/users table:

```python
# Old
DELETE FROM students

# New
DELETE FROM users
```

### 2.8 `app/routers/users.py` (was `students.py`)

| Item | Old | New |
|---|---|---|
| Router tag | `tags=["students"]` | `tags=["users"]` |
| Route paths | `"/students"`, `"/students/{student_id}"`, `"/students/{student_id}/reset-password"` | `"/users"`, `"/users/{user_id}"`, `"/users/{user_id}/reset-password"` |
| Function names | `get_students()` | `get_users()` |
| | `get_student(student_id)` | `get_user(user_id)` |
| | `patch_student(student_id)` | `patch_user(user_id)` |
| | `create_student(body)` | `create_user(body)` |
| | `reset_student_password(student_id)` | `reset_user_password(user_id)` |
| Path params | `student_id: str` | `user_id: str` |
| Docstrings | `"""List all students."""` | `"""List all users."""` |
| | `"""Admin resets a student's password."""` | `"""Admin resets a user's password."""` |
| Imports from queries | `list_students` → `list_users`, etc. (all function renames from §2.3) |
| Imports from schemas | `StudentListItem` → `UserListItem`, etc. (see §2.9) |
| Variable names | `student = await ...` | `user = await ...` |
| Dict access | `student["id"]`, `student["name"]`, `student.get("email")` | `user["id"]`, `user["name"]`, `user.get("email")` |

### 2.9 `app/schemas/user.py` (was `student.py`)

| Old class name | New class name |
|---|---|
| `StudentListItem` | `UserListItem` |
| `StudentPerformanceStats` | `UserPerformanceStats` |
| `StudentProfileOut` | `UserProfileOut` |
| `UpdateStudentRequest` | `UpdateUserRequest` |
| `StudentOut` | `UserOut` |

Update docstring:
```python
# Old: """Pydantic schemas for students."""
# New: """Pydantic schemas for users."""
```

Update field type references:
```python
# Old: stats: StudentPerformanceStats
# New: stats: UserPerformanceStats
```

### 2.10 `app/schemas/auth.py`

| Old | New |
|---|---|
| `class AdminCreateStudentRequest` | `class AdminCreateUserRequest` |

> **Note:** The `role` field default value `"student"` and the regex pattern `^(student|admin)$` stay as-is — `student` is a role name, not a table reference.

### 2.11 `app/schemas/session.py`

The `CreateSessionRequest` schema fields and their JSON aliases:

| Old field | New field | Alias change |
|---|---|---|
| `studentId` | `userId` | `alias="userId"` |
| `studentName` | `userName` | `alias="userName"` |
| `studentAge` | `userAge` | `alias="userAge"` |
| `studentGender` | `userGender` | `alias="userGender"` |

The `SessionListItem` and `SessionDetailOut` / `SessionEntry` response schemas:

| Old field | New field |
|---|---|
| `student_id` | `user_id` |
| `student_name` | `user_name` |
| `studentId` | `userId` |
| `studentName` | `userName` |

### 2.12 `app/schemas/stats.py`

| Old field | New field |
|---|---|
| `students: int` | `users: int` |

### 2.13 `app/routers/auth.py`

#### Import changes

| Old import | New import |
|---|---|
| `create_student_with_auth` | `create_user_with_auth` |
| `find_student_by_email` | `find_user_by_email` |
| `find_student_by_google_sub` | `find_user_by_google_sub` |
| `find_student_by_id` | `find_user_by_id` |
| `update_student_google_link` | `update_user_google_link` |
| `AdminCreateStudentRequest` | `AdminCreateUserRequest` |

#### Function renames

| Old | New |
|---|---|
| `_build_auth_user(student: dict)` | `_build_auth_user(user: dict)` |
| `_build_tokens(student: dict)` | `_build_tokens(user: dict)` |

#### Variable renames throughout

All local variables named `student` → `user_record` (to avoid shadowing the `user` dict from auth dependencies):

```python
# Old
student = await find_student_by_email(body.email)
if not student or not student.get("password_hash"):

# New
user_record = await find_user_by_email(body.email)
if not user_record or not user_record.get("password_hash"):
```

> **Note:** Use `user_record` (not `user`) because `user` is already used as a dependency-injected variable in FastAPI routes.

#### Role value `"student"` — NO CHANGE

The string literal `role="student"` in registration/Google flow stays as-is. It's a role name.

### 2.14 `app/routers/sessions.py`

| Item | Old | New |
|---|---|---|
| Import | `list_sessions_for_student` | `list_sessions_for_user` |
| Function call | `await list_sessions_for_student(user["sub"], ...)` | `await list_sessions_for_user(user["sub"], ...)` |
| Dict key check | `s.get("student_id", "")` | `s.get("user_id", "")` |
| Keyword args | `student_id=body.studentId` | `user_id=body.userId` |
| | `student_name=body.studentName` | `user_name=body.userName` |
| | `student_age=body.studentAge` | `user_age=body.userAge` |
| | `student_gender=body.studentGender` | `user_gender=body.userGender` |
| Comments | `# Students see only own sessions` | `# Non-admin users see only own sessions` |
| | `# Students can only access own sessions` | `# Non-admin users can only access own sessions` |

### 2.15 `app/services/stats.py`

```python
# Old docstring
"""Student performance statistics aggregation."""

# New docstring
"""User performance statistics aggregation."""
```

### 2.16 `app/services/grader.py` — NO CHANGE

The variables named `student` and `student_str` in the grader refer to the student's answer (the response given), not the database entity. These should remain as-is — they describe the answer source, not the user record.

---

## 3. Angular Frontend (`angular-app/src/app/`)

### 3.1 File/directory renames

| Old path | New path |
|---|---|
| `models/student.model.ts` | `models/user.model.ts` |
| `features/student-admin/student-admin.component.ts` | `features/user-admin/user-admin.component.ts` |

### 3.2 `models/user.model.ts` (was `student.model.ts`)

| Old interface | New interface |
|---|---|
| `StudentListItem` | `UserListItem` |
| `StudentPerformanceStats` | `UserPerformanceStats` |
| `StudentProfile` | `UserProfile` |
| `UpdateStudentRequest` | `UpdateUserRequest` |

Update type reference within `UserProfile`:
```typescript
// Old: stats: StudentPerformanceStats
// New: stats: UserPerformanceStats
```

### 3.3 `models/auth.model.ts`

| Old | New |
|---|---|
| `AdminCreateStudentRequest` | `AdminCreateUserRequest` |

> The `role: 'student' | 'admin'` type literal stays as-is — it's a role value.

### 3.4 `models/session.model.ts`

All schema fields in `CreateSessionRequest`, `SessionListItem`, `SessionDetailEntry`, etc.:

| Old field | New field |
|---|---|
| `studentId` | `userId` |
| `studentName` | `userName` |
| `studentAge` | `userAge` |
| `studentGender` | `userGender` |
| `student_id` | `user_id` |
| `student_name` | `user_name` |

### 3.5 `models/stats.model.ts`

```typescript
// Old: students: number;
// New: users: number;
```

### 3.6 `core/services/api.service.ts`

#### Import path change

```typescript
// Old
import { StudentListItem, StudentProfile, UpdateStudentRequest } from '../../models/student.model';
import { AdminCreateStudentRequest } from '../../models/auth.model';

// New
import { UserListItem, UserProfile, UpdateUserRequest } from '../../models/user.model';
import { AdminCreateUserRequest } from '../../models/auth.model';
```

#### Method renames + API path changes

| Old method | New method | Old API path | New API path |
|---|---|---|---|
| `getStudents()` | `getUsers()` | `/students` | `/users` |
| `getStudent(id)` | `getUser(id)` | `/students/${id}` | `/users/${id}` |
| `updateStudent(id, payload)` | `updateUser(id, payload)` | `/students/${id}` | `/users/${id}` |
| `createStudent(payload)` | `createUser(payload)` | `/students` | `/users` |
| `resetStudentPassword(id, pw)` | `resetUserPassword(id, pw)` | `/students/${id}/reset-password` | `/users/${id}/reset-password` |

#### Return type changes

```typescript
// Old
getStudents(): Observable<StudentListItem[]>
getStudent(id: string): Observable<StudentProfile>
updateStudent(id: string, payload: UpdateStudentRequest): Observable<any>
createStudent(payload: AdminCreateStudentRequest): Observable<any>
resetStudentPassword(studentId: string, password: string): Observable<any>

// New
getUsers(): Observable<UserListItem[]>
getUser(id: string): Observable<UserProfile>
updateUser(id: string, payload: UpdateUserRequest): Observable<any>
createUser(payload: AdminCreateUserRequest): Observable<any>
resetUserPassword(userId: string, password: string): Observable<any>
```

#### Section comment

```typescript
// Old: // ── Students ─────────────────
// New: // ── Users ─────────────────
```

### 3.7 `core/services/quiz.service.ts`

| Old | New |
|---|---|
| Import `StudentListItem` from `student.model` | Import `UserListItem` from `user.model` |
| `_currentStudentId` | `_currentUserId` |
| `_studentsDirectory` | `_usersDirectory` |
| `currentStudentId` (readonly signal) | `currentUserId` |
| `studentsDirectory` (readonly signal) | `usersDirectory` |
| `currentStudent` (computed) | `currentUser` |
| `setCurrentStudent(id)` | `setCurrentUser(id)` |
| `setStudentsDirectory(students)` | `setUsersDirectory(users)` |
| `refreshStudents()` | `refreshUsers()` |
| `this.api.getStudents()` | `this.api.getUsers()` |
| Signal type `StudentListItem[]` | `UserListItem[]` |

### 3.8 `features/user-admin/user-admin.component.ts` (was `student-admin`)

| Item | Old | New |
|---|---|---|
| Interface | `StudentRow` | `UserRow` |
| Selector | `'app-student-admin'` | `'app-user-admin'` |
| Class name | `StudentAdminComponent` | `UserAdminComponent` |
| UI heading | `Student Administration` | `User Administration` |
| Button label | `New Student` | `New User` |
| Dialog headers | `Edit Student` / `Create Student` | `Edit User` / `Create User` |
| Empty state | `No students found.` | `No users found.` |
| Toast messages | `Student updated`, `Failed to update student`, `Student account created`, `Failed to create student` | `User updated`, `Failed to update user`, `User account created`, `Failed to create user` |
| Signal | `students = signal<StudentRow[]>([])` | `users = signal<UserRow[]>([])` |
| Property | `editingStudent` | `editingUser` |
| Property | `resetPwStudentId` | `resetPwUserId` |
| Property | `resetPwStudentName` | `resetPwUserName` |
| Method | `loadStudents()` | `loadUsers()` |
| Method | `editStudent(s)` | `editUser(s)` |
| Method | `saveStudent()` | `saveUser()` |
| Method | `openResetPasswordDialog(s)` | `openResetPasswordDialog(s)` (keep name, update internals) |
| API calls | `this.api.getStudents()` | `this.api.getUsers()` |
| | `this.api.updateStudent(...)` | `this.api.updateUser(...)` |
| | `this.api.createStudent(...)` | `this.api.createUser(...)` |
| | `this.api.resetStudentPassword(...)` | `this.api.resetUserPassword(...)` |
| Role dropdown | `{ label: 'Student', value: 'student' }` | Keep as-is (role value) |

### 3.9 `features/start/start.component.ts`

| Old | New |
|---|---|
| Comment `<!-- Logged-in student info -->` | `<!-- Logged-in user info -->` |
| `studentAge` computed signal | `userAge` |
| `studentId: user?.id` (in request body) | `userId: user?.id` |

### 3.10 `features/profile/profile.component.ts`

| Old | New |
|---|---|
| Import `StudentProfile` from `student.model` | Import `UserProfile` from `user.model` |
| `profile = signal<StudentProfile \| null>(null)` | `profile = signal<UserProfile \| null>(null)` |
| `this.api.getStudent(user.id)` | `this.api.getUser(user.id)` |
| `this.api.updateStudent(user.id, ...)` | `this.api.updateUser(user.id, ...)` |
| Comment `// Load /students/:id for profile` | `// Load /users/:id for profile` |

### 3.11 `features/admin/admin.component.ts`

| Old | New |
|---|---|
| `{ label: 'Students', value: 'students' }` | `{ label: 'Users', value: 'users' }` |
| `{ label: 'Students', count: s.students }` | `{ label: 'Users', count: s.users }` |
| UI text: `ALL student and session data` | `ALL user and session data` |

### 3.12 `features/history/history-list.component.ts`

| Old | New |
|---|---|
| `<th>Student</th>` | `<th>User</th>` |
| `{{ s.student_name \|\| '—' }}` | `{{ s.user_name \|\| '—' }}` |

### 3.13 `features/history/session-detail.component.ts`

| Old | New |
|---|---|
| `<div>Student</div>` | `<div>User</div>` |
| `{{ detail()!.session.studentName }}` | `{{ detail()!.session.userName }}` |

### 3.14 `features/user-guide/user-guide.component.ts`

Update all UI text strings:

| Old text | New text |
|---|---|
| `Admin — Student Management` | `Admin — User Management` |
| `The Students page lets you view all registered students, create` | `The Users page lets you view all registered users, create` |
| `new student accounts with email/password` | `new user accounts with email/password` |
| `roles (student or admin)` | Keep as-is (role name) |
| `reset all student and session data` | `reset all user and session data` |
| `Admins can see all students' sessions` | `Admins can see all users' sessions` |

### 3.15 `shared/components/header/header.component.ts`

```html
<!-- Old -->
<a routerLink="/students" ...>Students</a>

<!-- New -->
<a routerLink="/users" ...>Users</a>
```

### 3.16 `app.routes.ts`

```typescript
// Old
{ path: 'students', loadComponent: () => import('./features/student-admin/student-admin.component')
    .then(m => m.StudentAdminComponent), ... }

// New
{ path: 'users', loadComponent: () => import('./features/user-admin/user-admin.component')
    .then(m => m.UserAdminComponent), ... }
```

Comment update:
```typescript
// Old: // Student routes (authenticated)
// New: // User management routes (authenticated)
```

---

## 4. Nuxt Frontend (`nuxt-app/`)

### 4.1 File renames

| Old path | New path |
|---|---|
| `server/api/students.get.ts` | `server/api/users.get.ts` |
| `server/api/students/[id].get.ts` | `server/api/users/[id].get.ts` |
| `server/api/students/[id].patch.ts` | `server/api/users/[id].patch.ts` |

### 4.2 `layers/db/server/db/schema.ts`

```typescript
// Old
export const students = pgTable("students", { ... });
// column: check("students_age_check", ...), check("students_gender_check", ...)
// FK: studentId: uuid("student_id").references(() => students.id, ...)

// New
export const users = pgTable("users", { ... });
// column: check("users_age_check", ...), check("users_gender_check", ...)
// FK: userId: uuid("user_id").references(() => users.id, ...)
```

### 4.3 `layers/db/server/db/queries.ts`

| Old | New |
|---|---|
| Import `students` from schema | Import `users` from schema |
| `listStudents()` | `listUsers()` |
| `getStudentProfile()` | `getUserProfile()` |
| `getStudentPerformanceStats()` | `getUserPerformanceStats()` |
| `updateStudentProfile()` | `updateUserProfile()` |
| Type `StudentPerformanceBucket` | `UserPerformanceBucket` |
| Variable `studentId` | `userId` |
| Variable `existingStudent` | `existingUser` |
| Variable `insertedStudents` | `insertedUsers` |
| All Drizzle refs to `students` table | Refs to `users` table |
| All Drizzle refs to `students.id`, `students.name` | `users.id`, `users.name` |
| Column ref `quizSessions.studentId` | `quizSessions.userId` |

### 4.4 `server/api/users.get.ts` (was `students.get.ts`)

| Old | New |
|---|---|
| Import `listStudents` | Import `listUsers` |
| Call `listStudents()` | Call `listUsers()` |
| Variable `students` | Variable `users` |

### 4.5 `server/api/users/[id].get.ts` (was `students/[id].get.ts`)

| Old | New |
|---|---|
| Import `getStudentProfile`, `getStudentPerformanceStats` | Import `getUserProfile`, `getUserPerformanceStats` |
| Variable `student` | Variable `user` |
| Error message `Student not found` | `User not found` |
| Error message `Student id is required` | `User id is required` |

### 4.6 `server/api/users/[id].patch.ts` (was `students/[id].patch.ts`)

| Old | New |
|---|---|
| Import `updateStudentProfile` | Import `updateUserProfile` |
| Call `updateStudentProfile(...)` | Call `updateUserProfile(...)` |

### 4.7 `server/api/sessions.post.ts` + `sessions.get.ts`

| Old Zod field | New Zod field |
|---|---|
| `studentId` | `userId` |
| `studentName` | `userName` |
| `studentAge` | `userAge` |
| `studentGender` | `userGender` |
| Response mapping `student_id` | `user_id` |
| Response mapping `student_name` | `user_name` |

### 4.8 `app/composables/useApi.ts`

| Old | New |
|---|---|
| `listStudents()` | `listUsers()` |
| `getStudentProfile(id)` | `getUserProfile(id)` |
| `updateStudentProfile(id, ...)` | `updateUserProfile(id, ...)` |
| API path `/api/students` | `/api/users` |
| Type fields `studentId`, `studentName`, `studentAge`, `studentGender` | `userId`, `userName`, `userAge`, `userGender` |
| Type fields `student_id`, `student_name` | `user_id`, `user_name` |

### 4.9 `app/app.vue`

| Old | New |
|---|---|
| State `currentStudentId` | `currentUserId` |
| State `studentsDirectory` | `usersDirectory` |
| Call `api.listStudents()` | `api.listUsers()` |
| CSS class `student-select`, `student-label` | `user-select`, `user-label` |
| Text `No student` | `No user` |
| Iteration `v-for="student in studentsDirectory"` | `v-for="user in usersDirectory"` |

### 4.10 Nuxt pages

Apply the same field renames (`studentId` → `userId`, `student_name` → `user_name`, `currentStudentId` → `currentUserId`, etc.) consistently across:

- `app/pages/index.vue`
- `app/pages/profile.vue`
- `app/pages/database-stats.vue`
- `app/pages/user-guide.vue`
- `app/pages/history/index.vue`
- `app/pages/history/[sessionId].vue`
- `app/pages/quiz/[sessionId].vue`

---

## 5. Python CLI App (`python-app/src/`)

### 5.1 `src/app_types.py`

| Old | New |
|---|---|
| `StudentGender` type alias | Keep as-is (describes quiz-taker's gender, not table name) |
| `active_student_id: str \| None` | `active_user_id: str \| None` |

### 5.2 `src/repositories.py`

#### Function renames

| Old | New |
|---|---|
| `list_students()` | `list_users()` |
| `get_student_profile(student_id)` | `get_user_profile(user_id)` |
| `update_student_profile(student_id, ...)` | `update_user_profile(user_id, ...)` |
| `create_student(...)` | `create_user(...)` |
| `get_student_sessions_for_stats(student_id)` | `get_user_sessions_for_stats(user_id)` |

#### SQL changes

| Old | New |
|---|---|
| `FROM students` | `FROM users` |
| `INSERT INTO students` | `INSERT INTO users` |
| `UPDATE students` | `UPDATE users` |
| `students.id`, `students.name` | `users.id`, `users.name` |
| `quiz_sessions.student_id` | `quiz_sessions.user_id` |
| `student_id` parameter/variable | `user_id` |
| `student_name` alias | `user_name` |

### 5.3 `src/services.py`

| Old | New |
|---|---|
| Parameter `student_id` | `user_id` |
| Parameter `student_name` | `user_name` |
| Parameter `student_age` | `user_age` |
| Parameter `student_gender` | `user_gender` |
| Variable `resolved_student_id` | `resolved_user_id` |
| Variable `existing_student` | `existing_user` |
| Dict key `"student_id"` / `"studentId"` | `"user_id"` / `"userId"` |
| Dict key `"studentName"` / `"student_name"` | `"userName"` / `"user_name"` |
| Function `get_student_performance_stats(student_id)` | `get_user_performance_stats(user_id)` |

### 5.4 `src/main.py`

| Old | New |
|---|---|
| `get_active_student_display()` | `get_active_user_display()` |
| `active_student_menu()` | `active_user_menu()` |
| Property access `active_student_id` | `active_user_id` |
| Variables `student_id`, `student_name`, `student_age`, `student_gender` | `user_id`, `user_name`, `user_age`, `user_gender` |
| Variable `active_student_display` | `active_user_display` |
| UI strings containing "student" | Update to "user" (where referring to the user entity, not the role) |

> **Note:** UI strings like "Select student" in the CLI may keep "student" if the app is specifically for students taking quizzes. Use judgment — if the CLI is student-facing only, the UI can say "student". The code identifiers (variables, functions) must change.

---

## 6. Spec & Config Files

### 6.1 Files to update

| File | Action |
|---|---|
| `openmath_v2.3_advanced_rbac_spec.md` | Replace all `students` table references with `users` (separate task) |
| `multiproject_repo_spec.md` | Update table references if any |
| `TECH_STACK_AND_FOLDER_STRUCTURE.md` | Update folder/file references if any |

### 6.2 Seed data files

Check `db/seeds/` for any references to `students` table and update to `users`.

---

## 7. What NOT to Rename

These items contain "student" but should NOT be changed:

| Item | Reason |
|---|---|
| Role value `"student"` | It's a role name, stays as-is |
| Role value `"admin"` | Not affected |
| `grader.py` variables (`student`, `student_str`, `student_vals`) | Refers to the student's answer input, not the DB entity |
| `{ label: 'Student', value: 'student' }` in role dropdowns | Role label/value |
| `role: 'student' \| 'admin'` in TypeScript types | Role type literal |
| `pattern=r"^(student\|admin)$"` in Pydantic | Role validation regex |
| `StudentGender` type alias in python-app | Describes quiz-taker demographic, could keep as conceptual name |

---

## 8. Implementation Order

| Step | Action | Risk |
|---|---|---|
| 1 | **Stop all apps** | — |
| 2 | **Apply migration** `0009_rename_students_to_users.sql` | Low — pure DDL rename |
| 3 | **Backend: rename files** `students.py` → `users.py`, `student.py` → `user.py` | Medium — import paths break |
| 4 | **Backend: update `queries.py`** — function names, SQL, parameters | High — most references |
| 5 | **Backend: update `schemas/`** — class names, field names | Medium |
| 6 | **Backend: update `routers/`** — `users.py`, `auth.py`, `sessions.py` | Medium |
| 7 | **Backend: update `main.py`** — import + router registration | Low |
| 8 | **Backend: update `services/`** — docstrings | Low |
| 9 | **Test backend** — start FastAPI, hit all endpoints | — |
| 10 | **Angular: rename files** `student.model.ts` → `user.model.ts`, `student-admin/` → `user-admin/` | Medium |
| 11 | **Angular: update models** — interface names, field names | Medium |
| 12 | **Angular: update services** — `api.service.ts`, `quiz.service.ts` | Medium |
| 13 | **Angular: update components** — all features | High — many files |
| 14 | **Angular: update routes + header** | Low |
| 15 | **Test Angular** — build + manual test all routes | — |
| 16 | **Nuxt: rename files** + update all references | Medium |
| 17 | **Python CLI: update all references** | Medium |
| 18 | **Test all apps end-to-end** | — |

---

## 9. Verification Checklist

### Database

- [ ] `\dt users` shows the renamed table
- [ ] `\dt students` returns nothing
- [ ] `\d quiz_sessions` shows `user_id` column (not `student_id`)
- [ ] All indexes exist with new names
- [ ] All constraints exist with new names
- [ ] FK `quiz_sessions.user_id → users.id` works

### Backend (Python API)

- [ ] `GET /api/users` returns user list
- [ ] `GET /api/users/{id}` returns user profile
- [ ] `PATCH /api/users/{id}` updates user
- [ ] `POST /api/users` creates user (admin)
- [ ] `POST /api/users/{id}/reset-password` works
- [ ] `POST /api/auth/register` creates user in `users` table
- [ ] `POST /api/auth/login` finds user in `users` table
- [ ] `POST /api/auth/google` finds/creates user in `users` table
- [ ] `GET /api/sessions` returns sessions with `user_id`/`user_name`
- [ ] `POST /api/sessions` accepts `userId`/`userName` fields
- [ ] `GET /api/stats` returns `users` count
- [ ] `POST /api/stats/reset` clears `users` table
- [ ] No Python import errors on startup
- [ ] Swagger docs show `/users` paths (not `/students`)

### Angular

- [ ] App compiles without errors (`ng build`)
- [ ] `/users` route loads User Admin page
- [ ] Profile page loads via `GET /api/users/{id}`
- [ ] Start page sends `userId` in session creation
- [ ] History shows `user_name` column
- [ ] Admin dashboard shows "Users" in table selector
- [ ] Header nav shows "Users" link (admin only)

### Nuxt

- [ ] App builds without errors
- [ ] `/api/users` endpoint works
- [ ] All pages render correctly with new field names

### Python CLI

- [ ] App starts without import errors
- [ ] User selection/creation works against `users` table
- [ ] Quiz sessions record `user_id`
