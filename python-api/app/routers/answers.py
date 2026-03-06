"""Answers router."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.queries import submit_answer
from app.schemas.answer import SubmitAnswerRequest

router = APIRouter(tags=["answers"])


@router.post("/answers")
async def post_answer(body: SubmitAnswerRequest, user: dict[str, Any] = Depends(get_current_user)):
    # Support both JSONB response format and legacy int value
    value = body.value
    response = body.response

    if value is None and response:
        parsed = response.get("parsed", {})
        value = parsed.get("value")

    if value is None:
        raise HTTPException(status_code=400, detail="Answer value is required")

    result = await submit_answer(
        question_id=body.questionId,
        value=value,
        response=response,
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Question not found")

    return result
