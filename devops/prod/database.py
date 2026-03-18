"""PROD — PostgreSQL database backup & restore.

The entire OpenMath application stack is stateless.  All user data — users,
quizzes, results, badges, settings, role assignments — lives exclusively in
the PostgreSQL database.  A single backup captures the complete application
state; restoring it fully recovers everything.
"""

from __future__ import annotations

import gzip
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

from devops.core.logger import log
from devops.core.state import get_state

# ── Constants ────────────────────────────────────────────────

_CONTAINER = "openmath-local-prod-db"
_DEFAULT_USER = "quiz"
_DEFAULT_DB = "quiz"


# ── Helpers ──────────────────────────────────────────────────


def _get_db_credentials() -> tuple[str, str]:
    """Return (POSTGRES_USER, POSTGRES_DB) from env-vars or defaults."""
    user = os.environ.get("POSTGRES_USER", _DEFAULT_USER)
    db = os.environ.get("POSTGRES_DB", _DEFAULT_DB)
    return user, db


def _backups_dir() -> Path:
    """Return the backups/ directory, creating it if necessary."""
    d = get_state().repo_root / "backups"
    d.mkdir(exist_ok=True)
    return d


def _is_container_running() -> bool:
    """Check whether the PostgreSQL container is up."""
    try:
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", _CONTAINER],
            capture_output=True, text=True, timeout=10,
        )
        return result.stdout.strip().lower() == "true"
    except Exception:
        return False


def _human_size(nbytes: int) -> str:
    """Format byte count as human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(nbytes) < 1024:
            return f"{nbytes:.1f} {unit}"
        nbytes /= 1024  # type: ignore[assignment]
    return f"{nbytes:.1f} TB"


# ── Public API ───────────────────────────────────────────────


def db_backup() -> None:
    """Create a compressed pg_dump backup of the production database."""
    label = "DB-BACKUP"

    if not _is_container_running():
        log(f"PostgreSQL container '{_CONTAINER}' is not running. "
            "Start it first with PROD → Local → Start.", level="ERROR", label=label)
        return

    user, db = _get_db_credentials()
    backup_dir = _backups_dir()
    ts = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"openmath_{ts}.sql.gz"
    backup_path = backup_dir / filename

    log("Creating database backup...", level="STEP", label=label)
    start = time.time()

    try:
        proc = subprocess.Popen(
            ["docker", "exec", _CONTAINER, "pg_dump",
             "-U", user, "-d", db, "--clean", "--if-exists"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert proc.stdout is not None

        with gzip.open(backup_path, "wb") as f:
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                f.write(chunk)

        proc.wait()
        stderr_out = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""

        if proc.returncode != 0:
            log(f"pg_dump failed (exit {proc.returncode}): {stderr_out}", level="ERROR", label=label)
            # Clean up partial file
            if backup_path.exists():
                backup_path.unlink()
            return

        duration = round(time.time() - start, 1)
        size = _human_size(backup_path.stat().st_size)

        print()
        print(f"\033[92m  ✅ Backup created successfully\033[0m")
        print(f"     File: backups/{filename}")
        print(f"     Size: {size}")
        print(f"     Duration: {duration}s")
        print()

    except Exception as exc:
        log(f"Backup failed: {exc}", level="ERROR", label=label)
        if backup_path.exists():
            backup_path.unlink()


def db_restore() -> None:
    """Restore the database from a selected backup file."""
    label = "DB-RESTORE"

    if not _is_container_running():
        log(f"PostgreSQL container '{_CONTAINER}' is not running. "
            "Start it first with PROD → Local → Start.", level="ERROR", label=label)
        return

    backup_dir = _backups_dir()
    backups = sorted(backup_dir.glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)

    if not backups:
        log("No backups found in backups/ directory.", level="WARN", label=label)
        return

    print()
    print("\033[96m  Available backups:\033[0m")
    for i, bp in enumerate(backups, 1):
        stat = bp.stat()
        size = _human_size(stat.st_size)
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
        print(f"    {i}. {bp.name}  ({size})  {mtime}")
    print()

    # Let user choose
    try:
        raw = input("  Select backup to restore (number): ").strip()
        idx = int(raw) - 1
        if idx < 0 or idx >= len(backups):
            log("Invalid selection.", level="ERROR", label=label)
            return
    except (ValueError, EOFError, KeyboardInterrupt):
        log("Cancelled.", level="WARN", label=label)
        return

    chosen = backups[idx]

    # Safety confirmation
    print()
    print("\033[93m  ⚠️  WARNING: This will OVERWRITE all current data in the database.\033[0m")
    print("  The entire application state will be replaced with the backup contents.")
    print()
    try:
        confirm = input("  Type 'yes' to confirm: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        log("Cancelled.", level="WARN", label=label)
        return

    if confirm != "yes":
        log("Restore cancelled by user.", level="WARN", label=label)
        return

    user, db = _get_db_credentials()
    log(f"Restoring from {chosen.name}...", level="STEP", label=label)
    start = time.time()

    try:
        proc = subprocess.Popen(
            ["docker", "exec", "-i", _CONTAINER, "psql", "-U", user, "-d", db],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert proc.stdin is not None

        with gzip.open(chosen, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                proc.stdin.write(chunk)

        proc.stdin.close()
        proc.wait()
        stderr_out = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""

        duration = round(time.time() - start, 1)

        if proc.returncode != 0:
            log(f"Restore failed (exit {proc.returncode}): {stderr_out}", level="ERROR", label=label)
            return

        print()
        print(f"\033[92m  ✅ Database restored successfully\033[0m")
        print(f"     Source: backups/{chosen.name}")
        print(f"     Duration: {duration}s")
        print()

    except Exception as exc:
        log(f"Restore failed: {exc}", level="ERROR", label=label)


def db_migrate() -> None:
    """Apply SQL migrations from db/migrations/ to the PROD database.

    Runs each .sql file in alphabetical order inside the PROD PostgreSQL
    container. PostgreSQL's IF NOT EXISTS / ON CONFLICT clauses in the
    migration files make this safe to run repeatedly.
    """
    label = "DB-MIGRATE"

    if not _is_container_running():
        log(f"PostgreSQL container '{_CONTAINER}' is not running. "
            "Start it first with PROD → Local → Start.", level="ERROR", label=label)
        return

    user, db = _get_db_credentials()

    # List migration files inside the container
    try:
        result = subprocess.run(
            ["docker", "exec", _CONTAINER, "ls", "/docker-entrypoint-initdb.d/"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            log("Cannot list migration files in container. "
                "Are db/migrations mounted?", level="ERROR", label=label)
            return
        files = sorted(f.strip() for f in result.stdout.splitlines() if f.strip().endswith(".sql"))
    except Exception as exc:
        log(f"Failed to list migrations: {exc}", level="ERROR", label=label)
        return

    if not files:
        log("No .sql files found in /docker-entrypoint-initdb.d/", level="WARN", label=label)
        return

    print()
    print(f"\033[96m  Applying {len(files)} migration(s) to PROD database...\033[0m")
    print()

    failed = 0
    for f in files:
        proc = subprocess.run(
            ["docker", "exec", _CONTAINER, "psql", "-U", user, "-d", db,
             "-f", f"/docker-entrypoint-initdb.d/{f}"],
            capture_output=True, text=True, timeout=30,
            encoding="utf-8", errors="replace",
        )
        # NOTICEs about "already exists, skipping" are normal
        status = "\033[92m✓\033[0m" if proc.returncode == 0 else "\033[91m✗\033[0m"
        if proc.returncode != 0:
            failed += 1
        print(f"  {status} {f}")
        if proc.returncode != 0 and proc.stderr:
            # Show only the ERROR lines, not NOTICEs
            for line in proc.stderr.splitlines():
                if "ERROR" in line:
                    print(f"    \033[91m{line.strip()}\033[0m")

    print()
    if failed:
        print(f"\033[93m  ⚠️  {failed} migration(s) had errors (may be safe if idempotent)\033[0m")
    else:
        print(f"\033[92m  ✅ All {len(files)} migrations applied successfully\033[0m")
    print()


def db_status() -> None:
    """Check database connectivity and show table statistics."""
    label = "DB-STATUS"

    # 1. Container check
    print()
    print("\033[96m  ═══ Database Status ═══\033[0m")
    print()

    if not _is_container_running():
        print(f"  \033[91m✗ Container:\033[0m  '{_CONTAINER}' is NOT running")
        print()
        log(f"Start the database first with PROD → Local → Start.", level="ERROR", label=label)
        return

    print(f"  \033[92m✓ Container:\033[0m  '{_CONTAINER}' is running")

    user, db = _get_db_credentials()

    # 2. Connection check — simple SELECT 1
    try:
        conn_result = subprocess.run(
            ["docker", "exec", _CONTAINER, "psql", "-U", user, "-d", db,
             "-c", "SELECT 1;"],
            capture_output=True, text=True, timeout=10,
        )
        if conn_result.returncode != 0:
            print(f"  \033[91m✗ Connection:\033[0m  FAILED — {conn_result.stderr.strip()}")
            print()
            return
        print(f"  \033[92m✓ Connection:\033[0m  OK (user={user}, db={db})")
    except Exception as exc:
        print(f"  \033[91m✗ Connection:\033[0m  FAILED — {exc}")
        print()
        return

    # 3. Database version
    try:
        ver_result = subprocess.run(
            ["docker", "exec", _CONTAINER, "psql", "-U", user, "-d", db,
             "-t", "-A", "-c", "SELECT version();"],
            capture_output=True, text=True, timeout=10,
        )
        if ver_result.returncode == 0:
            version = ver_result.stdout.strip().split(",")[0]  # first part only
            print(f"  \033[92m✓ Version:\033[0m    {version}")
    except Exception:
        pass

    # 4. Database size
    try:
        size_result = subprocess.run(
            ["docker", "exec", _CONTAINER, "psql", "-U", user, "-d", db,
             "-t", "-A", "-c", f"SELECT pg_size_pretty(pg_database_size('{db}'));"],
            capture_output=True, text=True, timeout=10,
        )
        if size_result.returncode == 0:
            print(f"  \033[92m✓ DB Size:\033[0m    {size_result.stdout.strip()}")
    except Exception:
        pass

    # 5. Table statistics
    query = """
        SELECT
            schemaname AS schema,
            relname    AS table_name,
            n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC, relname;
    """
    try:
        tbl_result = subprocess.run(
            ["docker", "exec", _CONTAINER, "psql", "-U", user, "-d", db,
             "-t", "-A", "-F", "|", "-c", query],
            capture_output=True, text=True, timeout=15,
        )
        if tbl_result.returncode != 0:
            print(f"\n  \033[91m✗ Could not query table stats:\033[0m {tbl_result.stderr.strip()}")
            print()
            return

        lines = [l.strip() for l in tbl_result.stdout.strip().splitlines() if l.strip()]
        if not lines:
            print(f"\n  \033[93m⚠ No user tables found in database '{db}'.\033[0m")
            print()
            return

        rows: list[tuple[str, str, int]] = []
        total_rows = 0
        for line in lines:
            parts = line.split("|")
            if len(parts) >= 3:
                schema, table, count_str = parts[0], parts[1], parts[2]
                count = int(count_str) if count_str.isdigit() else 0
                rows.append((schema, table, count))
                total_rows += count

        print()
        print(f"\033[96m  ═══ Table Statistics ({len(rows)} tables, {total_rows:,} total rows) ═══\033[0m")
        print()
        print(f"  {'#':<4} {'Schema':<10} {'Table':<40} {'Rows':>10}")
        print(f"  {'─'*4} {'─'*10} {'─'*40} {'─'*10}")

        for i, (schema, table, count) in enumerate(rows, 1):
            # Color-code: green for populated, dim for empty
            if count > 0:
                row_str = f"\033[92m{count:>10,}\033[0m"
            else:
                row_str = f"\033[90m{count:>10,}\033[0m"
            print(f"  {i:<4} {schema:<10} {table:<40} {row_str}")

        print(f"  {'─'*4} {'─'*10} {'─'*40} {'─'*10}")
        print(f"  {'':4} {'':10} {'TOTAL':<40} {total_rows:>10,}")
        print()

    except Exception as exc:
        log(f"Failed to query table statistics: {exc}", level="ERROR", label=label)


def db_list_backups() -> None:
    """List all available backup files with timestamps and sizes."""
    label = "DB-LIST"
    backup_dir = _backups_dir()
    backups = sorted(backup_dir.glob("*.sql.gz"), key=lambda p: p.stat().st_mtime, reverse=True)

    if not backups:
        log("No backups found in backups/ directory.", level="WARN", label=label)
        return

    print()
    print("\033[96m  ═══ Available Database Backups ═══\033[0m")
    print()
    print(f"  {'#':<4} {'Filename':<45} {'Size':<10} {'Date'}")
    print(f"  {'─'*4} {'─'*45} {'─'*10} {'─'*20}")

    total_size = 0
    for i, bp in enumerate(backups, 1):
        stat = bp.stat()
        size = stat.st_size
        total_size += size
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        print(f"  {i:<4} {bp.name:<45} {_human_size(size):<10} {mtime}")

    print()
    print(f"  Total: {len(backups)} backup(s), {_human_size(total_size)}")
    print(f"  Location: {backup_dir}")
    print()
