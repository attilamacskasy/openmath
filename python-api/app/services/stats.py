"""User performance statistics aggregation."""

from typing import Any


def create_performance_bucket(quiz_type_code: str, quiz_type_description: str) -> dict[str, Any]:
    return {
        "quiz_type_code": quiz_type_code,
        "quiz_type_description": quiz_type_description,
        "sessions": 0,
        "completed_sessions": 0,
        "in_progress_sessions": 0,
        "total_questions": 0,
        "correct_answers": 0,
        "wrong_answers": 0,
        "average_score_percent": 0.0,
        "total_time_seconds": 0,
    }


def aggregate_performance(session_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate session rows into overall and per-quiz-type buckets.

    Each row is expected to have:
      quiz_type_code, quiz_type_description, total_questions, correct_count,
      wrong_count, score_percent, started_at, finished_at
    """
    from datetime import datetime, timezone

    overall = create_performance_bucket("all", "All quiz types")
    by_quiz_type_map: dict[str, dict[str, Any]] = {}
    overall_score_sum = 0.0
    overall_score_count = 0
    by_quiz_type_score: dict[str, dict[str, float | int]] = {}

    for row in session_rows:
        qt_code = row.get("quiz_type_code") or "unknown"
        qt_desc = row.get("quiz_type_description") or "Unknown"

        if qt_code not in by_quiz_type_map:
            by_quiz_type_map[qt_code] = create_performance_bucket(qt_code, qt_desc)
            by_quiz_type_score[qt_code] = {"sum": 0.0, "count": 0}

        bucket = by_quiz_type_map[qt_code]
        score_tracker = by_quiz_type_score[qt_code]

        is_completed = row.get("finished_at") is not None
        started_at = row.get("started_at")
        finished_at = row.get("finished_at")

        duration_seconds = 0
        if started_at and finished_at:
            try:
                s = started_at if isinstance(started_at, datetime) else datetime.fromisoformat(str(started_at))
                e = finished_at if isinstance(finished_at, datetime) else datetime.fromisoformat(str(finished_at))
                diff = (e - s).total_seconds()
                duration_seconds = int(diff) if diff > 0 else 0
            except (ValueError, TypeError):
                pass
        elif started_at and not finished_at:
            try:
                s = started_at if isinstance(started_at, datetime) else datetime.fromisoformat(str(started_at))
                now = datetime.now(timezone.utc)
                if s.tzinfo is None:
                    s = s.replace(tzinfo=timezone.utc)
                diff = (now - s).total_seconds()
                duration_seconds = int(diff) if diff > 0 else 0
            except (ValueError, TypeError):
                pass

        total_q = row.get("total_questions", 0)
        correct = row.get("correct_count", 0)
        wrong = row.get("wrong_count", 0)

        for b in (overall, bucket):
            b["sessions"] += 1
            b["completed_sessions"] += 1 if is_completed else 0
            b["in_progress_sessions"] += 0 if is_completed else 1
            b["total_questions"] += total_q
            b["correct_answers"] += correct
            b["wrong_answers"] += wrong
            b["total_time_seconds"] += duration_seconds

        if is_completed:
            sp = float(row.get("score_percent", 0))
            overall_score_sum += sp
            overall_score_count += 1
            score_tracker["sum"] += sp
            score_tracker["count"] += 1

    overall["average_score_percent"] = (
        round(overall_score_sum / overall_score_count, 2) if overall_score_count > 0 else 0.0
    )

    by_quiz_type = []
    for code, bucket in sorted(by_quiz_type_map.items(), key=lambda kv: kv[1]["quiz_type_description"]):
        tracker = by_quiz_type_score.get(code, {"sum": 0.0, "count": 0})
        count = tracker["count"]
        bucket["average_score_percent"] = round(tracker["sum"] / count, 2) if count > 0 else 0.0
        by_quiz_type.append(bucket)

    return {"overall": overall, "by_quiz_type": by_quiz_type}
