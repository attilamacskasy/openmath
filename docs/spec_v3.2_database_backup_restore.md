# OpenMath Specification — v3.2
## PostgreSQL Database Backup & Restore

**Version:** 3.2  
**Status:** Draft Specification  
**Module:** DevOps / Production / Data Management  
**Depends on:** v2.8 (Production Dockerization), v3.1 (CLI Redesign)

---

# 1. Overview

This specification adds **PostgreSQL database backup and restore** capabilities to the DevOps PROD menu.

### Why This Matters

The entire OpenMath application stack is **stateless**. All three containers (Angular frontend, FastAPI backend, PostgreSQL) can be rebuilt and redeployed at any time — **the only persistent state lives in the PostgreSQL database**. This means:

- **A single database backup captures the entire application state** — all users, quizzes, results, badges, settings, and role assignments.
- **Restoring a backup fully restores the application** to the exact state it was in when the backup was created.
- If Docker volumes are accidentally deleted (e.g., `docker compose down -v`, or Docker Desktop reset), **all data is lost** unless a backup exists.
- When migrating between Docker stacks, servers, or cloud providers, a backup/restore cycle is the simplest path to move all data.

### Key Use Cases

1. **Disaster recovery** — accidental volume deletion, Docker Desktop reset, host crash
2. **Migration** — moving from local Docker Desktop to a remote Ubuntu server (or vice versa)
3. **Environment cloning** — copying production data to a staging environment for testing
4. **Pre-update safety net** — backup before deploying a new version, restore if something goes wrong
5. **Periodic scheduled backups** — manual or scripted daily/weekly dumps

---

# 2. Goals

1. One-click database backup from the PROD menu — no manual `docker exec` commands
2. One-click restore from a selected backup file
3. List existing backups with timestamps and sizes
4. Timestamped `.sql.gz` dump files stored in a local `backups/` folder at the repository root
5. Clear user feedback showing backup file path, size, and duration
6. Safety confirmation before restore (destructive operation — overwrites all current data)
7. Works with both local Docker Desktop and remote Docker deployments

---

# 3. Scope

### Included

- `pg_dump` via `docker exec` against the running PostgreSQL container
- Compressed output (gzip) to minimize disk usage
- Restore via `pg_dumpall` / `psql` pipe from compressed backup
- Backup listing with human-readable file sizes and timestamps
- Integration into the existing PROD menu as a new "Database" section
- CLI modes for non-interactive use: `python dev.py db-backup`, `python dev.py db-restore`

### Not Included

- Automated scheduled backups (cron) — out of scope for this version
- Remote backup transfer (scp/rsync) — can be added later
- Point-in-time recovery (WAL archiving) — requires more complex PostgreSQL configuration
- Backup encryption — files are stored as plain `.sql.gz`

---

# 4. Architecture

### Backup Directory

```
openmath/
├── backups/                          ← NEW: backup storage directory
│   ├── openmath_2026-03-10_093000.sql.gz
│   ├── openmath_2026-03-10_120000.sql.gz
│   └── ...
├── .gitignore                        ← backups/ already ignored (or add it)
```

- Directory: `{repo_root}/backups/`
- Naming: `openmath_{YYYY-MM-DD}_{HHMMSS}.sql.gz`
- Format: gzip-compressed plain SQL (pg_dump custom format is faster but less portable)

### Container & Credentials

All database connection details come from `docker-compose.prod.yml` environment variables:

| Variable         | Default | Source                              |
|------------------|---------|-------------------------------------|
| `POSTGRES_USER`  | `quiz`  | `docker-compose.prod.yml` / `.env`  |
| `POSTGRES_DB`    | `quiz`  | `docker-compose.prod.yml` / `.env`  |
| Container name   | `openmath-local-prod-db` | `docker-compose.prod.yml` |

### Backup Command

```bash
docker exec openmath-local-prod-db pg_dump -U quiz -d quiz --clean --if-exists | gzip > backups/openmath_2026-03-10_093000.sql.gz
```

On Windows, piping through gzip may not be available natively. The implementation uses Python's `gzip` module to compress the raw `pg_dump` output stream.

### Restore Command

```bash
gunzip -c backups/openmath_2026-03-10_093000.sql.gz | docker exec -i openmath-local-prod-db psql -U quiz -d quiz
```

On Windows, the implementation uses Python's `gzip` module to decompress, then pipes into `docker exec -i`.

---

# 5. Implementation Details

### 5.1 New Module: `devops/prod/database.py`

```python
def db_backup() -> None
    """Create a compressed pg_dump backup of the production database."""
    # 1. Verify container openmath-local-prod-db is running
    # 2. Create backups/ directory if needed
    # 3. Generate timestamped filename
    # 4. Run: docker exec openmath-local-prod-db pg_dump -U $USER -d $DB --clean --if-exists
    # 5. Pipe stdout through Python gzip and write to file
    # 6. Print: backup path, file size, duration

def db_restore(backup_file: Path | None = None) -> None
    """Restore the database from a compressed backup file."""
    # 1. If no file specified, list backups and let user choose
    # 2. Confirm with user (destructive operation)
    # 3. Verify container is running
    # 4. Read gzip file, decompress
    # 5. Pipe into: docker exec -i openmath-local-prod-db psql -U $USER -d $DB
    # 6. Print: restored from file, duration

def db_list_backups() -> None
    """List all backup files with timestamps and sizes."""
    # 1. Scan backups/ directory for *.sql.gz files
    # 2. Sort by modification time (newest first)
    # 3. Display table: filename, date, size

def _get_db_credentials() -> tuple[str, str]
    """Read POSTGRES_USER and POSTGRES_DB from .env or use defaults."""

def _is_db_container_running() -> bool
    """Check if openmath-local-prod-db container is running."""
```

### 5.2 PROD Menu Changes

Add a new separator section **"Database (Backup & Restore)"** between Build and Local Docker sections:

```
── Build Container Images ──────────────
  Build ALL         ...
  Build Backend     ...
  Build Angular     ...
  Build PostgreSQL  ...
── Database (Backup & Restore) ─────────    ← NEW
  Backup            Create pg_dump → backups/
  Restore           Restore from backup file
  List Backups      Show available backups
── Local Docker (Docker Desktop) ───────
  Start             ...
```

### 5.3 CLI Modes

| Mode          | Command                    | Description                    |
|---------------|----------------------------|--------------------------------|
| `db-backup`   | `python dev.py db-backup`  | Create backup (non-interactive)|
| `db-restore`  | `python dev.py db-restore` | Restore (prompts for file)     |
| `db-list`     | `python dev.py db-list`    | List available backups         |

---

# 6. User Experience

### 6.1 Backup Flow

```
PROD → Database → Backup

  Checking container openmath-local-prod-db... running ✓
  Creating backup...
  
  ✅ Backup created successfully
     File: backups/openmath_2026-03-10_093000.sql.gz
     Size: 2.4 MB
     Duration: 3.2s
  
  Press any key to continue...
```

### 6.2 Restore Flow

```
PROD → Database → Restore

  Available backups:
    1. openmath_2026-03-10_120000.sql.gz  (2.4 MB)  2026-03-10 12:00
    2. openmath_2026-03-10_093000.sql.gz  (2.3 MB)  2026-03-10 09:30
    3. openmath_2026-03-09_180000.sql.gz  (2.1 MB)  2026-03-09 18:00

  Select backup to restore: 1

  ⚠️  WARNING: This will OVERWRITE all current data in the database.
  The entire application state will be replaced with the backup contents.
  Type 'yes' to confirm: yes

  Restoring from openmath_2026-03-10_120000.sql.gz...
  
  ✅ Database restored successfully
     Source: backups/openmath_2026-03-10_120000.sql.gz
     Duration: 4.1s
  
  Press any key to continue...
```

### 6.3 List Backups Flow

```
PROD → Database → List Backups

  ═══ Available Database Backups ═══
  
  #  Filename                                  Size      Date
  1  openmath_2026-03-10_120000.sql.gz         2.4 MB    2026-03-10 12:00:00
  2  openmath_2026-03-10_093000.sql.gz         2.3 MB    2026-03-10 09:30:00
  3  openmath_2026-03-09_180000.sql.gz         2.1 MB    2026-03-09 18:00:00
  
  Total: 3 backups, 6.8 MB
  Location: C:\Users\...\openmath\backups\
  
  Press any key to continue...
```

---

# 7. Error Handling

| Scenario                        | Behavior                                              |
|---------------------------------|-------------------------------------------------------|
| Container not running           | Print error: "PostgreSQL container is not running. Start it first with PROD → Local → Start" |
| No backups found (restore/list) | Print info: "No backups found in backups/ directory"  |
| Backup file corrupted           | Print error from `psql` stderr, do not swallow errors |
| Disk full during backup         | Catch IOError, print error, clean up partial file     |
| Docker not installed            | Print error: "Docker is not available"                |

---

# 8. Security Considerations

- Backup files contain **all database data**, including user credentials (hashed passwords) and JWT secrets stored in the database.
- The `backups/` directory should be added to `.gitignore` to prevent accidental commits.
- Backup files are **not encrypted** — they are plain SQL compressed with gzip.
- For production environments, consider storing backups on a separate volume or transferring them off-host.

---

# 9. File Changes Summary

| File                           | Change                                                |
|--------------------------------|-------------------------------------------------------|
| `devops/prod/database.py`     | **NEW** — backup, restore, list functions             |
| `devops/menus/prod_menu.py`   | Add Database section with 3 menu items                |
| `devops/cli.py`               | Add `db-backup`, `db-restore`, `db-list` modes        |
| `backups/.gitkeep`            | **NEW** — ensure directory exists in repo             |
| `.gitignore`                  | Add `backups/*.sql.gz` pattern                        |

---

# 10. Future Enhancements (Out of Scope)

- **Automated scheduled backups** — cron job or Windows Task Scheduler integration
- **Remote backup** — `scp` / `rsync` backup files to a remote server
- **Backup rotation** — automatically delete backups older than N days
- **Backup encryption** — GPG or age encryption for sensitive data
- **WAL archiving** — PostgreSQL continuous archiving for point-in-time recovery
- **Backup verification** — restore to a temporary database and run integrity checks
