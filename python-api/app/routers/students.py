"""Students router."""

from fastapi import APIRouter, HTTPException

from app.queries import (
    get_student_performance_stats,
    get_student_profile,
    list_students,
    update_student_profile,
)
from app.schemas.student import StudentOut, UpdateStudentRequest

router = APIRouter(tags=["students"])


@router.get("/students")
async def get_students():
    return await list_students()


@router.get("/students/{student_id}")
async def get_student(student_id: str):
    student = await get_student_profile(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats = await get_student_performance_stats(student_id)
    return {**student, "stats": stats}


@router.patch("/students/{student_id}")
async def patch_student(student_id: str, body: UpdateStudentRequest):
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
