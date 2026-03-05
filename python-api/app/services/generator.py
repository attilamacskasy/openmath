"""Question generator – produces JSONB prompt payloads."""

import random
from typing import Any

from app.services.difficulty import DIFFICULTY_SETS, sanitize_learned_timetables


def _pick_factors(focus_set: list[int], learned_set: list[int]) -> tuple[int, int]:
    focus_factor = random.choice(focus_set) if focus_set else (learned_set[0] if learned_set else 1)
    other_factor = random.choice(learned_set) if learned_set else 1
    if random.random() < 0.5:
        return other_factor, focus_factor
    return focus_factor, other_factor


def generate_questions(
    difficulty: str,
    total_questions: int,
    quiz_type_code: str,
    template_kind: str,
    learned_timetables: list[int],
) -> list[dict[str, Any]]:
    """Generate question dicts with JSONB prompt structure + legacy columns."""
    learned_set = sanitize_learned_timetables(learned_timetables)
    difficulty_set = DIFFICULTY_SETS.get(difficulty, DIFFICULTY_SETS["hard"])
    focus_set = [x for x in difficulty_set if x in learned_set]
    effective_focus = focus_set if focus_set else learned_set

    questions: list[dict[str, Any]] = []

    for pos in range(1, total_questions + 1):
        if template_kind == "axb_plus_cxd":
            a, b = _pick_factors(effective_focus, learned_set)
            c, d = _pick_factors(effective_focus, learned_set)
            correct = (a * b) + (c * d)
            prompt = {
                "template": {"kind": "axb_plus_cxd", "a": a, "b": b, "c": c, "d": d},
                "answer": {"type": "int"},
                "render": f"({a} × {b}) + ({c} × {d})",
            }
            questions.append({
                "position": pos,
                "prompt": prompt,
                "correct": correct,
                "a": a,
                "b": b,
                "c": c,
                "d": d,
            })
        else:
            # Default: axb (multiplication)
            a, b = _pick_factors(effective_focus, learned_set)
            correct = a * b
            prompt = {
                "template": {"kind": "axb", "a": a, "b": b},
                "answer": {"type": "int"},
                "render": f"{a} × {b}",
            }
            questions.append({
                "position": pos,
                "prompt": prompt,
                "correct": correct,
                "a": a,
                "b": b,
                "c": None,
                "d": None,
            })

    return questions
