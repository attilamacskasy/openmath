"""PROD sub-menu — container builds, local deployment, remote deployment."""

from __future__ import annotations

from devops.prod.builds import prod_build_all, prod_build_component
from devops.prod.local import prod_local_down, prod_local_reset, prod_local_status, prod_local_up
from devops.prod.remote import remote_down, remote_push, remote_setup, remote_status, remote_up
from devops.utils.display import show_not_implemented


def show_prod_menu() -> None:
    """Display the PROD sub-menu loop."""
    while True:
        print()
        print("\033[95m═══════════════════════════════════════════════════════════════\033[0m")
        print("\033[95m  PROD — Docker Container Deployment\033[0m")
        print("\033[95m═══════════════════════════════════════════════════════════════\033[0m")
        print()
        print("  \033[90mCurrent Prod Stack: Postgres + Python FastAPI + Angular/PrimeNG\033[0m")
        print()
        print("  \033[96m─── Build Container Images ───\033[0m")
        print("  [B1] Build ALL images (database + backend + frontend)")
        print("  [B2] Build Database image")
        print("  [B3] Build Backend image (python-api)")
        print("  \033[90m[B4] Build Frontend 1 (React)       — not yet implemented\033[0m")
        print("  [B5] Build Frontend 2 (Nuxt)")
        print("  [B6] Build Frontend 3 (Angular)")
        print("  \033[90m[B7] Build Frontend 4 (Svelte)      — not yet implemented\033[0m")
        print()
        print("  \033[96m─── Deploy to Local Docker (Docker Desktop) ───\033[0m")
        print("  [L1] Start all containers")
        print("  [L2] Stop all containers")
        print("  [L3] Status + Logs")
        print("  [L4] Reset (stop + remove volumes + rebuild)")
        print()
        print("  \033[96m─── Deploy to Remote Docker (Ubuntu 24 Server) ───\033[0m")
        print("  [R1] Setup remote host (SSH key, Docker install check)")
        print("  [R2] Push images to remote")
        print("  [R3] Start all containers on remote")
        print("  [R4] Stop all containers on remote")
        print("  [R5] Status + Logs (remote)")
        print()
        print("  [0] Back to main menu")
        print()

        choice = input("Choose: ").strip().upper()

        actions = {
            # Build
            "B1": prod_build_all,
            "B2": lambda: prod_build_component("postgres", "Database"),
            "B3": lambda: prod_build_component("python-api", "Backend"),
            "B4": lambda: show_not_implemented("React frontend build", "docs/spec_react_fastapi.md"),
            "B5": lambda: prod_build_component("nuxt-app", "Nuxt"),
            "B6": lambda: prod_build_component("angular-app", "Angular"),
            "B7": lambda: show_not_implemented("Svelte frontend build", "docs/spec_svelte_fastapi.md"),
            # Local deploy
            "L1": prod_local_up,
            "L2": prod_local_down,
            "L3": prod_local_status,
            "L4": prod_local_reset,
            # Remote deploy
            "R1": remote_setup,
            "R2": remote_push,
            "R3": remote_up,
            "R4": remote_down,
            "R5": remote_status,
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
