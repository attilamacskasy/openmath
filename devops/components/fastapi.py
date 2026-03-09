"""Backend 1 — Python FastAPI component."""

from __future__ import annotations

from collections import OrderedDict

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.commands import command_exists
from devops.utils.display import show_component_status
from devops.utils.process import get_dev_process, start_background_server, stop_dev_process


def fastapi_init() -> None:
    """Create venv if needed, install requirements."""
    state = get_state()
    venv_path = state.repo_root / ".venv"
    if state.is_windows:
        venv_python = venv_path / "Scripts" / "python.exe"
    else:
        venv_python = venv_path / "bin" / "python"
    req_file = state.repo_root / "python-api" / "requirements.txt"

    if not venv_python.exists():
        log("Creating Python venv...", level="STEP", label="FASTAPI-INIT")
        invoke_flow("FASTAPI-VENV", [
            {"name": "Create venv", "command": "python -m venv .venv",
             "cwd": str(state.repo_root), "reason": "Create Python virtual environment.",
             "expected": ".venv directory created.", "required": True},
        ])
    else:
        log("✅ Python venv already exists", level="SUCCESS", label="FASTAPI-INIT")

    invoke_flow("FASTAPI-INSTALL", [
        {"name": "Install dependencies",
         "command": f'"{venv_python}" -m pip install -r "{req_file}"',
         "cwd": str(state.repo_root), "reason": "Install FastAPI + asyncpg dependencies.",
         "expected": "All packages installed.", "required": True},
    ])


def fastapi_start() -> None:
    """Start uvicorn dev server in a new terminal window."""
    state = get_state()
    existing = get_dev_process(state.fastapi_pid_path)
    if existing:
        log(f"FastAPI dev server already running (PID {existing}).", level="WARN", label="FASTAPI-START")
        return

    api_dir = state.repo_root / "python-api"
    if state.is_windows:
        venv_python = state.repo_root / ".venv" / "Scripts" / "python.exe"
    else:
        venv_python = state.repo_root / "bin" / "python"

    if not venv_python.exists():
        log("Python venv not found. Run Backend Init first.", level="ERROR", label="FASTAPI-START")
        return

    command = f'& "{venv_python}" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload'
    pid = start_background_server(
        label="FastAPI",
        pid_path=state.fastapi_pid_path,
        command=command,
        cwd=api_dir,
    )

    log(f"✅ FastAPI started (PID {pid}) at http://localhost:8000", level="SUCCESS", label="FASTAPI-START")

    state.step_results.append(OrderedDict(
        label="FASTAPI-START", name="FastAPI Start",
        command="uvicorn --reload --port 8000",
        cwd=str(api_dir), status="passed", durationSeconds=0, exitCode=0,
    ))


def fastapi_stop() -> None:
    state = get_state()
    stopped = stop_dev_process(state.fastapi_pid_path, "FastAPI")
    if stopped:
        state.step_results.append(OrderedDict(
            label="FASTAPI-STOP", name="FastAPI Stop", command="stop",
            cwd=str(state.repo_root), status="passed", durationSeconds=0, exitCode=0,
        ))


def fastapi_status() -> None:
    state = get_state()
    show_component_status(
        "Backend 1 (Python FastAPI)",
        pid_path=state.fastapi_pid_path,
        endpoint="http://localhost:8000 (API) / http://localhost:8000/docs (Swagger)",
    )
