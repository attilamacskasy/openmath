# Win11 Dev Assistant — SPEC (Monorepo + Nuxt 4 + React/Laravel + Docker + Full Visibility)

## 1) Goal
Create a **Windows 11** local script assistant that runs monorepo dev tasks with:
- **Visible validation/build progress** at every step
- **Live logs with timestamps** (no silent execution)
- **Explicit prompts before each command**
- **Structured error capture and recovery guidance**

Primary use-case: when installs/validate/build/dev run, you always know what is happening, what failed, and what to do next.

---

## 2) Target Environment
- Windows 11
- PowerShell 7+ preferred; must remain compatible with Windows PowerShell 5.1 where possible
- Monorepo layout includes:
  - `python-app/`
  - `nuxt-app/`
  - `react-laravel/frontend/`
  - `react-laravel/backend/`
  - `docker-compose.yml`
- Preferred package manager: **pnpm** for JavaScript projects
- Fallback package manager: **npm**, but only after explicit user confirmation

---

## 3) Non-Negotiable UX (No More “Dark” Runs)
### 3.1 Command transparency
Before every command, print:
- **Step label** (`[NUXT-VALIDATE-02]` style)
- **Command** (full command line)
- **Working directory**
- **Reason** (single sentence)
- **Expected output** (short line)

Prompt:
- `[R]un  [S]kip  [E]dit  [A]bort`

### 3.2 Live log streaming
While command is running:
- Stream stdout/stderr in real time
- Prefix each line with timestamp + step label
- Render stderr lines as errors (red if terminal supports color)
- Never buffer all output and print later

### 3.3 Heartbeat and elapsed time
For long-running commands (install/validate/build/dev/docker pulls):
- Print heartbeat every 10 seconds:
  - elapsed time
  - process still alive
  - last output timestamp

### 3.4 Required controls during long runs
- `Q` = stop process gracefully
- `K` = force kill process
- `L` = toggle compact/verbose log mode
- `T` = show tail of recent log lines

### 3.5 Error capture
On failure, capture and display:
- exit code
- failed command
- failed step label
- first error line (if detectable)
- last 200 log lines
- suggested next actions (`retry`, `edit command`, `open log`)

---

## 4) Tool Interface
### Entry point (required)
- `dev.ps1` at repo root

Modes:
- `.\dev.ps1` → interactive menu
- `.\dev.ps1 doctor` → diagnostics only
- `.\dev.ps1 up-nuxt` → Nuxt “Dev Up” flow
- `.\dev.ps1 validate-nuxt` → Nuxt validation-only flow
- `.\dev.ps1 build-nuxt` → Nuxt build flow
- `.\dev.ps1 up-react` → React/Laravel planned startup flow
- `.\dev.ps1 doctor-react` → React/Laravel diagnostics (planned)

---

## 5) Interactive Menu (Monorepo-Aware)
Minimum menu sections:

1. Doctor (All)
2. Docker/DB: Start Postgres (`docker compose up -d`)
3. Docker/DB: Stop Postgres
4. Docker/DB: Status + Logs (tail)
5. Nuxt: Install deps (`pnpm install`)
6. Nuxt: Approve builds (`pnpm approve-builds`)
7. Nuxt: Prepare (`pnpm nuxt prepare`)
8. Nuxt: Validate (`pnpm nuxt typecheck` or configured validate command)
9. Nuxt: Build (`pnpm build`)
10. Nuxt: Dev (`pnpm dev`)
11. Nuxt: Full “Dev Up”
12. React/Laravel: Doctor (planned)
13. React frontend: Install/Validate/Build (planned)
14. Laravel backend: Install/Test/Serve (planned)
15. React/Laravel: Full “Dev Up” (planned)
16. Open latest log file

Notes:
- React/Laravel items may be placeholders now, but the menu structure must exist in spec for future parity.
- Placeholder actions must clearly print `Planned - not implemented yet` and still log that event.

---

## 6) Doctor Checks (Must Be Actionable)
### 6.1 Shared checks
- Verify commands: `node`, `pnpm`, `docker`, `docker compose`, `git`
- Print versions and path to executable
- Verify files: `docker-compose.yml`, root `.env` (or `.env.example`)
- Check required ports:
  - `5432` (Postgres)
  - `3000`/`4000` (Nuxt)
  - optional React/Laravel ports if enabled

### 6.2 Nuxt checks
- Verify `nuxt-app/package.json`
- Verify `nuxt-app/nuxt.config.ts` (or equivalent config)
- Verify `nuxt-app/.env` or env source strategy
- Verify `DATABASE_URL` exists where Nuxt expects it

### 6.3 Planned React/Laravel checks
- Verify `react-laravel/frontend/package.json`
- Verify `react-laravel/backend/composer.json`
- Verify backend `.env` expectation and DB connection fields

Doctor output format:
- `✅ PASS`, `⚠️ WARN`, `❌ FAIL`
- Include exact fix hint command for each fail/warn.

---

## 7) Nuxt Validation and Build Flows (Visibility-First)
### 7.1 Validation flow (`validate-nuxt`)
Each step is confirmable (`Run/Skip/Edit/Abort`):
1. `docker compose up -d` (root)
2. `pnpm install` in `nuxt-app` (or skip if unchanged)
3. `pnpm approve-builds` in `nuxt-app` (recommended on Win11)
4. `pnpm nuxt prepare` in `nuxt-app`
5. `pnpm nuxt typecheck` (or project validate script)

### 7.2 Build flow (`build-nuxt`)
1. optional `pnpm install`
2. `pnpm nuxt prepare`
3. `pnpm build`

### 7.3 Dev Up flow (`up-nuxt`)
1. start DB
2. install/approve/prepare
3. start dev server (`pnpm dev`)

Failure policy for all flows:
- stop immediately on first failed required step
- print failure summary card
- print tail last 200 lines
- prompt: `[R]etry step  [E]dit command  [S]kip  [A]bort`

---

## 8) Logging + Run Artifacts
Store logs under:
- `./.dev-assistant/logs/YYYY-MM-DD_HH-mm-ss/`

Required files per run:
- `run.log` (full merged stream with timestamps)
- `errors.log` (stderr-only lines)
- `summary.json` including:
  - start/end time
  - host info
  - selected mode
  - steps with command, cwd, status, duration, exit code
  - detected warnings/errors signatures

Optional state:
- `./.dev-assistant/state.json` (remember preferences like compact mode)

---

## 9) Nuxt-Specific Error Detectors (Must)
Detect and provide guidance for:
- `Components directory not found`
  - explain likely components path mismatch
  - suggest creating folder or fixing `nuxt.config.ts`
- `Ignored build scripts`
  - suggest `pnpm approve-builds`
  - offer to run immediately
- missing env (`DATABASE_URL` undefined)
  - show expected env file and variable
- port already in use
  - show process/port guidance

---

## 10) Docker/DB Requirements
- `docker-compose.yml` must include `postgres`
- Required operations:
  - `up`, `down`, `status`, `logs --tail`, optional `psql` shell
- On DB connection failures:
  - print host, port, DB name, container status
  - print next-step hints (start container, verify env, check port conflicts)

---

## 11) Output Format Requirements
Step header format:
- `==[STEP 3/6][NUXT-VALIDATE] Prepare (pnpm nuxt prepare) @ nuxt-app==`

Status symbols:
- `✅` success
- `⚠️` warning
- `❌` error
- `ℹ️` info

End-of-run summary must include:
- total duration
- steps passed/skipped/failed
- link to log directory
- first failing step (if any)

---

## 12) Safety Rules
- Never run commands silently in the background.
- Never auto-fallback from `pnpm` to `npm` without explicit user confirmation.
- Never modify app source/config automatically unless user confirms.
- If command is edited by user, log both original and edited command.

---

## 13) Acceptance Criteria
- Every step prompts for `Run/Skip/Edit/Abort`.
- Validation/build steps stream live output with heartbeat.
- Failures produce clear summary + captured stderr + log tail.
- Log artifacts (`run.log`, `errors.log`, `summary.json`) are created per run.
- Nuxt `validate` and `build` flows are transparent and traceable end-to-end.
- `dev.ps1` menu includes planned React/Laravel sections (even if placeholder actions initially).

---

## 14) Nice-to-Have (v2)
- Dry-run mode (preview all commands without executing)
- Export logs as zip
- WSL detection and suggestions
- Defender/OneDrive performance guidance (advisory only)
