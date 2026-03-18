"""CLI mode router — maps --mode arguments to functions, prints help."""

from __future__ import annotations

from devops.check_requirements import check_requirements
from devops.components.angular import angular_build, angular_init, angular_start, angular_status, angular_stop
from devops.components.database import db_build, db_init, db_migrations, db_start, db_status, db_stop
from devops.components.fastapi import fastapi_init, fastapi_start, fastapi_status, fastapi_stop
from devops.components.nuxt import nuxt_build, nuxt_init, nuxt_start, nuxt_status, nuxt_stop, nuxt_validate
from devops.components.quickstart import dev_quick_start, dev_quick_stop
from devops.menus.main_menu import show_main_menu
from devops.prod.builds import prod_build_all
from devops.prod.database import db_backup as prod_db_backup, db_list_backups as prod_db_list, db_migrate as prod_db_migrate, db_restore as prod_db_restore
from devops.prod.local import prod_local_down, prod_local_reset, prod_local_status, prod_local_up
from devops.prod.remote import remote_down, remote_push, remote_setup, remote_status, remote_up
from devops.utils.promote_admin import promote_first_admin
from devops.utils.version_sync import bump_version, check_versions, sync_versions


def print_help() -> None:
    """Print all available CLI modes."""
    C = "\033[96m"
    G = "\033[92m"
    M = "\033[95m"
    Y = "\033[93m"
    D = "\033[90m"
    R = "\033[0m"

    print()
    print(f"{C}Available modes:{R}")
    print()
    print(f"  {G}Menu:{R}")
    print("    menu              Interactive menu (default)")
    print()
    print(f"  {G}DEV shortcuts:{R}")
    print("    dev-quick         Quick start: DB + FastAPI + Angular")
    print("    dev-stop          Quick stop: Angular + FastAPI + Docker")
    print("    db-init           Init database prerequisites")
    print("    db-build          Build database containers")
    print("    db-start          Start PostgreSQL + Adminer")
    print("    db-stop           Stop database containers")
    print("    db-migrate        Apply SQL migrations")
    print("    db-status         Show database status")
    print("    fastapi-init      Create venv + install deps")
    print("    fastapi-start     Start FastAPI dev server")
    print("    fastapi-stop      Stop FastAPI dev server")
    print("    fastapi-status    Show FastAPI status")
    print("    nuxt-init         Install Nuxt dependencies")
    print("    nuxt-start        Start Nuxt dev server")
    print("    nuxt-stop         Stop Nuxt dev server")
    print("    nuxt-validate     Typecheck Nuxt project")
    print("    nuxt-build        Build Nuxt for production")
    print("    nuxt-status       Show Nuxt status")
    print("    angular-init      Install Angular dependencies")
    print("    angular-start     Start Angular dev server")
    print("    angular-stop      Stop Angular dev server")
    print("    angular-build     Build Angular for production")
    print("    angular-status    Show Angular status")
    print()
    print(f"  {M}PROD shortcuts:{R}")
    print("    prod-build        Build all production images")
    print("    prod-local-up     Start local prod containers")
    print("    prod-local-down   Stop local prod containers")
    print("    prod-local-status Show local prod status")
    print("    prod-local-reset  Reset local prod (rebuild)")
    print("    prod-remote-setup Configure remote host")
    print("    prod-remote-push  Push images to remote")
    print("    prod-remote-up    Start remote containers")
    print("    prod-remote-down  Stop remote containers")
    print("    prod-remote-status Show remote status")
    print()
    print(f"  {M}Database:{R}")
    print("    prod-db-migrate   Apply SQL migrations")
    print("    prod-db-backup    Backup PostgreSQL database")
    print("    prod-db-restore   Restore from backup file")
    print("    prod-db-list      List available backups")
    print()
    print(f"  {Y}Utility:{R}")
    print("    check-reqs        Verify all prerequisites")
    print("    check-versions    Compare version.json vs actual files")
    print("    sync-versions     Sync version.json to all components")
    print("    bump-version      Update version and sync everywhere")
    print("    promote-admin     Make first registered user an admin")
    print("    help              Show this help")
    print()
    print(f"  {D}Flags:{R}")
    print("    --auto-approve    Skip confirmation prompts")
    print()


# ── Mode routing table ──────────────────────────────────────

MODE_MAP: dict[str, object] = {
    # Menu
    "menu": show_main_menu,
    # DEV shortcuts
    "dev-quick": dev_quick_start,
    "dev-stop": dev_quick_stop,
    "db-init": db_init,
    "db-build": db_build,
    "db-start": db_start,
    "db-stop": db_stop,
    "db-migrate": db_migrations,
    "db-status": db_status,
    "fastapi-init": fastapi_init,
    "fastapi-start": fastapi_start,
    "fastapi-stop": fastapi_stop,
    "fastapi-status": fastapi_status,
    "nuxt-init": nuxt_init,
    "nuxt-start": nuxt_start,
    "nuxt-stop": nuxt_stop,
    "nuxt-validate": nuxt_validate,
    "nuxt-build": nuxt_build,
    "nuxt-status": nuxt_status,
    "angular-init": angular_init,
    "angular-start": angular_start,
    "angular-stop": angular_stop,
    "angular-build": angular_build,
    "angular-status": angular_status,
    # PROD shortcuts
    "prod-build": prod_build_all,
    "prod-local-up": prod_local_up,
    "prod-local-down": prod_local_down,
    "prod-local-status": prod_local_status,
    "prod-local-reset": prod_local_reset,
    "prod-remote-setup": remote_setup,
    "prod-remote-push": remote_push,
    "prod-remote-up": remote_up,
    "prod-remote-down": remote_down,
    "prod-remote-status": remote_status,
    # Database
    "prod-db-migrate": prod_db_migrate,
    "prod-db-backup": prod_db_backup,
    "prod-db-restore": prod_db_restore,
    "prod-db-list": prod_db_list,
    # Utility
    "check-reqs": check_requirements,
    "check-versions": check_versions,
    "sync-versions": sync_versions,
    "bump-version": bump_version,
    "promote-admin": promote_first_admin,
    "help": print_help,
    # Legacy aliases (backward compat from dev.ps1)
    "doctor": check_requirements,
    "migrate-db": db_migrations,
    "validate-nuxt": nuxt_validate,
    "build-nuxt": nuxt_build,
    "start-nuxt": nuxt_start,
    "stop-nuxt": nuxt_stop,
    "install-fastapi": fastapi_init,
    "start-fastapi": fastapi_start,
    "stop-fastapi": fastapi_stop,
    "install-angular": angular_init,
    "start-angular": angular_start,
    "stop-angular": angular_stop,
    "build-angular": angular_build,
}


def route_mode(mode: str) -> None:
    """Dispatch *mode* to the appropriate function."""
    func = MODE_MAP.get(mode)

    # Special compound legacy aliases
    if mode == "up-nuxt":
        nuxt_init()
        nuxt_start()
        return
    if mode == "up-v2":
        dev_quick_start()
        return

    if func is None:
        from devops.core.logger import log
        log(f"Unknown mode: {mode}", level="ERROR", label="BOOT")
        print()
        print("\033[93mRun 'python dev.py help' for available modes.\033[0m")
        raise SystemExit(1)

    func()  # type: ignore[operator]
