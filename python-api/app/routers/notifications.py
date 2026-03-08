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


# ── Locale-aware notification messages (v2.6) ────────
NOTIFICATION_MESSAGES = {
    "en": {
        "student_associated_teacher": ("New Teacher", "Teacher {name} has added you to their class"),
        "student_associated_parent": ("New Parent", "Parent {name} has linked your account"),
        "quiz_completed": ("Quiz Completed", "Student {name} completed {quiz_type} — Score: {score}%"),
        "review_submitted": ("New Review", "Teacher {name} reviewed your {quiz_type} session"),
        "signoff_submitted": ("Signed Off", "Parent {name} signed off on your {quiz_type} session"),
        "role_changed": ("Roles Updated", "Your roles have been updated to: {roles}"),
        "student_removed_teacher": ("Teacher Removed", "You have been removed from {name}'s class"),
        "student_removed_parent": ("Parent Removed", "Parent {name} has unlinked your account"),
    },
    "hu": {
        "student_associated_teacher": ("Új tanár", "{name} tanár hozzáadott az osztályához"),
        "student_associated_parent": ("Új szülő", "{name} szülő összekapcsolta a fiókodat"),
        "quiz_completed": ("Kvíz kész", "{name} tanuló teljesítette: {quiz_type} — Eredmény: {score}%"),
        "review_submitted": ("Új értékelés", "{name} tanár értékelte a(z) {quiz_type} feladatsorodat"),
        "signoff_submitted": ("Jóváhagyva", "{name} szülő jóváhagyta a(z) {quiz_type} feladatsorodat"),
        "role_changed": ("Szerepkörök frissítve", "A szerepköreid frissítve lettek: {roles}"),
        "student_removed_teacher": ("Tanár eltávolítva", "Eltávolítottak {name} tanár osztályából"),
        "student_removed_parent": ("Szülő eltávolítva", "{name} szülő leválasztotta a fiókodat"),
    },
}


@router.get("/review-templates")
async def get_review_templates(
    role: str = Query(pattern=r"^(teacher|parent)$"),
    score_percent: int | None = Query(default=None, ge=0, le=100),
    locale: str = Query(default="en", pattern=r"^(en|hu)$"),
    user: dict[str, Any] = Depends(get_current_user),
):
    """Return template responses filtered by role, locale, and score-based sentiment."""
    templates = await list_review_templates(role, locale=locale)
    if score_percent is not None:
        if score_percent >= 70:
            sentiment = "positive"
        elif score_percent >= 40:
            sentiment = "neutral"
        else:
            sentiment = "negative"
        templates = [t for t in templates if t["sentiment"] == sentiment]
    return templates
