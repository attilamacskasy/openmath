from __future__ import annotations

from typing import Any

ALLOWED_STATS_TABLES = ("quiz_types", "users", "quiz_sessions", "questions", "answers")


def list_quiz_types(conn) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, code, description
            FROM quiz_types
            ORDER BY code ASC
            """
        )
        return cur.fetchall()


def list_quiz_types_by_codes(conn, codes: list[str]) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, code, description
            FROM quiz_types
            WHERE code = ANY(%s)
            ORDER BY code ASC
            """,
            (codes,),
        )
        return cur.fetchall()


def upsert_quiz_type(conn, code: str, description: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO quiz_types (code, description)
            VALUES (%s, %s)
            ON CONFLICT (code)
            DO UPDATE SET description = EXCLUDED.description
            RETURNING id, code, description
            """,
            (code, description),
        )
        return cur.fetchone()


def list_users(conn) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name
            FROM users
            ORDER BY name ASC, created_at DESC
            """
        )
        return cur.fetchall()


def get_user_profile(conn, user_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, age, gender, learned_timetables
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()


def update_user_profile(conn, user_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET name = %s,
                age = %s,
                gender = %s,
                learned_timetables = %s
            WHERE id = %s
            RETURNING id, name, age, gender, learned_timetables
            """,
            (
                payload["name"],
                payload.get("age"),
                payload.get("gender"),
                payload["learned_timetables"],
                user_id,
            ),
        )
        return cur.fetchone()


def get_quiz_type_by_code(conn, code: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id, code, description FROM quiz_types WHERE code = %s", (code,))
        return cur.fetchone()


def create_user(conn, payload: dict[str, Any]) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (name, age, gender, learned_timetables)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, age, gender, learned_timetables
            """,
            (payload["name"], payload.get("age"), payload.get("gender"), payload["learned_timetables"]),
        )
        return cur.fetchone()


def create_session(conn, payload: dict[str, Any]) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO quiz_sessions (user_id, quiz_type_id, difficulty, total_questions)
            VALUES (%s, %s, %s, %s)
            RETURNING id, user_id, quiz_type_id, difficulty, total_questions, correct_count, wrong_count, score_percent, started_at, finished_at
            """,
            (payload.get("user_id"), payload["quiz_type_id"], payload["difficulty"], payload["total_questions"]),
        )
        return cur.fetchone()


def insert_questions(conn, rows: list[dict[str, Any]]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO questions (session_id, quiz_type_id, a, b, c, d, correct, position)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (
                    row["session_id"],
                    row["quiz_type_id"],
                    row["a"],
                    row["b"],
                    row.get("c"),
                    row.get("d"),
                    row["correct"],
                    row["position"],
                )
                for row in rows
            ],
        )


def get_session(conn, session_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT qs.id,
                   qs.user_id,
                   qs.quiz_type_id,
                   qs.difficulty,
                   qs.total_questions,
                   qs.correct_count,
                   qs.wrong_count,
                   qs.score_percent,
                   qs.started_at,
                   qs.finished_at,
                   s.name AS user_name,
                   qt.code AS quiz_type_code
            FROM quiz_sessions qs
            LEFT JOIN users s ON s.id = qs.user_id
            LEFT JOIN quiz_types qt ON qt.id = qs.quiz_type_id
            WHERE qs.id = %s
            """,
            (session_id,),
        )
        return cur.fetchone()


def get_session_questions(conn, session_id: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT q.id,
                   q.session_id,
                   q.quiz_type_id,
                   q.a,
                   q.b,
                   q.c,
                   q.d,
                   q.correct,
                   q.position,
                   a.id AS answer_id,
                   a.value AS answer_value,
                   a.is_correct AS answer_is_correct,
                   a.answered_at AS answer_answered_at
            FROM questions q
            LEFT JOIN answers a ON a.question_id = q.id
            WHERE q.session_id = %s
            ORDER BY q.position ASC
            """,
            (session_id,),
        )
        return cur.fetchall()


def list_sessions(conn) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT qs.id,
                   qs.user_id,
                   qs.difficulty,
                   qs.total_questions,
                   qs.score_percent,
                   qs.started_at,
                   qs.finished_at,
                   s.name AS user_name,
                   qt.code AS quiz_type_code,
                   qt.description AS quiz_type_description
            FROM quiz_sessions qs
            LEFT JOIN users s ON s.id = qs.user_id
            LEFT JOIN quiz_types qt ON qt.id = qs.quiz_type_id
            ORDER BY qs.started_at DESC
            """
        )
        return cur.fetchall()


def get_question_by_id(conn, question_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, session_id, quiz_type_id, correct
            FROM questions
            WHERE id = %s
            """,
            (question_id,),
        )
        return cur.fetchone()


def get_answer_by_question_id(conn, question_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM answers WHERE question_id = %s", (question_id,))
        return cur.fetchone()


def insert_answer(conn, question_id: str, quiz_type_id: str, value: int, is_correct: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO answers (question_id, quiz_type_id, value, is_correct)
            VALUES (%s, %s, %s, %s)
            """,
            (question_id, quiz_type_id, value, is_correct),
        )


def get_session_answer_counts(conn, session_id: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(a.id)::int AS answered_count,
                   COUNT(a.id) FILTER (WHERE a.is_correct)::int AS correct_count,
                   COUNT(a.id) FILTER (WHERE NOT a.is_correct)::int AS wrong_count
            FROM questions q
            LEFT JOIN answers a ON a.question_id = q.id
            WHERE q.session_id = %s
            """,
            (session_id,),
        )
        return cur.fetchone()


def update_session_scoring(
    conn,
    session_id: str,
    correct_count: int,
    wrong_count: int,
    score_percent: float,
    finished: bool,
) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE quiz_sessions
            SET correct_count = %s,
                wrong_count = %s,
                score_percent = %s,
                finished_at = CASE WHEN %s THEN now() ELSE NULL END
            WHERE id = %s
            RETURNING correct_count, wrong_count, score_percent
            """,
            (correct_count, wrong_count, score_percent, finished, session_id),
        )
        return cur.fetchone()


def get_database_statistics(conn) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              (SELECT COUNT(*)::int FROM quiz_types) AS quiz_types,
              (SELECT COUNT(*)::int FROM users) AS users,
              (SELECT COUNT(*)::int FROM quiz_sessions) AS quiz_sessions,
              (SELECT COUNT(*)::int FROM questions) AS questions,
              (SELECT COUNT(*)::int FROM answers) AS answers
            """
        )
        return cur.fetchone()


def get_database_table_rows(conn, table: str) -> list[dict[str, Any]]:
    if table not in ALLOWED_STATS_TABLES:
        raise ValueError("Invalid table name")

    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {table}")
        return cur.fetchall()


def delete_all_schema_data(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM answers")
        cur.execute("DELETE FROM questions")
        cur.execute("DELETE FROM quiz_sessions")
        cur.execute("DELETE FROM users")


def get_user_sessions_for_stats(conn, user_id: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT qt.code AS quiz_type_code,
                   qt.description AS quiz_type_description,
                   qs.total_questions,
                   qs.correct_count,
                   qs.wrong_count,
                   qs.score_percent,
                   qs.started_at,
                   qs.finished_at
            FROM quiz_sessions qs
            LEFT JOIN quiz_types qt ON qt.id = qs.quiz_type_id
            WHERE qs.user_id = %s
            """,
            (user_id,),
        )
        return cur.fetchall()
