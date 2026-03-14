"""Badge evaluation service – evaluates badge rules after quiz completion (v2.7)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.database import get_pool
from app.queries import (
    award_badge,
    get_session_answers_in_order,
    get_user_completed_session_count,
    get_user_daily_streak,
    get_user_quiz_type_scores,
    get_user_timetable_stats,
    list_badges,
    list_user_badges,
)
from app.services.notifications import create_notification


async def evaluate_badges(user_id: str, session: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Run after quiz completion. Evaluates all active badge rules
    against user history. Awards any newly earned badges.
    Returns list of newly awarded badge summaries for the response.
    """
    try:
        all_badges = await list_badges()
        earned = await list_user_badges(user_id)
        earned_codes = {b["badge"]["code"] for b in earned}

        new_badges: list[dict[str, Any]] = []

        for badge in all_badges:
            if badge["code"] in earned_codes:
                continue

            rule = badge.get("rule")
            if isinstance(rule, str):
                rule = json.loads(rule)

            if not rule:
                continue

            met = await _check_rule(rule, user_id, session)
            if met:
                session_id = session.get("id") or session.get("session_id")
                awarded = await award_badge(
                    user_id, badge["id"], str(session_id) if session_id else None
                )
                if awarded:
                    new_badges.append({
                        "code": badge["code"],
                        "name_en": badge["name_en"],
                        "name_hu": badge["name_hu"],
                        "icon": badge["icon"],
                    })
                    # Notify the student
                    await create_notification(
                        user_id,
                        "badge_earned",
                        "Badge earned!",
                        f"You earned the '{badge['name_en']}' badge!",
                        {"badge_id": badge["id"], "badge_code": badge["code"]},
                    )

        return new_badges
    except Exception:
        return []


async def _check_rule(rule: dict, user_id: str, session: dict) -> bool:
    """Evaluate a single badge rule against user data."""
    rule_type = rule.get("type")

    if rule_type == "session_count":
        threshold = rule.get("threshold", 1)
        count = await get_user_completed_session_count(user_id)
        return count >= threshold

    elif rule_type == "perfect_score":
        score = session.get("score_percent")
        if score is None:
            score = session.get("percent")
        return score == 100

    elif rule_type == "speed":
        max_seconds = rule.get("max_seconds", 60)
        min_questions = rule.get("min_questions", 10)
        total_q = session.get("total_questions", 0)
        if total_q < min_questions:
            return False
        started = session.get("started_at")
        finished = session.get("finished_at")
        if not started or not finished:
            return False
        # Parse if strings
        if isinstance(started, str):
            started = datetime.fromisoformat(started)
        if isinstance(finished, str):
            finished = datetime.fromisoformat(finished)
        duration = (finished - started).total_seconds()
        return duration <= max_seconds

    elif rule_type == "streak":
        threshold = rule.get("threshold", 20)
        session_id = session.get("id") or session.get("session_id")
        if not session_id:
            return False
        answers = await get_session_answers_in_order(str(session_id))
        current_streak = 0
        max_streak = 0
        for a in answers:
            if a["is_correct"]:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
        return max_streak >= threshold

    elif rule_type == "daily_streak":
        days = rule.get("days", 7)
        streak = await get_user_daily_streak(user_id)
        return streak >= days

    elif rule_type == "timetable_mastery":
        min_accuracy = rule.get("min_accuracy", 90)
        difficulty = rule.get("difficulty", "hard")
        tables = rule.get("tables", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        stats = await get_user_timetable_stats(user_id, difficulty)
        stats_by_table = {s["table"]: s for s in stats}
        for t in tables:
            s = stats_by_table.get(t)
            if not s or s["accuracy"] < min_accuracy:
                return False
        return True

    elif rule_type == "multi_quiz_type":
        min_score = rule.get("min_score", 80)
        min_types = rule.get("min_types", 5)
        scores = await get_user_quiz_type_scores(user_id)
        qualifying = sum(1 for s in scores if float(s.get("avg_score", 0)) >= min_score)
        return qualifying >= min_types

    # Multiplayer badge rules (basic check — full eval in evaluate_multiplayer_badges)
    elif rule_type == "mp_wins":
        from app.queries import get_multiplayer_wins_count
        threshold = rule.get("threshold", 1)
        count = await get_multiplayer_wins_count(user_id)
        return count >= threshold

    elif rule_type == "mp_games_played":
        from app.queries import get_multiplayer_games_played_count
        threshold = rule.get("threshold", 10)
        count = await get_multiplayer_games_played_count(user_id)
        return count >= threshold

    elif rule_type == "mp_games_hosted":
        from app.queries import get_multiplayer_games_hosted_count
        threshold = rule.get("threshold", 10)
        count = await get_multiplayer_games_hosted_count(user_id)
        return count >= threshold

    elif rule_type in ("mp_perfect_game", "mp_speed_demon"):
        return False  # Handled by evaluate_multiplayer_badges

    return False


async def evaluate_multiplayer_badges(
    user_id: str, game_id: str, player_result: dict[str, Any]
) -> list[dict[str, Any]]:
    """Evaluate multiplayer-specific badges after game completion."""
    try:
        all_badges = await list_badges()
        earned = await list_user_badges(user_id)
        earned_codes = {b["badge"]["code"] for b in earned}

        new_badges: list[dict[str, Any]] = []

        for badge in all_badges:
            if badge["code"] in earned_codes:
                continue

            rule = badge.get("rule")
            if isinstance(rule, str):
                rule = json.loads(rule)
            if not rule:
                continue

            rule_type = rule.get("type")
            met = False

            if rule_type == "mp_wins":
                from app.queries import get_multiplayer_wins_count
                threshold = rule.get("threshold", 1)
                count = await get_multiplayer_wins_count(user_id)
                met = count >= threshold

            elif rule_type == "mp_perfect_game":
                met = (
                    player_result.get("final_position") == 1
                    and player_result.get("wrong_count", 1) == 0
                )

            elif rule_type == "mp_games_played":
                from app.queries import get_multiplayer_games_played_count
                threshold = rule.get("threshold", 10)
                count = await get_multiplayer_games_played_count(user_id)
                met = count >= threshold

            elif rule_type == "mp_speed_demon":
                if player_result.get("final_position") == 1:
                    from app.queries import get_player_answers_for_game
                    answers = await get_player_answers_for_game(player_result["player_id"])
                    if answers:
                        prev_lap = 0
                        all_fast = True
                        for a in answers:
                            diff = a["lap_time_ms"] - prev_lap
                            if diff > 3000:
                                all_fast = False
                                break
                            prev_lap = a["lap_time_ms"]
                        met = all_fast

            elif rule_type == "mp_games_hosted":
                from app.queries import get_multiplayer_games_hosted_count
                threshold = rule.get("threshold", 10)
                count = await get_multiplayer_games_hosted_count(user_id)
                met = count >= threshold

            if met:
                awarded = await award_badge(user_id, badge["id"], game_id)
                if awarded:
                    new_badges.append({
                        "code": badge["code"],
                        "name_en": badge["name_en"],
                        "name_hu": badge["name_hu"],
                        "icon": badge["icon"],
                    })
                    await create_notification(
                        user_id,
                        "badge_earned",
                        "Badge earned!",
                        f"You earned the '{badge['name_en']}' badge!",
                        {"badge_id": badge["id"], "badge_code": badge["code"]},
                    )

        return new_badges
    except Exception:
        return []
