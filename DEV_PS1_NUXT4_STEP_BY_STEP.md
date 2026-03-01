# `dev.ps1` Nuxt 4 Dev Guide (Windows)

This guide explains exactly how to use `dev.ps1` to **validate**, **build**, and **run** the Nuxt app on your development computer.

---

## 1) Required tools

You need these installed before running Nuxt tasks:

- **Docker Desktop** (you already have this)
- **Node.js** (LTS recommended)
- **pnpm**
- **Git**
- **PowerShell** (Windows PowerShell 5.1 or PowerShell 7+)

### Verify tools quickly

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 doctor
```

**Expected:**
- You see `PASS`/`WARN`/`FAIL` checks for tools, files, env, and ports.
- A run summary is printed at the end.
- Logs are saved in `.dev-assistant/logs/<timestamp>/`.

---

## 2) Start from repo root

Always run `dev.ps1` from repository root:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
```

**Expected:**
- Current directory is the project root.
- `dev.ps1` is available as `./dev.ps1`.

---

## 3) Understand command prompts

For each command, `dev.ps1` shows:
- step header
- command
- working directory
- reason
- expected outcome

Then asks:
- `[R]un  [S]kip  [E]dit  [A]bort`

**Expected:**
- Nothing runs silently.
- You choose exactly what executes.

---

## 4) One-time DB + env bootstrap (required)

Before `validate-nuxt` or `up-nuxt`, ensure Nuxt can read `DATABASE_URL` and the DB schema exists.

### 4.1 Create `nuxt-app/.env`

Nuxt runtime reads env from `nuxt-app/.env`.

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
Copy-Item ".\nuxt-app\.env.example" ".\nuxt-app\.env" -Force
```

Expected in `nuxt-app/.env`:

```dotenv
DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz
```

### 4.2 Apply initial schema/tables

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
docker compose up -d
Get-Content -Raw ".\db\migrations\0001_init.sql" | docker exec -i openmath-postgres psql -U quiz -d quiz -v ON_ERROR_STOP=1
docker exec openmath-postgres psql -U quiz -d quiz -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
```

**Expected:**
- You see tables: `students`, `quiz_sessions`, `questions`, `answers`.
- No `DATABASE_URL is required` runtime crash.

---

## 5) Validate Nuxt setup (recommended first)

Run Nuxt validation flow:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 validate-nuxt
```

Validation flow runs (with confirmations):
1. `docker compose up -d`
2. `pnpm install` (optional)
3. `pnpm approve-builds` (optional, Windows-friendly)
4. `pnpm nuxt prepare`
5. `pnpm nuxt typecheck`

**Expected:**
- Live logs stream line-by-line with timestamps.
- Heartbeat appears on long steps.
- If a step fails, you get failure summary + log tail + retry/edit options.

---

## 6) Build Nuxt production output

Run build flow:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 build-nuxt
```

Build flow runs (with confirmations):
1. `pnpm install` (optional)
2. `pnpm nuxt prepare`
3. `pnpm build`

**Expected:**
- Build progress appears live (not buffered).
- At finish, run summary shows status.
- Build artifacts are in Nuxt output folders (for example `.output/` depending on config).

---

## 7) Run full Nuxt dev startup

Run full dev-up flow:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 up-nuxt -AutoApprove
```

Flow runs (with confirmations):
1. Start Postgres via Docker
2. Install deps (optional)
3. Approve build scripts (optional)
4. Prepare Nuxt
5. Start `pnpm dev`

**Expected:**
- Nuxt flow reaches `pnpm dev` and prints local URL (usually `http://localhost:3000`).
- You see the local URL in logs (commonly `http://localhost:3000`).
- In current stable mode, hotkeys are disabled; if `up-nuxt` exits after summary, run `pnpm dev` directly from `nuxt-app`.

---

## 8) Use interactive menu mode (optional)

If you prefer menus instead of mode arguments:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1
```

**Expected:**
- Numbered menu appears.
- You can select doctor/validate/build/dev-up actions directly.
- React/Laravel planned menu items show as planned placeholders.

---

## 9) Where logs and errors are saved

Each run creates:

- `.dev-assistant/logs/<timestamp>/run.log`
- `.dev-assistant/logs/<timestamp>/errors.log`
- `.dev-assistant/logs/<timestamp>/summary.json`

**Expected:**
- `run.log` contains full step-by-step transcript.
- `errors.log` contains stderr/error lines.
- `summary.json` contains mode, duration, and step results.

---

## 10) If something fails

When a command fails, `dev.ps1` should:
- stop at failed required step
- show step name + command + exit code
- show first error line (if captured)
- show tail of recent logs
- ask what to do next (`Retry/Edit/Skip/Abort`)

**Expected:**
- You always know why it failed and what your next action can be.

### Common fixes from real runs

1. **`DATABASE_URL is required`**
	- Create `nuxt-app/.env` with `DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz`.

2. **DB is running but app still fails on queries**
	- Schema may be empty. Re-apply `db/migrations/0001_init.sql` and verify tables exist.

3. **`up-nuxt -AutoApprove` exits code `1` after printing startup**
	- Check latest logs in `.dev-assistant/logs/<timestamp>/`.
	- If no runtime error in `errors.log`, start dev directly:

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath\nuxt-app"
pnpm dev
```

---

## 11) Fast command list

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 doctor
.\dev.ps1 validate-nuxt
.\dev.ps1 build-nuxt
.\dev.ps1 up-nuxt -AutoApprove
```

For automatic confirmations (diagnostic/CI-like quick check):

```powershell
Set-Location "c:\Users\attila\Desktop\Code\openmath"
.\dev.ps1 doctor -AutoApprove
```

**Expected:**
- Commands run without per-step prompt when `-AutoApprove` is used.
- Full logs are still captured.
