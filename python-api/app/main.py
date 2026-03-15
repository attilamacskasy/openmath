"""FastAPI application entry point for OpenMath API."""

import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import lifespan
from app.routers import (
    answers, auth, badges, multiplayer, multiplayer_ws,
    notifications, parent, quiz_types, sessions, stats, teacher, users,
)


def _read_version() -> str:
    """Read API version from centralized version.json."""
    for candidate in [
        Path(__file__).resolve().parent.parent / "version.json",   # Docker: /app/version.json
        Path(__file__).resolve().parents[2] / "version.json",      # Dev:   repo_root/version.json
    ]:
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
                return data["components"].get("python-api", data["app"]["version"])
            except Exception:
                pass
    return "0.0.0"


app = FastAPI(
    title="OpenMath API",
    version=_read_version(),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(quiz_types.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(answers.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(teacher.router, prefix="/api")
app.include_router(parent.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(badges.router, prefix="/api")
app.include_router(multiplayer.router, prefix="/api")
app.include_router(multiplayer_ws.router)


@app.get("/api/health")
async def health():
    """Health check endpoint for container orchestration."""
    return {"status": "ok"}
