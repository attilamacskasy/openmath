from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

Difficulty = Literal["low", "medium", "hard"]
UserGender = Literal["female", "male", "other", "prefer_not_say"]


class SessionStats(TypedDict):
    correct: int
    wrong: int
    percent: float


@dataclass(slots=True)
class AppState:
    active_user_id: str | None = None
