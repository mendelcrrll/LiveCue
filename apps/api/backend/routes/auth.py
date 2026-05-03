from __future__ import annotations

from fastapi import APIRouter, Cookie, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse

from backend.auth.google_auth import GoogleAuthService
from backend.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/login")
def google_login():
    service = GoogleAuthService()
    state_value = service.generate_state()
    login_url = service.build_login_url(state=state_value)

    resp = RedirectResponse(url=login_url, status_code=status.HTTP_302_FOUND)
    resp.set_cookie(
        key="google_oauth_state",
        value=state_value,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=10 * 60,
    )
    return resp


@router.get("/google/callback")
async def google_callback(
    *,
    response: Response,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    stored_state: str | None = Cookie(default=None, alias="google_oauth_state"),
):
    if not code:
        raise HTTPException(status_code=400, detail="Missing `code` query parameter.")
    if not state:
        raise HTTPException(status_code=400, detail="Missing `state` query parameter.")
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    service = GoogleAuthService()
    tokens = await service.exchange_code_for_tokens(code=code)

    settings = get_settings()

    # Replace the raw token JSON response with a redirect back to the frontend.
    # Tokens are stored in cookies so the frontend can call the API with credentials.
    resp = RedirectResponse(url=settings.frontend_oauth_redirect_url, status_code=status.HTTP_302_FOUND)

    # Clean up CSRF state cookie.
    resp.delete_cookie(key="google_oauth_state")

    # Dev-friendly cookies (make Secure=True in prod behind HTTPS).
    resp.set_cookie(
        key="google_access_token",
        value=tokens.access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=tokens.expires_in or 3600,
    )
    if tokens.refresh_token:
        resp.set_cookie(
            key="google_refresh_token",
            value=tokens.refresh_token,
            httponly=True,
            samesite="lax",
            secure=False,
            # Google refresh tokens are long-lived; don't force expiry here.
        )

    return resp

