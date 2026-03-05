"""Pydantic schemas for stats."""

from pydantic import BaseModel


class DatabaseStats(BaseModel):
    quiz_types: int
    students: int
    quiz_sessions: int
    questions: int
    answers: int


class ResetRequest(BaseModel):
    confirmation: str
