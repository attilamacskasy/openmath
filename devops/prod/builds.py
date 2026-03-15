"""PROD — Container image builds."""

from __future__ import annotations

import json
from pathlib import Path

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.display import show_not_implemented


def _read_app_version() -> str:
    """Read the Angular app version from the centralized version.json."""
    try:
        # Try via state first, fallback to relative path
        try:
            vf = get_state().repo_root / "version.json"
        except Exception:
            vf = Path(__file__).resolve().parents[2] / "version.json"
        data = json.loads(vf.read_text(encoding="utf-8"))
        return data["components"].get("angular-app", data["app"]["version"])
    except Exception:
        return "0.0.0"


def _sync_version_json() -> None:
    """Copy version.json into sub-project Docker build contexts."""
    import shutil
    root = get_state().repo_root
    src = root / "version.json"
    if not src.exists():
        return
    for subdir in ["python-api", "angular-app"]:
        dst = root / subdir / "version.json"
        shutil.copy2(str(src), str(dst))


def _build_env() -> str:
    """Return env prefix that injects APP_VERSION for docker compose build."""
    ver = _read_app_version()
    return f"APP_VERSION={ver} "


def prod_build_all() -> None:
    """Build all production container images."""
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found. Create it first (see docs/spec_v3.0_devops_script.md).",
            level="ERROR", label="PROD-BUILD")
        return

    import os
    os.environ["APP_VERSION"] = _read_app_version()
    _sync_version_json()
    log(f"Building all production container images (v{os.environ['APP_VERSION']})...", level="STEP", label="PROD-BUILD")
    invoke_flow("PROD-BUILD-ALL", [
        {"name": "Build ALL images", "command": "docker compose -f docker-compose.prod.yml --env-file .env.prod build",
         "cwd": str(state.repo_root), "reason": "Build all production container images.",
         "expected": "All images built successfully.", "required": True},
    ])


def prod_build_component(service: str, label: str) -> None:
    """Build a single production container image."""
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found.", level="ERROR", label="PROD-BUILD")
        return

    import os
    os.environ["APP_VERSION"] = _read_app_version()
    _sync_version_json()
    invoke_flow(f"PROD-BUILD-{label.upper()}", [
        {"name": f"Build {label}",
         "command": f"docker compose -f docker-compose.prod.yml --env-file .env.prod build {service}",
         "cwd": str(state.repo_root), "reason": f"Build {label} production image.",
         "expected": "Image built.", "required": True},
    ])
