from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import httpx


class GoogleSlidesClient:
    def __init__(self, *, access_token: str, timeout_seconds: float = 20) -> None:
        self._access_token = access_token
        self._timeout_seconds = timeout_seconds

    async def fetch_presentation(self, presentation_id: str) -> Mapping[str, Any]:
        url = f"https://slides.googleapis.com/v1/presentations/{presentation_id}"
        headers = {"Authorization": f"Bearer {self._access_token}"}

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()
