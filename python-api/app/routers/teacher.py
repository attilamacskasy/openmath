"""Teacher router — view assigned students, review quizzes, self-association."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, require_roles
from app.queries import (
    create_or_update_review,
    create_teacher_student,
    delete_teacher_student_by_pair,
    find_user_by_email,
    get_reviews_for_session,
    get_session_by_id,
    get_session_owner_id,
    get_user_roles,
    is_teacher_of_student,
    list_reviews_by_reviewer,
    list_sessions_for_user,
    list_teacher_students,
)
from app.schemas.auth import AssociateByEmailRequest, ReviewRequest

router = APIRouter(prefix="/teacher", tags=["teacher"])

require_teacher = require_roles("teacher", "admin")


@router.get("/students")
async def get_students(user: dict[str, Any] = Depends(require_teacher)):
    """List students assigned to the current teacher."""
    return await list_teacher_students(user["sub"])


@router.get("/students/{student_id}/sessions")
async def get_student_sessions(
    student_id: str,
    user: dict[str, Any] = Depends(require_teacher),
):
    """List quiz sessions for an assigned student."""
    # Admins bypass assignment check
    if "admin" not in user.get("roles", []):
        if not await is_teacher_of_student(user["sub"], student_id):
            raise HTTPException(status_code=403, detail="Student not assigned to you")
    sessions = await list_sessions_for_user(student_id)
    # Attach review status for each session
    for s in sessions:
        reviews = await get_reviews_for_session(str(s["id"]))
        teacher_review = next((r for r in reviews if r["reviewer_role"] == "teacher"), None)
        parent_signoff = next((r for r in reviews if r["reviewer_role"] == "parent"), None)
        s["review_status"] = teacher_review["status"] if teacher_review else "pending"
        s["signoff_status"] = parent_signoff["status"] if parent_signoff else None
    return sessions


@router.get("/sessions/{session_id}")
async def get_session_detail(
    session_id: str,
    user: dict[str, Any] = Depends(require_teacher),
):
    """View full session detail — only if student is assigned."""
    owner_id = await get_session_owner_id(session_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if "admin" not in user.get("roles", []):
        if not await is_teacher_of_student(user["sub"], owner_id):
            raise HTTPException(status_code=403, detail="Student not assigned to you")

    detail = await get_session_by_id(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found")

    reviews = await get_reviews_for_session(session_id)
    detail["reviews"] = reviews
    return detail


@router.post("/sessions/{session_id}/review")
async def submit_review(
    session_id: str,
    body: ReviewRequest,
    user: dict[str, Any] = Depends(require_teacher),
):
    """Create or update a teacher review for a session."""
    owner_id = await get_session_owner_id(session_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if "admin" not in user.get("roles", []):
        if not await is_teacher_of_student(user["sub"], owner_id):
            raise HTTPException(status_code=403, detail="Student not assigned to you")

    review = await create_or_update_review(
        session_id=session_id,
        reviewer_id=user["sub"],
        reviewer_role="teacher",
        status=body.status,
        comment=body.comment,
    )
    return review


@router.get("/reviews")
async def get_my_reviews(user: dict[str, Any] = Depends(require_teacher)):
    """List all reviews created by the current teacher."""
    return await list_reviews_by_reviewer(user["sub"])


@router.post("/students")
async def associate_student(
    body: AssociateByEmailRequest,
    user: dict[str, Any] = Depends(require_teacher),
):
    """Teacher self-associates a student by email lookup."""
    student = await find_user_by_email(body.email)
    if not student:
        raise HTTPException(status_code=404, detail="No registered student found with that email address")
    student_roles = await get_user_roles(str(student["id"]))
    if "student" not in student_roles:
        raise HTTPException(status_code=400, detail="That user does not have the student role")
    if str(student["id"]) == user["sub"]:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    try:
        result = await create_teacher_student(user["sub"], str(student["id"]))
    except Exception:
        raise HTTPException(status_code=409, detail="This student is already in your class")
    return result


@router.delete("/students/{student_id}")
async def remove_student(
    student_id: str,
    user: dict[str, Any] = Depends(require_teacher),
):
    """Teacher removes a student from their own class."""
    if not await is_teacher_of_student(user["sub"], student_id):
        raise HTTPException(status_code=404, detail="Student not found in your class")
    await delete_teacher_student_by_pair(user["sub"], student_id)
    return {"ok": True}
