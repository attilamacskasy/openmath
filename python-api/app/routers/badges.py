"""Badges router (v2.7)."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.queries import (
    count_user_badges,
    get_user_roles,
    is_parent_of_student,
    is_teacher_of_student,
    list_badges,
    list_user_badges,
)

router = APIRouter(tags=["badges"])


@router.get("/badges")
async def get_all_badges(user: dict[str, Any] = Depends(get_current_user)):
    """Return all active badge definitions (for showing locked/unlocked grid)."""
    return await list_badges()


@router.get("/badges/me")
async def get_my_badges(user: dict[str, Any] = Depends(get_current_user)):
    """Return current user's earned badges."""
    return await list_user_badges(user["sub"])


@router.get("/badges/user/{user_id}")
async def get_user_badges(
    user_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Return badges for a specific user. Access: own, teacher-of, parent-of, admin."""
    if user_id != user["sub"]:
        user_roles = await get_user_roles(user["sub"])
        if "admin" in user_roles:
            pass
        elif "teacher" in user_roles and await is_teacher_of_student(user["sub"], user_id):
            pass
        elif "parent" in user_roles and await is_parent_of_student(user["sub"], user_id):
            pass
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    return await list_user_badges(user_id)


@router.get("/badges/user/{user_id}/count")
async def get_user_badge_count(
    user_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Return badge count for a user. Access: own, teacher-of, parent-of, admin."""
    if user_id != user["sub"]:
        user_roles = await get_user_roles(user["sub"])
        if "admin" in user_roles:
            pass
        elif "teacher" in user_roles and await is_teacher_of_student(user["sub"], user_id):
            pass
        elif "parent" in user_roles and await is_parent_of_student(user["sub"], user_id):
            pass
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    count = await count_user_badges(user_id)
    return {"count": count}
