"""Notification service – helpers for creating and broadcasting notifications (v2.5)."""

from __future__ import annotations

from app.queries import (
    get_parents_for_student,
    get_teachers_for_student,
    insert_notification,
)


async def create_notification(
    user_id: str,
    ntype: str,
    title: str,
    message: str,
    metadata: dict | None = None,
) -> dict:
    """Insert a notification and return it."""
    return await insert_notification(user_id, ntype, title, message, metadata or {})


async def notify_teachers_of_student(
    student_id: str, ntype: str, title: str, message: str, metadata: dict | None = None,
) -> None:
    """Notify all teachers associated with a student."""
    teachers = await get_teachers_for_student(student_id)
    for t in teachers:
        await create_notification(str(t["teacher_id"]), ntype, title, message, metadata)


async def notify_parents_of_student(
    student_id: str, ntype: str, title: str, message: str, metadata: dict | None = None,
) -> None:
    """Notify all parents associated with a student."""
    parents = await get_parents_for_student(student_id)
    for p in parents:
        await create_notification(str(p["parent_id"]), ntype, title, message, metadata)
