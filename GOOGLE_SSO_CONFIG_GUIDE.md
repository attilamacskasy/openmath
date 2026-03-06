# Google SSO Configuration Guide — OpenMath v2.1

This guide walks through every post-deployment step required to enable Google Single Sign-On (SSO) for the OpenMath Angular + FastAPI stack.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Google account | Any Gmail or Google Workspace account |
| Google Cloud project | Free tier is sufficient |
| OpenMath backend running | `python-api` on the configured host/port |
| OpenMath frontend running | `angular-app` served at its configured origin |

---

## Step 1 — Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project selector dropdown at the top-left and choose **New Project**.
3. Enter a project name (e.g. `openmath-auth`).
4. Click **Create** and wait for the project to be provisioned.
5. Make sure the new project is selected in the project dropdown.

---

## Step 2 — Configure the OAuth Consent Screen

1. In the left sidebar navigate to **APIs & Services → OAuth consent screen**.
2. Choose **External** user type (unless you have a Workspace org and want internal only) and click **Create**.
3. Fill in the required fields:

| Field | Value |
|---|---|
| App name | `OpenMath` |
| User support email | Your email address |
| Developer contact email | Your email address |

4. Under **Scopes**, click **Add or Remove Scopes** and add the three required scopes — `openid`, `email`, and `profile`:

![OAuth consent screen — scopes configuration](assets/images/v2.1_auth_rbac/gcp_auth_scope.JPG)

5. Click **Save and Continue** through the remaining steps.
6. If in **Testing** mode, add your test accounts under **Test users**. External apps in testing only allow email addresses explicitly listed here:

![Test users configuration](assets/images/v2.1_auth_rbac/gcp_test_users.JPG)

> **Note:** To allow any Google user to sign in, you must submit the app for **verification** or switch to a Google Workspace internal app. During development, testing mode is fine.

---

## Step 3 — Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services → Credentials**.
2. Click **+ CREATE CREDENTIALS → OAuth client ID**.
3. Set Application type to **Web application**.
4. Give it a name (e.g. `OpenMath Web Client`).
5. Under **Authorized JavaScript origins** and **Authorized redirect URIs**, add your frontend origins and callback URLs. For both local development and production:

![Authorized origins and redirect URIs](assets/images/v2.1_auth_rbac/gcp_auth_prod.JPG)

| Environment | Origin | Redirect URI |
|---|---|---|
| Local development | `http://localhost:4200` | `http://localhost:4200/auth/callback` |
| Production | `https://your-production-domain.com` | `https://your-production-domain.com/auth/callback` |

6. Click **Create**.
7. A dialog will display your **Client ID** and **Client Secret**. Copy both values — you will need them in the next step:

![Client ID and Client Secret](assets/images/v2.1_auth_rbac/gcp_client_ID_and_secret.JPG)

---

## Step 4 — Set Environment Variables (Backend)

The FastAPI backend reads Google OAuth settings from environment variables (via `python-api/app/config.py`).

Create or update the `.env` file in the project root directory:

```dotenv
# --- JWT ---
JWT_SECRET_KEY=<generate-a-long-random-string>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# --- Google OAuth 2.0 ---
GOOGLE_CLIENT_ID=<your-client-id-from-step-3>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret-from-step-3>
GOOGLE_REDIRECT_URI=http://localhost:4200/auth/callback
```

### How to generate a secure JWT secret

```bash
# Python one-liner
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Or on PowerShell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

> **Important:** The `GOOGLE_REDIRECT_URI` must exactly match one of the Authorized redirect URIs configured in Step 3. The backend uses this value when exchanging the authorization code for tokens.

---

## Step 5 — Set the Client ID (Frontend)

Open `angular-app/src/environments/environment.ts` and set the `googleClientId` property to the same Client ID from Step 3:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api',
  googleClientId: '<your-client-id-from-step-3>.apps.googleusercontent.com',
};
```

For production, update `environment.prod.ts` with the same Client ID (or a separate one if you created per-environment credentials).

---

## Step 6 — Apply the Database Migration

The auth/RBAC migration adds the required columns to the `students` table:

```bash
# From the project root
psql $DATABASE_URL -f db/migrations/0006_auth_rbac.sql
```

Or use the migration script:

```powershell
# PowerShell
.\scripts\apply-migrations.ps1
```

This migration:
- Adds `email`, `password_hash`, `role`, `auth_provider`, `google_sub`, `birthday` columns
- Backfills `birthday` from existing `age` values
- Creates unique indexes on `email` and `google_sub`

After migration, the students table will include the new auth columns. Here is an example with both local and Google users:

![Students table with auth columns](assets/images/v2.1_auth_rbac/db_students_admin.JPG)

---

## Step 7 — Create the First Admin User

After migration, all existing students default to `role = 'student'`. To create an admin:

### Option A — Register via API, then promote in DB

```bash
# Register normally
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"SecureP@ss1"}'

# Promote to admin in PostgreSQL
psql $DATABASE_URL -c "UPDATE students SET role = 'admin' WHERE email = 'admin@example.com';"
```

### Option B — Direct SQL insert

```sql
INSERT INTO students (name, email, password_hash, role, auth_provider, learned_timetables)
VALUES (
  'Admin',
  'admin@example.com',
  -- bcrypt hash of your chosen password (generate with: python -c "import bcrypt; print(bcrypt.hashpw(b'YourPassword', bcrypt.gensalt(12)).decode())")
  '$2b$12$...',
  'admin',
  'local',
  ARRAY[1,2,3,4,5,6,7,8,9,10]
);
```

Once logged in as admin, you can manage all students from the Student Admin panel:

![Student admin panel](assets/images/v2.1_auth_rbac/fe_student_admin.JPG)

---

## Step 8 — Verify the Integration

### 8.1 — Local login

1. Start the backend: `cd python-api && uvicorn app.main:app --reload`
2. Start the frontend: `cd angular-app && ng serve`
3. Open `http://localhost:4200/register` and create an account.
4. Log in at `http://localhost:4200/login`.
5. Confirm you can start a quiz and view your profile.

The new auth endpoints should be visible in the Swagger UI at `http://localhost:8000/docs`:

![Auth API endpoints in Swagger](assets/images/v2.1_auth_rbac/be_api_new_auth.JPG)

### 8.2 — Google SSO

1. On the login page, click **Sign in with Google**:

![Login page with Google SSO button](assets/images/v2.1_auth_rbac/fe_sing_in_with_Google.JPG)

2. You should be redirected to Google's consent screen where you authorize OpenMath to access your name and email:

![Google consent screen](assets/images/v2.1_auth_rbac/fe_sing_in_with_Google2.JPG)

3. After granting consent, Google redirects back to `http://localhost:4200/auth/callback?code=...`. The callback component exchanges the code with the backend:

![Callback processing](assets/images/v2.1_auth_rbac/fe_sing_in_with_Google3.JPG)

4. You are now logged in. The header shows your name, auth provider badge, and the full menu is available:

![Logged in via Google SSO](assets/images/v2.1_auth_rbac/fe_sing_in_with_Google4.JPG)

5. Verify the user appears in the `students` table with `auth_provider = 'google'` and the correct `google_sub`.

### 8.3 — Admin features

Admin users see additional navigation links (Students, Admin) and can delete sessions from the History page:

![Admin delete session](assets/images/v2.1_auth_rbac/fe_delete_session.JPG)

The User Guide also shows admin-specific sections when logged in as an admin:

![User guide with admin sections](assets/images/v2.1_auth_rbac/fe_user_guide_for_admins.JPG)

### 8.4 — Token refresh

- Access tokens expire after 30 minutes by default.
- The Angular HTTP interceptor automatically refreshes the token on 401 responses.
- To test manually: wait 30+ minutes or shorten `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` to 1 minute.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` error on Google | Redirect URI in backend `.env` doesn't match Google Console | Ensure `GOOGLE_REDIRECT_URI` exactly matches an Authorized redirect URI in Step 3 |
| `invalid_client` error | Wrong Client ID or Client Secret | Double-check values in `.env` and `environment.ts` |
| CORS errors on `/api/auth/google` | Frontend origin not in CORS config | Add `http://localhost:4200` to `CORS_ORIGINS` in `.env` |
| `401 Unauthorized` on all API calls | JWT secret mismatch or missing token | Ensure `JWT_SECRET_KEY` is set and consistent across restarts |
| Google button does nothing | `googleClientId` empty in `environment.ts` | Set the Client ID as described in Step 5 |
| `accounts.google.com/gsi/client` 404 | GIS script not loaded | Verify `<script>` tag is present in `index.html` |
| Consent screen shows "unverified app" | App not verified by Google | Normal in development/testing mode; click "Advanced" → "Go to OpenMath" |

---

## Security Checklist

- [ ] `JWT_SECRET_KEY` is at least 32 characters and randomly generated
- [ ] `JWT_SECRET_KEY` is **not** committed to version control
- [ ] `.env` file is listed in `.gitignore`
- [ ] `GOOGLE_CLIENT_SECRET` is **not** exposed in frontend code
- [ ] HTTPS is enforced in production
- [ ] `GOOGLE_REDIRECT_URI` uses `https://` in production
- [ ] Test users are removed from Google Console before going live
- [ ] OAuth consent screen is submitted for verification (if targeting external users)
