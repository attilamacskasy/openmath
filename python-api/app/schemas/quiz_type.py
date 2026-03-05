"""Pydantic schemas for quiz types."""

from uuid import UUID

from pydantic import BaseModel


class QuizTypeOut(BaseModel):
    id: UUID
    code: str
    description: str
    answer_type: str = "int"
    template_kind: str | None = None
