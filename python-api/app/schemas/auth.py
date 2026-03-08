"""Pydantic schemas for authentication."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = None  # ISO date string YYYY-MM-DD
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    learnedTimetables: list[int] | None = Field(default=None, alias="learnedTimetables")
    locale: str = Field(default="en", pattern=r"^(en|hu)$")

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
    role: str  # backward compat — primary role
    roles: list[str] = Field(default_factory=list)  # all assigned roles
    age: int | None = None
    authProvider: str = Field(default="local", alias="authProvider")

    model_config = {"populate_by_name": True}


class AuthResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: AuthUser
    isNewUser: bool = False


class AdminCreateUserRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    password: str = Field(min_length=6)
    birthday: str | None = None
    gender: str | None = Field(default=None, pattern=r"^(female|male|other|prefer_not_say)$")
    role: str = Field(default="student", pattern=r"^(student|admin|teacher|parent)$")
    learnedTimetables: list[int] | None = Field(default=None, alias="learnedTimetables")
    locale: str = Field(default="en", pattern=r"^(en|hu)$")

    model_config = {"populate_by_name": True}


class ReviewRequest(BaseModel):
    comment: str | None = None
    status: str = Field(pattern=r"^(reviewed)$")


class SignoffRequest(BaseModel):
    comment: str | None = None
    status: str = Field(pattern=r"^(signed)$")


class RoleAssignment(BaseModel):
    roles: list[str] = Field(min_length=1)


class RelationshipRequest(BaseModel):
    teacher_id: str | None = Field(default=None, alias="teacherId")
    parent_id: str | None = Field(default=None, alias="parentId")
    student_id: str = Field(alias="studentId")

    model_config = {"populate_by_name": True}


class AssociateByEmailRequest(BaseModel):
    email: str
