"""PROD — Container image builds."""

from __future__ import annotations

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state
from devops.utils.display import show_not_implemented


def prod_build_all() -> None:
    """Build all production container images."""
    state = get_state()
    prod_compose = state.repo_root / "docker-compose.prod.yml"
    if not prod_compose.exists():
        log("docker-compose.prod.yml not found. Create it first (see docs/spec_v3.0_devops_script.md).",
            level="ERROR", label="PROD-BUILD")
        return

    log("Building all production container images...", level="STEP", label="PROD-BUILD")
    invoke_flow("PROD-BUILD-ALL", [
        {"name": "Build ALL images", "command": "docker compose -f docker-compose.prod.yml build",
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

    invoke_flow(f"PROD-BUILD-{label.upper()}", [
        {"name": f"Build {label}",
         "command": f"docker compose -f docker-compose.prod.yml build {service}",
         "cwd": str(state.repo_root), "reason": f"Build {label} production image.",
         "expected": "Image built.", "required": True},
    ])
