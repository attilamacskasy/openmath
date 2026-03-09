"""Logging infrastructure — replaces Write-Log from dev.ps1."""

from __future__ import annotations

import sys
from datetime import datetime

from devops.core.state import get_state

# ANSI colour codes (work on Windows 10+ terminal and all modern terminals)
_COLOURS = {
    "ERROR": "\033[91m",      # red
    "WARN": "\033[93m",       # yellow
    "SUCCESS": "\033[92m",    # green
    "STEP": "\033[96m",       # cyan
    "HEARTBEAT": "\033[33m",  # dark yellow / orange
    "INFO": "",
}
_RESET = "\033[0m"


def log(message: str, *, level: str = "INFO", label: str = "SYSTEM") -> None:
    """Write a structured log line to console + run log file.

    Levels: INFO, WARN, ERROR, SUCCESS, STEP, HEARTBEAT
    """
    state = get_state()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}][{label}][{level}] {message}"

    # Append to run log file
    try:
        with open(state.run_log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass

    # Keep in-memory tail buffer (max 300 lines)
    state.last_log_lines.append(line)
    if len(state.last_log_lines) > 300:
        state.last_log_lines.pop(0)

    # Write to error log if ERROR
    if level == "ERROR":
        try:
            with open(state.error_log_path, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    # Suppress INFO in compact mode
    if state.compact_log_mode and level == "INFO":
        return

    colour = _COLOURS.get(level, "")
    if colour:
        print(f"{colour}{line}{_RESET}", flush=True)
    else:
        print(line, flush=True)


def show_tail(lines: int = 200) -> None:
    """Print the last *lines* from the in-memory log buffer."""
    state = get_state()
    log("Showing last {} log lines".format(lines), level="STEP", label="TAIL")
    for entry in state.last_log_lines[-lines:]:
        print(entry)


def add_signature(signature: str) -> None:
    """Record a detection signature (e.g. 'pnpm:ignored-build-scripts')."""
    if not signature:
        return
    state = get_state()
    if signature not in state.detected_signatures:
        state.detected_signatures.append(signature)
