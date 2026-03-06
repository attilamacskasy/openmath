"""Sessions router."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user, require_admin
from app.queries import (
    create_session,
    delete_session,
    get_quiz_type_by_code,
    get_session_by_id,
    insert_questions,
    list_sessions,
    list_sessions_for_student,
)
from app.schemas.session import CreateSessionRequest
from app.services.difficulty import is_difficulty
from app.services.generator import generate_questions

router = APIRouter(tags=["sessions"])

DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"


@router.get("/sessions")
async def get_sessions(user: dict[str, Any] = Depends(get_current_user)):
    # Students see only own sessions; admins see all
    if user.get("role") == "admin":
        return await list_sessions()
    return await list_sessions_for_student(user["sub"])


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict[str, Any] = Depends(get_current_user)):
    result = await get_session_by_id(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    # Students can only access own sessions
    if user.get("role") != "admin":
        s = result.get("session", {})
        if str(s.get("student_id", "")) != user["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
    return result


@router.delete("/sessions/{session_id}")
async def remove_session(session_id: str, user: dict[str, Any] = Depends(require_admin)):
    """Admin deletes a session with cascade."""
    deleted = await delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"deleted": True, "sessionId": session_id}


@router.post("/sessions")
async def post_session(body: CreateSessionRequest, user: dict[str, Any] = Depends(get_current_user)):
    if not is_difficulty(body.difficulty):
        raise HTTPException(status_code=400, detail="Invalid difficulty")

    quiz_type_code = body.quizTypeCode or DEFAULT_QUIZ_TYPE_CODE
    quiz_type = await get_quiz_type_by_code(quiz_type_code)
    if not quiz_type:
        raise HTTPException(status_code=400, detail=f"Unknown quiz type: {quiz_type_code}")

    template_kind = quiz_type.get("template_kind") or "axb"

    session = await create_session(
        difficulty=body.difficulty,
        total_questions=body.totalQuestions,
        student_id=body.studentId,
        student_name=body.studentName,
        student_age=body.studentAge,
        student_gender=body.studentGender,
        learned_timetables=body.learnedTimetables,
        quiz_type_code=quiz_type_code,
    )

    generated = generate_questions(
        difficulty=session["difficulty"],
        total_questions=session["total_questions"],
        quiz_type_code=quiz_type_code,
        template_kind=template_kind,
        learned_timetables=session["learned_timetables"],
    )

    questions = await insert_questions(
        session_id=session["id"],
        quiz_type_id=session["quiz_type_id"],
        generated=generated,
    )

    return {
        "sessionId": session["id"],
        "quizTypeCode": quiz_type_code,
        "questions": [
            {
                "id": q["id"],
                "position": q["position"],
                "prompt": q.get("prompt", {
                    "template": {
                        "kind": template_kind,
                        "a": q.get("a"),
                        "b": q.get("b"),
                        **({"c": q["c"], "d": q["d"]} if q.get("c") is not None else {}),
                    },
                    "answer": {"type": "int"},
                    "render": (
                        f"({q.get('a')} × {q.get('b')}) + ({q.get('c')} × {q.get('d')})"
                        if q.get("c") is not None
                        else f"{q.get('a')} × {q.get('b')}"
                    ),
                }),
            }
            for q in questions
        ],
    }
