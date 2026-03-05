"""Quiz types router."""

from fastapi import APIRouter

from app.queries import list_quiz_types

router = APIRouter(tags=["quiz-types"])


@router.get("/quiz-types")
async def get_quiz_types():
    return await list_quiz_types()
