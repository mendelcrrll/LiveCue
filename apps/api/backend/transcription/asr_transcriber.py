from __future__ import annotations

import mimetypes
import os
from pathlib import Path

import httpx

from backend.config import get_settings


class ASRTranscriber:
    """Transcribes audio using OpenAI or the local whisper.cpp HTTP service."""

    def __init__(self, *, base_url: str | None = None, timeout_seconds: float = 120) -> None:
        settings = get_settings()
        self.settings = settings
        self.provider = (settings.stt_provider or "whisper").strip().lower()
        self.base_url = (base_url or settings.whisper_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def transcribe(self, audio_path: Path) -> str:
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        if self.provider == "openai":
            return self._transcribe_with_openai(audio_path)

        return self._transcribe_with_whisper_service(audio_path)

    def _transcribe_with_openai(self, audio_path: Path) -> str:
        api_key = (self.settings.openai_api_key or os.getenv("OPENAI_API_KEY", "")).strip()
        if not api_key:
            raise RuntimeError("OpenAI API key is missing. Set OPENAI_API_KEY.")

        with audio_path.open("rb") as audio_file:
            response = httpx.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {api_key}"},
                files={
                    "file": (
                        audio_path.name,
                        audio_file,
                        mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream",
                    )
                },
                data={
                    "model": self.settings.stt_model_name,
                    "response_format": "text",
                },
                timeout=self.timeout_seconds,
            )

        response.raise_for_status()
        return response.text.strip()

    def _transcribe_with_whisper_service(self, audio_path: Path) -> str:
        with audio_path.open("rb") as audio_file:
            response = httpx.post(
                f"{self.base_url}/inference",
                files={
                    "file": (
                        audio_path.name,
                        audio_file,
                        mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream",
                    )
                },
                data={
                    "temperature": "0.0",
                    "temperature_inc": "0.2",
                    "response_format": "text",
                },
                timeout=self.timeout_seconds,
            )

        response.raise_for_status()
        return response.text.strip()
