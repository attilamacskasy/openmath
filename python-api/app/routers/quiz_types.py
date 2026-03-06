"""Quiz types router."""

from typing import Any

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.queries import list_quiz_types

router = APIRouter(tags=["quiz-types"])


@router.get("/quiz-types")
async def get_quiz_types(user: dict[str, Any] = Depends(get_current_user)):
    return await list_quiz_types()
