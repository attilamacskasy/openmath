"""Pydantic schemas for answers."""

from uuid import UUID

from pydantic import BaseModel, Field


class SubmitAnswerRequest(BaseModel):
    questionId: str = Field(alias="questionId")
    response: dict | None = None
    value: int | None = None

    model_config = {"populate_by_name": True}


class AnswerSessionStats(BaseModel):
    correct: int
    wrong: int
    percent: float


class SubmitAnswerResponse(BaseModel):
    isCorrect: bool
    correctValue: int
    session: AnswerSessionStats
