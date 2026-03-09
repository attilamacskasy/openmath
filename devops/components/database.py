"""Database 1 — Docker / PostgreSQL component."""

from __future__ import annotations

from collections import OrderedDict
from pathlib import Path

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.commands import command_exists
from devops.utils.display import show_component_status


def db_init() -> None:
    """Verify Docker installed, ensure .env exists with DB defaults."""
    state = get_state()
    label = "DB-INIT"
    log("Checking database prerequisites...", level="STEP", label=label)

    if not command_exists("docker"):
        log("❌ Docker not installed. Install Docker Desktop first.", level="ERROR", label=label)
        return
    log("✅ Docker found", level="SUCCESS", label=label)

    env_file = state.repo_root / ".env"
    if not env_file.exists():
        log("⚠️ .env not found. Creating from defaults...", level="WARN", label=label)
        default_env = (
            "DATABASE_URL=postgresql+asyncpg://quiz:quiz@localhost:5432/quiz\n"
            "POSTGRES_USER=quiz\n"
            "POSTGRES_PASSWORD=quiz\n"
            "POSTGRES_DB=quiz\n"
        )
        env_file.write_text(default_env, encoding="utf-8")
        log("✅ Created .env with default database settings", level="SUCCESS", label=label)
    else:
        log("✅ .env exists", level="SUCCESS", label=label)

    log("✅ Database init complete", level="SUCCESS", label=label)


def db_build() -> None:
    state = get_state()
    invoke_flow("DB-BUILD", [
        {"name": "Docker Compose Build", "command": "docker compose build",
         "cwd": str(state.repo_root), "reason": "Build/pull database container images.",
         "expected": "Images pulled/built successfully.", "required": True},
    ])


def db_start() -> None:
    state = get_state()
    invoke_flow("DB-START", [
        {"name": "DB Start", "command": "docker compose up -d",
         "cwd": str(state.repo_root), "reason": "Start PostgreSQL and Adminer containers.",
         "expected": "Containers running.", "required": True},
    ])


def db_migrations() -> None:
    state = get_state()
    migration_script = state.repo_root / "scripts" / "apply-migrations.ps1"
    if not migration_script.exists():
        raise FileNotFoundError(f"Migration script not found: {migration_script}")

    if state.is_windows:
        cmd = f'powershell -NoProfile -ExecutionPolicy Bypass -File "{migration_script}"'
    else:
        # Assume a .sh equivalent exists or use psql directly
        sh_script = state.repo_root / "scripts" / "apply-migrations.sh"
        cmd = f'bash "{sh_script}"'

    invoke_flow("DB-MIGRATE", [
        {"name": "Apply DB Migrations", "command": cmd,
         "cwd": str(state.repo_root), "reason": "Apply SQL migrations.",
         "expected": "All migration files apply successfully.", "required": True},
    ])


def db_stop() -> None:
    state = get_state()
    invoke_flow("DB-STOP", [
        {"name": "DB Stop", "command": "docker compose down",
         "cwd": str(state.repo_root), "reason": "Stop database containers.",
         "expected": "Containers stopped.", "required": True},
    ])


def db_status() -> None:
    show_component_status(
        "Database 1 (PostgreSQL)",
        endpoint="localhost:5432 (DB) / localhost:8080 (Adminer)",
        component_type="docker",
    )
