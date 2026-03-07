"""Notifications router (v2.5)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user
from app.queries import (
    count_unread_notifications,
    get_notifications,
    list_review_templates,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = Query(default=False),
    user: dict[str, Any] = Depends(get_current_user),
):
    """List notifications for the current user."""
    return await get_notifications(user["sub"], unread_only)


@router.get("/notifications/unread-count")
async def get_unread_count(user: dict[str, Any] = Depends(get_current_user)):
    """Return the count of unread notifications."""
    count = await count_unread_notifications(user["sub"])
    return {"count": count}


@router.patch("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Mark a single notification as read."""
    success = await mark_notification_read(notification_id, user["sub"])
    if not success:
        raise HTTPException(404, "Notification not found")
    return {"ok": True}


@router.patch("/notifications/read-all")
async def mark_all_read(user: dict[str, Any] = Depends(get_current_user)):
    """Mark all notifications as read."""
    count = await mark_all_notifications_read(user["sub"])
    return {"count": count}


@router.get("/review-templates")
async def get_review_templates(
    role: str = Query(pattern=r"^(teacher|parent)$"),
    score_percent: int | None = Query(default=None, ge=0, le=100),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Return template responses filtered by role and score-based sentiment."""
    templates = await list_review_templates(role)
    if score_percent is not None:
        if score_percent >= 70:
            sentiment = "positive"
        elif score_percent >= 40:
            sentiment = "neutral"
        else:
            sentiment = "negative"
        templates = [t for t in templates if t["sentiment"] == sentiment]
    return templates
