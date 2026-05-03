from __future__ import annotations

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Response

from backend.auth.google_auth import GoogleAuthService
from backend.google.slides_client import GoogleSlidesClient

router = APIRouter(prefix="/google", tags=["google"])


@router.get("/presentations/{presentation_id}")
async def get_google_presentation(
    presentation_id: str,
    response: Response,
    google_access_token: str | None = Cookie(default=None, alias="google_access_token"),
    google_refresh_token: str | None = Cookie(default=None, alias="google_refresh_token"),
):
    if not google_access_token:
        raise HTTPException(status_code=401, detail="Missing Google access token. Re-authenticate.")

    client = GoogleSlidesClient(access_token=google_access_token)
    try:
        return await client.fetch_presentation(presentation_id)
    except httpx.HTTPStatusError as exc:
        # If the access token is expired/invalid and we have a refresh token, try once more.
        if exc.response.status_code == 401 and google_refresh_token:
            service = GoogleAuthService()
            refreshed = await service.refresh_access_token(refresh_token=google_refresh_token)

            response.set_cookie(
                key="google_access_token",
                value=refreshed.access_token,
                httponly=True,
                samesite="lax",
                secure=False,
                max_age=refreshed.expires_in or 3600,
            )

            client = GoogleSlidesClient(access_token=refreshed.access_token)
            return await client.fetch_presentation(presentation_id)
        # Forward Google API errors instead of turning them into a 500.
        detail: str
        try:
            detail = exc.response.json()
        except Exception:
            detail = exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc

