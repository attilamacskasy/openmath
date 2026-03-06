"""Authentication router — register, login, Google SSO, refresh, me."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import (
    calculate_age,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    exchange_google_code,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from app.dependencies import get_current_user
from app.queries import (
    create_student_with_auth,
    find_student_by_email,
    find_student_by_google_sub,
    find_student_by_id,
    update_student_google_link,
)
from app.schemas.auth import (
    AdminCreateStudentRequest,
    AuthResponse,
    AuthUser,
    GoogleAuthRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_auth_user(student: dict) -> AuthUser:
    birthday = student.get("birthday")
    age = calculate_age(birthday) if birthday else student.get("age")
    return AuthUser(
        id=str(student["id"]),
        name=student["name"],
        email=student.get("email", ""),
        role=student.get("role", "student"),
        age=age,
    )


def _build_tokens(student: dict) -> tuple[str, str]:
    sid = str(student["id"])
    return (
        create_access_token(
            sub=sid,
            email=student.get("email", ""),
            name=student["name"],
            role=student.get("role", "student"),
        ),
        create_refresh_token(sub=sid),
    )


# ── Register ───────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> AuthResponse:
    existing = await find_student_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    birthday: date | None = None
    if body.birthday:
        try:
            birthday = date.fromisoformat(body.birthday)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid birthday format (use YYYY-MM-DD)")

    pw_hash = hash_password(body.password)
    timetables = body.learnedTimetables or [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    student = await create_student_with_auth(
        name=body.name,
        email=body.email,
        password_hash=pw_hash,
        role="student",
        auth_provider="local",
        birthday=birthday,
        gender=body.gender,
        learned_timetables=timetables,
    )

    access, refresh = _build_tokens(student)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=_build_auth_user(student),
    )


# ── Login ──────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest) -> AuthResponse:
    student = await find_student_by_email(body.email)
    if not student or not student.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, student["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access, refresh = _build_tokens(student)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=_build_auth_user(student),
    )


# ── Google SSO ─────────────────────────────────────────────

@router.post("/google")
async def google_auth(body: GoogleAuthRequest) -> AuthResponse:
    try:
        tokens = await exchange_google_code(body.code, body.redirectUri)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to exchange Google authorization code")

    id_token_str = tokens.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="No id_token in Google response")

    google_user = await verify_google_id_token(id_token_str)
    if not google_user:
        raise HTTPException(status_code=401, detail="Invalid Google id_token")

    email = google_user.get("email", "")
    name = google_user.get("name", email.split("@")[0])
    google_sub = google_user.get("sub", "")

    is_new_user = False

    # Look up by google_sub first, then email
    student = await find_student_by_google_sub(google_sub)
    if not student:
        student = await find_student_by_email(email)
        if student:
            # Link Google account to existing local account
            await update_student_google_link(
                str(student["id"]), google_sub, "both"
            )
            student["auth_provider"] = "both"
            student["google_sub"] = google_sub
        else:
            # Create new student from Google profile
            student = await create_student_with_auth(
                name=name,
                email=email,
                password_hash=None,
                role="student",
                auth_provider="google",
                google_sub=google_sub,
            )
            is_new_user = True

    access, refresh = _build_tokens(student)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=_build_auth_user(student),
        isNewUser=is_new_user,
    )


# ── Refresh ────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(body: RefreshRequest) -> dict:
    payload = decode_refresh_token(body.refreshToken)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    student = await find_student_by_id(payload["sub"])
    if not student:
        raise HTTPException(status_code=401, detail="User not found")

    access, new_refresh = _build_tokens(student)
    return {"accessToken": access, "refreshToken": new_refresh}


# ── Me ─────────────────────────────────────────────────────

@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    student = await find_student_by_id(user["sub"])
    if not student:
        raise HTTPException(status_code=404, detail="User not found")

    birthday = student.get("birthday")
    age = calculate_age(birthday) if birthday else student.get("age")

    return {
        "id": str(student["id"]),
        "name": student["name"],
        "email": student.get("email", ""),
        "role": student.get("role", "student"),
        "age": age,
        "birthday": str(birthday) if birthday else None,
        "gender": student.get("gender"),
        "authProvider": student.get("auth_provider", "local"),
        "learnedTimetables": student.get("learned_timetables", []),
    }
