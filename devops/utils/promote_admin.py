"""Promote the first registered user to admin role.

Workflow: clean DB → apply migrations → register a local user → run this
to grant admin so you can manage other users from the portal.
"""

from __future__ import annotations

import os
import subprocess

from devops.ui.theme import CYAN, DIM, GREEN, RED, RESET

YELLOW = "\033[93m"

_DEV_CONTAINER = "openmath-local-dev-db"
_PROD_CONTAINER = "openmath-local-prod-db"
_DEFAULT_USER = "quiz"
_DEFAULT_DB = "quiz"


# ── Helpers ──────────────────────────────────────────────────

def _is_running(container: str) -> bool:
    try:
        r = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", container],
            capture_output=True, text=True, timeout=10,
        )
        return r.stdout.strip().lower() == "true"
    except Exception:
        return False


def _detect_container() -> str | None:
    """Return the name of whichever DB container is running (dev or prod)."""
    for c in (_PROD_CONTAINER, _DEV_CONTAINER):
        if _is_running(c):
            return c
    return None


def _psql(container: str, query: str) -> subprocess.CompletedProcess[str]:
    user = os.environ.get("POSTGRES_USER", _DEFAULT_USER)
    db = os.environ.get("POSTGRES_DB", _DEFAULT_DB)
    return subprocess.run(
        ["docker", "exec", container, "psql", "-U", user, "-d", db,
         "-t", "-A", "-F", "|", "-c", query],
        capture_output=True, text=True, timeout=15,
    )


# ── Public API ───────────────────────────────────────────────

def promote_first_admin() -> None:
    """Find the first registered user and grant admin role."""
    print()
    print(f"  {CYAN}═══ Promote First User to Admin ═══{RESET}")
    print()

    container = _detect_container()
    if not container:
        print(f"  {RED}✗ No database container is running.{RESET}")
        print(f"  {DIM}Start DEV or PROD stack first.{RESET}")
        print()
        return

    env_label = "PROD" if "prod" in container else "DEV"
    print(f"  {GREEN}✓ Container:{RESET}  {container} ({env_label})")

    # 1. Find the first registered user (oldest created_at)
    result = _psql(container,
        "SELECT id, name, email, role FROM users ORDER BY created_at ASC LIMIT 1;")
    if result.returncode != 0 or not result.stdout.strip():
        print(f"  {RED}✗ No users found in database.{RESET}")
        print(f"  {DIM}Register a user first via the application.{RESET}")
        print()
        return

    parts = result.stdout.strip().split("|")
    if len(parts) < 4:
        print(f"  {RED}✗ Unexpected query result: {result.stdout.strip()}{RESET}")
        print()
        return

    user_id, name, email, current_role = parts[0], parts[1], parts[2], parts[3]
    print(f"  {GREEN}✓ First user:{RESET}  {name} ({email})")
    print(f"  {DIM}  ID:   {user_id}{RESET}")
    print(f"  {DIM}  Role: {current_role}{RESET}")

    # 2. Check if already admin via user_roles
    check = _psql(container, f"""
        SELECT COUNT(*) FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = '{user_id}' AND r.name = 'admin';
    """)
    already_admin = check.returncode == 0 and check.stdout.strip() != "0"

    if already_admin:
        print()
        print(f"  {YELLOW}⚠ User '{name}' already has admin role — no changes needed.{RESET}")
        print()
        return

    # 3. Grant admin role via user_roles junction table
    grant = _psql(container, f"""
        INSERT INTO user_roles (user_id, role_id)
        SELECT '{user_id}', r.id FROM roles r WHERE r.name = 'admin'
        ON CONFLICT (user_id, role_id) DO NOTHING;
    """)
    if grant.returncode != 0:
        print(f"  {RED}✗ Failed to insert user_roles: {grant.stderr.strip()}{RESET}")
        print()
        return

    # 4. Also update legacy role column on users table
    _psql(container, f"UPDATE users SET role = 'admin' WHERE id = '{user_id}';")

    # 5. Verify
    verify = _psql(container, f"""
        SELECT r.name FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = '{user_id}' ORDER BY r.name;
    """)
    roles_list = [l.strip() for l in verify.stdout.strip().splitlines() if l.strip()] if verify.returncode == 0 else []

    print()
    print(f"  {GREEN}✅ User '{name}' promoted to admin!{RESET}")
    if roles_list:
        print(f"  {DIM}  Roles: {', '.join(roles_list)}{RESET}")
    print()
    print(f"  {DIM}You can now log in and manage users from the portal.{RESET}")
    print()
