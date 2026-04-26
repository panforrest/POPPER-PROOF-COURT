"""Centralized settings loader for POPPER-PROOF COURT.

Reads from .env (loaded in main.py) via pydantic-settings.
Every env var has a sensible default so the app boots even with
zero secrets, returning typed errors only when a real call is attempted.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- LLM Providers ---
    openai_api_key: str = ""
    openai_judge_model: str = "o3"
    openai_defender_model: str = "gpt-4o"
    anthropic_api_key: str = ""
    anthropic_prosecutor_model: str = "claude-sonnet-4-5-20250929"

    # --- Voice ---
    elevenlabs_api_key: str = ""
    elevenlabs_prosecutor_voice_id: str = "21m00Tcm4TlvDq8ikWAM"
    elevenlabs_defender_voice_id: str = "AZnzlk1XvdvUeBnXmlld"
    elevenlabs_judge_voice_id: str = "EXAVITQu4vr4xnSDxMaL"

    # --- Search ---
    tavily_api_key: str = ""
    semantic_scholar_api_key: str = ""

    # --- Server ---
    backend_port: int = 8000
    backend_host: str = "0.0.0.0"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # --- Storage ---
    chroma_persist_dir: str = "./chroma_db"
    sqlite_path: str = "./data/cases.db"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
