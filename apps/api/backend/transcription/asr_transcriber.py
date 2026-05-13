from __future__ import annotations

import mimetypes
from pathlib import Path

import httpx

from backend.config import get_settings


class ASRTranscriber:
    """Transcribes audio by calling the local whisper.cpp HTTP service."""

    def __init__(self, *, base_url: str | None = None, timeout_seconds: float = 120) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.whisper_base_url).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def transcribe(self, audio_path: Path) -> str:
        if not audio_path.is_file():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

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
