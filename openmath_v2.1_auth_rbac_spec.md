# OpenMath v2.1 — Authentication & RBAC Specification

**Status:** Draft (March 2026)  
**Depends on:** OpenMath v2.0 (Angular 18 + FastAPI + PrimeNG + PostgreSQL)  
**Scope:** Authentication, Role-Based Access Control, Student Admin, schema evolution

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope Summary](#2-scope-summary)
3. [Authentication Model](#3-authentication-model)
4. [Google SSO Integration](#4-google-sso-integration)
5. [Role-Based Access Control](#5-role-based-access-control)
6. [Schema Changes](#6-schema-changes)
7. [API Changes](#7-api-changes)
8. [Frontend Changes](#8-frontend-changes)
9. [Login Flow UX](#9-login-flow-ux)
10. [Student Admin Page](#10-student-admin-page)
11. [Session History Changes](#11-session-history-changes)
12. [Migration Strategy](#12-migration-strategy)
13. [Security Considerations](#13-security-considerations)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Future Scope — v2.5 Ideas](#15-future-scope--v25-ideas)

---

## 1. Purpose

OpenMath v2.0 has no authentication — anyone can access any page, edit any student, or reset the database. v2.1 introduces:

1. **Login-gated access** — students must authenticate before using the application
2. **Two authentication methods** — local password and Google SSO (OAuth 2.0)
3. **Role-based access control (RBAC)** — `student` and `admin` roles with distinct permissions
4. **Student administration** — admins can browse, create, and manage all student accounts
5. **Profile evolution** — email field, birthday (replacing manual age), password hash storage

This spec defines the complete authentication and authorization layer for the Angular + FastAPI stack.

---

## 2. Scope Summary

### In Scope (v2.1)

| Feature | Description |
|---------|-------------|
| Local login | Email + password authentication with bcrypt-hashed passwords |
| Google SSO | OAuth 2.0 / OpenID Connect via Google, mapped to students table |
| JWT tokens | Stateless session management via access + refresh tokens |
| RBAC | Two roles: `student` (limited) and `admin` (full access) |
| Login page | Gated entry point — no anonymous access to app features |
| Student Admin | Admin-only page to list, create, edit, and manage student accounts |
| Profile evolution | Email column, birthday (auto-calculated age), password hash |
| Session delete | Admin can delete sessions with cascade to questions + answers |

### Out of Scope (deferred to v2.5)

| Feature | Reference |
|---------|-----------|
| Quiz Type Editor | §15.1 |
| Incentive System / Badges / Leaderboard | §15.2 |

---

## 3. Authentication Model

### 3.1 Dual Authentication Strategy

OpenMath v2.1 supports two authentication methods that coexist:

| Method | How it works | Who uses it |
|--------|-------------|-------------|
| **Local** | Student registers with email + password. Password stored as bcrypt hash in `students.password_hash`. | Students without Google accounts, younger kids with parent-created accounts |
| **Google SSO** | Student clicks "Sign in with Google". Google returns identity token. Backend maps Google email to `students.email`. | Students with Google/Gmail accounts, teachers, admins |

Both methods produce the same result: a **JWT access token** that identifies the student and their role.

### 3.2 JWT Token Structure

**Access token** (short-lived, 30 minutes):

```json
{
  "sub": "student-uuid",
  "email": "anna@example.com",
  "name": "Anna",
  "role": "student",
  "iat": 1741234567,
  "exp": 1741236367
}
```

**Refresh token** (long-lived, 7 days):

```json
{
  "sub": "student-uuid",
  "type": "refresh",
  "iat": 1741234567,
  "exp": 1741839367
}
```

### 3.3 Token Flow

```
                    ┌──────────────┐
                    │  Login Page   │
                    │  (Angular)    │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     Local Login                 Google SSO
     (email + pw)              (OAuth redirect)
              │                         │
              ▼                         ▼
     POST /api/auth/login      POST /api/auth/google
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼───────┐
                    │  FastAPI      │
                    │  Returns:    │
                    │  access_token │
                    │  refresh_token│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Angular      │
                    │  Stores in    │
                    │  localStorage │
                    │  Sets header  │
                    │  Authorization│
                    └──────────────┘
```

### 3.4 Password Hashing

- Algorithm: **bcrypt** via Python's `passlib` library
- Work factor: 12 rounds (default)
- Passwords are **never stored in plain text**
- Minimum password length: 6 characters
- No complexity requirements (target audience is children / parents)

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash on registration
hashed = pwd_context.hash("student_password")

# Verify on login
is_valid = pwd_context.verify("student_password", stored_hash)
```

---

## 4. Google SSO Integration

### 4.1 How Google OAuth 2.0 / OpenID Connect Works

Google SSO uses the **OAuth 2.0 Authorization Code flow with PKCE** (recommended for SPAs):

```
┌──────────┐     1. Click "Sign in with Google"      ┌──────────────┐
│  Angular  │ ──────────────────────────────────────► │ Google OAuth  │
│  (SPA)    │                                         │ Consent Screen│
└──────────┘                                          └──────┬───────┘
                                                             │
     ◄───────────── 2. User authenticates with Google ───────┘
                     Grants consent (email, profile)
                                                             │
┌──────────┐     3. Google redirects back with               │
│  Angular  │ ◄── authorization code ────────────────────────┘
│  (SPA)    │
└─────┬────┘
      │
      │  4. Send code to backend
      ▼
┌──────────┐     5. Exchange code for tokens          ┌──────────────┐
│  FastAPI  │ ──────────────────────────────────────► │ Google Token  │
│  Backend  │                                         │ Endpoint      │
└─────┬────┘ ◄── 6. Receive id_token + access_token ─┘
      │
      │  7. Decode id_token → get email, name, picture
      │  8. Find or create student by email
      │  9. Issue OpenMath JWT tokens
      ▼
┌──────────┐
│  Angular  │ ◄── 10. Return access_token + refresh_token
│  (SPA)    │
└──────────┘
```

**Step-by-step explanation:**

1. **User clicks "Sign in with Google"** — Angular redirects to Google's authorization endpoint with the app's `client_id`, requested scopes (`openid email profile`), a redirect URI, and a PKCE `code_verifier`/`code_challenge`.

2. **Google shows consent screen** — The user sees which Google account to use and what permissions the app requests (email address, basic profile info). The user grants consent.

3. **Google redirects back** — Google redirects to the Angular app's callback URL (e.g., `http://localhost:4200/auth/callback`) with an authorization `code` in the URL parameters.

4. **Angular sends code to backend** — The Angular app sends this authorization code to `POST /api/auth/google` on the FastAPI backend.

5. **Backend exchanges code for tokens** — FastAPI sends the code (along with `client_id`, `client_secret`, and `redirect_uri`) to Google's token endpoint (`https://oauth2.googleapis.com/token`).

6. **Google returns tokens** — Google responds with an `id_token` (JWT containing user identity) and an `access_token`.

7. **Backend decodes the id_token** — The `id_token` is a JWT signed by Google. FastAPI verifies its signature using Google's public keys and extracts: `email`, `name`, `picture`, `sub` (Google user ID).

8. **Map to local student** — FastAPI looks up the student by email in the `students` table. If no match, it creates a new student record with `auth_provider = 'google'` and `google_sub = <Google sub>`.

9. **Issue OpenMath tokens** — FastAPI creates its own JWT access + refresh tokens containing the student's UUID, role, and other claims.

10. **Angular stores tokens** — Same flow as local login from here.

### 4.2 What Is Needed to Make Google SSO Work

#### A. Google Cloud Console Setup

1. **Create a Google Cloud project** at https://console.cloud.google.com
2. **Enable the "Google Identity" API** (OAuth 2.0)
3. **Configure the OAuth consent screen:**
   - App name: `OpenMath`
   - User support email: your email
   - Scopes: `openid`, `email`, `profile`
   - Authorized domains: `localhost` (dev), your production domain
4. **Create OAuth 2.0 credentials:**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:4200`
   - Authorized redirect URIs: `http://localhost:4200/auth/callback`
   - Save the `client_id` and `client_secret`

#### B. Environment Variables

```env
# .env (add to existing)
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:4200/auth/callback
JWT_SECRET_KEY=your-random-secret-minimum-32-chars
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

#### C. Python Dependencies (additions to requirements.txt)

```
python-jose[cryptography]>=3.3.0    # JWT creation and verification
passlib[bcrypt]>=1.7.0              # bcrypt password hashing
httpx>=0.27.0                       # Async HTTP client for Google token exchange
```

#### D. Angular Dependencies

```
@abacritt/angularx-social-login     # Google Sign-In button component
```

Or use the native Google Identity Services (GIS) JavaScript library directly — no npm package required. GIS is loaded via a `<script>` tag in `index.html`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 4.3 Account Linking

When a Google user signs in:

| Scenario | Behavior |
|----------|----------|
| Email matches existing student | Link Google `sub` to student, allow both login methods |
| Email does not exist | Create new student with `auth_provider = 'google'`, role = `student` |
| Student has local account, now uses Google | Update `google_sub` and `auth_provider` to `both` |

The `students.email` column is the **primary linkage key** between local and Google accounts.

---

## 5. Role-Based Access Control

### 5.1 Role Definitions

| Role | Code | Description |
|------|------|-------------|
| **Student** | `student` | Default role for all students. Can take quizzes, view own history, edit own profile. |
| **Admin** | `admin` | Full access. Can manage all students, view all data, delete sessions, reset database. |

### 5.2 Permission Matrix

| Feature / Route | Student | Admin |
|-----------------|---------|-------|
| **Login** (`/login`) | ✅ (public) | ✅ (public) |
| **Start Quiz** (`/`) | ✅ | ✅ |
| **Take Quiz** (`/quiz/:id`) | ✅ (own sessions) | ✅ (any session) |
| **Edit Profile** (`/profile`) | ✅ (own profile) | ✅ (any via Student Admin) |
| **Session History** (`/history`) | ✅ (own results only) | ✅ (all results + delete) |
| **Session Detail** (`/history/:id`) | ✅ (own sessions) | ✅ (any session) |
| **User Guide** (`/guide`) | ✅ | ✅ |
| **Student Admin** (`/students`) | ❌ | ✅ |
| **Database Admin** (`/admin`) | ❌ | ✅ |

### 5.3 Route Guards (Angular)

```typescript
// auth.guard.ts — redirects to /login if not authenticated
canActivate(): boolean {
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
}

// admin.guard.ts — redirects to / if not admin
canActivate(): boolean {
  if (authService.currentUser()?.role !== 'admin') {
    router.navigate(['/']);
    return false;
  }
  return true;
}
```

### 5.4 Backend Authorization

FastAPI dependency injection for route protection:

```python
# dependencies.py

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Decode JWT and return user payload. Raises 401 if invalid."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Raise 403 if user is not admin."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
```

Usage in routers:

```python
# Protected — any authenticated user
@router.get("/quiz-types")
async def get_quiz_types(user: dict = Depends(get_current_user)):
    ...

# Protected — admin only
@router.post("/stats/reset")
async def reset_data(body: ResetRequest, user: dict = Depends(require_admin)):
    ...
```

---

## 6. Schema Changes

### 6.1 Students Table Evolution

```sql
-- Migration: 0006_auth_rbac.sql

-- Add authentication columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'local'
    CHECK (auth_provider IN ('local', 'google', 'both'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;

-- Replace age with birthday for auto-calculated age
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday DATE;

-- Backfill: convert existing age to approximate birthday
-- (uses Jan 1 of birth year as estimate since exact date is unknown)
UPDATE students
SET birthday = make_date(
    EXTRACT(YEAR FROM CURRENT_DATE)::int - age, 1, 1
)
WHERE age IS NOT NULL AND birthday IS NULL;

-- Note: age column is kept for backwards compatibility but becomes computed.
-- Application code should calculate age from birthday going forward.
-- The age column will be deprecated in a future migration.

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);

-- Index for Google sub lookups (SSO)
CREATE INDEX IF NOT EXISTS idx_students_google_sub ON students(google_sub);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
```

### 6.2 Updated Students Table Shape

```sql
CREATE TABLE students (
  -- Existing columns
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  age                INT NULL CHECK (age IS NULL OR age BETWEEN 4 AND 120),  -- DEPRECATED: use birthday
  gender             TEXT NULL CHECK (gender IN ('female','male','other','prefer_not_say')),
  learned_timetables INT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7,8,9,10],
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- v2.1 new columns
  email              TEXT UNIQUE,                                             -- Login identifier
  password_hash      TEXT,                                                    -- bcrypt hash (null for Google-only)
  role               TEXT NOT NULL DEFAULT 'student',                         -- 'student' | 'admin'
  auth_provider      TEXT NOT NULL DEFAULT 'local',                           -- 'local' | 'google' | 'both'
  google_sub         TEXT UNIQUE,                                             -- Google account ID
  birthday           DATE                                                     -- Birth date (age auto-calculated)
);
```

### 6.3 Age Calculation

Age is no longer stored — it is **computed from birthday** in application code:

```python
# Python
from datetime import date

def calculate_age(birthday: date | None) -> int | None:
    if birthday is None:
        return None
    today = date.today()
    return today.year - birthday.year - (
        (today.month, today.day) < (birthday.month, birthday.day)
    )
```

```typescript
// TypeScript
function calculateAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
```

The existing `age` column remains in the schema for backwards compatibility with the Nuxt app but is no longer written to by v2.1. API responses include a computed `age` field derived from `birthday`.

---

## 7. API Changes

### 7.1 New Auth Endpoints

#### `POST /api/auth/register`

Register a new student with local credentials.

**Request:**
```json
{
  "name": "Anna",
  "email": "anna@example.com",
  "password": "secret123",
  "birthday": "2017-03-15",
  "gender": "female",
  "learnedTimetables": [1, 2, 3, 4, 5]
}
```

**Response (201):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "Anna",
    "email": "anna@example.com",
    "role": "student",
    "age": 9
  }
}
```

**Validation:**
- `name`: required, non-empty
- `email`: required, valid email format, unique
- `password`: required, minimum 6 characters
- `birthday`: optional, must be a valid date in the past, resulting age must be 4–120
- `gender`: optional, enum
- `learnedTimetables`: optional, defaults to `[1..10]`

#### `POST /api/auth/login`

Authenticate with email + password.

**Request:**
```json
{
  "email": "anna@example.com",
  "password": "secret123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "Anna",
    "email": "anna@example.com",
    "role": "student",
    "age": 9
  }
}
```

**Error responses:**
- `401` — Invalid email or password
- `400` — Missing required fields

#### `POST /api/auth/google`

Authenticate via Google OAuth authorization code.

**Request:**
```json
{
  "code": "4/0AX4XfWg...",
  "redirectUri": "http://localhost:4200/auth/callback"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "name": "Anna",
    "email": "anna@gmail.com",
    "role": "student",
    "age": null
  },
  "isNewUser": true
}
```

**Backend processing:**
1. Exchange `code` for Google tokens via `https://oauth2.googleapis.com/token`
2. Decode and verify the `id_token` using Google's public JWKs
3. Extract `email`, `name`, `sub`, `picture` from the token
4. Look up student by `email` or `google_sub`
5. If not found: create new student with `role = 'student'`, `auth_provider = 'google'`
6. If found with `auth_provider = 'local'`: update to `auth_provider = 'both'`, store `google_sub`
7. Issue OpenMath JWT tokens

#### `POST /api/auth/refresh`

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### `GET /api/auth/me`

Get current authenticated user profile.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Anna",
  "email": "anna@example.com",
  "role": "student",
  "age": 9,
  "birthday": "2017-03-15",
  "gender": "female",
  "authProvider": "local",
  "learnedTimetables": [1, 2, 3, 4, 5]
}
```

### 7.2 Modified Existing Endpoints

| Endpoint | Change |
|----------|--------|
| All endpoints | Require `Authorization: Bearer <token>` header |
| `GET /api/sessions` | Students see only own sessions; admins see all |
| `GET /api/sessions/{id}` | Students can only access own sessions |
| `PATCH /api/students/{id}` | Students can only edit own profile; admins can edit any |
| `GET /api/students` | Admin only (for Student Admin page) |
| `GET /api/students/{id}` | Students can only view own profile; admins can view any |
| `POST /api/stats/reset` | Admin only |
| `GET /api/stats` | Admin only |
| `GET /api/stats/{table}` | Admin only |

### 7.3 New Student Admin Endpoints

#### `POST /api/students`

Admin creates a new student account.

**Request:**
```json
{
  "name": "Béla",
  "email": "bela@example.com",
  "password": "initial123",
  "birthday": "2018-07-22",
  "gender": "male",
  "role": "student",
  "learnedTimetables": [1, 2, 3, 4, 5]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Béla",
  "email": "bela@example.com",
  "role": "student",
  "age": 7,
  "createdAt": "2026-03-06T..."
}
```

#### `DELETE /api/sessions/{id}`

Admin deletes a session and all its questions and answers (cascade).

**Response (200):**
```json
{
  "deleted": true,
  "sessionId": "uuid"
}
```

---

## 8. Frontend Changes

### 8.1 New Services

#### `AuthService`

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<AuthUser | null>(null);
  private _isAuthenticated = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');

  login(email: string, password: string): Observable<AuthResponse> { ... }
  loginWithGoogle(code: string): Observable<AuthResponse> { ... }
  register(payload: RegisterRequest): Observable<AuthResponse> { ... }
  logout(): void { ... }
  refreshToken(): Observable<AuthResponse> { ... }
  loadFromStorage(): void { ... }  // Called on app init
}
```

#### `AuthInterceptor`

HTTP interceptor that:
- Attaches `Authorization: Bearer <token>` to all API requests
- Catches 401 responses and attempts token refresh
- Redirects to `/login` on refresh failure

### 8.2 New Components

| Component | Route | Access |
|-----------|-------|--------|
| `LoginComponent` | `/login` | Public |
| `RegisterComponent` | `/register` | Public |
| `AuthCallbackComponent` | `/auth/callback` | Public (Google redirect landing) |
| `StudentAdminComponent` | `/students` | Admin only |

### 8.3 Modified Components

| Component | Changes |
|-----------|---------|
| `HeaderComponent` | Show user name + logout button instead of student dropdown. Show/hide nav items based on role. |
| `StartComponent` | Remove student creation fields (handled by registration). Auto-use logged-in student. |
| `HistoryListComponent` | Students: always filtered to own results. Admins: see all + delete button per session. |
| `ProfileComponent` | Auto-loads own profile. Adds birthday field (date picker). Age shown as computed read-only. |
| `AdminComponent` | Admin guard — only accessible to admin role. |

### 8.4 Updated Routes

```typescript
export const routes: Routes = [
  // Public routes
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'auth/callback', loadComponent: () => import('./features/auth/callback.component').then(m => m.AuthCallbackComponent) },

  // Student routes (authenticated)
  { path: '', loadComponent: () => import('./features/start/start.component').then(m => m.StartComponent), canActivate: [authGuard] },
  { path: 'quiz/:sessionId', loadComponent: () => import('./features/quiz/quiz.component').then(m => m.QuizComponent), canActivate: [authGuard] },
  { path: 'history', loadComponent: () => import('./features/history/history-list.component').then(m => m.HistoryListComponent), canActivate: [authGuard] },
  { path: 'history/:sessionId', loadComponent: () => import('./features/history/session-detail.component').then(m => m.SessionDetailComponent), canActivate: [authGuard] },
  { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent), canActivate: [authGuard] },
  { path: 'guide', loadComponent: () => import('./features/user-guide/user-guide.component').then(m => m.UserGuideComponent), canActivate: [authGuard] },

  // Admin routes
  { path: 'students', loadComponent: () => import('./features/student-admin/student-admin.component').then(m => m.StudentAdminComponent), canActivate: [authGuard, adminGuard] },
  { path: 'admin', loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent), canActivate: [authGuard, adminGuard] },

  { path: '**', redirectTo: 'login' }
];
```

---

## 9. Login Flow UX

### 9.1 Login Page Layout

```
┌─────────────────────────────────────────────┐
│              🧮 OpenMath                     │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │         Sign in to OpenMath         │    │
│  │                                     │    │
│  │  Email:    [________________]       │    │
│  │  Password: [________________]       │    │
│  │                                     │    │
│  │  [ Sign In ]                        │    │
│  │                                     │    │
│  │  ──────── or ────────               │    │
│  │                                     │    │
│  │  [ 🔵 Sign in with Google ]         │    │
│  │                                     │    │
│  │  Don't have an account? Register    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  footer: OpenMath v2.1                      │
└─────────────────────────────────────────────┘
```

### 9.2 Registration Page Layout

```
┌─────────────────────────────────────────────┐
│              🧮 OpenMath                     │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │      Create your account            │    │
│  │                                     │    │
│  │  Name:     [________________]       │    │
│  │  Email:    [________________]       │    │
│  │  Password: [________________]       │    │
│  │  Birthday: [__ / __ / ____] (opt.)  │    │
│  │  Gender:   [dropdown]       (opt.)  │    │
│  │                                     │    │
│  │  Timetables learned:               │    │
│  │  ☑1 ☑2 ☑3 ☑4 ☑5 ☐6 ☐7 ☐8 ☐9 ☐10  │    │
│  │                                     │    │
│  │  [ Register ]                       │    │
│  │                                     │    │
│  │  Already have an account? Sign in   │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

### 9.3 Flow Behaviors

| Action | Behavior |
|--------|----------|
| Successful local login | Store tokens, redirect to `/` (Start page) |
| Successful Google login (existing user) | Store tokens, redirect to `/` |
| Successful Google login (new user) | Create account, store tokens, redirect to `/profile` to complete setup |
| Successful registration | Store tokens, redirect to `/` |
| Failed login | Show inline error: "Invalid email or password" |
| Token expired (API 401) | Attempt silent refresh. If refresh fails, redirect to `/login` |
| Logout | Clear tokens from localStorage, redirect to `/login` |

### 9.4 Header Changes When Authenticated

**Student view:**
```
Start | Profile | History | Guide                      Anna ▼ [Logout]
```

**Admin view:**
```
Start | Profile | History | Guide | Students | Admin   Admin User ▼ [Logout]
```

The student dropdown selector is removed — the logged-in user **is** the active student. Admins can switch student context via the Student Admin page.

---

## 10. Student Admin Page

**Route:** `/students`  
**Access:** Admin only

### 10.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  Student Administration                    [+ New Student]│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │ Name     │ Email           │ Age │ Role    │ Provider ││
│  │──────────│─────────────────│─────│─────────│──────────││
│  │ Anna     │ anna@email.com  │ 9   │ student │ local    ││
│  │ Béla     │ bela@gmail.com  │ 7   │ student │ google   ││
│  │ Teacher  │ admin@school.hu │ 35  │ admin   │ both     ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  Clicking a row opens student detail / edit form         │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Features

- **List all students** with sortable/filterable PrimeNG table
- **Create new student** via dialog (name, email, password, birthday, gender, role, timetables)
- **Edit student** — change name, email, birthday, gender, role, timetables
- **Reset password** — admin can set a new password for any student
- **View performance** — link to student's performance stats

### 10.3 PrimeNG Components

- `p-table` with `[paginator]="true"`, sorting, global filter
- `p-dialog` for create/edit form
- `p-tag` for role badges (`student` = blue, `admin` = orange)
- `p-confirmDialog` for destructive actions

---

## 11. Session History Changes

### 11.1 Student View

Students see **only their own sessions**. The "Show only my results" toggle is kept but defaults to ON and cannot show other students' results.

The API enforces this — `GET /api/sessions` automatically filters by the authenticated student's ID when role is `student`.

### 11.2 Admin View

Admins see **all sessions from all students**. Additional features:

- **Delete button** per session row (trash icon)
- Delete triggers `p-confirmDialog`: "Delete this session? This will permanently remove the session, all its questions, and all answers."
- Calls `DELETE /api/sessions/{id}`
- Cascade deletion handled by PostgreSQL `ON DELETE CASCADE`

### 11.3 Session Delete API

```sql
-- CASCADE handles questions and answers automatically
DELETE FROM quiz_sessions WHERE id = $1;
```

The `questions` table has `REFERENCES quiz_sessions(id) ON DELETE CASCADE`, and `answers` table has `REFERENCES questions(id) ON DELETE CASCADE`, so a single DELETE on `quiz_sessions` removes everything.

After deletion, session counters on the student's profile are recalculated on next fetch.

---

## 12. Migration Strategy

### 12.1 Database Migration Order

1. Apply `0006_auth_rbac.sql` — adds columns, backfills birthday, creates indexes
2. Create initial admin account via seed script or manual SQL
3. Existing students without email/password cannot log in until credentials are set

### 12.2 Handling Existing Students

Existing students from v2.0 have no email or password. Options:

**Option A (recommended): Admin bootstraps accounts**
1. First deployment: create one admin account via SQL seed
2. Admin logs in and uses Student Admin to set email + password for existing students
3. Students can then log in

**Seed script for initial admin:**
```sql
INSERT INTO students (name, email, password_hash, role, auth_provider, learned_timetables)
VALUES (
    'Admin',
    'admin@openmath.local',
    -- bcrypt hash of 'admin123' (generate with Python: pwd_context.hash("admin123"))
    '$2b$12$LJ3m4ks9Hj8v7Z1r2u4kQe...',
    'admin',
    'local',
    ARRAY[1,2,3,4,5,6,7,8,9,10]
);
```

**Option B: Migration sets temporary credentials**
- Auto-generate email from name (e.g., `anna@openmath.local`)
- Set a common temporary password that must be changed on first login
- More complex, less secure

### 12.3 Backwards Compatibility

- The Nuxt app does not require authentication — it continues working unmodified
- The `age` column remains for Nuxt compatibility
- New columns have defaults or are nullable — no breaking changes to existing queries

---

## 13. Security Considerations

### 13.1 Password Security

| Measure | Implementation |
|---------|---------------|
| Hashing | bcrypt with 12 rounds |
| Min length | 6 characters |
| Storage | Only hash stored, never plain text |
| Transmission | HTTPS in production, HTTP acceptable for localhost dev |
| No password in logs | FastAPI request logging excludes password fields |

### 13.2 JWT Security

| Measure | Implementation |
|---------|---------------|
| Signing | HS256 with server-side secret key |
| Access token TTL | 30 minutes |
| Refresh token TTL | 7 days |
| Storage | `localStorage` (acceptable for this app's threat model) |
| Token in header | `Authorization: Bearer <token>` |
| No sensitive data in JWT | Only UUID, email, name, role |

### 13.3 Google SSO Security

| Measure | Implementation |
|---------|---------------|
| Token verification | Verify `id_token` signature against Google's JWKs |
| Audience check | Verify `aud` claim matches our `client_id` |
| Issuer check | Verify `iss` is `accounts.google.com` or `https://accounts.google.com` |
| PKCE | Use code_verifier/code_challenge for authorization code flow |
| Client secret | Stored server-side only, never exposed to frontend |

### 13.4 API Security

| Measure | Implementation |
|---------|---------------|
| Input validation | Pydantic schema validation on all endpoints |
| SQL injection | Parameterized queries via asyncpg (`$1`, `$2`) |
| CORS | Restricted to `http://localhost:4200` (and production domain) |
| Rate limiting | Recommended for `/api/auth/login` (5 attempts per minute per IP) |
| Role enforcement | Backend checks role on every protected endpoint |

---

## 14. Acceptance Criteria

### Authentication

- [ ] Students can register with name, email, and password
- [ ] Students can log in with email + password
- [ ] Students can log in with Google account
- [ ] Google accounts are automatically linked to existing email matches
- [ ] New Google users get a student account created automatically
- [ ] JWT access token expires after 30 minutes
- [ ] Refresh token silently renews the access token
- [ ] Expired refresh token redirects to login page
- [ ] Logout clears tokens and redirects to login

### RBAC

- [ ] Unauthenticated users see only login/register pages
- [ ] Students can: start quiz, take quiz, view own history, edit own profile, view guide
- [ ] Students cannot: access Student Admin, Database Admin, see other students' data
- [ ] Admins can: do everything students can + manage students, view all data, delete sessions, reset DB
- [ ] API returns 401 for unauthenticated requests
- [ ] API returns 403 for unauthorized role access

### Student Admin

- [ ] Admin can list all students with search/sort
- [ ] Admin can create a new student (with email, password, role)
- [ ] Admin can edit any student's profile
- [ ] Admin can reset any student's password
- [ ] Admin can change a student's role to admin (and vice versa)

### Session History

- [ ] Students see only their own session history
- [ ] Admins see all sessions from all students
- [ ] Admins can delete a session (with confirmation)
- [ ] Deleting a session cascades to questions and answers

### Profile

- [ ] Birthday field replaces age input (PrimeNG Calendar / date picker)
- [ ] Age is displayed as a computed read-only value
- [ ] Email is displayed but not editable (login identifier)

### Schema

- [ ] Migration 0006 adds all new columns without breaking existing data
- [ ] Existing students retain their data after migration
- [ ] Birthday backfill produces reasonable approximate values from legacy age

---

## 15. Future Scope — v2.5 Ideas

These features are **out of scope for v2.1** but documented here as design direction for the next release.

### 15.1 Quiz Type Editor

**Concept:** Admin-facing UI to create, edit, and manage quiz types — no more SQL-only quiz type management.

**Planned features:**
- CRUD interface for quiz types (code, description, answer_type, template_kind)
- Set **recommended age range** per quiz type (e.g., `multiplication_1_10` → ages 7–9, `fraction_add` → ages 9–11)
- Start page auto-filters quiz types by student's age when a recommended range is set
- Enable/disable quiz types without deleting them (soft toggle)
- Preview generated sample questions for a quiz type
- Reorder quiz types for display priority

**Schema addition:**
```sql
ALTER TABLE quiz_types ADD COLUMN recommended_age_min INT;
ALTER TABLE quiz_types ADD COLUMN recommended_age_max INT;
ALTER TABLE quiz_types ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE quiz_types ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
```

### 15.2 Incentive System / Motivation / Badges

**Concept:** Keep students engaged and motivated through gamification — visible progress, achievements, and social recognition.

**Planned features:**

#### Badges / Achievements
- **Speed Demon** — Complete a 10-question quiz in under 60 seconds
- **Perfect Score** — Get 100% on a quiz
- **Streak Master** — Get 5 correct answers in a row
- **First Quiz** — Complete your first quiz session
- **Timetable Champion** — Master all timetables 1–10 (100% on hard difficulty)
- **Practice Makes Perfect** — Complete 50 total quiz sessions
- **Daily Learner** — Complete at least one quiz per day for 7 consecutive days
- **Multi-Talent** — Score above 80% on all available quiz types

#### Leaderboard
- Weekly and all-time leaderboards
- Ranked by: average score, total quizzes completed, best speed
- Filterable by quiz type and difficulty
- Shows student name, avatar (from Google profile picture or generated), and rank
- Students can opt out of leaderboard visibility via profile settings

#### Certificate / PDF Report
- Downloadable PDF certificate for completed milestones
- "Anna completed 100 multiplication quizzes with an average score of 92%"
- Printable format with OpenMath branding and the student's name
- Generated server-side using a PDF library (e.g., `reportlab` or `weasyprint`)
- Certificates include: student name, quiz type, difficulty, date range, total questions answered, accuracy percentage

#### Progress Tracking
- Visual progress bars per timetable (1–10) showing mastery percentage
- "You've mastered 7 out of 10 timetables on medium difficulty!"
- Historical trend chart showing score improvement over time

**Schema additions (v2.5):**
```sql
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,          -- PrimeIcon name or emoji
  criteria JSONB NOT NULL,     -- Machine-readable unlock conditions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_id)
);
```

---

*End of specification — OpenMath v2.1 Authentication & RBAC*
