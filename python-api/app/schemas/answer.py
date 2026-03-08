"""Pydantic schemas for answers."""

from uuid import UUID

from pydantic import BaseModel, Field


class SubmitAnswerRequest(BaseModel):
    questionId: str = Field(alias="questionId")
    response: dict | None = None
    value: int | str | None = None

    model_config = {"populate_by_name": True}


class AnswerSessionStats(BaseModel):
    correct: int
    wrong: int
    percent: float


class BadgeSummary(BaseModel):
    """Lightweight badge info returned inline with answer submission (v2.7)."""
    code: str
    name_en: str
    name_hu: str
    icon: str


class SubmitAnswerResponse(BaseModel):
    isCorrect: bool
    correctValue: int | str
    session: AnswerSessionStats
    newBadges: list[BadgeSummary] | None = None
