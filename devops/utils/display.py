"""Display helpers — status banners, not-implemented notices, log opening."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from devops.core.logger import log
from devops.core.state import get_state
from devops.utils.process import get_dev_process


def show_component_status(
    label: str,
    *,
    pid_path: Path | None = None,
    endpoint: str = "",
    component_type: str = "process",
) -> None:
    """Display status info for a running component."""
    state = get_state()

    print()
    print(f"\033[96m═══ {label} ═══\033[0m")

    if component_type == "docker":
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "--format",
                 "table {{.Name}}\t{{.Status}}\t{{.Ports}}"],
                capture_output=True, text=True, cwd=str(state.repo_root), timeout=15,
            )
            for line in result.stdout.strip().splitlines():
                print(f"  {line}")
        except Exception:
            print("  \033[91mStatus: Docker not available\033[0m")

        print()
        print(f"  Endpoint:  {endpoint}")
        print()
        print("  \033[90mRecent logs:\033[0m")
        try:
            result = subprocess.run(
                ["docker", "compose", "logs", "--tail=15", "postgres"],
                capture_output=True, text=True, cwd=str(state.repo_root), timeout=15,
            )
            for line in result.stdout.strip().splitlines():
                print(f"    {line}")
        except Exception:
            print("    \033[93m(unable to fetch logs)\033[0m")
    else:
        pid = get_dev_process(pid_path) if pid_path else None
        if pid:
            print(f"  \033[92mStatus:    ● Running (PID {pid})\033[0m")
        else:
            print("  \033[90mStatus:    ○ Stopped\033[0m")
        print(f"  Endpoint:  {endpoint}")

    print()


def show_not_implemented(name: str, spec_ref: str) -> None:
    """Show a placeholder message for unimplemented frontends."""
    print()
    print(f"  \033[93m⚠ {name} is not yet implemented.\033[0m")
    print(f"  \033[90mSee {spec_ref} for details.\033[0m")
    print()


def open_latest_log() -> None:
    """Open the most recent run log in the default editor."""
    state = get_state()
    base = state.repo_root / ".dev-assistant" / "logs"
    if not base.exists():
        log("No logs directory found yet.", level="WARN", label="LOGS")
        return

    dirs = sorted(base.iterdir(), key=lambda d: d.stat().st_mtime, reverse=True)
    dirs = [d for d in dirs if d.is_dir()]
    if not dirs:
        log("No run folders found.", level="WARN", label="LOGS")
        return

    log_file = dirs[0] / "run.log"
    if log_file.exists():
        if sys.platform == "win32":
            os.startfile(str(log_file))  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", str(log_file)])
        log(f"Opened {log_file}", label="LOGS")
