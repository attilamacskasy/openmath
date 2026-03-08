"""Pydantic schemas for badges (v2.7)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BadgeOut(BaseModel):
    id: str
    code: str
    name_en: str
    name_hu: str
    description_en: str
    description_hu: str
    icon: str
    category: str
    sort_order: int


class UserBadgeOut(BaseModel):
    id: str
    badge: BadgeOut
    awarded_at: str
    session_id: str | None = None


class BadgeSummary(BaseModel):
    """Lightweight badge info returned inline with answer submission."""
    code: str
    name_en: str
    name_hu: str
    icon: str
