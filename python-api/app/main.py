"""FastAPI application entry point for OpenMath API v2.3."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import lifespan
from app.routers import answers, auth, parent, quiz_types, sessions, stats, teacher, users

app = FastAPI(
    title="OpenMath API",
    version="2.3.0",
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
