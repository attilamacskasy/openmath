"""PROD sub-menu — container builds, local deployment, remote deployment."""

from __future__ import annotations

from InquirerPy import inquirer
from InquirerPy.separator import Separator

from devops.prod.builds import prod_build_all, prod_build_component
from devops.prod.database import db_backup, db_list_backups, db_migrate, db_restore, db_status
from devops.prod.local import prod_local_down, prod_local_reset, prod_local_status, prod_local_up
from devops.prod.remote import remote_down, remote_push, remote_setup, remote_status, remote_up
from devops.ui.banner import clear_screen, show_banner, wait_for_key
from devops.ui.theme import CYAN, DIM, RED, RESET, THEME
from devops.utils.promote_admin import promote_first_admin


# ── Human-readable feedback per action key ────────────────
_STATUS_MSG: dict[str, str] = {
    "build-all":     "✅ All production images built",
    "build-backend": "✅ Backend image built",
    "build-angular": "✅ Angular image built",
    "build-db":      "✅ PostgreSQL image built",
    "db-backup":     "✅ Database backup created",
    "db-restore":    "✅ Database restored from backup",
    "db-migrate":    "✅ Database migrations applied",
    "db-status":     "ℹ️  Database status shown",
    "db-list":       "ℹ️  Backup list shown",
    "local-start":   "✅ Local containers started",
    "local-stop":    "✅ Local containers stopped",
    "local-status":  "ℹ️  Local container status shown",
    "local-reset":   "✅ Local containers reset",
    "remote-setup":  "✅ Remote host configured",
    "remote-push":   "✅ Images pushed to remote",
    "remote-start":  "✅ Remote containers started",
    "remote-stop":   "✅ Remote containers stopped",
    "remote-status": "ℹ️  Remote status shown",
    "promote-admin": "✅ First user promoted to admin",
}


# ── Action dispatch table ───────────────────────────────────
_ACTIONS: dict[str, object] = {
    # Build
    "build-all": prod_build_all,
    "build-backend": lambda: prod_build_component("python-api", "Backend"),
    "build-angular": lambda: prod_build_component("angular-app", "Angular"),
    "build-db": lambda: prod_build_component("postgresql", "PostgreSQL"),
    # Database
    "db-backup": db_backup,
    "db-restore": db_restore,
    "db-migrate": db_migrate,
    "db-status": db_status,
    "db-list": db_list_backups,
    # Local deploy
    "local-start": prod_local_up,
    "local-stop": prod_local_down,
    "local-status": prod_local_status,
    "local-reset": prod_local_reset,
    # Remote deploy
    "remote-setup": remote_setup,
    "remote-push": remote_push,
    "remote-start": remote_up,
    "remote-stop": remote_down,
    "remote-status": remote_status,
    # Utility
    "promote-admin": promote_first_admin,
}


def show_prod_menu() -> None:
    """Display the PROD sub-menu with arrow-key navigation."""
    _last_status: str | None = None

    while True:
        clear_screen()
        show_banner()
        print(f"  {CYAN}PROD — Production Deployment{RESET}")
        print(f"  {DIM}Stack: Postgres + FastAPI + Angular/PrimeNG (Docker){RESET}")
        if _last_status:
            print()
            print(f"  {CYAN}{_last_status}{RESET}")
        print()

        try:
            choice = inquirer.select(
                message="Select action:",
                choices=[
                    Separator("── Build Container Images ──────────────────────"),
                    {"name": "Build ALL         Build all production images",              "value": "build-all"},
                    {"name": "Build Backend     openmath/python-api:latest",               "value": "build-backend"},
                    {"name": "Build Angular     openmath/angular-app:latest",              "value": "build-angular"},
                    {"name": "Build PostgreSQL  postgres:16-alpine (pull)",                "value": "build-db"},
                    Separator("── Database ───────────────────────────────────"),
                    {"name": "Status            Connection check + table stats", "value": "db-status"},
                    {"name": "Run Migrations    Apply db/migrations/*.sql",     "value": "db-migrate"},
                    {"name": "Backup            Create pg_dump → backups/",     "value": "db-backup"},
                    {"name": "Restore           Restore from backup file",      "value": "db-restore"},
                    {"name": "List Backups      Show available backups",        "value": "db-list"},
                    Separator("── Local Docker (Docker Desktop) ───────────────"),
                    {"name": "Start             Start all containers",           "value": "local-start"},
                    {"name": "Stop              Stop all containers",            "value": "local-stop"},
                    {"name": "Status            Container status + logs",        "value": "local-status"},
                    {"name": "Reset             Stop + remove volumes + rebuild","value": "local-reset"},
                    Separator("── Remote Docker (Ubuntu 24 Server) ────────────"),
                    {"name": "Setup             Configure SSH + Docker check",   "value": "remote-setup"},
                    {"name": "Push              Push images to remote",          "value": "remote-push"},
                    {"name": "Start             Start remote containers",        "value": "remote-start"},
                    {"name": "Stop              Stop remote containers",         "value": "remote-stop"},
                    {"name": "Status            Remote status + logs",           "value": "remote-status"},
                    Separator("── Utility ────────────────────────────────────"),
                    {"name": "Promote Admin     Make first user an admin",        "value": "promote-admin"},
                    Separator(),
                    {"name": "← Back",                                           "value": "back"},
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
