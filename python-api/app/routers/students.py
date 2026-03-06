"""Students router."""

from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth import calculate_age, hash_password
from app.dependencies import get_current_user, require_admin
from app.queries import (
    create_student_with_auth,
    get_student_performance_stats,
    get_student_profile,
    list_students,
    list_students_admin,
    update_student_password,
    update_student_profile,
    update_student_profile_v2,
)
from app.schemas.auth import AdminCreateStudentRequest
from app.schemas.student import StudentOut, UpdateStudentRequest

router = APIRouter(tags=["students"])


@router.get("/students")
async def get_students(user: dict[str, Any] = Depends(require_admin)):
    return await list_students_admin()


@router.get("/students/{student_id}")
async def get_student(student_id: str, user: dict[str, Any] = Depends(get_current_user)):
    # Students can only view own profile; admins can view any
    if user.get("role") != "admin" and user["sub"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    student = await get_student_profile(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats = await get_student_performance_stats(student_id)
    return {**student, "stats": stats}


@router.patch("/students/{student_id}")
async def patch_student(
    student_id: str,
    body: UpdateStudentRequest,
    user: dict[str, Any] = Depends(get_current_user),
):
    # Students can only edit own profile; admins can edit any
    if user.get("role") != "admin" and user["sub"] != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

    updated = await update_student_profile(
        student_id,
        name=body.name,
        age=body.age,
        gender=body.gender,
        learned_timetables=body.learned_timetables,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Student not found")
    return updated


@router.post("/students", status_code=201)
async def create_student(
    body: AdminCreateStudentRequest,
    user: dict[str, Any] = Depends(require_admin),
):
    """Admin creates a new student account."""
    birthday: date | None = None
    if body.birthday:
        try:
            birthday = date.fromisoformat(body.birthday)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid birthday format")

    pw_hash = hash_password(body.password)
    timetables = body.learnedTimetables or [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    student = await create_student_with_auth(
        name=body.name,
        email=body.email,
        password_hash=pw_hash,
        role=body.role,
        auth_provider="local",
        birthday=birthday,
        gender=body.gender,
        learned_timetables=timetables,
    )

    age = calculate_age(birthday) if birthday else None
    return {
        "id": str(student["id"]),
        "name": student["name"],
        "email": student.get("email"),
        "role": student.get("role"),
        "age": age,
        "createdAt": student.get("created_at"),
    }


@router.post("/students/{student_id}/reset-password")
async def reset_student_password(
    student_id: str,
    body: dict,
    user: dict[str, Any] = Depends(require_admin),
):
    """Admin resets a student's password."""
    new_password = body.get("password", "")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    pw_hash = hash_password(new_password)
    await update_student_password(student_id, pw_hash)
    return {"success": True}
