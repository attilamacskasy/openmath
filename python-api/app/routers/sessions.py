"""Sessions router."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user, require_admin
from app.queries import (
    create_session,
    delete_session,
    get_quiz_type_by_code,
    get_reviews_for_session,
    get_session_by_id,
    get_user_roles,
    insert_questions,
    is_parent_of_student,
    is_teacher_of_student,
    list_parent_children,
    list_sessions,
    list_sessions_for_user,
    list_sessions_for_users,
    list_teacher_students,
)
from app.schemas.session import CreateSessionRequest
from app.services.difficulty import is_difficulty
from app.services.generator import generate_questions

router = APIRouter(tags=["sessions"])

DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"


@router.get("/sessions")
async def get_sessions(
    user: dict[str, Any] = Depends(get_current_user),
    quiz_type_code: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
):
    # If user_id is provided, verify relationship
    if user_id and user_id != user["sub"]:
        user_roles = await get_user_roles(user["sub"])
        if "admin" in user_roles:
            pass  # admin can view anyone
        elif "teacher" in user_roles and await is_teacher_of_student(user["sub"], user_id):
            pass  # teacher viewing their student
        elif "parent" in user_roles and await is_parent_of_student(user["sub"], user_id):
            pass  # parent viewing their child
        else:
            from fastapi import HTTPException as _H
            raise HTTPException(status_code=403, detail="Access denied")
        return await list_sessions_for_user(user_id, quiz_type_code=quiz_type_code)

    # Users see only own sessions; admins see all; teachers/parents include students
    user_roles = await get_user_roles(user["sub"])
    if "admin" in user_roles:
        return await list_sessions(quiz_type_code=quiz_type_code)

    # Collect user IDs to query: own + associated students/children
    user_ids = [user["sub"]]
    if "teacher" in user_roles:
        students = await list_teacher_students(user["sub"])
        user_ids.extend(str(s["id"]) for s in students)
    if "parent" in user_roles:
        children = await list_parent_children(user["sub"])
        user_ids.extend(str(c["id"]) for c in children)

    # Deduplicate
    user_ids = list(dict.fromkeys(user_ids))
    if len(user_ids) == 1:
        return await list_sessions_for_user(user_ids[0], quiz_type_code=quiz_type_code)
    return await list_sessions_for_users(user_ids, quiz_type_code=quiz_type_code)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict[str, Any] = Depends(get_current_user)):
    result = await get_session_by_id(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    # Users can only access own sessions; admins/teachers/parents can access related
    user_roles = await get_user_roles(user["sub"])
    s = result.get("session", {})
    session_owner = str(s.get("user_id", ""))
    if "admin" not in user_roles and session_owner != user["sub"]:
        # Allow teachers and parents to view their students' sessions
        is_related = False
        if "teacher" in user_roles:
            is_related = await is_teacher_of_student(user["sub"], session_owner)
        if not is_related and "parent" in user_roles:
            is_related = await is_parent_of_student(user["sub"], session_owner)
        if not is_related:
            raise HTTPException(status_code=403, detail="Access denied")
    # Attach reviews
    reviews = await get_reviews_for_session(session_id)
    result["reviews"] = reviews
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
        user_id=body.userId,
        user_name=body.userName,
        user_age=body.userAge,
        user_gender=body.userGender,
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
        "quizTypeDescription": quiz_type.get("description", ""),
        "quizTypeCategory": quiz_type.get("category", ""),
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
