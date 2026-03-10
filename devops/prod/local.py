"""PROD — Local Docker deployment."""

from __future__ import annotations

import subprocess

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state


def prod_local_up() -> None:
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found.", level="ERROR", label="PROD-LOCAL")
        return

    invoke_flow("PROD-LOCAL-UP", [
        {"name": "Start prod containers",
         "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod up -d",
         "cwd": str(state.repo_root), "reason": "Start all production containers locally.",
         "expected": "All containers running.", "required": True},
    ])


def prod_local_down() -> None:
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found.", level="ERROR", label="PROD-LOCAL")
        return

    invoke_flow("PROD-LOCAL-DOWN", [
        {"name": "Stop prod containers",
         "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod down",
         "cwd": str(state.repo_root), "reason": "Stop all production containers.",
         "expected": "Containers stopped.", "required": True},
    ])


def prod_local_status() -> None:
    state = get_state()
    print()
    print("\033[96m═══ Production Containers (Local) ═══\033[0m")
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.prod.yml", "--env-file", ".env.prod", "ps"],
            capture_output=True, text=True, cwd=str(state.repo_root), timeout=15,
        )
        for line in result.stdout.strip().splitlines():
            print(f"  {line}")
    except Exception:
        print("  \033[93mdocker-compose.prod.yml not found or Docker unavailable.\033[0m")

    print()
    print("  \033[90mRecent logs:\033[0m")
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.prod.yml", "--env-file", ".env.prod", "logs", "--tail=20"],
            capture_output=True, text=True, cwd=str(state.repo_root), timeout=15,
        )
        for line in result.stdout.strip().splitlines():
            print(f"    {line}")
    except Exception:
        pass
    print()


def prod_local_reset() -> None:
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found.", level="ERROR", label="PROD-RESET")
        return

    invoke_flow("PROD-LOCAL-RESET", [
        {"name": "Stop containers",
         "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod down -v",
         "cwd": str(state.repo_root), "reason": "Stop containers and remove volumes.",
         "expected": "Containers and volumes removed.", "required": True},
        {"name": "Rebuild images",
         "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache",
         "cwd": str(state.repo_root), "reason": "Rebuild all images from scratch.",
         "expected": "Images rebuilt.", "required": True},
        {"name": "Start containers",
         "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod up -d",
         "cwd": str(state.repo_root), "reason": "Start fresh containers.",
         "expected": "Containers running.", "required": True},
    ])
