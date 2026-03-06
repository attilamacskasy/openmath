"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://quiz:quiz@localhost:5432/quiz"
    cors_origins: str = "http://localhost:4200"
    debug: bool = True

    # JWT
    jwt_secret_key: str = "openmath-dev-secret-change-in-production-min32chars"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # Google OAuth 2.0
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:4200/auth/callback"

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()

# Debug: log auth config presence at startup
import logging
_log = logging.getLogger("openmath.config")
_log.info("JWT_SECRET_KEY set: %s (length=%d)", bool(settings.jwt_secret_key), len(settings.jwt_secret_key))
_log.info("GOOGLE_CLIENT_ID set: %s (%s...)", bool(settings.google_client_id), settings.google_client_id[:20] if settings.google_client_id else 'EMPTY')
_log.info("GOOGLE_CLIENT_SECRET set: %s", bool(settings.google_client_secret))
_log.info("GOOGLE_REDIRECT_URI: %s", settings.google_redirect_uri)
