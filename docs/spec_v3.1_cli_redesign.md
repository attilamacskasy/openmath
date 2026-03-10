# spec v3.1 — CLI Redesign (Arrow-Key Navigation)

> Redesign the `dev.py` interactive console to use arrow-key driven menus,
> an ASCII art banner, status bar, and shortcut hints — inspired by the
> Claude Code terminal experience.

---

## 1. Goals

1. Replace all `input("Choose: ")` text prompts with **arrow-key navigable menus**
2. Add a branded **ASCII art banner** shown on launch
3. Show a **status bar** with project info beneath the banner
4. Add **`?` shortcut** to display keyboard shortcuts at any time
5. Keep all existing functionality — only the presentation layer changes
6. Remain a **pure-Python** solution with one small dependency (`InquirerPy`)
7. No color theme selector — use a single dark-mode palette throughout

---

## 2. Dependency

| Package      | Purpose                                    |
|--------------|--------------------------------------------|
| `InquirerPy` | Arrow-key select, checkbox, confirm prompts |

Install: `pip install InquirerPy`

InquirerPy wraps `prompt_toolkit` and gives us:
- `inquirer.select()` — single-choice arrow-key list
- `inquirer.checkbox()` — multi-select with spacebar
- `inquirer.confirm()` — yes/no
- `inquirer.text()` — free-form input
- Separator lines inside menus
- Theming / colors

---

## 3. Color Palette (Dark Mode Only)

| Role            | ANSI / Hex     | Usage                          |
|-----------------|----------------|--------------------------------|
| Banner          | Bright Cyan    | ASCII art + title line         |
| Section header  | Bright Green   | `── Database ──`, `── Backend ──` |
| Active item     | Bright White   | Currently highlighted menu row |
| Dimmed / N/A    | Dark Gray      | Not-yet-implemented items      |
| Error           | Bright Red     | Error messages                 |
| Success         | Bright Green   | Checkmarks, success output     |
| Warning         | Bright Yellow  | Warnings, skipped steps        |
| Status bar      | Dim Cyan       | Model / version / path strip   |

---

## 4. Screen Layouts

### 4.1 — Launch Screen (Banner + Main Menu)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ██████╗ ██████╗ ███████╗███╗   ██╗███╗   ███╗ █████╗ ████████╗██╗  ██╗         │
│  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║████╗ ████║██╔══██╗╚══██╔══╝██║  ██║         │
│  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██╔████╔██║███████║   ██║   ███████║         │
│  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║╚██╔╝██║██╔══██║   ██║   ██╔══██║         │
│  ╚██████╔╝██║     ███████╗██║ ╚████║██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║         │
│   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝         │
│                                                                                  │
│  DevOps Console v3.1                                                             │
│  ──────────────────────────────────────────────────────────────────────────────  │
│  Python 3.14  ·  Node 24  ·  Docker 29  ·  pnpm 10                               │
│  C:\Users\attila\Desktop\Code\openmath                                           │
│  ──────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  ? shortcuts                                                                     │
│                                                                                  │
│  What would you like to do?                                                      │
│                                                                                  │
│  › DEV   Local development (Docker + uvicorn + ng serve)                         │
│    PROD  Production deployment (build, local, remote)                            │
│    ──────────────────────────────────────────                                    │
│    Check Requirements                                                            │
│    Open Latest Log                                                               │
│    ──────────────────────────────────────────                                    │
│    Exit                                                                          │
│                                                                                  │
│  ↑/↓ navigate  ·  Enter select  ·  ? shortcuts  ·  Ctrl+C exit                   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- `›` marker on the currently highlighted row (moves with ↑/↓)
- Separator lines group related items
- Status bar shows detected tool versions (auto-detected, no Doctor run needed)
- Banner only shown once per session (not re-drawn when returning to main menu)

---

### 4.2 — DEV Sub-Menu

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  DEV — Local Development                                            │
│  Stack: Postgres + FastAPI + Angular/PrimeNG                        │
│                                                                     │
│  › Quick Start (DB + FastAPI + Angular)                             │  
│    ── Database (Docker / PostgreSQL) ──────────────────             │
│    Init          Verify Docker, create .env                         │
│    Build         docker compose build                               │
│    Start         docker compose up -d                               │
│    Migrations    Apply SQL migrations                               │
│    Stop          docker compose down                                │
│    Status        Show DB status + logs                              │
│    ── Backend (Python FastAPI) ────────────────────────             │
│    Init          Create venv, install deps                          │
│    Start         uvicorn --reload                                   │
│    Stop          Stop dev server                                    │
│    Status        Show backend status + logs                         │
│    ── Frontend: Angular + PrimeNG ─────────────────────             │
│    Init          pnpm install                                       │
│    Start         ng serve                                           │
│    Stop          Stop dev server                                    │
│    Build         Production build                                   │
│    Status        Show frontend status + logs                        │
│    ── Frontend: Nuxt 4 (Vue) ──────────────────────────             │
│    Init          pnpm install + nuxt prepare                        │
│    Start         Vite dev server                                    │
│    Stop          Stop dev server                                    │
│    Validate      Typecheck                                          │
│    Build         Production build                                   │
│    Status        Show Nuxt status + logs                            │
│    ──────────────────────────────────────────                       │
│    ← Back                                                           │
│                                                                     │
│  ↑/↓ navigate  ·  Enter select  ·  ? shortcuts  ·  Esc back         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Notes:**
- Section headers (e.g. `── Database ──`) are `Separator` items — not selectable
- Items that are not yet implemented (React, Svelte) are omitted entirely
  (no grayed-out placeholders cluttering the menu)
- Each item has a short label + description on the same row
- `← Back` at the bottom returns to main menu
- `Esc` key also goes back

---

### 4.3 — PROD Sub-Menu

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  PROD — Production Deployment                                       │
│  Stack: Postgres + FastAPI + Angular/PrimeNG (Docker)               │
│                                                                     │
│  › ── Build Container Images ──────────────────────────             │
│    Build ALL         Build all production images                    │
│    Build Backend     python-api image                               │
│    Build Angular     Angular frontend image                         │
│    Build Nuxt        Nuxt frontend image                            │
│    ── Local Docker (Docker Desktop) ───────────────────             │
│    Start             Start all containers                           │
│    Stop              Stop all containers                            │
│    Status            Container status + logs                        │
│    Reset             Stop + remove volumes + rebuild                │
│    ── Remote Docker (Ubuntu 24 Server) ────────────────             │
│    Setup             Configure SSH + Docker check                   │
│    Push              Push images to remote                          │
│    Start             Start remote containers                        │
│    Stop              Stop remote containers                         │
│    Status            Remote status + logs                           │
│    ──────────────────────────────────────────                       │
│    ← Back                                                           │
│                                                                     │
│  ↑/↓ navigate  ·  Enter select  ·  ? shortcuts  ·  Esc back         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 — Shortcuts Overlay (triggered by `?`)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Keyboard Shortcuts                                                 │
│  ─────────────────────────────────────────                          │
│                                                                     │
│  ↑ / ↓          Navigate menu items                                 │
│  Enter           Select / confirm                                   │
│  Esc             Go back / cancel                                   │
│  Ctrl+C          Exit immediately                                   │
│  ?               Show this help                                     │
│                                                                     │
│  CLI Shortcuts (bypass menus)                                       │
│  ─────────────────────────────────────────                          │
│                                                                     │
│  python dev.py dev-quick       Quick Start (DB + API + Angular)     │
│  python dev.py db-start        Start PostgreSQL                     │
│  python dev.py fastapi-start   Start FastAPI server                 │
│  python dev.py angular-start   Start Angular server                 │
│  python dev.py check-reqs      Verify all prerequisites             │
│  python dev.py help            Show all CLI modes                   │
│  python dev.py --auto-approve  Skip all confirmation prompts        │
│                                                                     │
│  Press any key to close...                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.5 — Step Execution Output (unchanged behavior)

When a menu item is selected and runs, it drops into the existing
`runner.py` flow — streaming command output in real-time.  No UI changes
needed here. After execution finishes or fails, the user is returned
to the sub-menu they came from.

```
  ==[STEP 1/4][DEV-QUICK] DB Start (docker compose up -d) @ C:\...\openmath==
  Running step automatically.
  [2026-03-10 01:02:03] Container openmath-local-dev-db  Started
  ✅ DB Start finished with exit code 0

  ==[STEP 2/4][DEV-QUICK] FastAPI Install ...==
  Running step automatically.
  ...
```

---

## 5. Architecture Changes

### 5.1 New file: `devops/ui/theme.py`

Central color/style definitions using `InquirerPy` theming:

```python
THEME = {
    "questionmark": {"fg": "#00d7ff"},   # cyan
    "question": {"fg": "#ffffff"},
    "pointer": {"fg": "#00ff87"},         # green arrow
    "highlighted": {"fg": "#00ff87"},     # selected row
    "separator": {"fg": "#585858"},       # dim section headers
    "instruction": {"fg": "#585858"},
    "answer": {"fg": "#00d7ff"},
}
```

### 5.2 New file: `devops/ui/banner.py`

- `show_banner()` — print ASCII art + version line
- `show_status_bar()` — detect & display tool versions inline
- `show_shortcuts()` — print shortcuts overlay, wait for keypress

### 5.3 Modified files

| File                        | Change                                           |
|-----------------------------|--------------------------------------------------|
| `devops/menus/main_menu.py` | Replace `input()` loop with `inquirer.select()`  |
| `devops/menus/dev_menu.py`  | Replace `input()` loop with `inquirer.select()`  |
| `devops/menus/prod_menu.py` | Replace `input()` loop with `inquirer.select()`  |
| `devops/__main_impl.py`     | Call `show_banner()` on interactive `menu` mode  |
| `requirements.txt` (root)   | Add `InquirerPy` dependency                      |

### 5.4 Files NOT changed

| File                     | Reason                                     |
|--------------------------|--------------------------------------------|
| `devops/cli.py`          | CLI mode routing stays identical           |
| `devops/core/runner.py`  | Step execution engine stays identical      |
| `devops/core/state.py`   | No state changes needed                    |
| `devops/components/*.py` | Component actions are UI-agnostic          |
| `devops/prod/*.py`       | Prod actions are UI-agnostic               |

---

## 6. Menu Item Data Structure

Each selectable menu choice maps to:

```python
{
    "name": "Start         docker compose up -d",   # display text
    "value": "db-start",                              # action key
}
```

Separators use `InquirerPy.separator.Separator`:

```python
Separator("── Database (Docker / PostgreSQL) ──")
```

The action key maps to a function via a dict, same pattern as today.

---

## 7. Banner Shown Once Per Session

- `show_banner()` is called in `__main_impl.py` only when `mode == "menu"`
- When returning from a sub-menu back to main menu, the banner is NOT re-printed
- The main menu loop re-shows only the `inquirer.select()` prompt

---

## 8. `?` Shortcut Binding

InquirerPy supports custom key bindings. We bind `?` to display the
shortcuts overlay without leaving the current menu:

```python
from prompt_toolkit.keys import Keys

@kb.add("?")
def show_help(event):
    show_shortcuts()
```

After the overlay is dismissed (any key), the menu prompt re-renders.

---

## 9. Esc Key Behavior

- In sub-menus (DEV / PROD): `Esc` returns to main menu
  (equivalent to selecting `← Back`)
- In main menu: `Esc` exits the application
  (equivalent to selecting `Exit`)

Implemented by catching `KeyboardInterrupt` / adding `← Back` as last
choice and handling `Esc` key binding.

---

## 10. CLI (Non-Interactive) Modes Unaffected

Running `python dev.py db-start` or any named mode bypasses the
interactive menus entirely. The arrow-key UI only applies to the
`menu` mode (default when no argument is given).

---

## 11. Implementation Plan

| Step | Task                                              |
|------|---------------------------------------------------|
| 1    | `pip install InquirerPy` + add to requirements    |
| 2    | Create `devops/ui/__init__.py`                    |
| 3    | Create `devops/ui/theme.py` — palette + theme     |
| 4    | Create `devops/ui/banner.py` — ASCII art + status |
| 5    | Rewrite `main_menu.py` with `inquirer.select()`   |
| 6    | Rewrite `dev_menu.py` with `inquirer.select()`    |
| 7    | Rewrite `prod_menu.py` with `inquirer.select()`   |
| 8    | Update `__main_impl.py` to show banner on launch  |
| 9    | Test all menu flows interactively                 |
| 10   | Test CLI shortcut modes still work                |

---

## 12. Acceptance Criteria

1. Launching `python dev.py` shows ASCII art banner + status bar
2. Main menu navigable with ↑/↓ arrows, Enter to select
3. DEV sub-menu navigable with ↑/↓, sections separated visually
4. PROD sub-menu navigable with ↑/↓, sections separated visually
5. `?` key shows shortcuts overlay from any menu
6. `Esc` goes back from sub-menus, exits from main menu
7. `Ctrl+C` exits cleanly from anywhere
8. All CLI modes (`python dev.py db-start` etc.) continue to work unchanged
9. No color theme selector — dark-mode only
10. Banner shown once per session, not repeated on menu re-entry
