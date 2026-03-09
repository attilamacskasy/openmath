"""Command / port / version checking utilities."""

from __future__ import annotations

import shutil
import socket
import subprocess
import sys


def command_exists(name: str) -> bool:
    """Return True if *name* is on the PATH."""
    return shutil.which(name) is not None


def get_command_version(executable: str, arg: str = "--version") -> str:
    """Run *executable <arg>* and return the first line of output."""
    try:
        cmd = [executable] + arg.split()
        # shell=True needed on Windows for .cmd/.bat wrappers (e.g. pnpm)
        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=10,
            shell=(sys.platform == "win32"),
        )
        output = result.stdout.strip() or result.stderr.strip()
        return output.splitlines()[0] if output else "unknown"
    except Exception:
        return "unknown"


def is_port_open(port: int, host: str = "127.0.0.1", timeout: float = 0.5) -> bool:
    """Return True if *port* is currently listening on *host*."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(timeout)
        try:
            s.connect((host, port))
            return True
        except (ConnectionRefusedError, OSError):
            return False


def get_package_manager(*, auto_approve: bool = False) -> str:
    """Return 'pnpm' or 'npm', prompting if pnpm missing and not auto-approve."""
    if command_exists("pnpm"):
        return "pnpm"

    if not command_exists("npm"):
        raise RuntimeError("Neither pnpm nor npm is available.")

    if auto_approve:
        raise RuntimeError("pnpm not found and AutoApprove is enabled. Explicit fallback confirmation required.")

    choice = input("pnpm not found. Use npm for this run? [y/N]: ").strip().lower()
    if choice == "y":
        return "npm"

    raise RuntimeError("pnpm missing and npm fallback not approved.")
