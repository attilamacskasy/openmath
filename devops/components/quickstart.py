"""Quick-start flows for DEV environment."""

from __future__ import annotations

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.commands import get_package_manager
from devops.components.fastapi import fastapi_start
from devops.components.angular import angular_start


def dev_quick_start() -> None:
    """Run the current default dev stack in sequence: DB → FastAPI → Angular."""
    state = get_state()

    print()
    print("\033[92m═══════════════════════════════════════════════════════════════\033[0m")
    print("\033[92m  Quick Start Dev Stack\033[0m")
    print("\033[92m  Postgres + Python FastAPI + Angular/PrimeNG\033[0m")
    print("\033[92m═══════════════════════════════════════════════════════════════\033[0m")
    print()

    pm = get_package_manager(auto_approve=state.auto_approve)
    angular_dir = str(state.repo_root / "angular-app")

    if state.is_windows:
        venv_python = str(state.repo_root / ".venv" / "Scripts" / "python.exe")
    else:
        venv_python = str(state.repo_root / ".venv" / "bin" / "python")
    req_file = str(state.repo_root / "python-api" / "requirements.txt")

    # Phase 1: Dependencies
    steps = [
        {"name": "DB Start", "command": "docker compose up -d",
         "cwd": str(state.repo_root), "reason": "Start PostgreSQL + Adminer.",
         "expected": "Containers running.", "required": True},
    ]

    venv_python_path = state.repo_root / ".venv" / ("Scripts" if state.is_windows else "bin") / ("python.exe" if state.is_windows else "python")
    if not venv_python_path.exists():
        steps.append(
            {"name": "Create venv", "command": "python -m venv .venv",
             "cwd": str(state.repo_root), "reason": "Create Python virtual environment.",
             "expected": ".venv created.", "required": True},
        )

    steps.extend([
        {"name": "FastAPI Install", "command": f'"{venv_python}" -m pip install -r "{req_file}"',
         "cwd": str(state.repo_root), "reason": "Install FastAPI dependencies.",
         "expected": "Packages installed.", "required": True},
        {"name": "Angular Install", "command": f"{pm} install",
         "cwd": angular_dir, "reason": "Install Angular dependencies.",
         "expected": "Dependencies installed.", "required": False},
    ])

    invoke_flow("DEV-QUICK", steps)

    # Phase 2: Start servers
    fastapi_start()
    angular_start()

    print()
    log("✅ Dev stack is running!", level="SUCCESS", label="DEV-QUICK")
    print()
    print("  \033[92mPostgreSQL:  localhost:5432\033[0m")
    print("  \033[92mAdminer:     http://localhost:8080\033[0m")
    print("  \033[92mFastAPI:     http://localhost:8000\033[0m")
    print("  \033[92mSwagger:     http://localhost:8000/docs\033[0m")
    print("  \033[92mAngular:     http://localhost:4200\033[0m")
    print()
