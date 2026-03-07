"""Answers router."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.queries import get_session_with_quiz_info, submit_answer
from app.schemas.answer import SubmitAnswerRequest
from app.services.notifications import notify_teachers_of_student

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

    # v2.5: Notify teachers when quiz is completed (session has percent set and finished)
    session_data = result.get("session", {})
    if session_data.get("percent") is not None:
        # Check if this was the final answer by looking for a finished session
        # The submit_answer sets finished_at when all answers are in
        # We detect completion by checking if percent matches a finished state
        # A simpler approach: check if wrong + correct == total questions
        pass  # We'll check via the questionId
    # Try to detect completion from the result
    # submit_answer updates finished_at when len(all_answers) >= total_questions
    # We can detect this by re-checking, but it's simpler to check in the result:
    # The session info in result doesn't include finished_at, so we check directly
    try:
        from app.queries import get_session_owner_id
        import asyncpg

        # Get question -> session_id
        from app.database import get_pool
        pool = await get_pool()
        q_row = await pool.fetchrow(
            "SELECT session_id FROM questions WHERE id = $1",
            __import__("uuid").UUID(body.questionId),
        )
        if q_row:
            sid = q_row["session_id"]
            s_row = await pool.fetchrow(
                "SELECT user_id, finished_at, total_questions, score_percent, quiz_type_id FROM quiz_sessions WHERE id = $1",
                sid,
            )
            if s_row and s_row["finished_at"] is not None:
                student_id = str(s_row["user_id"]) if s_row["user_id"] else None
                if student_id:
                    session_info = await get_session_with_quiz_info(str(sid))
                    student_name = session_info["user_name"] if session_info else "Student"
                    quiz_desc = session_info["quiz_type_description"] if session_info else "quiz"
                    score = s_row["score_percent"]
                    await notify_teachers_of_student(
                        student_id,
                        "quiz_completed",
                        "Quiz completed",
                        f"Student {student_name} completed {quiz_desc} — Score: {score}%",
                        {"session_id": str(sid), "score_percent": score},
                    )
    except Exception:
        pass  # Don't fail the answer submission if notification fails

    return result
