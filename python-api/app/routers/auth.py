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
    add_user_role,
    create_user_with_auth,
    find_user_by_email,
    find_user_by_google_sub,
    find_user_by_id,
    get_user_roles,
    update_user_google_link,
)
from app.schemas.auth import (
    AdminCreateUserRequest,
    AuthResponse,
    AuthUser,
    GoogleAuthRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _build_auth_user(user_record: dict) -> AuthUser:
    birthday = user_record.get("birthday")
    age = calculate_age(birthday) if birthday else user_record.get("age")
    roles = await get_user_roles(str(user_record["id"]))
    primary_role = roles[0] if roles else user_record.get("role", "student")
    return AuthUser(
        id=str(user_record["id"]),
        name=user_record["name"],
        email=user_record.get("email", ""),
        role=primary_role,
        roles=roles,
        age=age,
        authProvider=user_record.get("auth_provider", "local"),
    )


async def _build_tokens(user_record: dict) -> tuple[str, str]:
    sid = str(user_record["id"])
    roles = await get_user_roles(sid)
    primary_role = roles[0] if roles else user_record.get("role", "student")
    return (
        create_access_token(
            sub=sid,
            email=user_record.get("email", ""),
            name=user_record["name"],
            role=primary_role,
            roles=roles,
        ),
        create_refresh_token(sub=sid),
    )


# ── Register ───────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> AuthResponse:
    existing = await find_user_by_email(body.email)
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

    user_record = await create_user_with_auth(
        name=body.name,
        email=body.email,
        password_hash=pw_hash,
        role="student",
        auth_provider="local",
        birthday=birthday,
        gender=body.gender,
        learned_timetables=timetables,
        locale=body.locale,
    )

    # Assign student role in user_roles table
    await add_user_role(str(user_record["id"]), "student")

    access, refresh = await _build_tokens(user_record)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=await _build_auth_user(user_record),
    )


# ── Login ──────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest) -> AuthResponse:
    user_record = await find_user_by_email(body.email)
    if not user_record or not user_record.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(body.password, user_record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access, refresh = await _build_tokens(user_record)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=await _build_auth_user(user_record),
    )


# ── Google SSO ─────────────────────────────────────────────

@router.post("/google")
async def google_auth(body: GoogleAuthRequest) -> AuthResponse:
    import logging
    log = logging.getLogger("openmath.auth")

    log.info("Google auth request: redirectUri=%s, code_length=%d", body.redirectUri, len(body.code))

    try:
        tokens = await exchange_google_code(body.code, body.redirectUri)
        log.info("Google token exchange succeeded, keys: %s", list(tokens.keys()))
    except Exception as e:
        log.error("Google code exchange failed: %s", e)
        raise HTTPException(status_code=400, detail="Failed to exchange Google authorization code")

    id_token_str = tokens.get("id_token")
    if not id_token_str:
        log.error("No id_token in Google response. Response keys: %s", list(tokens.keys()))
        raise HTTPException(status_code=400, detail="No id_token in Google response")

    access_token_str = tokens.get("access_token")
    google_user = await verify_google_id_token(id_token_str, access_token=access_token_str)
    if not google_user:
        log.error("verify_google_id_token returned None")
        raise HTTPException(status_code=401, detail="Invalid Google id_token")

    email = google_user.get("email", "")
    name = google_user.get("name", email.split("@")[0])
    google_sub = google_user.get("sub", "")

    is_new_user = False

    # Look up by google_sub first, then email
    user_record = await find_user_by_google_sub(google_sub)
    if not user_record:
        user_record = await find_user_by_email(email)
        if user_record:
            # Link Google account to existing local account
            await update_user_google_link(
                str(user_record["id"]), google_sub, "both"
            )
            user_record["auth_provider"] = "both"
            user_record["google_sub"] = google_sub
        else:
            # Create new user from Google profile
            user_record = await create_user_with_auth(
                name=name,
                email=email,
                password_hash=None,
                role="student",
                auth_provider="google",
                google_sub=google_sub,
            )
            # Assign student role in user_roles table
            await add_user_role(str(user_record["id"]), "student")
            is_new_user = True

    access, refresh = await _build_tokens(user_record)
    return AuthResponse(
        accessToken=access,
        refreshToken=refresh,
        user=await _build_auth_user(user_record),
        isNewUser=is_new_user,
    )


# ── Refresh ────────────────────────────────────────────────

@router.post("/refresh")
async def refresh(body: RefreshRequest) -> dict:
    payload = decode_refresh_token(body.refreshToken)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_record = await find_user_by_id(payload["sub"])
    if not user_record:
        raise HTTPException(status_code=401, detail="User not found")

    access, new_refresh = await _build_tokens(user_record)
    return {"accessToken": access, "refreshToken": new_refresh}


# ── Me ─────────────────────────────────────────────────────

@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    user_record = await find_user_by_id(user["sub"])
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")

    birthday = user_record.get("birthday")
    age = calculate_age(birthday) if birthday else user_record.get("age")
    roles = await get_user_roles(user["sub"])

    return {
        "id": str(user_record["id"]),
        "name": user_record["name"],
        "email": user_record.get("email", ""),
        "role": roles[0] if roles else user_record.get("role", "student"),
        "roles": roles,
        "age": age,
        "birthday": str(birthday) if birthday else None,
        "gender": user_record.get("gender"),
        "authProvider": user_record.get("auth_provider", "local"),
        "learnedTimetables": user_record.get("learned_timetables", []),
        "locale": user_record.get("locale", "en"),
    }
