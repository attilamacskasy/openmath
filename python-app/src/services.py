from __future__ import annotations

from datetime import datetime
import random
from decimal import Decimal
from typing import Any

import repositories as repo

DIFFICULTY_SETS: dict[str, list[int]] = {
    "low": [1, 5, 10],
    "medium": [1, 2, 3, 4, 5, 6, 10],
    "hard": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}

DEFAULT_QUIZ_TYPE_CODE = "multiplication_1_10"
DEFAULT_LEARNED_TIMETABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
ALLOWED_GENDERS = {"female", "male", "other", "prefer_not_say"}
REQUIRED_QUIZ_TYPES = {
    "multiplication_1_10": "Multiplication quiz with factors between 1 and 10",
    "sum_products_1_10": "Sum of products quiz: (a × b) + (c × d) with factors 1..10",
}


def is_difficulty(value: str) -> bool:
    return value in {"low", "medium", "hard"}


def ensure_required_quiz_types(conn, apply_changes: bool) -> dict[str, Any]:
    required_codes = sorted(REQUIRED_QUIZ_TYPES.keys())
    existing = repo.list_quiz_types_by_codes(conn, required_codes)
    existing_codes = {row["code"] for row in existing}
    missing_codes = [code for code in required_codes if code not in existing_codes]

    created_or_updated: list[dict[str, Any]] = []
    if apply_changes:
        for code in required_codes:
            created_or_updated.append(repo.upsert_quiz_type(conn, code, REQUIRED_QUIZ_TYPES[code]))

    return {
        "required_codes": required_codes,
        "existing_codes": sorted(existing_codes),
        "missing_codes": missing_codes,
        "fixed": apply_changes,
        "rows": created_or_updated,
    }


def sanitize_learned_timetables(values: list[int] | None) -> list[int]:
    if not values:
        return DEFAULT_LEARNED_TIMETABLES.copy()

    filtered = [item for item in values if isinstance(item, int) and 1 <= item <= 10]
    if not filtered:
        return DEFAULT_LEARNED_TIMETABLES.copy()

    return list(dict.fromkeys(filtered))


def _random_int(minimum: int, maximum: int) -> int:
    return random.randint(minimum, maximum)


def _pick_factors(focus_set: list[int], learned_set: list[int]) -> tuple[int, int]:
    focus_factor = focus_set[_random_int(0, len(focus_set) - 1)]
    other_factor = learned_set[_random_int(0, len(learned_set) - 1)]
    swap = random.random() >= 0.5
    return (other_factor, focus_factor) if swap else (focus_factor, other_factor)


def generate_questions(difficulty: str, total_questions: int, quiz_type_code: str, learned_timetables: list[int]) -> list[dict[str, Any]]:
    learned_set = sanitize_learned_timetables(learned_timetables)
    difficulty_set = DIFFICULTY_SETS[difficulty]
    focus_set = [value for value in difficulty_set if value in learned_set]
    effective_focus = focus_set if focus_set else learned_set

    rows: list[dict[str, Any]] = []
    for position in range(1, total_questions + 1):
        a, b = _pick_factors(effective_focus, learned_set)

        if quiz_type_code == "sum_products_1_10":
            c, d = _pick_factors(effective_focus, learned_set)
            rows.append(
                {
                    "a": a,
                    "b": b,
                    "c": c,
                    "d": d,
                    "correct": a * b + c * d,
                    "position": position,
                }
            )
            continue

        rows.append({"a": a, "b": b, "c": None, "d": None, "correct": a * b, "position": position})

    return rows


def calculate_percent(correct_count: int, total_questions: int) -> float:
    if total_questions <= 0:
        return 0.0
    return round((correct_count / total_questions) * 100, 2)


def create_session_with_questions(
    conn,
    *,
    difficulty: str,
    total_questions: int,
    user_id: str | None,
    user_name: str | None,
    user_age: int | None,
    user_gender: str | None,
    learned_timetables: list[int] | None,
    quiz_type_code: str | None,
) -> dict[str, Any]:
    if not is_difficulty(difficulty):
        raise ValueError("Invalid difficulty")

    if total_questions < 1 or total_questions > 50:
        raise ValueError("total_questions must be between 1 and 50")

    resolved_quiz_type_code = quiz_type_code or DEFAULT_QUIZ_TYPE_CODE
    quiz_type = repo.get_quiz_type_by_code(conn, resolved_quiz_type_code)
    if not quiz_type:
        raise ValueError(f"Quiz type not found: {resolved_quiz_type_code}")

    resolved_user_id: str | None = None
    resolved_learned_timetables = DEFAULT_LEARNED_TIMETABLES.copy()

    if user_id:
        existing_user = repo.get_user_profile(conn, user_id)
        if existing_user:
            resolved_user_id = existing_user["id"]
            resolved_learned_timetables = sanitize_learned_timetables(existing_user["learned_timetables"])
    elif user_name and user_name.strip():
        normalized_gender = user_gender if user_gender in ALLOWED_GENDERS else "prefer_not_say"
        resolved_learned_timetables = sanitize_learned_timetables(learned_timetables)
        user = repo.create_user(
            conn,
            {
                "name": user_name.strip(),
                "age": user_age,
                "gender": normalized_gender,
                "learned_timetables": resolved_learned_timetables,
            },
        )
        resolved_user_id = user["id"]

    session = repo.create_session(
        conn,
        {
            "user_id": resolved_user_id,
            "quiz_type_id": quiz_type["id"],
            "difficulty": difficulty,
            "total_questions": total_questions,
        },
    )

    generated = generate_questions(difficulty, total_questions, resolved_quiz_type_code, resolved_learned_timetables)
    repo.insert_questions(
        conn,
        [
            {
                "session_id": session["id"],
                "quiz_type_id": quiz_type["id"],
                **question,
            }
            for question in generated
        ],
    )

    questions = repo.get_session_questions(conn, session["id"])

    return {
        "sessionId": session["id"],
        "quizTypeCode": resolved_quiz_type_code,
        "questions": [
            {
                "id": q["id"],
                "a": q["a"],
                "b": q["b"],
                "c": q["c"],
                "d": q["d"],
                "position": q["position"],
            }
            for q in questions
        ],
    }


def get_session_detail(conn, session_id: str) -> dict[str, Any] | None:
    session = repo.get_session(conn, session_id)
    if not session:
        return None

    question_rows = repo.get_session_questions(conn, session_id)
    questions = []
    for row in question_rows:
        answer = None
        if row["answer_id"]:
            answer = {
                "id": row["answer_id"],
                "questionId": row["id"],
                "quizTypeId": row["quiz_type_id"],
                "value": row["answer_value"],
                "isCorrect": row["answer_is_correct"],
                "answeredAt": row["answer_answered_at"],
            }

        questions.append(
            {
                "id": row["id"],
                "sessionId": row["session_id"],
                "quizTypeId": row["quiz_type_id"],
                "a": row["a"],
                "b": row["b"],
                "c": row["c"],
                "d": row["d"],
                "correct": row["correct"],
                "position": row["position"],
                "answer": answer,
            }
        )

    return {
        "session": {
            "id": session["id"],
            "userId": session["user_id"],
            "quizTypeId": session["quiz_type_id"],
            "difficulty": session["difficulty"],
            "totalQuestions": session["total_questions"],
            "correctCount": session["correct_count"],
            "wrongCount": session["wrong_count"],
            "scorePercent": float(session["score_percent"]),
            "startedAt": session["started_at"],
            "finishedAt": session["finished_at"],
            "userName": session["user_name"],
            "quizTypeCode": session["quiz_type_code"],
        },
        "questions": questions,
    }


def submit_answer(conn, question_id: str, value: int) -> dict[str, Any] | None:
    question = repo.get_question_by_id(conn, question_id)
    if not question:
        return None

    is_correct = value == question["correct"]

    existing_answer = repo.get_answer_by_question_id(conn, question_id)
    if not existing_answer:
        repo.insert_answer(conn, question_id, question["quiz_type_id"], value, is_correct)

    session = repo.get_session(conn, question["session_id"])
    if not session:
        return None

    counts = repo.get_session_answer_counts(conn, question["session_id"])
    correct_count = counts["correct_count"] or 0
    wrong_count = counts["wrong_count"] or 0
    answered_count = counts["answered_count"] or 0

    percent = calculate_percent(correct_count, session["total_questions"])
    finished = answered_count >= session["total_questions"]

    updated = repo.update_session_scoring(
        conn,
        question["session_id"],
        correct_count=correct_count,
        wrong_count=wrong_count,
        score_percent=percent,
        finished=finished,
    )

    return {
        "isCorrect": is_correct,
        "correctValue": question["correct"],
        "session": {
            "correct": updated["correct_count"],
            "wrong": updated["wrong_count"],
            "percent": float(updated["score_percent"]),
        },
    }


def list_sessions(conn) -> list[dict[str, Any]]:
    rows = repo.list_sessions(conn)
    return [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "difficulty": row["difficulty"],
            "total_questions": row["total_questions"],
            "score_percent": float(row["score_percent"]),
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "user_name": row["user_name"],
            "quiz_type_code": row["quiz_type_code"],
            "quiz_type_description": row["quiz_type_description"],
        }
        for row in rows
    ]


def get_user_performance_stats(conn, user_id: str) -> dict[str, Any]:
    session_rows = repo.get_user_sessions_for_stats(conn, user_id)

    def create_bucket(code: str, description: str) -> dict[str, Any]:
        return {
            "quiz_type_code": code,
            "quiz_type_description": description,
            "sessions": 0,
            "completed_sessions": 0,
            "in_progress_sessions": 0,
            "total_questions": 0,
            "correct_answers": 0,
            "wrong_answers": 0,
            "average_score_percent": 0.0,
            "total_time_seconds": 0,
        }

    overall = create_bucket("all", "All quiz types")
    buckets: dict[str, dict[str, Any]] = {}
    score_trackers: dict[str, dict[str, float | int]] = {}
    overall_score_sum = 0.0
    overall_score_count = 0

    for row in session_rows:
        code = row["quiz_type_code"] or "unknown"
        description = row["quiz_type_description"] or "Unknown"

        if code not in buckets:
            buckets[code] = create_bucket(code, description)
            score_trackers[code] = {"sum": 0.0, "count": 0}

        bucket = buckets[code]
        tracker = score_trackers[code]

        is_completed = row["finished_at"] is not None
        start: datetime | None = row["started_at"]
        end: datetime | None = row["finished_at"]
        end = end or datetime.now(tz=start.tzinfo if start else None)

        duration_seconds = 0
        if start and end and end > start:
            duration_seconds = int((end - start).total_seconds())

        for target in (overall, bucket):
            target["sessions"] += 1
            target["completed_sessions"] += 1 if is_completed else 0
            target["in_progress_sessions"] += 0 if is_completed else 1
            target["total_questions"] += row["total_questions"]
            target["correct_answers"] += row["correct_count"]
            target["wrong_answers"] += row["wrong_count"]
            target["total_time_seconds"] += duration_seconds

        if is_completed:
            score = float(row["score_percent"] if not isinstance(row["score_percent"], Decimal) else float(row["score_percent"]))
            overall_score_sum += score
            overall_score_count += 1
            tracker["sum"] = float(tracker["sum"]) + score
            tracker["count"] = int(tracker["count"]) + 1

    overall["average_score_percent"] = round(overall_score_sum / overall_score_count, 2) if overall_score_count > 0 else 0.0

    by_quiz_type: list[dict[str, Any]] = []
    for item in sorted(buckets.values(), key=lambda value: value["quiz_type_description"]):
        tracker = score_trackers[item["quiz_type_code"]]
        count = int(tracker["count"])
        total = float(tracker["sum"])
        item["average_score_percent"] = round(total / count, 2) if count > 0 else 0.0
        by_quiz_type.append(item)

    return {"overall": overall, "by_quiz_type": by_quiz_type}
