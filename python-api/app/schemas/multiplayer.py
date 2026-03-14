"""Pydantic schemas for multiplayer games."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateGameRequest(BaseModel):
    quiz_type_code: str = Field(alias="quizTypeCode")
    difficulty: str = Field(default="medium", pattern=r"^(low|medium|hard)$")
    total_questions: int = Field(default=10, ge=1, le=50, alias="totalQuestions")
    penalty_seconds: int = Field(default=10, alias="penaltySeconds")
    min_players: int = Field(default=2, ge=2, le=25, alias="minPlayers")
    max_players: int = Field(default=5, ge=2, le=25, alias="maxPlayers")
    learned_timetables: list[int] | None = Field(default=None, alias="learnedTimetables")

    model_config = {"populate_by_name": True}


class GameOut(BaseModel):
    id: str
    game_code: str
    host_user_id: str
    host_name: str | None = None
    quiz_type_id: str
    quiz_type_code: str | None = None
    quiz_type_description: str | None = None
    difficulty: str
    total_questions: int
    penalty_seconds: int
    min_players: int
    max_players: int
    status: str
    player_count: int = 0
    created_at: str


class PlayerOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    slot_number: int
    is_ready: bool
    correct_count: int = 0
    wrong_count: int = 0
    total_time_ms: int | None = None
    penalty_time_ms: int = 0
    final_position: int | None = None
    joined_at: str
    finished_at: str | None = None


class GameDetailOut(BaseModel):
    game: GameOut
    players: list[PlayerOut]


class HistoryGameOut(BaseModel):
    id: str
    game_code: str
    host_name: str | None = None
    quiz_type_code: str | None = None
    quiz_type_description: str | None = None
    difficulty: str
    total_questions: int
    penalty_seconds: int
    player_count: int = 0
    status: str
    winner_name: str | None = None
    winner_time_ms: int | None = None
    created_at: str
    completed_at: str | None = None


class ChatMessageOut(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    message: str
    sent_at: str


class AnswerOut(BaseModel):
    id: str
    player_id: str
    question_id: str
    value: str | None = None
    is_correct: bool
    lap_time_ms: int
    penalty_ms: int = 0
    answered_at: str


class QuestionOut(BaseModel):
    id: str
    position: int
    correct: str
    prompt: dict | None = None
    a: int | None = None
    b: int | None = None
    c: int | None = None
    d: int | None = None


class HistoryDetailOut(BaseModel):
    game: GameOut
    players: list[PlayerOut]
    questions: list[QuestionOut]
    answers: list[AnswerOut]
    chat: list[ChatMessageOut]
