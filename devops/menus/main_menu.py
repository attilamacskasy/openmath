"""Main menu — top-level entry point for interactive mode."""

from __future__ import annotations

from InquirerPy import inquirer
from InquirerPy.separator import Separator

from devops.check_requirements import check_requirements
from devops.menus.dev_menu import show_dev_menu
from devops.menus.prod_menu import show_prod_menu
from devops.ui.banner import clear_screen, show_banner, show_shortcuts, wait_for_key
from devops.ui.theme import CYAN, DIM, RESET, THEME
from devops.utils.display import open_latest_log
from devops.utils.version_sync import bump_version, check_versions, sync_versions


def show_main_menu() -> None:
    """Display the top-level DEV / PROD arrow-key menu loop."""
    while True:
        clear_screen()
        show_banner()
        try:
            choice = inquirer.select(
                message="What would you like to do?",
                choices=[
                    {"name": "DEV   Local development (Docker + uvicorn + ng serve)", "value": "dev"},
                    {"name": "PROD  Production deployment (build, local, remote)", "value": "prod"},
                    Separator(),
                    {"name": "Check Requirements", "value": "check-reqs"},
                    {"name": "Open Latest Log", "value": "open-log"},
                    {"name": "? Shortcuts", "value": "shortcuts"},
                    Separator("── Versioning ─────────────────────────────────"),
                    {"name": "Check Versions    Compare version.json vs actual files",   "value": "check-ver"},
                    {"name": "Sync Versions     Propagate version.json → all components", "value": "sync-ver"},
                    {"name": "Bump Version      Update version and sync everywhere",      "value": "bump-ver"},
                    Separator(),
                    {"name": "Exit", "value": "exit"},
                ],
                style=THEME,
                pointer="›",
                qmark="",
                amark="",
                instruction="",
                long_instruction="↑/↓ navigate · Enter select · Ctrl+C exit",
                mandatory=False,
                keybindings={"skip": [{"key": "escape"}]},
            ).execute()
        except (KeyboardInterrupt, EOFError):
            choice = None

        if choice is None or choice == "exit":
            return
        elif choice == "dev":
            show_dev_menu()
        elif choice == "prod":
            show_prod_menu()
        elif choice == "check-reqs":
            check_requirements()
            wait_for_key()
        elif choice == "open-log":
            open_latest_log()
            wait_for_key()
        elif choice == "shortcuts":
            show_shortcuts()
        elif choice == "check-ver":
            check_versions()
            wait_for_key()
        elif choice == "sync-ver":
            sync_versions()
            wait_for_key()
        elif choice == "bump-ver":
            bump_version()
            wait_for_key()
