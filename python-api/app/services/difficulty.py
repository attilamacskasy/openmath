"""Difficulty sets and helpers."""

from typing import Literal

Difficulty = Literal["low", "medium", "hard"]

DIFFICULTY_SETS: dict[str, list[int]] = {
    "low": [1, 5, 10],
    "medium": [1, 2, 3, 4, 5, 6, 10],
    "hard": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
}


def is_difficulty(value: str) -> bool:
    return value in ("low", "medium", "hard")


DEFAULT_LEARNED_TIMETABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]


def sanitize_learned_timetables(values: list[int] | None) -> list[int]:
    """Accept only integers 1..10, remove duplicates, fallback to full range."""
    if not values:
        return list(DEFAULT_LEARNED_TIMETABLES)

    filtered = [v for v in values if isinstance(v, int) and 1 <= v <= 10]
    if not filtered:
        return list(DEFAULT_LEARNED_TIMETABLES)

    return sorted(set(filtered))
