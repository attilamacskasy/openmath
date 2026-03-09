"""Frontend 2 — Vue.js / Nuxt 4 component."""

from __future__ import annotations

from collections import OrderedDict

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.commands import get_package_manager
from devops.utils.display import show_component_status
from devops.utils.process import get_dev_process, start_background_server, stop_dev_process


def nuxt_init() -> None:
    state = get_state()
    pm = get_package_manager(auto_approve=state.auto_approve)
    nuxt_dir = str(state.repo_root / "nuxt-app")

    invoke_flow("NUXT-INIT", [
        {"name": "Nuxt Install", "command": f"{pm} install",
         "cwd": nuxt_dir, "reason": "Install dependencies.",
         "expected": "Dependencies installed.", "required": True},
        {"name": "Approve Builds", "command": f"{pm} approve-builds",
         "cwd": nuxt_dir, "reason": "Approve blocked build scripts on Windows.",
         "expected": "Approval complete.", "required": False, "skipInAutoApprove": True},
        {"name": "Nuxt Prepare", "command": f"{pm} nuxt prepare",
         "cwd": nuxt_dir, "reason": "Generate Nuxt types and artifacts.",
         "expected": "Prepare completes.", "required": True},
    ])


def nuxt_start() -> None:
    state = get_state()
    existing = get_dev_process(state.nuxt_pid_path)
    if existing:
        log(f"Nuxt dev server already running (PID {existing}).", level="WARN", label="NUXT-START")
        return

    pm = get_package_manager(auto_approve=state.auto_approve)
    nuxt_dir = state.repo_root / "nuxt-app"
    command = f"{pm} dev"

    pid = start_background_server(
        label="Nuxt",
        pid_path=state.nuxt_pid_path,
        command=command,
        cwd=nuxt_dir,
    )

    log(f"✅ Nuxt dev server started (PID {pid}) at http://localhost:3000", level="SUCCESS", label="NUXT-START")

    state.step_results.append(OrderedDict(
        label="NUXT-START", name="Nuxt Start", command=f"{pm} dev",
        cwd=str(nuxt_dir), status="passed", durationSeconds=0, exitCode=0,
    ))


def nuxt_stop() -> None:
    state = get_state()
    stopped = stop_dev_process(state.nuxt_pid_path, "Nuxt")
    if stopped:
        state.step_results.append(OrderedDict(
            label="NUXT-STOP", name="Nuxt Stop", command="stop",
            cwd=str(state.repo_root), status="passed", durationSeconds=0, exitCode=0,
        ))


def nuxt_validate() -> None:
    state = get_state()
    pm = get_package_manager(auto_approve=state.auto_approve)
    nuxt_dir = str(state.repo_root / "nuxt-app")

    invoke_flow("NUXT-VALIDATE", [
        {"name": "Nuxt Typecheck", "command": f"{pm} nuxt typecheck",
         "cwd": nuxt_dir, "reason": "Validate Nuxt project types.",
         "expected": "Typecheck passes.", "required": True},
    ])


def nuxt_build() -> None:
    state = get_state()
    pm = get_package_manager(auto_approve=state.auto_approve)
    nuxt_dir = str(state.repo_root / "nuxt-app")

    invoke_flow("NUXT-BUILD", [
        {"name": "Nuxt Prepare", "command": f"{pm} nuxt prepare",
         "cwd": nuxt_dir, "reason": "Generate artifacts before build.",
         "expected": "Prepare passes.", "required": True},
        {"name": "Nuxt Build", "command": f"{pm} build",
         "cwd": nuxt_dir, "reason": "Build production assets.",
         "expected": "Build completes.", "required": True},
    ])


def nuxt_status() -> None:
    state = get_state()
    show_component_status(
        "Frontend 2 (Vue.js / Nuxt 4)",
        pid_path=state.nuxt_pid_path,
        endpoint="http://localhost:3000",
    )
