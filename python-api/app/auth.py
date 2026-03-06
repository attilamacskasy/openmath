"""Authentication utilities: JWT tokens, password hashing, Google OAuth."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# ── Password hashing ──────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Age calculation ────────────────────────────────────────

def calculate_age(birthday: date | None) -> int | None:
    if birthday is None:
        return None
    today = date.today()
    return today.year - birthday.year - (
        (today.month, today.day) < (birthday.month, birthday.day)
    )


# ── JWT creation ───────────────────────────────────────────

def create_access_token(
    sub: str,
    email: str,
    name: str,
    role: str,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "name": name,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(sub: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_refresh_token_expire_days),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate an access token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") == "refresh":
            return None  # Don't accept refresh tokens as access tokens
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a refresh token. Returns payload or None."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


# ── Google OAuth helpers ───────────────────────────────────

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


async def exchange_google_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """Exchange authorization code for Google tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def verify_google_id_token(id_token: str) -> dict[str, Any] | None:
    """Verify and decode a Google id_token using Google's public JWKs."""
    try:
        # Fetch Google's public keys
        async with httpx.AsyncClient() as client:
            resp = await client.get(GOOGLE_JWKS_URL)
            resp.raise_for_status()
            jwks = resp.json()

        # Decode the id_token
        payload = jwt.decode(
            id_token,
            jwks,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=list(GOOGLE_ISSUERS),
        )
        return payload
    except (JWTError, httpx.HTTPError):
        return None
