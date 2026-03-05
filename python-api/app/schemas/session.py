"""Pydantic schemas for quiz sessions."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    difficulty: str = Field(pattern=r"^(low|medium|hard)$")
    totalQuestions: int = Field(ge=1, le=50, alias="totalQuestions")
    quizTypeCode: str | None = Field(default=None, alias="quizTypeCode")
    studentId: str | None = Field(default=None, alias="studentId")
    studentName: str | None = Field(default=None, alias="studentName")
    studentAge: int | None = Field(default=None, ge=4, le=120, alias="studentAge")
    studentGender: str | None = Field(default=None, alias="studentGender")
    learnedTimetables: list[int] | None = Field(default=None, alias="learnedTimetables")

    model_config = {"populate_by_name": True}


class QuestionOut(BaseModel):
    id: UUID
    position: int
    prompt: dict


class CreateSessionResponse(BaseModel):
    sessionId: str
    quizTypeCode: str
    questions: list[QuestionOut]


class SessionListItem(BaseModel):
    id: UUID
    student_id: UUID | None = None
    difficulty: str
    total_questions: int
    score_percent: float
    started_at: datetime
    finished_at: datetime | None = None
    student_name: str | None = None
    quiz_type_code: str | None = None


class SessionDetailQuestion(BaseModel):
    id: UUID
    sessionId: UUID
    position: int
    prompt: dict | None = None
    correct: int
    a: int | None = None
    b: int | None = None
    c: int | None = None
    d: int | None = None
    answer: dict | None = None


class SessionDetailSession(BaseModel):
    id: UUID
    studentId: UUID | None = None
    quizTypeId: UUID
    difficulty: str
    totalQuestions: int
    correctCount: int
    wrongCount: int
    scorePercent: str
    startedAt: datetime
    finishedAt: datetime | None = None
    studentName: str | None = None
    quizTypeCode: str | None = None


class SessionDetailOut(BaseModel):
    session: SessionDetailSession
    questions: list[SessionDetailQuestion]
