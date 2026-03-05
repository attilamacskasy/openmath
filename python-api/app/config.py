"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://quiz:quiz@localhost:5432/quiz"
    cors_origins: str = "http://localhost:4200"
    debug: bool = True

    model_config = {"env_file": "../.env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
