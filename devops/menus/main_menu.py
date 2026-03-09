"""Main menu — top-level entry point for interactive mode."""

from __future__ import annotations

from devops.check_requirements import check_requirements
from devops.menus.dev_menu import show_dev_menu
from devops.menus.prod_menu import show_prod_menu
from devops.utils.display import open_latest_log


def show_main_menu() -> None:
    """Display the top-level DEV / PROD menu loop."""
    while True:
        print()
        print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
        print("\033[96m  OpenMath DevOps Console (dev.py)\033[0m")
        print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
        print()
        print("  \033[92m[D] DEV  — Windows 11 — Docker + uvicorn + ng serve / Vite\033[0m")
        print("  \033[95m[P] PROD — Docker containers — local or remote deployment\033[0m")
        print("  \033[93m[H] Check Requirements (verify all prerequisites)\033[0m")
        print("  [L] Open latest log")
        print("  [0] Exit")
        print()

        choice = input("Choose: ").strip().upper()
        if choice == "D":
            show_dev_menu()
        elif choice == "P":
            show_prod_menu()
        elif choice == "H":
            check_requirements()
        elif choice == "L":
            open_latest_log()
        elif choice == "0":
            return
        else:
            print("\033[93mInvalid choice. Press D, P, H, L, or 0.\033[0m")
