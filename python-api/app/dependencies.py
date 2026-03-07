"""FastAPI dependencies for authentication and authorization."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.auth import decode_access_token
from app.queries import get_user_roles

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict[str, Any]:
    """Decode JWT and return user payload. Raises 401 if invalid."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def require_roles(*roles: str):
    """Factory: returns a dependency that checks the user has at least one of the given roles."""
    async def _check(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_roles = await get_user_roles(user["sub"])
        if not any(r in user_roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        user["roles"] = user_roles
        return user
    return _check


async def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Raise 403 if user is not admin (checks user_roles table)."""
    user_roles = await get_user_roles(user["sub"])
    if "admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    user["roles"] = user_roles
    return user
