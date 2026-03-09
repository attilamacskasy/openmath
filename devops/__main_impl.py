"""Main implementation — argument parsing, state init, mode dispatch."""

from __future__ import annotations

import argparse
import sys

from devops.core.logger import log, show_tail
from devops.core.state import AppState
from devops.core.summary import print_run_summary, save_summary


def main(argv: list[str] | None = None) -> None:
    """Parse arguments and run the requested mode."""

    # ── Enable ANSI colours on Windows ───────────────────────
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

    # ── Argument parsing ─────────────────────────────────────
    parser = argparse.ArgumentParser(
        prog="dev.py",
        description="OpenMath DevOps Console — build, run, deploy the full stack.",
        add_help=False,
    )
    parser.add_argument(
        "mode",
        nargs="?",
        default="menu",
        help="Operation mode (default: menu). Run 'dev.py help' for full list.",
    )
    parser.add_argument(
        "--auto-approve",
        action="store_true",
        default=False,
        help="Skip confirmation prompts.",
    )
    args = parser.parse_args(argv)

    mode: str = args.mode.lower().strip()
    auto_approve: bool = args.auto_approve

    # ── Init global state ────────────────────────────────────
    state = AppState()
    state.init(mode=mode, auto_approve=auto_approve)

    # ── Dispatch ─────────────────────────────────────────────
    try:
        log(f"Run started in mode: {mode}", level="STEP", label="BOOT")

        from devops.cli import route_mode
        route_mode(mode)

    except KeyboardInterrupt:
        print("\n\033[93mInterrupted by user.\033[0m")
    except SystemExit:
        raise
    except Exception as exc:
        log(str(exc), level="ERROR", label="FATAL")
        show_tail(200)
        sys.exit(1)
    finally:
        save_summary()
        print_run_summary()
