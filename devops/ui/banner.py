"""ASCII-art banner, status bar, and shortcuts overlay."""

from __future__ import annotations

import os
import sys

from devops.ui.theme import CYAN, DIM, GREEN, RESET
from devops.utils.commands import command_exists, get_command_version


def clear_screen() -> None:
    """Clear the terminal screen (cross-platform)."""
    if sys.platform == "win32":
        os.system("cls")
    else:
        os.system("clear")

# ── ASCII banner (shown once per session) ────────────────────
_BANNER = rf"""
{CYAN}  ██████╗ ██████╗ ███████╗███╗   ██╗███╗   ███╗ █████╗ ████████╗██╗  ██╗
 ██╔═══██╗██╔══██╗██╔════╝████╗  ██║████╗ ████║██╔══██╗╚══██╔══╝██║  ██║
 ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██╔████╔██║███████║   ██║   ███████║
 ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║╚██╔╝██║██╔══██║   ██║   ██╔══██║
 ╚██████╔╝██║     ███████╗██║ ╚████║██║ ╚═╝ ██║██║  ██║   ██║   ██║  ██║
  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝{RESET}
"""

_VERSION = "DevOps Console v3.1"


def _detect_version(name: str) -> str:
    """Return a short version string for *name*, or '–' if missing."""
    if not command_exists(name):
        return "–"
    raw = get_command_version(name)
    # Keep only the first meaningful version token
    for token in raw.split():
        if any(ch.isdigit() for ch in token):
            return token.strip("v").rstrip(",")
    return raw.split("\n")[0][:20]


def show_banner() -> None:
    """Print the ASCII art banner + status bar (once per session)."""
    print(_BANNER)
    print(f"  {CYAN}{_VERSION}{RESET}")

    # ── status bar ───────────────────────────────────────────
    parts: list[str] = []
    for label, cmd in [("Python", "python"), ("Node", "node"),
                       ("Docker", "docker"), ("pnpm", "pnpm")]:
        ver = _detect_version(cmd)
        parts.append(f"{label} {ver}")

    bar = "  ·  ".join(parts)
    sep = "─" * 72

    print(f"  {DIM}{sep}{RESET}")
    print(f"  {DIM}{bar}{RESET}")
    print(f"  {DIM}{os.getcwd()}{RESET}")
    print(f"  {DIM}{sep}{RESET}")
    print()


def show_shortcuts() -> None:
    """Print the keyboard-shortcuts overlay and wait for a keypress."""
    print()
    print(f"  {CYAN}Keyboard Shortcuts{RESET}")
    print(f"  {DIM}{'─' * 44}{RESET}")
    print()
    print("  ↑ / ↓          Navigate menu items")
    print("  Enter           Select / confirm")
    print("  Esc             Go back / cancel")
    print("  Ctrl+C          Exit immediately")
    print("  ?               Show this help")
    print()
    print(f"  {CYAN}CLI Shortcuts (bypass menus){RESET}")
    print(f"  {DIM}{'─' * 44}{RESET}")
    print()
    print(f"  {GREEN}python dev.py dev-quick{RESET}       Quick Start (DB + API + Angular)")
    print(f"  {GREEN}python dev.py dev-stop{RESET}        Quick Stop (Angular + API + Docker)")
    print(f"  {GREEN}python dev.py db-start{RESET}        Start PostgreSQL")
    print(f"  {GREEN}python dev.py fastapi-start{RESET}   Start FastAPI server")
    print(f"  {GREEN}python dev.py angular-start{RESET}   Start Angular server")
    print(f"  {GREEN}python dev.py check-reqs{RESET}      Verify all prerequisites")
    print(f"  {GREEN}python dev.py help{RESET}            Show all CLI modes")
    print(f"  {GREEN}python dev.py --auto-approve{RESET}  Skip all confirmation prompts")
    print()

    # Wait for any keypress (cross-platform)
    try:
        if sys.platform == "win32":
            import msvcrt
            print(f"  {DIM}Press any key to close...{RESET}", end="", flush=True)
            msvcrt.getch()  # type: ignore[attr-defined]
        else:
            import termios
            import tty
            print(f"  {DIM}Press any key to close...{RESET}", end="", flush=True)
            fd = sys.stdin.fileno()
            old = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                sys.stdin.read(1)
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old)
    except (EOFError, KeyboardInterrupt):
        pass
    print()  # newline after keypress


def wait_for_key() -> None:
    """Print a prompt and wait for any keypress before continuing."""
    print()
    try:
        if sys.platform == "win32":
            import msvcrt
            print(f"  {DIM}Press any key to continue...{RESET}", end="", flush=True)
            msvcrt.getch()  # type: ignore[attr-defined]
        else:
            import termios
            import tty
            print(f"  {DIM}Press any key to continue...{RESET}", end="", flush=True)
            fd = sys.stdin.fileno()
            old = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                sys.stdin.read(1)
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old)
    except (EOFError, KeyboardInterrupt):
        pass
    print()
