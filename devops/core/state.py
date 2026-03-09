"""Global state management for the DevOps console."""

from __future__ import annotations

import os
import platform
import sys
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from typing import Any


class AppState:
    """Singleton holding all runtime state for a dev.py run."""

    _instance: AppState | None = None

    def __new__(cls) -> AppState:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialised = False
        return cls._instance

    # ------------------------------------------------------------------
    def init(self, *, mode: str = "menu", auto_approve: bool = False) -> None:
        if self._initialised:
            return
        self._initialised = True

        self.repo_root = Path(__file__).resolve().parents[2]  # devops/core/state.py → repo root

        self.run_id = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self.run_log_dir = self.repo_root / ".dev-assistant" / "logs" / self.run_id
        self.run_log_path = self.run_log_dir / "run.log"
        self.error_log_path = self.run_log_dir / "errors.log"
        self.summary_path = self.run_log_dir / "summary.json"
        self.state_dir = self.repo_root / ".dev-assistant" / "state"

        # PID files
        self.nuxt_pid_path = self.state_dir / "nuxt-dev.pid"
        self.fastapi_pid_path = self.state_dir / "fastapi-dev.pid"
        self.angular_pid_path = self.state_dir / "angular-dev.pid"

        # Remote config
        self.remote_config_path = self.state_dir / "remote.json"

        # Runtime state
        self.compact_log_mode = False
        self.step_results: list[OrderedDict[str, Any]] = []
        self.detected_signatures: list[str] = []
        self.start_at = datetime.now()
        self.current_mode = mode
        self.auto_approve = auto_approve
        self.last_log_lines: list[str] = []

        # Shell executable (for spawning sub-processes in new windows)
        if platform.system() == "Windows":
            self.shell_exe = "powershell"
        else:
            self.shell_exe = os.environ.get("SHELL", "/bin/bash")

        # Ensure directories exist
        self.run_log_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.run_log_path.touch()
        self.error_log_path.touch()

    # convenience ---------------------------------------------------------
    @property
    def is_windows(self) -> bool:
        return platform.system() == "Windows"


def get_state() -> AppState:
    """Return the global AppState singleton (must be init'd first)."""
    return AppState()
