from __future__ import annotations
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = Field(default="AI Document Service")
    APP_ENV: str = Field(default="development")
    APP_VERSION: str = Field(default="1.0.0")
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000, validation_alias="APP_PORT")
    DEBUG: bool = Field(default=False)

    OLLAMA_URL: str = Field(default="http://localhost:11434", validation_alias="OLLAMA_BASE_URL")

    # LLM / RAG Generation
    LLM_MODEL: str = Field(default="qwen2.5", validation_alias="LLM_MODEL")
    LLM_TEMPERATURE: float = Field(default=0.1, validation_alias="LLM_TEMPERATURE")
    LLM_MAX_TOKENS: int = Field(default=1024, validation_alias="LLM_MAX_TOKENS")

    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_DB: str = Field(default="postgres")
    POSTGRES_USER: str = Field(default="postgres")
    POSTGRES_PASSWORD: str = Field(default="password")

    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)

    LOG_LEVEL: str = Field(default="INFO")
    CORS_ALLOW_ORIGINS: List[str] = Field(
        default=["http://localhost", "http://127.0.0.1"]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
