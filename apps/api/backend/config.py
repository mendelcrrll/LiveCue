from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=API_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    api_env: str = "development"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cookie_samesite: str = "lax"

    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:54332/postgres"
    supabase_url: str = "http://127.0.0.1:54331"
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8000/api/auth/google/callback"

    # Where the browser should land after completing Google OAuth.
    frontend_oauth_redirect_url: str = "http://127.0.0.1:5173/"

    llm_provider: str = ""
    openai_api_key: str = ""
    stt_provider: str = ""
    stt_model_name: str = "gpt-4o-mini-transcribe"
    whisper_base_url: str = "http://127.0.0.1:8081"
    qwen_embedding_model_name: str = "Qwen/Qwen3-Embedding-0.6B"
    ollama_base_url: str = "http://localhost:11434"
    inference_llm_model_name: str = "qwen3:0.6b"


@lru_cache
def get_settings() -> Settings:
    return Settings()
