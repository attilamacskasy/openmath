"""DEV sub-menu — per-component actions for local development."""

from __future__ import annotations

from InquirerPy import inquirer
from InquirerPy.separator import Separator

from devops.components.angular import angular_build, angular_init, angular_start, angular_status, angular_stop
from devops.components.database import db_build, db_init, db_migrations, db_start, db_status, db_stop
from devops.components.fastapi import fastapi_init, fastapi_start, fastapi_status, fastapi_stop
from devops.components.nuxt import nuxt_build, nuxt_init, nuxt_start, nuxt_status, nuxt_stop, nuxt_validate
from devops.components.quickstart import dev_quick_start, dev_quick_stop
from devops.ui.banner import clear_screen, show_banner, wait_for_key
from devops.ui.theme import CYAN, DIM, GREEN, RED, RESET, YELLOW, THEME


# ── Human-readable feedback per action key ────────────────
_STATUS_MSG: dict[str, str] = {
    "quick-start": "✅ Dev stack started  (DB + FastAPI + Angular)",
    "quick-stop":  "✅ Dev stack stopped  (Docker down, servers closed)",
    "db-init":     "✅ Database initialised",
    "db-build":    "✅ Database containers built",
    "db-start":    "✅ Database started  (docker compose up)",
    "db-migrate":  "✅ Migrations applied",
    "db-stop":     "✅ Database stopped  (docker compose down)",
    "db-status":   "ℹ️  Database status shown",
    "fastapi-init":   "✅ FastAPI venv + deps installed",
    "fastapi-start":  "✅ FastAPI server started  (http://localhost:8000)",
    "fastapi-stop":   "✅ FastAPI server stopped",
    "fastapi-status": "ℹ️  FastAPI status shown",
    "angular-init":   "✅ Angular dependencies installed",
    "angular-start":  "✅ Angular dev server started  (http://localhost:4200)",
    "angular-stop":   "✅ Angular dev server stopped",
    "angular-build":  "✅ Angular production build complete",
    "angular-status": "ℹ️  Angular status shown",
    "nuxt-init":      "✅ Nuxt dependencies installed",
    "nuxt-start":     "✅ Nuxt dev server started",
    "nuxt-stop":      "✅ Nuxt dev server stopped",
    "nuxt-validate":  "✅ Nuxt typecheck complete",
    "nuxt-build":     "✅ Nuxt production build complete",
    "nuxt-status":    "ℹ️  Nuxt status shown",
}


# ── Action dispatch table ───────────────────────────────────
_ACTIONS: dict[str, object] = {
    "quick-start": dev_quick_start,
    "quick-stop": dev_quick_stop,
    # Database
    "db-init": db_init,
    "db-build": db_build,
    "db-start": db_start,
    "db-migrate": db_migrations,
    "db-stop": db_stop,
    "db-status": db_status,
    # Backend
    "fastapi-init": fastapi_init,
    "fastapi-start": fastapi_start,
    "fastapi-stop": fastapi_stop,
    "fastapi-status": fastapi_status,
    # Nuxt
    "nuxt-init": nuxt_init,
    "nuxt-start": nuxt_start,
    "nuxt-stop": nuxt_stop,
    "nuxt-validate": nuxt_validate,
    "nuxt-build": nuxt_build,
    "nuxt-status": nuxt_status,
    # Angular
    "angular-init": angular_init,
    "angular-start": angular_start,
    "angular-stop": angular_stop,
    "angular-build": angular_build,
    "angular-status": angular_status,
}


def show_dev_menu() -> None:
    """Display the DEV sub-menu with arrow-key navigation."""
    _last_status: str | None = None

    while True:
        clear_screen()
        show_banner()
        print(f"  {GREEN}DEV — Local Development{RESET}")
        print(f"  {DIM}Stack: Postgres + FastAPI + Angular/PrimeNG{RESET}")
        if _last_status:
            print()
            print(f"  {CYAN}{_last_status}{RESET}")
        print()

        try:
            choice = inquirer.select(
                message="Select action:",
                choices=[
                    {"name": "Quick Start (DB + FastAPI + Angular)",    "value": "quick-start"},
                    {"name": "Quick Stop  (Docker + FastAPI + Angular)",   "value": "quick-stop"},
                    Separator("── Database (Docker / PostgreSQL) ──────────────"),
                    {"name": "Init          Verify Docker, create .env",   "value": "db-init"},
                    {"name": "Build         docker compose build",          "value": "db-build"},
                    {"name": "Start         docker compose up -d",          "value": "db-start"},
                    {"name": "Migrations    Apply SQL migrations",          "value": "db-migrate"},
                    {"name": "Stop          docker compose down",           "value": "db-stop"},
                    {"name": "Status        Show DB status + logs",         "value": "db-status"},
                    Separator("── Backend (Python FastAPI) ────────────────────"),
                    {"name": "Init          Create venv, install deps",     "value": "fastapi-init"},
                    {"name": "Start         uvicorn --reload",              "value": "fastapi-start"},
                    {"name": "Stop          Stop dev server",               "value": "fastapi-stop"},
                    {"name": "Status        Show backend status + logs",    "value": "fastapi-status"},
                    Separator("── Frontend: Angular + PrimeNG ─────────────────"),
                    {"name": "Init          pnpm install",                  "value": "angular-init"},
                    {"name": "Start         ng serve",                      "value": "angular-start"},
                    {"name": "Stop          Stop dev server",               "value": "angular-stop"},
                    {"name": "Build         Production build",              "value": "angular-build"},
                    {"name": "Status        Show frontend status + logs",   "value": "angular-status"},
                    Separator("── Frontend: Nuxt 4 (Vue) ──────────────────────"),
                    {"name": "Init          pnpm install + nuxt prepare",   "value": "nuxt-init"},
                    {"name": "Start         Vite dev server",               "value": "nuxt-start"},
                    {"name": "Stop          Stop dev server",               "value": "nuxt-stop"},
                    {"name": "Validate      Typecheck",                     "value": "nuxt-validate"},
                    {"name": "Build         Production build",              "value": "nuxt-build"},
                    {"name": "Status        Show Nuxt status + logs",       "value": "nuxt-status"},
                    Separator(),
                    {"name": "← Back",                                      "value": "back"},
                ],
                style=THEME,
                pointer="›",
                qmark="",
                amark="",
                instruction="",
                long_instruction="↑/↓ navigate · Enter select · Esc back",
                mandatory=False,
                keybindings={"skip": [{"key": "escape"}]},
            ).execute()
        except (KeyboardInterrupt, EOFError):
            choice = None

        if choice is None or choice == "back":
            return

        action = _ACTIONS.get(choice)
        if action:
            try:
                action()  # type: ignore[operator]
                _last_status = _STATUS_MSG.get(choice)
            except Exception as exc:
                _last_status = f"❌ Error: {exc}"
                print(f"\033[91mError: {exc}\033[0m")
            wait_for_key()
