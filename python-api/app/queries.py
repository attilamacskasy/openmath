"""Database query functions – raw SQL via asyncpg, mirroring Nuxt Drizzle queries."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

from app.database import get_pool
from app.services.scoring import calculate_percent

DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"
DEFAULT_LEARNED_TIMETABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

STATS_TABLE_NAMES = ("quiz_types", "students", "quiz_sessions", "questions", "answers")


def _sanitize_learned_timetables(values: list[int] | None) -> list[int]:
    if not values:
        return list(DEFAULT_LEARNED_TIMETABLES)
    filtered = sorted({v for v in values if isinstance(v, int) and 1 <= v <= 10})
    return filtered if filtered else list(DEFAULT_LEARNED_TIMETABLES)


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """Convert asyncpg Record to dict, serializing special types."""
    d: dict[str, Any] = {}
    for k, v in dict(row).items():
        if isinstance(v, UUID):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
        else:
            d[k] = v
    return d


# ── Quiz Types ─────────────────────────────────────────────

async def list_quiz_types() -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, code, description,
                  COALESCE(answer_type, 'int') AS answer_type,
                  template_kind
           FROM quiz_types ORDER BY code"""
    )
    return [_row_to_dict(r) for r in rows]


async def get_quiz_type_id_by_code(code: str) -> str:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT id FROM quiz_types WHERE code = $1", code)
    if not row:
        raise ValueError(f"Quiz type not found: {code}")
    return str(row["id"])


async def get_quiz_type_by_code(code: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, code, description,
                  COALESCE(answer_type, 'int') AS answer_type,
                  template_kind
           FROM quiz_types WHERE code = $1""",
        code,
    )
    return _row_to_dict(row) if row else None


# ── Students ───────────────────────────────────────────────

async def list_students() -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, name FROM students ORDER BY name, created_at DESC")
    return [_row_to_dict(r) for r in rows]


async def get_student_profile(student_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, age, gender, learned_timetables FROM students WHERE id = $1",
        UUID(student_id),
    )
    return _row_to_dict(row) if row else None


async def get_student_performance_stats(student_id: str) -> dict[str, Any]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT qt.code AS quiz_type_code,
                  qt.description AS quiz_type_description,
                  qs.total_questions, qs.correct_count, qs.wrong_count,
                  qs.score_percent, qs.started_at, qs.finished_at
           FROM quiz_sessions qs
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id
           WHERE qs.student_id = $1""",
        UUID(student_id),
    )
    from app.services.stats import aggregate_performance

    session_rows = [_row_to_dict(r) for r in rows]
    return aggregate_performance(session_rows)


async def update_student_profile(
    student_id: str,
    name: str,
    age: int | None,
    gender: str | None,
    learned_timetables: list[int],
) -> dict[str, Any] | None:
    pool = await get_pool()
    sanitized = _sanitize_learned_timetables(learned_timetables)
    row = await pool.fetchrow(
        """UPDATE students
           SET name = $2, age = $3, gender = $4, learned_timetables = $5
           WHERE id = $1
           RETURNING id, name, age, gender, learned_timetables""",
        UUID(student_id),
        name.strip(),
        age,
        gender,
        sanitized,
    )
    return _row_to_dict(row) if row else None


# ── Sessions ───────────────────────────────────────────────

async def create_session(
    difficulty: str,
    total_questions: int,
    student_id: str | None = None,
    student_name: str | None = None,
    student_age: int | None = None,
    student_gender: str | None = None,
    learned_timetables: list[int] | None = None,
    quiz_type_code: str | None = None,
) -> dict[str, Any]:
    pool = await get_pool()
    code = quiz_type_code or DEFAULT_QUIZ_TYPE_CODE
    quiz_type_id_str = await get_quiz_type_id_by_code(code)
    quiz_type_id = UUID(quiz_type_id_str)

    resolved_student_id: UUID | None = None
    resolved_timetables = list(DEFAULT_LEARNED_TIMETABLES)

    async with pool.acquire() as conn:
        if student_id:
            existing = await conn.fetchrow(
                "SELECT id, learned_timetables FROM students WHERE id = $1",
                UUID(student_id),
            )
            if existing:
                resolved_student_id = existing["id"]
                resolved_timetables = _sanitize_learned_timetables(list(existing["learned_timetables"] or []))
        elif student_name and student_name.strip():
            resolved_timetables = _sanitize_learned_timetables(learned_timetables)
            inserted = await conn.fetchrow(
                """INSERT INTO students (name, age, gender, learned_timetables)
                   VALUES ($1, $2, $3, $4)
                   RETURNING id, learned_timetables""",
                student_name.strip(),
                student_age,
                student_gender,
                resolved_timetables,
            )
            if inserted:
                resolved_student_id = inserted["id"]
                resolved_timetables = _sanitize_learned_timetables(list(inserted["learned_timetables"] or []))

        session = await conn.fetchrow(
            """INSERT INTO quiz_sessions (student_id, quiz_type_id, difficulty, total_questions)
               VALUES ($1, $2, $3, $4)
               RETURNING id, quiz_type_id, difficulty, total_questions""",
            resolved_student_id,
            quiz_type_id,
            difficulty,
            total_questions,
        )

    if not session:
        raise RuntimeError("Failed to create session")

    return {
        "id": str(session["id"]),
        "quiz_type_id": str(session["quiz_type_id"]),
        "difficulty": session["difficulty"],
        "total_questions": session["total_questions"],
        "learned_timetables": resolved_timetables,
    }


async def insert_questions(
    session_id: str, quiz_type_id: str, generated: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    pool = await get_pool()
    sid = UUID(session_id)
    qtid = UUID(quiz_type_id)

    async with pool.acquire() as conn:
        for q in generated:
            prompt_json = json.dumps(q["prompt"])
            await conn.execute(
                """INSERT INTO questions (session_id, quiz_type_id, a, b, c, d, correct, position, prompt)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)""",
                sid,
                qtid,
                q.get("a"),
                q.get("b"),
                q.get("c"),
                q.get("d"),
                q["correct"],
                q["position"],
                prompt_json,
            )

        rows = await conn.fetch(
            """SELECT id, a, b, c, d, position, prompt
               FROM questions WHERE session_id = $1 ORDER BY position""",
            sid,
        )

    result = []
    for r in rows:
        d = _row_to_dict(r)
        # prompt comes back as str from asyncpg if stored as jsonb
        if isinstance(d.get("prompt"), str):
            d["prompt"] = json.loads(d["prompt"])
        result.append(d)
    return result


async def list_sessions() -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT qs.id, qs.student_id, qs.difficulty,
                  qs.total_questions, qs.score_percent,
                  qs.started_at, qs.finished_at,
                  s.name AS student_name,
                  qt.code AS quiz_type_code
           FROM quiz_sessions qs
           LEFT JOIN students s ON qs.student_id = s.id
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id
           ORDER BY qs.started_at DESC"""
    )
    return [_row_to_dict(r) for r in rows]


async def get_session_by_id(session_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    sid = UUID(session_id)

    session = await pool.fetchrow("SELECT * FROM quiz_sessions WHERE id = $1", sid)
    if not session:
        return None

    student_name: str | None = None
    if session["student_id"]:
        student_row = await pool.fetchrow(
            "SELECT name FROM students WHERE id = $1", session["student_id"]
        )
        student_name = student_row["name"] if student_row else None

    qt_code: str | None = None
    qt_row = await pool.fetchrow(
        "SELECT code FROM quiz_types WHERE id = $1", session["quiz_type_id"]
    )
    qt_code = qt_row["code"] if qt_row else None

    question_rows = await pool.fetch(
        "SELECT * FROM questions WHERE session_id = $1 ORDER BY position", sid
    )

    q_ids = [q["id"] for q in question_rows]

    answer_rows: list[asyncpg.Record] = []
    if q_ids:
        answer_rows = await pool.fetch(
            "SELECT * FROM answers WHERE question_id = ANY($1::uuid[])", q_ids
        )

    answers_by_qid: dict[str, dict] = {}
    for a in answer_rows:
        ad = _row_to_dict(a)
        if isinstance(ad.get("response"), str):
            try:
                ad["response"] = json.loads(ad["response"])
            except (json.JSONDecodeError, TypeError):
                pass
        answers_by_qid[str(a["question_id"])] = ad

    session_dict = _row_to_dict(session)
    session_dict["studentName"] = student_name
    session_dict["quizTypeCode"] = qt_code

    questions_out = []
    for q in question_rows:
        qd = _row_to_dict(q)
        if isinstance(qd.get("prompt"), str):
            try:
                qd["prompt"] = json.loads(qd["prompt"])
            except (json.JSONDecodeError, TypeError):
                pass
        qd["answer"] = answers_by_qid.get(str(q["id"]))
        questions_out.append(qd)

    return {"session": session_dict, "questions": questions_out}


# ── Answers ────────────────────────────────────────────────

async def submit_answer(
    question_id: str, value: int | None = None, response: dict | None = None
) -> dict[str, Any] | None:
    pool = await get_pool()
    qid = UUID(question_id)

    question = await pool.fetchrow("SELECT * FROM questions WHERE id = $1", qid)
    if not question:
        return None

    # Determine the int value for grading
    answer_value = value
    if answer_value is None and response:
        parsed = response.get("parsed", {})
        answer_value = parsed.get("value")
    if answer_value is None:
        answer_value = 0

    is_correct = answer_value == question["correct"]

    # Check for existing answer (idempotent)
    existing = await pool.fetchrow("SELECT id FROM answers WHERE question_id = $1", qid)

    if not existing:
        response_json = json.dumps(response or {"raw": str(answer_value), "parsed": {"type": "int", "value": answer_value}})
        await pool.execute(
            """INSERT INTO answers (question_id, quiz_type_id, value, is_correct, response)
               VALUES ($1, $2, $3, $4, $5::jsonb)""",
            qid,
            question["quiz_type_id"],
            answer_value,
            is_correct,
            response_json,
        )

    # Recompute session counters
    session_id = question["session_id"]
    all_q_ids = await pool.fetch(
        "SELECT id FROM questions WHERE session_id = $1", session_id
    )
    all_qids_list = [r["id"] for r in all_q_ids]

    all_answers = await pool.fetch(
        "SELECT is_correct FROM answers WHERE question_id = ANY($1::uuid[])",
        all_qids_list,
    )

    correct_count = sum(1 for a in all_answers if a["is_correct"])
    wrong_count = len(all_answers) - correct_count

    session = await pool.fetchrow(
        "SELECT total_questions FROM quiz_sessions WHERE id = $1", session_id
    )
    if not session:
        return None

    percent = calculate_percent(correct_count, session["total_questions"])
    finished_at = datetime.now(timezone.utc) if len(all_answers) >= session["total_questions"] else None

    await pool.execute(
        """UPDATE quiz_sessions
           SET correct_count = $2, wrong_count = $3, score_percent = $4, finished_at = $5
           WHERE id = $1""",
        session_id,
        correct_count,
        wrong_count,
        percent,
        finished_at,
    )

    return {
        "isCorrect": is_correct,
        "correctValue": question["correct"],
        "session": {
            "correct": correct_count,
            "wrong": wrong_count,
            "percent": percent,
        },
    }


# ── Stats ──────────────────────────────────────────────────

async def get_database_statistics() -> dict[str, int]:
    pool = await get_pool()
    tables = ["quiz_types", "students", "quiz_sessions", "questions", "answers"]
    result: dict[str, int] = {}
    for table in tables:
        row = await pool.fetchrow(f"SELECT count(*)::int AS cnt FROM {table}")  # noqa: S608
        result[table] = row["cnt"] if row else 0
    return result


async def get_database_table_rows(table: str) -> list[dict[str, Any]]:
    if table not in STATS_TABLE_NAMES:
        raise ValueError(f"Invalid table: {table}")

    pool = await get_pool()
    order = {
        "quiz_types": "ORDER BY code",
        "students": "ORDER BY created_at DESC",
        "quiz_sessions": "ORDER BY started_at DESC",
        "questions": "ORDER BY position",
        "answers": "ORDER BY answered_at DESC",
    }
    rows = await pool.fetch(f"SELECT * FROM {table} {order.get(table, '')}")  # noqa: S608
    result = []
    for r in rows:
        d = _row_to_dict(r)
        # Parse any JSONB fields that come back as strings
        for key in ("prompt", "response"):
            if key in d and isinstance(d[key], str):
                try:
                    d[key] = json.loads(d[key])
                except (json.JSONDecodeError, TypeError):
                    pass
        result.append(d)
    return result


async def delete_all_schema_data() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM answers")
            await conn.execute("DELETE FROM questions")
            await conn.execute("DELETE FROM quiz_sessions")
            await conn.execute("DELETE FROM students")
