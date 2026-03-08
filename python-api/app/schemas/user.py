"""Pydantic schemas for users."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class UserListItem(BaseModel):
    id: UUID
    name: str


class PerformanceBucket(BaseModel):
    quiz_type_code: str
    quiz_type_description: str
    sessions: int = 0
    completed_sessions: int = 0
    in_progress_sessions: int = 0
    total_questions: int = 0
    correct_answers: int = 0
    wrong_answers: int = 0
    average_score_percent: float = 0.0
    total_time_seconds: float = 0.0


class UserPerformanceStats(BaseModel):
    overall: PerformanceBucket
    by_quiz_type: list[PerformanceBucket]


class UserProfileOut(BaseModel):
    id: UUID
    name: str
    age: int | None = None
    gender: str | None = None
    learned_timetables: list[int]
    stats: UserPerformanceStats


class UpdateUserRequest(BaseModel):
    name: str = Field(min_length=1)
    age: int | None = Field(default=None, ge=4, le=120)
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    learned_timetables: list[int] = Field(min_length=1)
    birthday: str | None = None  # ISO date string YYYY-MM-DD
    email: str | None = None
    locale: str | None = Field(default=None, pattern=r"^(en|hu)$")


class UserOut(BaseModel):
    id: UUID
    name: str
    age: int | None = None
    gender: str | None = None
    learned_timetables: list[int]
