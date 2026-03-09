"""Run summary — saves JSON summary at end of each run."""

from __future__ import annotations

import json
import os
import platform
from datetime import datetime

from devops.core.logger import log
from devops.core.state import get_state


def save_summary() -> None:
    """Write summary.json with run metadata, step results, and signatures."""
    state = get_state()
    try:
        end_at = datetime.now()
        duration = round((end_at - state.start_at).total_seconds(), 2)

        os_caption = platform.platform()

        summary = {
            "runId": state.run_id,
            "mode": state.current_mode,
            "host": {
                "machine": platform.node(),
                "user": os.environ.get("USERNAME") or os.environ.get("USER", "unknown"),
                "shell": state.shell_exe,
                "pythonVersion": platform.python_version(),
                "os": os_caption,
            },
            "startAt": state.start_at.isoformat(),
            "endAt": end_at.isoformat(),
            "durationSeconds": duration,
            "logDir": str(state.run_log_dir),
            "runLog": str(state.run_log_path),
            "errorLog": str(state.error_log_path),
            "steps": [dict(s) for s in state.step_results],
            "signatures": list(state.detected_signatures),
        }

        with open(state.summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, default=str)
    except Exception as exc:
        log(f"Failed to write summary: {exc}", level="ERROR", label="SUMMARY")


def print_run_summary() -> None:
    """Print a human-readable run summary to stdout."""
    state = get_state()
    end_at = datetime.now()
    duration = round((end_at - state.start_at).total_seconds(), 2)
    passed = sum(1 for s in state.step_results if s.get("status") == "passed")
    failed = sum(1 for s in state.step_results if s.get("status") == "failed")
    skipped = sum(1 for s in state.step_results if s.get("status") == "skipped")
    planned = sum(1 for s in state.step_results if s.get("status") == "planned")

    print()
    print("\033[96m=== Run Summary ===\033[0m")
    print(f"Duration: {duration}s")
    print(f"Passed: {passed}  Failed: {failed}  Skipped: {skipped}  Planned: {planned}")
    print(f"Logs: {state.run_log_dir}")
    print(f"Summary JSON: {state.summary_path}")
