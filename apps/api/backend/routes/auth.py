from __future__ import annotations

import secrets
import time
from dataclasses import dataclass

from fastapi import APIRouter, Cookie, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from backend.auth.google_auth import GoogleAuthService, GoogleTokenResponse
from backend.config import get_settings


router = APIRouter(prefix="/auth", tags=["auth"])
@router.get("/debug/session")
def debug_session(
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    return {
        "session_id": session_id,
        "has_session": session_id in SESSIONS_BY_ID if session_id else False,
        "session_count": len(SESSIONS_BY_ID),
        "credential_count": len(GOOGLE_CREDENTIALS_BY_USER_ID),
    }

@dataclass(slots=True)
class StoredGoogleCredentials:
    user_id: str
    access_token: str
    refresh_token: str | None
    expires_at: int
    scope: str
    token_type: str
    id_token: str | None


@dataclass(slots=True)
class StoredSession:
    session_id: str
    user_id: str
    created_at: int


GOOGLE_CREDENTIALS_BY_USER_ID: dict[str, StoredGoogleCredentials] = {}
SESSIONS_BY_ID: dict[str, StoredSession] = {}


def _is_secure_cookie() -> bool:
    settings = get_settings()
    env = str(getattr(settings, "environment", "")).lower()
    return env in {"prod", "production"}


def _cookie_samesite() -> str:
    """
    Use 'lax' for same-site frontend/backend.
    If you later deploy cross-site and need cookies sent cross-site,
    use 'none' and set secure=True over HTTPS.
    """
    settings = get_settings()
    configured = getattr(settings, "cookie_samesite", None)
    return configured or "lax"


async def persist_google_credentials(*, tokens: GoogleTokenResponse) -> str:
    """
    Dev-only in-memory credential persistence.
    Replace with DB storage later.
    """
    user_id = secrets.token_urlsafe(16)

    GOOGLE_CREDENTIALS_BY_USER_ID[user_id] = StoredGoogleCredentials(
        user_id=user_id,
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_at=int(time.time()) + max(tokens.expires_in, 0),
        scope=tokens.scope,
        token_type=tokens.token_type,
        id_token=tokens.id_token,
    )
    return user_id


async def create_app_session(*, user_id: str) -> str:
    """
    Dev-only in-memory app session creation.
    Replace with DB/Redis-backed sessions later.
    """
    session_id = secrets.token_urlsafe(32)

    SESSIONS_BY_ID[session_id] = StoredSession(
        session_id=session_id,
        user_id=user_id,
        created_at=int(time.time()),
    )
    return session_id


@router.get("/google/login")
def google_login():
    service = GoogleAuthService()
    state_value = service.generate_state()
    login_url = service.build_login_url(
        state=state_value,
        scopes=["https://www.googleapis.com/auth/presentations.readonly"],
        access_type="offline",
        prompt="select_account",
        include_granted_scopes=True,
    )

    resp = RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)
    resp.set_cookie(
        key="google_oauth_state",
        value=state_value,
        httponly=True,
        samesite="lax",
        secure=_is_secure_cookie(),
        max_age=10 * 60,
        path="/",
    )
    return resp


@router.get("/google/callback")
async def google_callback(
    *,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    stored_state: str | None = Cookie(default=None, alias="google_oauth_state"),
):
    if error:
        detail = error_description or error
        raise HTTPException(status_code=400, detail=f"Google OAuth error: {detail}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing `code` query parameter.")
    if not state:
        raise HTTPException(status_code=400, detail="Missing `state` query parameter.")
    if not stored_state:
        raise HTTPException(status_code=400, detail="Missing stored OAuth state.")
    if not secrets.compare_digest(stored_state, state):
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    service = GoogleAuthService()
    tokens = await service.exchange_code_for_tokens(code=code)

    user_id = await persist_google_credentials(tokens=tokens)
    session_id = await create_app_session(user_id=user_id)

    settings = get_settings()
    resp = RedirectResponse(
        url=settings.frontend_oauth_redirect_url,
        status_code=status.HTTP_302_FOUND,
    )

    resp.delete_cookie(key="google_oauth_state", path="/")

    resp.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite=_cookie_samesite(),
        secure=_is_secure_cookie(),
        path="/",
        max_age=60 * 60 * 24 * 7,
    )

    return resp


@router.post("/logout")
async def logout(
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    settings = get_settings()
    redirect_url = getattr(settings, "frontend_oauth_redirect_url", "/")

    resp = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)

    if session_id:
        session = SESSIONS_BY_ID.pop(session_id, None)
        if session:
            GOOGLE_CREDENTIALS_BY_USER_ID.pop(session.user_id, None)

    resp.delete_cookie(key="session_id", path="/")
    return resp