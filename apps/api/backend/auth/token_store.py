# backend/auth/token_store.py
# temporary token store for dev
from __future__ import annotations

from dataclasses import dataclass
from time import time

@dataclass
class StoredGoogleCredentials:
    access_token: str
    refresh_token: str | None
    expires_at: int
    scope: str
    token_type: str
    id_token: str | None

TOKEN_STORE: dict[str, StoredGoogleCredentials] = {}

def save_tokens(session_id: str, tokens) -> None:
    TOKEN_STORE[session_id] = StoredGoogleCredentials(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_at=int(time()) + max(tokens.expires_in, 0),
        scope=tokens.scope,
        token_type=tokens.token_type,
        id_token=tokens.id_token,
    )

def get_tokens(session_id: str) -> StoredGoogleCredentials | None:
    return TOKEN_STORE.get(session_id)

def delete_tokens(session_id: str) -> None:
    TOKEN_STORE.pop(session_id, None)