"""Sessions router."""

import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.dependencies import get_current_user, require_admin
from app.queries import (
    create_session,
    delete_session,
    get_quiz_type_by_code,
    get_reviews_for_session,
    get_session_by_id,
    get_session_full_detail,
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
        "renderMode": quiz_type.get("render_mode", "text"),
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


@router.get("/sessions/{session_id}/export-pdf")
async def export_session_pdf(
    session_id: str,
    user: dict[str, Any] = Depends(get_current_user),
):
    """Generate and return session PDF. Access: own, teacher-of, parent-of, admin."""
    detail = await get_session_full_detail(session_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Session not found")

    s = detail["session"]
    session_owner = str(s.get("user_id", ""))

    # Access check
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles and session_owner != user["sub"]:
        is_related = False
        if "teacher" in user_roles:
            is_related = await is_teacher_of_student(user["sub"], session_owner)
        if not is_related and "parent" in user_roles:
            is_related = await is_parent_of_student(user["sub"], session_owner)
        if not is_related:
            raise HTTPException(status_code=403, detail="Access denied")

    # Generate PDF
    pdf_bytes = _generate_session_pdf(detail)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="openmath-session-{session_id[:8]}.pdf"'},
    )


def _generate_session_pdf(detail: dict) -> bytes:
    """Generate a PDF report for a quiz session using reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    story: list = []

    s = detail["session"]
    questions = detail.get("questions", [])
    reviews = detail.get("reviews", [])

    # Title
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=18, spaceAfter=6)
    story.append(Paragraph("OpenMath — Session Report", title_style))
    story.append(Spacer(1, 4 * mm))

    # Summary info
    info_style = ParagraphStyle("Info", parent=styles["Normal"], fontSize=10, spaceAfter=2)
    user_name = s.get("user_name") or "—"
    quiz_desc = s.get("quiz_type_description") or s.get("quiz_type_code") or "—"
    difficulty = (s.get("difficulty") or "—").capitalize()
    score = f"{s.get('correct_count', 0)}/{s.get('total_questions', 0)} ({s.get('score_percent', 0)}%)"

    started = s.get("started_at", "")
    finished = s.get("finished_at", "")
    duration = "—"
    date_str = "—"
    if started:
        if isinstance(started, str):
            try:
                started_dt = datetime.fromisoformat(started)
            except ValueError:
                started_dt = None
        else:
            started_dt = started
        if started_dt:
            date_str = started_dt.strftime("%Y-%m-%d %H:%M")
        if finished:
            if isinstance(finished, str):
                try:
                    finished_dt = datetime.fromisoformat(finished)
                except ValueError:
                    finished_dt = None
            else:
                finished_dt = finished
            if started_dt and finished_dt:
                secs = int((finished_dt - started_dt).total_seconds())
                mins, secs_r = divmod(secs, 60)
                duration = f"{mins}m {secs_r}s" if mins else f"{secs_r}s"

    for label, val in [
        ("Student", user_name),
        ("Date", date_str),
        ("Quiz Type", quiz_desc),
        ("Difficulty", difficulty),
        ("Score", score),
        ("Duration", duration),
    ]:
        story.append(Paragraph(f"<b>{label}:</b> {val}", info_style))

    story.append(Spacer(1, 6 * mm))

    # Questions table
    header = ["#", "Question", "Your Answer", "Correct", "✓/✗"]
    data = [header]
    for q in questions:
        pos = q.get("position", "")
        # Question text
        prompt = q.get("prompt")
        if isinstance(prompt, dict) and prompt.get("render"):
            q_text = prompt["render"]
        elif q.get("c") is not None:
            q_text = f"({q.get('a')} × {q.get('b')}) + ({q.get('c')} × {q.get('d')})"
        else:
            q_text = f"{q.get('a', '?')} × {q.get('b', '?')}"

        # Answers
        correct_val = q.get("correct", "—")
        answer_val = "—"
        response = q.get("response")
        if isinstance(response, dict):
            parsed = response.get("parsed", {})
            answer_val = str(parsed.get("value", q.get("answer_value", "—")))
        elif q.get("answer_value") is not None:
            answer_val = str(q["answer_value"])

        is_correct = q.get("is_correct")
        mark = "✓" if is_correct else ("✗" if is_correct is not None else "—")
        data.append([str(pos), q_text, str(answer_val), str(correct_val), mark])

    col_widths = [30, 180, 80, 80, 40]
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2196F3")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)
    story.append(Spacer(1, 6 * mm))

    # Reviews
    if reviews:
        story.append(Paragraph("<b>Reviews</b>", styles["Heading3"]))
        for rev in reviews:
            role = "Teacher review" if rev.get("reviewer_role") == "teacher" else "Parent sign-off"
            name = rev.get("reviewer_name", "—")
            comment = rev.get("comment", "")
            status = rev.get("status", "")
            rev_date = rev.get("updated_at") or rev.get("created_at") or ""
            if isinstance(rev_date, str) and rev_date:
                try:
                    rev_date = datetime.fromisoformat(rev_date).strftime("%Y-%m-%d")
                except ValueError:
                    pass
            text = f"<b>{role}</b> — {name} ({status})"
            if comment:
                text += f"<br/><i>{comment}</i>"
            if rev_date:
                text += f"<br/><font size='8'>{rev_date}</font>"
            story.append(Paragraph(text, info_style))
            story.append(Spacer(1, 2 * mm))

    # Footer
    story.append(Spacer(1, 10 * mm))
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.grey)
    now = datetime.utcnow().strftime("%Y-%m-%d")
    story.append(Paragraph(f"Generated by OpenMath on {now}", footer_style))

    doc.build(story)
    return buf.getvalue()
