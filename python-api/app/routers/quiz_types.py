"""Quiz types router — public + admin CRUD endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.dependencies import get_current_user, require_admin
from app.queries import (
    count_sessions_for_quiz_type,
    create_quiz_type,
    delete_quiz_type,
    get_distinct_categories,
    get_quiz_type_by_id,
    list_active_quiz_types,
    list_quiz_types,
    update_quiz_type,
)
from app.schemas.quiz_type import PreviewQuestion, QuizTypeCreate, QuizTypeUpdate
from app.services.generator import GENERATORS, generate_preview

router = APIRouter(tags=["quiz-types"])


# ── Public ──────────────────────────────────────────────────

@router.get("/quiz-types")
async def get_quiz_types(
    user: dict[str, Any] = Depends(get_current_user),
    age: int | None = Query(default=None, ge=4, le=120),
    category: str | None = Query(default=None),
):
    """List active quiz types, optionally filtered by age and category."""
    types = await list_active_quiz_types(age=age, category=category)
    categories = await get_distinct_categories()
    return {"types": types, "categories": categories}


class PublicPreviewRequest(BaseModel):
    template_kind: str
    answer_type: str = "int"
    quiz_type_code: str = ""


@router.post("/quiz-types/preview")
async def public_preview(
    body: PublicPreviewRequest,
    user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Generate 3 sample questions by template_kind (no DB write)."""
    if body.template_kind not in GENERATORS:
        raise HTTPException(status_code=400, detail=f"Unknown template_kind: {body.template_kind}")
    return generate_preview(body.template_kind, body.answer_type, body.quiz_type_code)


# ── Admin CRUD ──────────────────────────────────────────────

@router.get("/admin/quiz-types")
async def admin_list_quiz_types(user: dict[str, Any] = Depends(require_admin)):
    """List ALL quiz types including inactive (admin view)."""
    return await list_quiz_types()


@router.get("/admin/quiz-types/{qt_id}")
async def admin_get_quiz_type(qt_id: str, user: dict[str, Any] = Depends(require_admin)):
    result = await get_quiz_type_by_id(qt_id)
    if not result:
        raise HTTPException(status_code=404, detail="Quiz type not found")
    return result


@router.post("/admin/quiz-types", status_code=201)
async def admin_create_quiz_type(
    body: QuizTypeCreate, user: dict[str, Any] = Depends(require_admin)
):
    try:
        return await create_quiz_type(body.model_dump())
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Quiz type code already exists: {body.code}")
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/admin/quiz-types/{qt_id}")
async def admin_update_quiz_type(
    qt_id: str, body: QuizTypeUpdate, user: dict[str, Any] = Depends(require_admin)
):
    data = body.model_dump(exclude_unset=True)
    result = await update_quiz_type(qt_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Quiz type not found")
    return result


@router.delete("/admin/quiz-types/{qt_id}")
async def admin_delete_quiz_type(qt_id: str, user: dict[str, Any] = Depends(require_admin)):
    session_count = await count_sessions_for_quiz_type(qt_id)
    if session_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {session_count} sessions reference this quiz type",
        )
    try:
        deleted = await delete_quiz_type(qt_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=404, detail="Quiz type not found")
    return {"deleted": True}


@router.post("/admin/quiz-types/{qt_id}/preview")
async def admin_preview_quiz_type(qt_id: str, user: dict[str, Any] = Depends(require_admin)):
    """Generate 3 sample questions for a saved quiz type (admin preview)."""
    qt = await get_quiz_type_by_id(qt_id)
    if not qt:
        raise HTTPException(status_code=404, detail="Quiz type not found")
    template_kind = qt.get("template_kind")
    if not template_kind or template_kind not in GENERATORS:
        raise HTTPException(status_code=400, detail=f"Unknown template_kind: {template_kind}")
    return generate_preview(template_kind, qt.get("answer_type", "int"), qt.get("code", ""))
