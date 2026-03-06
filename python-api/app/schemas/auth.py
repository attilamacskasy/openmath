"""Pydantic schemas for authentication."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = None  # ISO date string YYYY-MM-DD
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    learnedTimetables: list[int] | None = Field(default=None, alias="learnedTimetables")

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    code: str
    redirectUri: str = Field(alias="redirectUri")

    model_config = {"populate_by_name": True}


class RefreshRequest(BaseModel):
    refreshToken: str = Field(alias="refreshToken")

    model_config = {"populate_by_name": True}


class AuthUser(BaseModel):
    id: str
    name: str
    email: str
    role: str
    age: int | None = None
    authProvider: str = Field(default="local", alias="authProvider")

    model_config = {"populate_by_name": True}


class AuthResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AuthUser
    isNewUser: bool = False


class AdminCreateStudentRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = None
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    role: str = Field(default="student", pattern=r"^(student|admin)$")
    learnedTimetables: list[int] | None = Field(default=None, alias="learnedTimetables")

    model_config = {"populate_by_name": True}
