# OpenMath v2.1 Auth/RBAC — Implementation Summary

**Date:** 2025  
**Scope:** Angular 18 + FastAPI (python-api) stack only  
**Spec:** `openmath_v2.1_auth_rbac_spec.md`

---

## Overview

This implementation adds JWT-based authentication with Google SSO and role-based access control (RBAC) to the OpenMath platform. Every API endpoint is now protected — students see only their own data, and admin users have full management capabilities.

---

## Architecture

```
┌──────────────────┐     Authorization Code     ┌────────────────┐
│   Google OAuth   │ ◄──────────────────────── │  Angular App   │
│   Consent Screen │ ────────────────────────► │  (port 4200)   │
└──────────────────┘     Redirect + code        └───────┬────────┘
                                                        │ JWT Bearer
                                                        ▼
                                                ┌────────────────┐
                                                │  FastAPI        │
                                                │  (port 8000)    │
                                                │  /api/auth/*    │
                                                └───────┬────────┘
                                                        │ asyncpg
                                                        ▼
                                                ┌────────────────┐
                                                │  PostgreSQL 16  │
                                                │  (port 5432)    │
                                                └────────────────┘
```

**Auth flow:** Email/password login or Google Authorization Code → backend issues HS256 JWT access token (30 min) + refresh token (7 days) → Angular interceptor attaches Bearer token to all API requests → backend dependency extracts and validates JWT on every protected route.

---

## Database Changes

### New migration: `db/migrations/0006_auth_rbac.sql`

| Column | Type | Details |
|---|---|---|
| `email` | `VARCHAR(255) UNIQUE` | Login identifier |
| `password_hash` | `VARCHAR(255)` | bcrypt (12 rounds), nullable for Google-only users |
| `role` | `VARCHAR(20)` | CHECK `student` / `admin`, default `student` |
| `auth_provider` | `VARCHAR(20)` | CHECK `local` / `google` / `both`, default `local` |
| `google_sub` | `VARCHAR(255) UNIQUE` | Google account subject ID |
| `birthday` | `DATE` | Replaces age-based approach; age computed dynamically |

**Indexes:** `idx_students_email`, `idx_students_google_sub`, `idx_students_role`

The migration backfills `birthday` from existing `age` values for backwards compatibility.

---

## Backend Changes (python-api)

### New Files

| File | Purpose |
|---|---|
| `app/auth.py` | JWT creation/decode (python-jose HS256), bcrypt password hashing (passlib), Google code exchange + id_token verification (httpx) |
| `app/dependencies.py` | FastAPI dependencies: `get_current_user` (Bearer → JWT payload), `require_admin` (role check → 403) |
| `app/schemas/auth.py` | Pydantic v2 models: RegisterRequest, LoginRequest, GoogleAuthRequest, RefreshRequest, AuthUser, AuthResponse, AdminCreateStudentRequest |
| `app/routers/auth.py` | 5 endpoints: POST register, POST login, POST google, POST refresh, GET me |

### Modified Files

| File | Changes |
|---|---|
| `requirements.txt` | Added `python-jose[cryptography]>=3.3.0`, `passlib[bcrypt]>=1.7.0`, `httpx>=0.27.0` |
| `app/config.py` | Added `jwt_secret_key`, `jwt_algorithm`, `jwt_access_token_expire_minutes`, `jwt_refresh_token_expire_days`, `google_client_id`, `google_client_secret`, `google_redirect_uri` |
| `app/main.py` | Version bumped to 2.1.0; imports and mounts `auth_router` at `/api/auth` |
| `app/queries.py` | Added ~10 auth queries: find/create student by email/google_sub, update password, update google link, admin student list, filtered sessions, delete session, v2 profile update |
| `app/routers/students.py` | GET list → admin-only; GET/PATCH by ID → ownership check; new POST create (admin); new POST reset-password (admin) |
| `app/routers/sessions.py` | GET list → admin sees all, student sees own; GET by ID → ownership; POST → auth required; new DELETE → admin-only |
| `app/routers/answers.py` | POST → requires `get_current_user` |
| `app/routers/stats.py` | All 3 endpoints → require `require_admin` |
| `app/routers/quiz_types.py` | GET → requires `get_current_user` |

### API Endpoint Summary

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/auth/register` | Public | — |
| POST | `/api/auth/login` | Public | — |
| POST | `/api/auth/google` | Public | — |
| POST | `/api/auth/refresh` | Public (refresh token in body) | — |
| GET | `/api/auth/me` | Bearer | Any |
| GET | `/api/students` | Bearer | Admin |
| POST | `/api/students` | Bearer | Admin |
| GET | `/api/students/:id` | Bearer | Owner or Admin |
| PATCH | `/api/students/:id` | Bearer | Owner or Admin |
| POST | `/api/students/:id/reset-password` | Bearer | Admin |
| GET | `/api/sessions` | Bearer | Any (filtered) |
| POST | `/api/sessions` | Bearer | Any |
| GET | `/api/sessions/:id` | Bearer | Owner or Admin |
| DELETE | `/api/sessions/:id` | Bearer | Admin |
| POST | `/api/answers` | Bearer | Any |
| GET | `/api/quiz-types` | Bearer | Any |
| GET | `/api/stats` | Bearer | Admin |
| GET | `/api/stats/:table` | Bearer | Admin |
| POST | `/api/stats/reset` | Bearer | Admin |

---

## Frontend Changes (angular-app)

### New Files

| File | Purpose |
|---|---|
| `src/app/models/auth.model.ts` | TypeScript interfaces for all auth request/response types |
| `src/app/core/services/auth.service.ts` | Signal-based auth state, login/register/Google/refresh/logout methods, localStorage persistence |
| `src/app/core/interceptors/auth.interceptor.ts` | Functional HttpInterceptorFn — attaches Bearer token, auto-refreshes on 401 |
| `src/app/core/guards/auth.guard.ts` | `authGuard` (redirect to /login) and `adminGuard` (redirect to /) |
| `src/app/features/auth/login.component.ts` | Email/password form + "Sign in with Google" button |
| `src/app/features/auth/register.component.ts` | Full registration form: name, email, password, birthday, gender, timetables |
| `src/app/features/auth/callback.component.ts` | Handles Google OAuth redirect, exchanges code, routes user |
| `src/app/features/student-admin/student-admin.component.ts` | Admin panel: PrimeNG table of all students, create/edit dialog, reset password dialog |

### Modified Files

| File | Changes |
|---|---|
| `src/index.html` | Added Google Identity Services (GIS) script tag |
| `src/environments/environment.ts` | Added `googleClientId` property |
| `src/app/app.routes.ts` | Added auth routes (login, register, auth/callback); applied `authGuard` to all app routes; applied `adminGuard` to /students and /admin |
| `src/app/app.config.ts` | Added `withInterceptors([authInterceptor])` to `provideHttpClient()` |
| `src/app/app.component.ts` | Conditional header/footer rendering — hidden on login/register/callback pages |
| `src/app/shared/components/header/header.component.ts` | Removed student dropdown; shows logged-in user name + Logout button; admin-only nav links (Students, Admin) |
| `src/app/core/services/api.service.ts` | Added `createStudent()`, `resetStudentPassword()`, `deleteSession()` methods |
| `src/app/features/start/start.component.ts` | Removed student creation fields; auto-uses logged-in user from AuthService |
| `src/app/features/history/history-list.component.ts` | Removed client-side filter checkbox; API enforces student filtering; admin delete button per session |
| `src/app/features/profile/profile.component.ts` | Uses AuthService instead of QuizService; added birthday date picker + computed age display; shows email as read-only |

---

## Environment Variables

### Backend (`python-api/.env`)

```dotenv
DATABASE_URL=postgresql://openmath:openmath@localhost:5432/openmath
CORS_ORIGINS=["http://localhost:4200"]

# Auth (new in v2.1)
JWT_SECRET_KEY=<random-64-char-string>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
GOOGLE_CLIENT_ID=<from-google-console>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<from-google-console>
GOOGLE_REDIRECT_URI=http://localhost:4200/auth/callback
```

### Frontend (`angular-app/src/environments/environment.ts`)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  googleClientId: '<from-google-console>.apps.googleusercontent.com',
};
```

---

## Security Model

| Concern | Implementation |
|---|---|
| Password storage | bcrypt 12 rounds via passlib |
| Token signing | HS256 via python-jose |
| Token transport | `Authorization: Bearer <token>` header |
| Token refresh | Interceptor catches 401 → calls `/api/auth/refresh` → retries original request |
| Google verification | Backend fetches Google's JWKs and verifies id_token signature (RS256) |
| RBAC enforcement | Server-side `require_admin` dependency raises 403 for non-admin users |
| Data isolation | Students can only access their own sessions, answers, and profile |
| Client persistence | localStorage keys: `openmath_access_token`, `openmath_refresh_token`, `openmath_user` |

---

## Setup Steps

1. Install new Python dependencies: `pip install -r python-api/requirements.txt`
2. Apply the database migration: `psql $DATABASE_URL -f db/migrations/0006_auth_rbac.sql`
3. Configure backend `.env` with JWT and Google OAuth values
4. Set `googleClientId` in Angular environment file
5. Create an admin user (see `GOOGLE_SSO_CONFIG_GUIDE.md` Step 7)
6. Restart backend and frontend

See [GOOGLE_SSO_CONFIG_GUIDE.md](GOOGLE_SSO_CONFIG_GUIDE.md) for detailed Google Cloud Console configuration instructions.
