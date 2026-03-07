"""Database query functions – raw SQL via asyncpg, mirroring Nuxt Drizzle queries."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg

from app.database import get_pool
from app.services.scoring import calculate_percent

DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"
DEFAULT_LEARNED_TIMETABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

STATS_TABLE_NAMES = ("quiz_types", "users", "quiz_sessions", "questions", "answers")


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
                  template_kind, category,
                  recommended_age_min, recommended_age_max,
                  is_active, sort_order
           FROM quiz_types ORDER BY sort_order, code"""
    )
    return [_row_to_dict(r) for r in rows]


async def list_active_quiz_types(
    age: int | None = None, category: str | None = None
) -> list[dict[str, Any]]:
    """List active quiz types, optionally filtered by age and category."""
    pool = await get_pool()
    conditions = ["is_active = true"]
    params: list[Any] = []
    idx = 1

    if age is not None:
        conditions.append(f"(recommended_age_min IS NULL OR recommended_age_min <= ${idx})")
        params.append(age)
        idx += 1
        conditions.append(f"(recommended_age_max IS NULL OR recommended_age_max >= ${idx})")
        params.append(age)
        idx += 1

    if category is not None:
        conditions.append(f"category = ${idx}")
        params.append(category)
        idx += 1

    where = " AND ".join(conditions)
    rows = await pool.fetch(
        f"""SELECT id, code, description,
                   COALESCE(answer_type, 'int') AS answer_type,
                   template_kind, category,
                   recommended_age_min, recommended_age_max,
                   is_active, sort_order
            FROM quiz_types WHERE {where}
            ORDER BY sort_order, code""",
        *params,
    )
    return [_row_to_dict(r) for r in rows]


async def get_quiz_type_by_id(qt_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, code, description,
                  COALESCE(answer_type, 'int') AS answer_type,
                  template_kind, category,
                  recommended_age_min, recommended_age_max,
                  is_active, sort_order, created_at
           FROM quiz_types WHERE id = $1""",
        UUID(qt_id),
    )
    return _row_to_dict(row) if row else None


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
                  template_kind, category,
                  recommended_age_min, recommended_age_max,
                  is_active, sort_order
           FROM quiz_types WHERE code = $1""",
        code,
    )
    return _row_to_dict(row) if row else None


async def create_quiz_type(data: dict[str, Any]) -> dict[str, Any]:
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO quiz_types (code, description, template_kind, answer_type,
                                    category, recommended_age_min, recommended_age_max,
                                    is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, code, description, answer_type, template_kind,
                     category, recommended_age_min, recommended_age_max,
                     is_active, sort_order, created_at""",
        data["code"],
        data["description"],
        data["template_kind"],
        data.get("answer_type", "int"),
        data.get("category"),
        data.get("recommended_age_min"),
        data.get("recommended_age_max"),
        data.get("is_active", True),
        data.get("sort_order", 0),
    )
    return _row_to_dict(row)


async def update_quiz_type(qt_id: str, data: dict[str, Any]) -> dict[str, Any] | None:
    pool = await get_pool()
    # Build dynamic SET clause
    fields = []
    params: list[Any] = [UUID(qt_id)]
    idx = 2
    allowed = [
        "description", "template_kind", "answer_type", "category",
        "recommended_age_min", "recommended_age_max", "is_active", "sort_order",
    ]
    for key in allowed:
        if key in data:
            fields.append(f"{key} = ${idx}")
            params.append(data[key])
            idx += 1

    if not fields:
        return await get_quiz_type_by_id(qt_id)

    set_clause = ", ".join(fields)
    row = await pool.fetchrow(
        f"""UPDATE quiz_types SET {set_clause} WHERE id = $1
            RETURNING id, code, description, answer_type, template_kind,
                      category, recommended_age_min, recommended_age_max,
                      is_active, sort_order, created_at""",
        *params,
    )
    return _row_to_dict(row) if row else None


async def delete_quiz_type(qt_id: str) -> bool:
    pool = await get_pool()
    # Check for referencing sessions
    count_row = await pool.fetchrow(
        "SELECT count(*)::int AS cnt FROM quiz_sessions WHERE quiz_type_id = $1",
        UUID(qt_id),
    )
    if count_row and count_row["cnt"] > 0:
        raise ValueError(f"Cannot delete: {count_row['cnt']} sessions reference this quiz type")

    result = await pool.execute(
        "DELETE FROM quiz_types WHERE id = $1", UUID(qt_id)
    )
    return result == "DELETE 1"


async def count_sessions_for_quiz_type(qt_id: str) -> int:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT count(*)::int AS cnt FROM quiz_sessions WHERE quiz_type_id = $1",
        UUID(qt_id),
    )
    return row["cnt"] if row else 0


async def get_distinct_categories() -> list[str]:
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT DISTINCT category FROM quiz_types WHERE category IS NOT NULL AND is_active = true ORDER BY category"
    )
    return [r["category"] for r in rows]


# ── Users ──────────────────────────────────────────────────

async def list_users() -> list[dict[str, Any]]:
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, name FROM users ORDER BY name, created_at DESC")
    return [_row_to_dict(r) for r in rows]


async def get_user_profile(user_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, age, gender, learned_timetables FROM users WHERE id = $1",
        UUID(user_id),
    )
    return _row_to_dict(row) if row else None


async def get_user_performance_stats(user_id: str) -> dict[str, Any]:
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT qt.code AS quiz_type_code,
                  qt.description AS quiz_type_description,
                  qs.total_questions, qs.correct_count, qs.wrong_count,
                  qs.score_percent, qs.started_at, qs.finished_at
           FROM quiz_sessions qs
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id
           WHERE qs.user_id = $1""",
        UUID(user_id),
    )
    from app.services.stats import aggregate_performance

    session_rows = [_row_to_dict(r) for r in rows]
    return aggregate_performance(session_rows)


async def update_user_profile(
    user_id: str,
    name: str,
    age: int | None,
    gender: str | None,
    learned_timetables: list[int],
) -> dict[str, Any] | None:
    pool = await get_pool()
    sanitized = _sanitize_learned_timetables(learned_timetables)
    row = await pool.fetchrow(
        """UPDATE users
           SET name = $2, age = $3, gender = $4, learned_timetables = $5
           WHERE id = $1
           RETURNING id, name, age, gender, learned_timetables""",
        UUID(user_id),
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
    user_id: str | None = None,
    user_name: str | None = None,
    user_age: int | None = None,
    user_gender: str | None = None,
    learned_timetables: list[int] | None = None,
    quiz_type_code: str | None = None,
) -> dict[str, Any]:
    pool = await get_pool()
    code = quiz_type_code or DEFAULT_QUIZ_TYPE_CODE
    quiz_type_id_str = await get_quiz_type_id_by_code(code)
    quiz_type_id = UUID(quiz_type_id_str)

    resolved_user_id: UUID | None = None
    resolved_timetables = list(DEFAULT_LEARNED_TIMETABLES)

    async with pool.acquire() as conn:
        if user_id:
            existing = await conn.fetchrow(
                "SELECT id, learned_timetables FROM users WHERE id = $1",
                UUID(user_id),
            )
            if existing:
                resolved_user_id = existing["id"]
                resolved_timetables = _sanitize_learned_timetables(list(existing["learned_timetables"] or []))
        elif user_name and user_name.strip():
            resolved_timetables = _sanitize_learned_timetables(learned_timetables)
            inserted = await conn.fetchrow(
                """INSERT INTO users (name, age, gender, learned_timetables)
                   VALUES ($1, $2, $3, $4)
                   RETURNING id, learned_timetables""",
                user_name.strip(),
                user_age,
                user_gender,
                resolved_timetables,
            )
            if inserted:
                resolved_user_id = inserted["id"]
                resolved_timetables = _sanitize_learned_timetables(list(inserted["learned_timetables"] or []))

        session = await conn.fetchrow(
            """INSERT INTO quiz_sessions (user_id, quiz_type_id, difficulty, total_questions)
               VALUES ($1, $2, $3, $4)
               RETURNING id, quiz_type_id, difficulty, total_questions""",
            resolved_user_id,
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
                str(q["correct"]),
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


async def list_sessions(quiz_type_code: str | None = None) -> list[dict[str, Any]]:
    pool = await get_pool()
    query = """SELECT qs.id, qs.user_id, qs.difficulty,
                  qs.total_questions, qs.score_percent,
                  qs.started_at, qs.finished_at,
                  u.name AS user_name,
                  qt.code AS quiz_type_code,
                  qt.description AS quiz_type_description
           FROM quiz_sessions qs
           LEFT JOIN users u ON qs.user_id = u.id
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id"""
    if quiz_type_code:
        query += " WHERE qt.code = $1"
        query += " ORDER BY qs.started_at DESC"
        rows = await pool.fetch(query, quiz_type_code)
    else:
        query += " ORDER BY qs.started_at DESC"
        rows = await pool.fetch(query)
    return [_row_to_dict(r) for r in rows]


async def get_session_by_id(session_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    sid = UUID(session_id)

    session = await pool.fetchrow("SELECT * FROM quiz_sessions WHERE id = $1", sid)
    if not session:
        return None

    user_name: str | None = None
    if session["user_id"]:
        user_row = await pool.fetchrow(
            "SELECT name FROM users WHERE id = $1", session["user_id"]
        )
        user_name = user_row["name"] if user_row else None

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
    session_dict["userName"] = user_name
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
    question_id: str, value: int | str | None = None, response: dict | None = None
) -> dict[str, Any] | None:
    pool = await get_pool()
    qid = UUID(question_id)

    question = await pool.fetchrow("SELECT * FROM questions WHERE id = $1", qid)
    if not question:
        return None

    # Build response if not provided
    if response is None:
        response = {"raw": str(value), "parsed": {"type": "int", "value": value}}

    # Use the grader for all answer types
    from app.services.grader import grade_answer

    prompt_data = question.get("prompt")
    if isinstance(prompt_data, str):
        import json as _json
        try:
            prompt_data = _json.loads(prompt_data)
        except (ValueError, TypeError):
            prompt_data = None

    is_correct = grade_answer(prompt_data, response, question["correct"])

    # Determine the int value for legacy column (or 0 for text/tuple)
    answer_value = value
    if answer_value is None and response:
        parsed = response.get("parsed", {})
        answer_value = parsed.get("value")
    if answer_value is None:
        answer_value = 0
    # Legacy column `value` in answers table is integer
    try:
        int_value = int(answer_value)
    except (ValueError, TypeError):
        int_value = 0

    # Check for existing answer (idempotent)
    existing = await pool.fetchrow("SELECT id FROM answers WHERE question_id = $1", qid)

    if not existing:
        response_json = json.dumps(response)
        await pool.execute(
            """INSERT INTO answers (question_id, quiz_type_id, value, is_correct, response)
               VALUES ($1, $2, $3, $4, $5::jsonb)""",
            qid,
            question["quiz_type_id"],
            int_value,
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
    tables = ["quiz_types", "users", "quiz_sessions", "questions", "answers"]
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
        "users": "ORDER BY created_at DESC",
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
            await conn.execute("DELETE FROM users")


# ── Auth / Users (v2.1) ─────────────────────────────

async def find_user_by_email(email: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, name, email, password_hash, role, auth_provider,
                  google_sub, birthday, age, gender, learned_timetables
           FROM users WHERE email = $1""",
        email,
    )
    return _row_to_dict(row) if row else None


async def find_user_by_google_sub(google_sub: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, name, email, password_hash, role, auth_provider,
                  google_sub, birthday, age, gender, learned_timetables
           FROM users WHERE google_sub = $1""",
        google_sub,
    )
    return _row_to_dict(row) if row else None


async def find_user_by_id(user_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, name, email, password_hash, role, auth_provider,
                  google_sub, birthday, age, gender, learned_timetables
           FROM users WHERE id = $1""",
        UUID(user_id),
    )
    return _row_to_dict(row) if row else None


async def create_user_with_auth(
    name: str,
    email: str,
    password_hash: str | None,
    role: str = "student",
    auth_provider: str = "local",
    google_sub: str | None = None,
    birthday: date | None = None,
    gender: str | None = None,
    learned_timetables: list[int] | None = None,
) -> dict[str, Any]:
    pool = await get_pool()
    sanitized = _sanitize_learned_timetables(learned_timetables)
    row = await pool.fetchrow(
        """INSERT INTO users (name, email, password_hash, role, auth_provider,
                                 google_sub, birthday, gender, learned_timetables)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, name, email, role, auth_provider, google_sub,
                     birthday, age, gender, learned_timetables, created_at""",
        name.strip(),
        email.lower().strip(),
        password_hash,
        role,
        auth_provider,
        google_sub,
        birthday,
        gender,
        sanitized,
    )
    return _row_to_dict(row)


async def update_user_google_link(
    user_id: str, google_sub: str, auth_provider: str = "both"
) -> None:
    pool = await get_pool()
    await pool.execute(
        "UPDATE users SET google_sub = $2, auth_provider = $3 WHERE id = $1",
        UUID(user_id),
        google_sub,
        auth_provider,
    )


async def update_user_password(user_id: str, password_hash: str) -> None:
    pool = await get_pool()
    await pool.execute(
        "UPDATE users SET password_hash = $2 WHERE id = $1",
        UUID(user_id),
        password_hash,
    )


async def list_users_admin() -> list[dict[str, Any]]:
    """List all users with auth columns and roles (admin view)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT u.id, u.name, u.email, u.role, u.auth_provider, u.birthday,
                  u.age, u.gender, u.learned_timetables, u.created_at,
                  COALESCE(
                      (SELECT array_agg(r.name ORDER BY r.name)
                       FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                       WHERE ur.user_id = u.id), ARRAY[]::text[]
                  ) AS roles
           FROM users u ORDER BY u.name, u.created_at DESC"""
    )
    return [_row_to_dict(r) for r in rows]


async def update_user_profile_v2(
    user_id: str,
    name: str,
    age: int | None,
    gender: str | None,
    learned_timetables: list[int],
    birthday: date | None = None,
    email: str | None = None,
    role: str | None = None,
) -> dict[str, Any] | None:
    """V2.1 profile update with optional birthday, email, and role."""
    pool = await get_pool()
    sanitized = _sanitize_learned_timetables(learned_timetables)
    row = await pool.fetchrow(
        """UPDATE users
           SET name = $2, age = $3, gender = $4, learned_timetables = $5,
               birthday = $6,
               email = COALESCE($7, email),
               role = COALESCE($8, role)
           WHERE id = $1
           RETURNING id, name, email, role, auth_provider, birthday, age,
                     gender, learned_timetables""",
        UUID(user_id),
        name.strip(),
        age,
        gender,
        sanitized,
        birthday,
        email,
        role,
    )
    return _row_to_dict(row) if row else None


async def delete_session(session_id: str) -> bool:
    """Delete a session and cascade to questions/answers."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM quiz_sessions WHERE id = $1", UUID(session_id)
    )
    return result == "DELETE 1"


async def list_sessions_for_user(user_id: str, quiz_type_code: str | None = None) -> list[dict[str, Any]]:
    """List sessions filtered by user_id."""
    pool = await get_pool()
    query = """SELECT qs.id, qs.user_id, qs.difficulty,
                  qs.total_questions, qs.score_percent,
                  qs.started_at, qs.finished_at,
                  u.name AS user_name,
                  qt.code AS quiz_type_code,
                  qt.description AS quiz_type_description
           FROM quiz_sessions qs
           LEFT JOIN users u ON qs.user_id = u.id
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id
           WHERE qs.user_id = $1"""
    params: list[Any] = [UUID(user_id)]
    if quiz_type_code:
        query += " AND qt.code = $2"
        params.append(quiz_type_code)
    query += " ORDER BY qs.started_at DESC"
    rows = await pool.fetch(query, *params)
    return [_row_to_dict(r) for r in rows]


# ── Roles (v2.3) ────────────────────────────────────

async def get_user_roles(user_id: str) -> list[str]:
    """Return list of role names for a user from user_roles junction table."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT r.name FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1
           ORDER BY r.name""",
        UUID(user_id),
    )
    return [r["name"] for r in rows]


async def set_user_roles(user_id: str, role_names: list[str]) -> list[str]:
    """Replace all roles for a user. Returns the new role list."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "DELETE FROM user_roles WHERE user_id = $1", UUID(user_id)
            )
            if role_names:
                await conn.executemany(
                    """INSERT INTO user_roles (user_id, role_id)
                       SELECT $1, r.id FROM roles r WHERE r.name = $2
                       ON CONFLICT (user_id, role_id) DO NOTHING""",
                    [(UUID(user_id), name) for name in role_names],
                )
    return await get_user_roles(user_id)


async def add_user_role(user_id: str, role_name: str) -> None:
    """Add a single role to a user."""
    pool = await get_pool()
    await pool.execute(
        """INSERT INTO user_roles (user_id, role_id)
           SELECT $1, r.id FROM roles r WHERE r.name = $2
           ON CONFLICT (user_id, role_id) DO NOTHING""",
        UUID(user_id),
        role_name,
    )


async def get_all_roles() -> list[dict[str, Any]]:
    """Return all available roles."""
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, name, description FROM roles ORDER BY name")
    return [_row_to_dict(r) for r in rows]


# ── Teacher–Student relationships (v2.3) ────────────

async def list_teacher_students(teacher_id: str) -> list[dict[str, Any]]:
    """List students assigned to a teacher."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ts.id AS assignment_id, u.id, u.name, u.email, u.birthday, u.age, u.gender
           FROM teacher_students ts
           JOIN users u ON ts.student_id = u.id
           WHERE ts.teacher_id = $1
           ORDER BY u.name""",
        UUID(teacher_id),
    )
    return [_row_to_dict(r) for r in rows]


async def is_teacher_of_student(teacher_id: str, student_id: str) -> bool:
    """Check if teacher is assigned to student."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM teacher_students WHERE teacher_id = $1 AND student_id = $2",
        UUID(teacher_id),
        UUID(student_id),
    )
    return row is not None


async def list_all_teacher_students() -> list[dict[str, Any]]:
    """List all teacher–student assignments (admin)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ts.id, ts.teacher_id, ts.student_id, ts.created_at,
                  t.name AS teacher_name, t.email AS teacher_email,
                  s.name AS student_name, s.email AS student_email
           FROM teacher_students ts
           JOIN users t ON ts.teacher_id = t.id
           JOIN users s ON ts.student_id = s.id
           ORDER BY t.name, s.name"""
    )
    return [_row_to_dict(r) for r in rows]


async def create_teacher_student(teacher_id: str, student_id: str) -> dict[str, Any]:
    """Assign a student to a teacher."""
    if teacher_id == student_id:
        raise ValueError("A user cannot be assigned as their own teacher")
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO teacher_students (teacher_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (teacher_id, student_id) DO NOTHING
           RETURNING id, teacher_id, student_id, created_at""",
        UUID(teacher_id),
        UUID(student_id),
    )
    if not row:
        # Already exists
        row = await pool.fetchrow(
            "SELECT id, teacher_id, student_id, created_at FROM teacher_students WHERE teacher_id = $1 AND student_id = $2",
            UUID(teacher_id),
            UUID(student_id),
        )
    return _row_to_dict(row)


async def delete_teacher_student(assignment_id: str) -> bool:
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM teacher_students WHERE id = $1", UUID(assignment_id)
    )
    return result == "DELETE 1"


async def delete_teacher_student_by_pair(teacher_id: str, student_id: str) -> bool:
    """Remove a specific teacher–student assignment by the pair of IDs."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM teacher_students WHERE teacher_id = $1 AND student_id = $2",
        UUID(teacher_id),
        UUID(student_id),
    )
    return result == "DELETE 1"


# ── Parent–Student relationships (v2.3) ─────────────

async def list_parent_children(parent_id: str) -> list[dict[str, Any]]:
    """List children assigned to a parent."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ps.id AS assignment_id, u.id, u.name, u.email, u.birthday, u.age, u.gender
           FROM parent_students ps
           JOIN users u ON ps.student_id = u.id
           WHERE ps.parent_id = $1
           ORDER BY u.name""",
        UUID(parent_id),
    )
    return [_row_to_dict(r) for r in rows]


async def is_parent_of_student(parent_id: str, student_id: str) -> bool:
    """Check if parent is assigned to student."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM parent_students WHERE parent_id = $1 AND student_id = $2",
        UUID(parent_id),
        UUID(student_id),
    )
    return row is not None


async def list_all_parent_students() -> list[dict[str, Any]]:
    """List all parent–student assignments (admin)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ps.id, ps.parent_id, ps.student_id, ps.created_at,
                  p.name AS parent_name, p.email AS parent_email,
                  s.name AS student_name, s.email AS student_email
           FROM parent_students ps
           JOIN users p ON ps.parent_id = p.id
           JOIN users s ON ps.student_id = s.id
           ORDER BY p.name, s.name"""
    )
    return [_row_to_dict(r) for r in rows]


async def create_parent_student(parent_id: str, student_id: str) -> dict[str, Any]:
    """Assign a student to a parent."""
    if parent_id == student_id:
        raise ValueError("A user cannot be assigned as their own parent")
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO parent_students (parent_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (parent_id, student_id) DO NOTHING
           RETURNING id, parent_id, student_id, created_at""",
        UUID(parent_id),
        UUID(student_id),
    )
    if not row:
        row = await pool.fetchrow(
            "SELECT id, parent_id, student_id, created_at FROM parent_students WHERE parent_id = $1 AND student_id = $2",
            UUID(parent_id),
            UUID(student_id),
        )
    return _row_to_dict(row)


async def delete_parent_student(assignment_id: str) -> bool:
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM parent_students WHERE id = $1", UUID(assignment_id)
    )
    return result == "DELETE 1"


async def delete_parent_student_by_pair(parent_id: str, student_id: str) -> bool:
    """Remove a specific parent–student assignment by the pair of IDs."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM parent_students WHERE parent_id = $1 AND student_id = $2",
        UUID(parent_id),
        UUID(student_id),
    )
    return result == "DELETE 1"


# ── Quiz Reviews (v2.3) ─────────────────────────────

async def get_reviews_for_session(session_id: str) -> list[dict[str, Any]]:
    """Get all reviews for a session."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT qr.id, qr.session_id, qr.reviewer_id, qr.reviewer_role,
                  qr.status, qr.comment, qr.created_at, qr.updated_at,
                  u.name AS reviewer_name
           FROM quiz_reviews qr
           JOIN users u ON qr.reviewer_id = u.id
           WHERE qr.session_id = $1
           ORDER BY qr.created_at""",
        UUID(session_id),
    )
    return [_row_to_dict(r) for r in rows]


async def create_or_update_review(
    session_id: str,
    reviewer_id: str,
    reviewer_role: str,
    status: str,
    comment: str | None = None,
) -> dict[str, Any]:
    """Create or update a review for a session by a reviewer."""
    pool = await get_pool()
    # Check if review already exists for this reviewer + session
    existing = await pool.fetchrow(
        """SELECT id FROM quiz_reviews
           WHERE session_id = $1 AND reviewer_id = $2""",
        UUID(session_id),
        UUID(reviewer_id),
    )
    if existing:
        row = await pool.fetchrow(
            """UPDATE quiz_reviews
               SET status = $3, comment = $4, updated_at = now()
               WHERE session_id = $1 AND reviewer_id = $2
               RETURNING id, session_id, reviewer_id, reviewer_role,
                         status, comment, created_at, updated_at""",
            UUID(session_id),
            UUID(reviewer_id),
            status,
            comment,
        )
    else:
        row = await pool.fetchrow(
            """INSERT INTO quiz_reviews (session_id, reviewer_id, reviewer_role, status, comment)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, session_id, reviewer_id, reviewer_role,
                         status, comment, created_at, updated_at""",
            UUID(session_id),
            UUID(reviewer_id),
            reviewer_role,
            status,
            comment,
        )
    return _row_to_dict(row)


async def list_reviews_by_reviewer(reviewer_id: str) -> list[dict[str, Any]]:
    """List all reviews created by a specific reviewer."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT qr.id, qr.session_id, qr.reviewer_id, qr.reviewer_role,
                  qr.status, qr.comment, qr.created_at, qr.updated_at,
                  u.name AS student_name,
                  qt.code AS quiz_type_code,
                  qt.description AS quiz_type_description,
                  qs.score_percent, qs.difficulty, qs.started_at
           FROM quiz_reviews qr
           JOIN quiz_sessions qs ON qr.session_id = qs.id
           JOIN users u ON qs.user_id = u.id
           LEFT JOIN quiz_types qt ON qs.quiz_type_id = qt.id
           WHERE qr.reviewer_id = $1
           ORDER BY qr.created_at DESC""",
        UUID(reviewer_id),
    )
    return [_row_to_dict(r) for r in rows]


async def get_session_owner_id(session_id: str) -> str | None:
    """Get the user_id of a session's owner."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT user_id FROM quiz_sessions WHERE id = $1",
        UUID(session_id),
    )
    return str(row["user_id"]) if row else None
