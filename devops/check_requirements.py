"""Check Requirements — verifies all system prerequisites."""

from __future__ import annotations

import re

from devops.core.logger import log
from devops.core.state import get_state
from devops.utils.commands import command_exists, get_command_version, is_port_open


def check_requirements() -> None:
    """Run a comprehensive check of all tools, files, ports, and environment."""
    state = get_state()

    print()
    print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
    print("\033[96m  Check Requirements — Verifying all prerequisites\033[0m")
    print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
    print()

    label = "REQS"

    # ── CLI tools ────────────────────────────────────────────
    checks = [
        ("node",   "Install Node.js LTS from https://nodejs.org"),
        ("pnpm",   "Run: npm install -g pnpm"),
        ("docker", "Install Docker Desktop from https://docker.com"),
        ("git",    "Install Git from https://git-scm.com"),
        ("python", "Install Python 3.12+ from https://python.org"),
        ("psql",   "Install PostgreSQL client tools (psql)"),
        ("ssh",    "SSH client (built-in on Win10+)"),
    ]

    for name, hint in checks:
        if command_exists(name):
            # ssh outputs to stderr and uses -V, pnpm uses --version
            if name == "ssh":
                version = get_command_version(name, "-V")
            else:
                version = get_command_version(name)
            log(f"✅ {name} found ({version})", level="SUCCESS", label=label)
        else:
            log(f"❌ {name} missing. Hint: {hint}", level="ERROR", label=label)

    # ── Docker Compose V2 ───────────────────────────────────
    if command_exists("docker"):
        import subprocess as _sp
        try:
            r = _sp.run(["docker", "compose", "version"], capture_output=True, text=True, timeout=10)
            if r.returncode == 0 and r.stdout.strip():
                log(f"✅ docker compose available ({r.stdout.strip().splitlines()[0]})", level="SUCCESS", label=label)
            else:
                log("❌ docker compose unavailable. Ensure Docker Desktop Compose V2 is enabled.",
                    level="ERROR", label=label)
        except Exception:
            log("❌ docker compose unavailable. Ensure Docker Desktop Compose V2 is enabled.",
                level="ERROR", label=label)

    # ── pip ──────────────────────────────────────────────────
    if command_exists("python"):
        import subprocess
        try:
            result = subprocess.run(
                ["python", "-m", "pip", "--version"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                log(f"✅ pip available ({result.stdout.strip().splitlines()[0]})", level="SUCCESS", label=label)
            else:
                log("⚠️ pip not available via python -m pip", level="WARN", label=label)
        except Exception:
            log("⚠️ pip not available via python -m pip", level="WARN", label=label)

    # ── Project files ────────────────────────────────────────
    project_files = [
        ("docker-compose.yml", "Create root docker-compose.yml"),
        ("python-api/requirements.txt", "Backend requirements file"),
        ("angular-app/package.json", "Angular frontend"),
        ("nuxt-app/package.json", "Nuxt frontend"),
    ]

    for rel_path, hint in project_files:
        full_path = state.repo_root / rel_path
        if full_path.exists():
            log(f"✅ found {rel_path}", level="SUCCESS", label=label)
        else:
            log(f"⚠️ missing {rel_path} — {hint}", level="WARN", label=label)

    # ── .env ─────────────────────────────────────────────────
    env_file = state.repo_root / ".env"
    if env_file.exists():
        env_text = env_file.read_text(encoding="utf-8")
        if re.search(r"DATABASE_URL\s*=", env_text):
            log("✅ .env has DATABASE_URL", level="SUCCESS", label=label)
        else:
            log("⚠️ .env missing DATABASE_URL", level="WARN", label=label)
    else:
        log("⚠️ .env not found — copy .env.example and configure", level="WARN", label=label)

    # ── .venv ────────────────────────────────────────────────
    if state.is_windows:
        venv_python = state.repo_root / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = state.repo_root / ".venv" / "bin" / "python"

    if venv_python.exists():
        log("✅ Python venv found at .venv", level="SUCCESS", label=label)
    else:
        log("⚠️ Python venv not found. Create with: python -m venv .venv", level="WARN", label=label)

    # ── Ports ────────────────────────────────────────────────
    ports = [
        (5432, "PostgreSQL"),
        (8000, "FastAPI"),
        (8080, "Adminer"),
        (4200, "Angular"),
        (3000, "Nuxt"),
    ]

    for port, name in ports:
        open_ = is_port_open(port)
        state_text = "in use" if open_ else "free"
        level = "WARN" if open_ else "INFO"
        log(f"Port {port} ({name}) is {state_text}", level=level, label=label)

    # ── OneDrive warning ─────────────────────────────────────
    if "OneDrive" in str(state.repo_root):
        log("⚠️ Repo appears under OneDrive path. This may slow Node installs/builds.",
            level="WARN", label=label)

    print()
