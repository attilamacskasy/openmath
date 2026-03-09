"""PID / process management utilities."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

from devops.core.logger import log
from devops.core.state import get_state


def read_pid(pid_path: Path) -> int | None:
    """Read PID from a file, return None if invalid or missing."""
    if not pid_path.exists():
        return None
    try:
        text = pid_path.read_text().strip()
        return int(text) if text else None
    except (ValueError, OSError):
        return None


def is_process_alive(pid: int) -> bool:
    """Check whether a process with *pid* is still running."""
    if sys.platform == "win32":
        # Use tasklist to check — os.kill(pid, 0) can be unreliable on Windows
        try:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True, text=True, timeout=5,
            )
            return str(pid) in result.stdout
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


def get_dev_process(pid_path: Path) -> int | None:
    """Return PID if the tracked process is alive, else None."""
    pid = read_pid(pid_path)
    if pid is None:
        return None
    if is_process_alive(pid):
        return pid
    return None


def stop_dev_process(pid_path: Path, label: str) -> bool:
    """Stop a tracked dev process. Returns True if stopped, False if not running."""
    pid = get_dev_process(pid_path)
    if pid is None:
        if pid_path.exists():
            pid_path.unlink(missing_ok=True)
        log(f"{label} not running or already stopped.", level="WARN", label=f"{label}-STOP")
        return False

    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True, timeout=10)
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass

    pid_path.unlink(missing_ok=True)
    log(f"✅ {label} stopped (PID {pid}).", level="SUCCESS", label=f"{label}-STOP")
    return True


def start_background_server(
    *,
    label: str,
    pid_path: Path,
    command: str,
    cwd: str | Path,
) -> int | None:
    """Launch a command in a new terminal window. Returns PID or None."""
    state = get_state()

    if sys.platform == "win32":
        # Launch in a new PowerShell console window
        proc = subprocess.Popen(
            [
                state.shell_exe, "-NoExit", "-Command",
                f"$Host.UI.RawUI.WindowTitle = '{label}'; Set-Location '{cwd}'; {command}",
            ],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
        )
        pid = proc.pid
    else:
        # Unix: launch in background
        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=str(cwd),
            start_new_session=True,
        )
        pid = proc.pid

    pid_path.write_text(str(pid), encoding="ascii")
    return pid
