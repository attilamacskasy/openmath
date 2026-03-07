"""Parent router — view children's quizzes, sign off on reviews, self-association."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, require_roles
from app.queries import (
    create_or_update_review,
    create_parent_student,
    delete_parent_student_by_pair,
    find_user_by_email,
    find_user_by_id,
    get_reviews_for_session,
    get_session_by_id,
    get_session_owner_id,
    get_session_with_quiz_info,
    get_user_roles,
    is_parent_of_student,
    list_parent_children,
    list_sessions_for_user,
)
from app.schemas.auth import AssociateByEmailRequest, SignoffRequest
from app.services.notifications import create_notification

router = APIRouter(prefix="/parent", tags=["parent"])

require_parent = require_roles("parent", "admin")


@router.get("/children")
async def get_children(user: dict[str, Any] = Depends(require_parent)):
    """List children assigned to the current parent."""
    return await list_parent_children(user["sub"])


@router.get("/children/{child_id}/sessions")
async def get_child_sessions(
    child_id: str,
    user: dict[str, Any] = Depends(require_parent),
):
    """List quiz sessions for a child."""
    if "admin" not in user.get("roles", []):
        if not await is_parent_of_student(user["sub"], child_id):
            raise HTTPException(status_code=403, detail="Child not assigned to you")
    sessions = await list_sessions_for_user(child_id)
    # Attach review status
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
    user: dict[str, Any] = Depends(require_parent),
):
    """View full session detail + teacher review."""
    owner_id = await get_session_owner_id(session_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if "admin" not in user.get("roles", []):
        if not await is_parent_of_student(user["sub"], owner_id):
            raise HTTPException(status_code=403, detail="Child not assigned to you")

    detail = await get_session_by_id(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found")

    reviews = await get_reviews_for_session(session_id)
    detail["reviews"] = reviews
    return detail


@router.post("/sessions/{session_id}/signoff")
async def sign_off(
    session_id: str,
    body: SignoffRequest,
    user: dict[str, Any] = Depends(require_parent),
):
    """Parent signs off on a reviewed session."""
    owner_id = await get_session_owner_id(session_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Session not found")

    if "admin" not in user.get("roles", []):
        if not await is_parent_of_student(user["sub"], owner_id):
            raise HTTPException(status_code=403, detail="Child not assigned to you")

    # v2.5: Require teacher review before parent sign-off
    reviews = await get_reviews_for_session(session_id)
    teacher_reviewed = any(
        r["reviewer_role"] == "teacher" and r["status"] == "reviewed"
        for r in reviews
    )
    if not teacher_reviewed:
        raise HTTPException(status_code=400, detail="Cannot sign off until a teacher has reviewed this session")

    review = await create_or_update_review(
        session_id=session_id,
        reviewer_id=user["sub"],
        reviewer_role="parent",
        status=body.status,
        comment=body.comment,
    )
    # Notify student
    session_info = await get_session_with_quiz_info(session_id)
    parent_info = await find_user_by_id(user["sub"])
    parent_name = parent_info["name"] if parent_info else "A parent"
    quiz_desc = session_info["quiz_type_description"] if session_info else "quiz"
    if owner_id:
        await create_notification(
            owner_id,
            "signoff_submitted",
            "Session signed off",
            f"Parent {parent_name} signed off on your {quiz_desc} session",
        )
    return review


@router.post("/children")
async def associate_child(
    body: AssociateByEmailRequest,
    user: dict[str, Any] = Depends(require_parent),
):
    """Parent self-associates a child by email lookup."""
    student = await find_user_by_email(body.email)
    if not student:
        raise HTTPException(status_code=404, detail="No registered student found with that email address")
    student_roles = await get_user_roles(str(student["id"]))
    if "student" not in student_roles:
        raise HTTPException(status_code=400, detail="That user does not have the student role")
    if str(student["id"]) == user["sub"]:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    try:
        result = await create_parent_student(user["sub"], str(student["id"]))
    except Exception as e:
        if "at most 2 parents" in str(e):
            raise HTTPException(status_code=409, detail="This student already has the maximum of 2 parents")
        raise HTTPException(status_code=409, detail="This child is already assigned to your account")
    # Notify student
    parent_info = await find_user_by_id(user["sub"])
    parent_name = parent_info["name"] if parent_info else "A parent"
    await create_notification(
        str(student["id"]),
        "student_associated_parent",
        "Parent linked",
        f"Parent {parent_name} has linked your account",
    )
    return result


@router.delete("/children/{child_id}")
async def remove_child(
    child_id: str,
    user: dict[str, Any] = Depends(require_parent),
):
    """Parent removes a child from their own account."""
    if not await is_parent_of_student(user["sub"], child_id):
        raise HTTPException(status_code=404, detail="Child not found on your account")
    # Notify student before removing
    parent_info = await find_user_by_id(user["sub"])
    parent_name = parent_info["name"] if parent_info else "A parent"
    await create_notification(
        child_id,
        "student_removed_parent",
        "Parent unlinked",
        f"Parent {parent_name} has unlinked your account",
    )
    await delete_parent_student_by_pair(user["sub"], child_id)
    return {"ok": True}
