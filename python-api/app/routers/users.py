"""Users router."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth import calculate_age, hash_password
from app.dependencies import get_current_user, require_admin
from app.queries import (
    create_parent_student,
    create_teacher_student,
    create_user_with_auth,
    delete_parent_student,
    delete_teacher_student,
    get_student_associations,
    get_user_performance_stats,
    get_user_profile,
    get_user_roles,
    get_user_timetable_stats,
    is_parent_of_student,
    is_teacher_of_student,
    list_all_parent_students,
    list_all_teacher_students,
    list_users,
    list_users_admin,
    add_user_role,
    set_user_roles,
    update_user_password,
    update_user_profile,
    update_user_profile_v2,
)
from app.schemas.auth import AdminCreateUserRequest, RoleAssignment, RelationshipRequest
from app.schemas.user import UserOut, UpdateUserRequest
from app.services.notifications import create_notification

router = APIRouter(tags=["users"])


@router.get("/users")
async def get_users(user: dict[str, Any] = Depends(require_admin)):
    return await list_users_admin()


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict[str, Any] = Depends(get_current_user)):
    # Users can only view own profile; admins can view any
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles and user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    profile = await get_user_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    stats = await get_user_performance_stats(user_id)
    return {**profile, "stats": stats}


@router.patch("/users/{user_id}")
async def patch_user(
    user_id: str,
    body: UpdateUserRequest,
    user: dict[str, Any] = Depends(get_current_user),
):
    # Users can only edit own profile; admins can edit any
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles and user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    birthday: date | None = None
    if body.birthday:
        try:
            birthday = date.fromisoformat(body.birthday)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid birthday format (use YYYY-MM-DD)")

    updated = await update_user_profile_v2(
        user_id,
        name=body.name,
        age=body.age,
        gender=body.gender,
        learned_timetables=body.learned_timetables,
        birthday=birthday,
        email=body.email,
        locale=body.locale,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


@router.post("/users", status_code=201)
async def create_user(
    body: AdminCreateUserRequest,
    user: dict[str, Any] = Depends(require_admin),
):
    """Admin creates a new user account."""
    birthday: date | None = None
    if body.birthday:
        try:
            birthday = date.fromisoformat(body.birthday)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid birthday format")

    pw_hash = hash_password(body.password)
    timetables = body.learnedTimetables or [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    new_user = await create_user_with_auth(
        name=body.name,
        email=body.email,
        password_hash=pw_hash,
        role=body.role,
        auth_provider="local",
        birthday=birthday,
        gender=body.gender,
        learned_timetables=timetables,
        locale=body.locale,
    )

    # Assign role in user_roles table
    await add_user_role(str(new_user["id"]), body.role)

    age = calculate_age(birthday) if birthday else None
    return {
        "id": str(new_user["id"]),
        "name": new_user["name"],
        "email": new_user.get("email"),
        "role": new_user.get("role"),
        "roles": [body.role],
        "age": age,
        "createdAt": new_user.get("created_at"),
    }


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    body: dict,
    user: dict[str, Any] = Depends(require_admin),
):
    """Admin resets a user's password."""
    new_password = body.get("password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    pw_hash = hash_password(new_password)
    await update_user_password(user_id, pw_hash)
    return {"success": True}


# ── Student associations (v2.5) ─────────────────────

@router.get("/users/{user_id}/associations")
async def get_user_associations(
    user_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Get teachers and parents associated with a student."""
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles and user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return await get_student_associations(user_id)


@router.get("/users/{user_id}/mastery")
async def get_timetable_mastery(
    user_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Return per-timetable accuracy for multiplication quizzes (v2.7).
    Response: list of { table, attempts, accuracy, mastered }.
    Access: own, teacher-of, parent-of, admin.
    """
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
    return await get_user_timetable_stats(user_id)


# ── Role management (admin) ─────────────────────────

@router.get("/users/{user_id}/roles")
async def get_roles(user_id: str, user: dict[str, Any] = Depends(require_admin)):
    """Get roles for a user."""
    roles = await get_user_roles(user_id)
    return {"roles": roles}


@router.put("/users/{user_id}/roles")
async def update_roles(
    user_id: str,
    body: RoleAssignment,
    user: dict[str, Any] = Depends(require_admin),
):
    """Set roles for a user (replaces all)."""
    roles = await set_user_roles(user_id, body.roles)
    # Notify user of role change
    await create_notification(
        user_id,
        "role_changed",
        "Roles updated",
        f"Your roles have been updated to: {', '.join(roles)}",
    )
    return {"roles": roles}


# ── Relationship management (admin) ─────────────────

@router.get("/admin/teacher-students")
async def get_teacher_students(user: dict[str, Any] = Depends(require_admin)):
    """List all teacher–student assignments."""
    return await list_all_teacher_students()


@router.post("/admin/teacher-students", status_code=201)
async def add_teacher_student(
    body: RelationshipRequest,
    user: dict[str, Any] = Depends(require_admin),
):
    """Assign student to teacher."""
    if not body.teacher_id:
        raise HTTPException(status_code=400, detail="teacherId is required")
    try:
        return await create_teacher_student(body.teacher_id, body.student_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/teacher-students/{assignment_id}")
async def remove_teacher_student(
    assignment_id: str,
    user: dict[str, Any] = Depends(require_admin),
):
    """Remove teacher–student assignment."""
    deleted = await delete_teacher_student(assignment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True}


@router.get("/admin/parent-students")
async def get_parent_students(user: dict[str, Any] = Depends(require_admin)):
    """List all parent–student assignments."""
    return await list_all_parent_students()


@router.post("/admin/parent-students", status_code=201)
async def add_parent_student(
    body: RelationshipRequest,
    user: dict[str, Any] = Depends(require_admin),
):
    """Assign student to parent."""
    if not body.parent_id:
        raise HTTPException(status_code=400, detail="parentId is required")
    try:
        return await create_parent_student(body.parent_id, body.student_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/admin/parent-students/{assignment_id}")
async def remove_parent_student(
    assignment_id: str,
    user: dict[str, Any] = Depends(require_admin),
):
    """Remove parent–student assignment."""
    deleted = await delete_parent_student(assignment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True}
