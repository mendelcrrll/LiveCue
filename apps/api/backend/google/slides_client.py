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

    async def fetch_slide_thumbnail(
        self,
        presentation_id: str,
        slide_object_id: str,
    ) -> Mapping[str, Any]:
        url = (
            f"https://slides.googleapis.com/v1/presentations/{presentation_id}"
            f"/pages/{slide_object_id}/thumbnail"
        )
        headers = {"Authorization": f"Bearer {self._access_token}"}
        params = {
            "thumbnailProperties.mimeType": "PNG",
            "thumbnailProperties.thumbnailSize": "LARGE",
        }

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            return resp.json()

    async def batch_update_presentation(
        self,
        presentation_id: str,
        requests: list[Mapping[str, Any]],
    ) -> Mapping[str, Any]:
        url = f"https://slides.googleapis.com/v1/presentations/{presentation_id}:batchUpdate"
        headers = {"Authorization": f"Bearer {self._access_token}"}

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            resp = await client.post(url, headers=headers, json={"requests": requests})
            resp.raise_for_status()
            return resp.json()
