"""Async PostgreSQL connection pool using asyncpg."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


@asynccontextmanager
async def lifespan(app):
    """FastAPI lifespan: create pool on startup, close on shutdown."""
    await get_pool()
    yield
    await close_pool()
