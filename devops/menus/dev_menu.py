"""DEV sub-menu — per-component actions for local development."""

from __future__ import annotations

from devops.components.angular import angular_build, angular_init, angular_start, angular_status, angular_stop
from devops.components.database import db_build, db_init, db_migrations, db_start, db_status, db_stop
from devops.components.fastapi import fastapi_init, fastapi_start, fastapi_status, fastapi_stop
from devops.components.nuxt import nuxt_build, nuxt_init, nuxt_start, nuxt_status, nuxt_stop, nuxt_validate
from devops.components.quickstart import dev_quick_start
from devops.utils.display import show_not_implemented


def show_dev_menu() -> None:
    """Display the DEV sub-menu loop."""
    while True:
        print()
        print("\033[92m═══════════════════════════════════════════════════════════════\033[0m")
        print("\033[92m  DEV — Windows 11 — Docker + uvicorn + ng serve / Vite\033[0m")
        print("\033[92m═══════════════════════════════════════════════════════════════\033[0m")
        print()
        print("  \033[90mCurrent Dev Stack: Postgres + Python FastAPI + Angular/PrimeNG\033[0m")
        print()
        print("  \033[92m[Q] Quick Start Dev Stack (Postgres + FastAPI + Angular)\033[0m")
        print()
        print("  \033[96m─── Database 1 (Docker / PostgreSQL) ───\033[0m")
        print("  [D1] Init (verify Docker, create .env)")
        print("  [D2] Build (docker compose build)")
        print("  [D3] Start (docker compose up -d)")
        print("  [D4] Apply Migrations")
        print("  [D5] Stop (docker compose down)")
        print("  [D6] Status + Logs")
        print()
        print("  \033[96m─── Backend 1 (Python FastAPI) ───\033[0m")
        print("  [B1] Init (create venv, install deps)")
        print("  [B2] Start (uvicorn --reload)")
        print("  [B3] Stop")
        print("  [B4] Status + Logs")
        print()
        print("  \033[90m─── Frontend 1 (React JS) ───\033[0m")
        print("  \033[90m[F1] Not yet implemented\033[0m")
        print()
        print("  \033[96m─── Frontend 2 (Vue.js / Nuxt 4) ───\033[0m")
        print("  [N1] Init (pnpm install, approve builds, nuxt prepare)")
        print("  [N2] Start (Vite dev server)")
        print("  [N3] Stop")
        print("  [N4] Validate (typecheck)")
        print("  [N5] Build")
        print("  [N6] Status + Logs")
        print()
        print("  \033[96m─── Frontend 3 (Angular + PrimeNG) ───\033[0m")
        print("  [A1] Init (pnpm install)")
        print("  [A2] Start (ng serve)")
        print("  [A3] Stop")
        print("  [A4] Build")
        print("  [A5] Status + Logs")
        print()
        print("  \033[90m─── Frontend 4 (Svelte) ───\033[0m")
        print("  \033[90m[V1] Not yet implemented\033[0m")
        print()
        print("  [0] Back to main menu")
        print()

        choice = input("Choose: ").strip().upper()

        actions = {
            # Quick Start
            "Q": dev_quick_start,
            # Database
            "D1": db_init,
            "D2": db_build,
            "D3": db_start,
            "D4": db_migrations,
            "D5": db_stop,
            "D6": db_status,
            # Backend
            "B1": fastapi_init,
            "B2": fastapi_start,
            "B3": fastapi_stop,
            "B4": fastapi_status,
            # Frontend 1 — React (placeholder)
            "F1": lambda: show_not_implemented("React JS frontend", "docs/spec_react_fastapi.md"),
            # Frontend 2 — Nuxt
            "N1": nuxt_init,
            "N2": nuxt_start,
            "N3": nuxt_stop,
            "N4": nuxt_validate,
            "N5": nuxt_build,
            "N6": nuxt_status,
            # Frontend 3 — Angular
            "A1": angular_init,
            "A2": angular_start,
            "A3": angular_stop,
            "A4": angular_build,
            "A5": angular_status,
            # Frontend 4 — Svelte (placeholder)
            "V1": lambda: show_not_implemented("Svelte frontend", "docs/spec_svelte_fastapi.md"),
        }

        if choice == "0":
            return
        elif choice in actions:
            try:
                actions[choice]()
            except Exception as exc:
                print(f"\033[91mError: {exc}\033[0m")
        else:
            print("\033[93mInvalid choice.\033[0m")
