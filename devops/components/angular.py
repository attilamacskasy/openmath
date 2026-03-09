"""Frontend 3 — Angular + PrimeNG component."""

from __future__ import annotations

from collections import OrderedDict

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.commands import get_package_manager
from devops.utils.display import show_component_status
from devops.utils.process import get_dev_process, start_background_server, stop_dev_process


def angular_init() -> None:
    state = get_state()
    pm = get_package_manager(auto_approve=state.auto_approve)
    angular_dir = str(state.repo_root / "angular-app")

    invoke_flow("ANGULAR-INIT", [
        {"name": "Angular Install", "command": f"{pm} install",
         "cwd": angular_dir, "reason": "Install Angular + PrimeNG dependencies.",
         "expected": "Dependencies installed.", "required": True},
    ])


def angular_start() -> None:
    state = get_state()
    existing = get_dev_process(state.angular_pid_path)
    if existing:
        log(f"Angular dev server already running (PID {existing}).", level="WARN", label="ANGULAR-START")
        return

    pm = get_package_manager(auto_approve=state.auto_approve)
    angular_dir = state.repo_root / "angular-app"
    command = f"{pm} start"

    pid = start_background_server(
        label="Angular",
        pid_path=state.angular_pid_path,
        command=command,
        cwd=angular_dir,
    )

    log(f"✅ Angular dev server started (PID {pid}) at http://localhost:4200", level="SUCCESS", label="ANGULAR-START")

    state.step_results.append(OrderedDict(
        label="ANGULAR-START", name="Angular Start", command=f"{pm} start",
        cwd=str(angular_dir), status="passed", durationSeconds=0, exitCode=0,
    ))


def angular_stop() -> None:
    state = get_state()
    stopped = stop_dev_process(state.angular_pid_path, "Angular")
    if stopped:
        state.step_results.append(OrderedDict(
            label="ANGULAR-STOP", name="Angular Stop", command="stop",
            cwd=str(state.repo_root), status="passed", durationSeconds=0, exitCode=0,
        ))


def angular_build() -> None:
    state = get_state()
    pm = get_package_manager(auto_approve=state.auto_approve)
    angular_dir = str(state.repo_root / "angular-app")

    invoke_flow("ANGULAR-BUILD", [
        {"name": "Angular Install", "command": f"{pm} install",
         "cwd": angular_dir, "reason": "Install dependencies.",
         "expected": "Dependencies installed.", "required": False},
        {"name": "Angular Build", "command": f"{pm} run build",
         "cwd": angular_dir, "reason": "Build production assets.",
         "expected": "Build completes.", "required": True},
    ])


def angular_status() -> None:
    state = get_state()
    show_component_status(
        "Frontend 3 (Angular + PrimeNG)",
        pid_path=state.angular_pid_path,
        endpoint="http://localhost:4200",
    )
