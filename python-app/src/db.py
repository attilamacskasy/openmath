from __future__ import annotations

import os
from pathlib import Path
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        _load_database_url_from_env_files()
        database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    return database_url


def _load_database_url_from_env_files() -> None:
    src_dir = Path(__file__).resolve().parent
    candidate_files = [
        src_dir.parent / ".env",
        src_dir.parent.parent / ".env",
    ]

    for env_file in candidate_files:
        if not env_file.exists():
            continue

        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, raw_value = stripped.split("=", 1)
            key = key.strip()
            value = raw_value.strip().strip('"').strip("'")

            if key == "DATABASE_URL" and value:
                os.environ.setdefault("DATABASE_URL", value)
                return


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    conn = psycopg.connect(get_database_url(), row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
