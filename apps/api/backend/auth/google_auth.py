from __future__ import annotations

import secrets
import urllib.parse
from dataclasses import dataclass

import httpx

from backend.config import Settings, get_settings

class GoogleAuthService:
    """Google OAuth2
    - Build the Google authorization URL (what the frontend redirects to)
    - Exchange the returned auth code for tokens (server-side)
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def build_login_url(
        self,
        *,
        state: str | None = None,
        scopes: list[str] | None = None,
        access_type: str = "offline",
        prompt: str = "consent",
        include_granted_scopes: bool = True,
    ) -> str:
        """Return a URL to redirect the user to Google's consent screen."""
        s = self._settings
        if not s.google_client_id or not s.google_redirect_uri:
            raise ValueError("Missing google_client_id or google_redirect_uri in settings.")

        # minimal scope
        scopes = scopes or ["https://www.googleapis.com/auth/presentations.readonly"]

        params = {
            "client_id": s.google_client_id,
            "redirect_uri": s.google_redirect_uri,
            "response_type": "code",
            "scope": " ".join(scopes),
            "access_type": access_type,
            "prompt": prompt,
            "include_granted_scopes": "true" if include_granted_scopes else "false",
        }
        if state is not None:
            params["state"] = state

        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    def generate_state(self) -> str:
        """Generate a CSRF state value suitable for cookies/session storage."""
        return secrets.token_urlsafe(32)

    async def exchange_code_for_tokens(self, *, code: str) -> GoogleTokenResponse:
        """Exchange an auth code for Google OAuth tokens."""
        s = self._settings
        if not s.google_client_id or not s.google_client_secret or not s.google_redirect_uri:
            raise ValueError(
                "Missing google_client_id/google_client_secret/google_redirect_uri in settings."
            )

        data = {
            "code": code,
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "redirect_uri": s.google_redirect_uri,
            "grant_type": "authorization_code",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://oauth2.googleapis.com/token", data=data)
            resp.raise_for_status()
            payload = resp.json()

        return GoogleTokenResponse(
            access_token=payload["access_token"],
            expires_in=int(payload.get("expires_in", 0)),
            refresh_token=payload.get("refresh_token"),
            scope=payload.get("scope", ""),
            token_type=payload.get("token_type", "Bearer"),
            id_token=payload.get("id_token"),
        )

    async def refresh_access_token(self, *, refresh_token: str) -> GoogleTokenResponse:
        """Use a refresh token to obtain a new access token."""
        s = self._settings
        if not s.google_client_id or not s.google_client_secret:
            raise ValueError("Missing google_client_id/google_client_secret in settings.")

        data = {
            "client_id": s.google_client_id,
            "client_secret": s.google_client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://oauth2.googleapis.com/token", data=data)
            resp.raise_for_status()
            payload = resp.json()

        # Refresh responses typically do not include a new refresh token.
        return GoogleTokenResponse(
            access_token=payload["access_token"],
            expires_in=int(payload.get("expires_in", 0)),
            refresh_token=payload.get("refresh_token"),
            scope=payload.get("scope", ""),
            token_type=payload.get("token_type", "Bearer"),
            id_token=payload.get("id_token"),
        )


@dataclass(frozen=True, slots=True)
class GoogleTokenResponse:
    access_token: str
    expires_in: int
    refresh_token: str | None
    scope: str
    token_type: str
    id_token: str | None
