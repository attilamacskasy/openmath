"""PROD — Remote Docker deployment (Ubuntu server via SSH)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from devops.core.logger import log
from devops.core.runner import invoke_flow
from devops.core.state import get_state


# ── Remote config persistence ───────────────────────────────


def _load_remote_config() -> dict[str, Any] | None:
    state = get_state()
    if state.remote_config_path.exists():
        try:
            return json.loads(state.remote_config_path.read_text(encoding="utf-8"))
        except Exception:
            log("Failed to read remote.json, will prompt for config.", level="WARN", label="REMOTE")
    return None


def _save_remote_config(config: dict[str, Any]) -> None:
    state = get_state()
    state.remote_config_path.write_text(
        json.dumps(config, indent=2), encoding="utf-8",
    )
    log(f"✅ Remote config saved to {state.remote_config_path}", level="SUCCESS", label="REMOTE")


def _get_ssh_command() -> dict[str, Any]:
    config = _load_remote_config()
    if not config:
        raise RuntimeError("Remote host not configured. Run Setup remote host first.")
    target = f"{config['user']}@{config['host']}"
    args = f'-p {config["port"]} -i "{config["sshKeyPath"]}" -o StrictHostKeyChecking=no'
    return {"target": target, "args": args, "config": config}


# ── Public actions ──────────────────────────────────────────


def remote_setup() -> None:
    """Interactive wizard to configure remote host SSH details."""
    print()
    print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
    print("\033[96m  Remote Host Setup — Ubuntu 24 Docker Server\033[0m")
    print("\033[96m═══════════════════════════════════════════════════════════════\033[0m")
    print()

    existing = _load_remote_config() or {}
    default_host = existing.get("host", "")
    default_user = existing.get("user", "deploy")
    default_port = existing.get("port", 22)
    default_path = existing.get("deployPath", "/opt/openmath")
    default_key = existing.get("sshKeyPath", "~/.ssh/id_ed25519")

    remote_host = input(f"Remote host [{default_host}]: ").strip() or default_host
    if not remote_host:
        print("\033[91mHost is required.\033[0m")
        return

    remote_user = input(f"SSH user [{default_user}]: ").strip() or default_user
    remote_port = input(f"SSH port [{default_port}]: ").strip() or str(default_port)
    remote_path = input(f"Deploy path [{default_path}]: ").strip() or default_path
    remote_key = input(f"SSH key path [{default_key}]: ").strip() or default_key

    config = {
        "host": remote_host,
        "user": remote_user,
        "port": int(remote_port),
        "deployPath": remote_path,
        "sshKeyPath": remote_key,
    }
    _save_remote_config(config)

    # Test connectivity
    state = get_state()
    log("Testing SSH connectivity...", level="STEP", label="REMOTE-SETUP")

    ssh_target = f"{config['user']}@{config['host']}"
    ssh_args = f'-p {config["port"]} -i "{config["sshKeyPath"]}" -o StrictHostKeyChecking=no -o ConnectTimeout=10'

    invoke_flow("REMOTE-SETUP", [
        {"name": "Test SSH", "command": f'ssh {ssh_args} {ssh_target} "echo ok"',
         "cwd": str(state.repo_root), "reason": "Verify SSH connectivity.",
         "expected": "ok", "required": True},
        {"name": "Check Docker", "command": f'ssh {ssh_args} {ssh_target} "docker --version"',
         "cwd": str(state.repo_root), "reason": "Verify Docker on remote.",
         "expected": "Docker version output.", "required": True},
        {"name": "Check Compose", "command": f'ssh {ssh_args} {ssh_target} "docker compose version"',
         "cwd": str(state.repo_root), "reason": "Verify Docker Compose on remote.",
         "expected": "Compose version output.", "required": True},
        {"name": "Create deploy dir", "command": f'ssh {ssh_args} {ssh_target} "mkdir -p {config["deployPath"]}"',
         "cwd": str(state.repo_root), "reason": "Create deployment directory.",
         "expected": "Directory created or exists.", "required": True},
        {"name": "Transfer compose file",
         "command": f'scp -P {config["port"]} -i "{config["sshKeyPath"]}" docker-compose.prod.yml {ssh_target}:{config["deployPath"]}/',
         "cwd": str(state.repo_root), "reason": "Upload production compose file.",
         "expected": "File transferred.", "required": True},
    ])


def remote_push() -> None:
    """Save, transfer, and load container images on the remote host."""
    ssh = _get_ssh_command()
    state = get_state()

    log("Pushing container images to remote...", level="STEP", label="REMOTE-PUSH")

    invoke_flow("REMOTE-PUSH", [
        {"name": "Save images",
         "command": "docker save openmath-api openmath-angular openmath-db -o openmath-images.tar",
         "cwd": str(state.repo_root), "reason": "Export container images to tar.",
         "expected": "openmath-images.tar created.", "required": True},
        {"name": "Transfer images",
         "command": f'scp -P {ssh["config"]["port"]} -i "{ssh["config"]["sshKeyPath"]}" openmath-images.tar {ssh["target"]}:{ssh["config"]["deployPath"]}/',
         "cwd": str(state.repo_root), "reason": "Upload images to remote server.",
         "expected": "File transferred.", "required": True},
        {"name": "Load images on remote",
         "command": f'ssh {ssh["args"]} {ssh["target"]} "docker load -i {ssh["config"]["deployPath"]}/openmath-images.tar"',
         "cwd": str(state.repo_root), "reason": "Import container images on remote.",
         "expected": "Images loaded.", "required": True},
    ])


def remote_up() -> None:
    ssh = _get_ssh_command()
    state = get_state()

    invoke_flow("REMOTE-UP", [
        {"name": "Start remote containers",
         "command": f'ssh {ssh["args"]} {ssh["target"]} "cd {ssh["config"]["deployPath"]} && docker compose -f docker-compose.prod.yml up -d"',
         "cwd": str(state.repo_root), "reason": "Start production stack on remote.",
         "expected": "Containers running.", "required": True},
    ])


def remote_down() -> None:
    ssh = _get_ssh_command()
    state = get_state()

    invoke_flow("REMOTE-DOWN", [
        {"name": "Stop remote containers",
         "command": f'ssh {ssh["args"]} {ssh["target"]} "cd {ssh["config"]["deployPath"]} && docker compose -f docker-compose.prod.yml down"',
         "cwd": str(state.repo_root), "reason": "Stop production stack on remote.",
         "expected": "Containers stopped.", "required": True},
    ])


def remote_status() -> None:
    ssh = _get_ssh_command()

    print()
    print(f'\033[96m═══ Production Containers (Remote: {ssh["config"]["host"]}) ═══\033[0m')
    try:
        result = subprocess.run(
            f'ssh {ssh["args"]} {ssh["target"]} "cd {ssh["config"]["deployPath"]} && docker compose -f docker-compose.prod.yml ps"',
            shell=True, capture_output=True, text=True, timeout=30,
        )
        for line in result.stdout.strip().splitlines():
            print(f"  {line}")
    except Exception:
        print("  \033[91mFailed to connect to remote host.\033[0m")

    print()
    print("  \033[90mRecent logs:\033[0m")
    try:
        result = subprocess.run(
            f'ssh {ssh["args"]} {ssh["target"]} "cd {ssh["config"]["deployPath"]} && docker compose -f docker-compose.prod.yml logs --tail=20"',
            shell=True, capture_output=True, text=True, timeout=30,
        )
        for line in result.stdout.strip().splitlines():
            print(f"    {line}")
    except Exception:
        pass
    print()
