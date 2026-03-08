"""Pydantic schemas for quiz types."""

from uuid import UUID

from pydantic import BaseModel, Field


class QuizTypeOut(BaseModel):
    id: UUID
    code: str
    description: str
    answer_type: str = "int"
    template_kind: str | None = None
    category: str | None = None
    recommended_age_min: int | None = None
    recommended_age_max: int | None = None
    is_active: bool = True
    sort_order: int = 0
    render_mode: str = "text"


class QuizTypeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=200)
    template_kind: str = Field(min_length=1)
    answer_type: str = "int"
    category: str | None = None
    recommended_age_min: int | None = Field(default=None, ge=4, le=18)
    recommended_age_max: int | None = Field(default=None, ge=4, le=18)
    is_active: bool = True
    sort_order: int = 0
    render_mode: str = "text"


class QuizTypeUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=200)
    template_kind: str | None = None
    answer_type: str | None = None
    category: str | None = None
    recommended_age_min: int | None = Field(default=None, ge=4, le=18)
    recommended_age_max: int | None = Field(default=None, ge=4, le=18)
    is_active: bool | None = None
    sort_order: int | None = None
    render_mode: str | None = None


class PreviewQuestion(BaseModel):
    render: str
    correct: str
    answer_type: str
