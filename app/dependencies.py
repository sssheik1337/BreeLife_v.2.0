from datetime import datetime, timezone

from fastapi import HTTPException, Request, Response

from services.storage_db import get_session_user, read_payload, write_payload
from app.context import (
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_TTL,
    ADMIN_SESSIONS,
    TELEGRAM_SESSION_COOKIE,
    load_admin_config,
)


def require_telegram_user_id(request: Request, response: Response) -> int:
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    session = get_session_user(token)
    if not session:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    telegram_user_id = session.get("telegram_user_id")
    if telegram_user_id is None:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    response.set_cookie(
        TELEGRAM_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )
    return telegram_user_id


def optional_current_user(request: Request) -> int | None:
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not token:
        return None
    session = get_session_user(token)
    if not session:
        return None
    telegram_user_id = session.get("telegram_user_id")
    if telegram_user_id is None:
        return None
    return telegram_user_id


def require_completed_profile(telegram_user_id: int) -> dict[str, object]:
    profile = read_payload(telegram_user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")
    if not profile.get("is_completed"):
        raise HTTPException(status_code=409, detail="PROFILE_NOT_COMPLETED")
    return profile


def load_profile(telegram_user_id: int) -> dict[str, object]:
    return read_payload(telegram_user_id) or {}


def update_profile(telegram_user_id: int, data: dict[str, object]) -> None:
    write_payload(telegram_user_id, data)


def apply_profile_patch(profile: dict[str, object], patch: dict[str, object]) -> dict[str, object]:
    updated = dict(profile)
    updated.update(patch)
    updated["is_completed"] = bool(patch.get("is_completed") or profile.get("is_completed"))
    updated["last_updated"] = datetime.now(timezone.utc).isoformat()
    return updated


def maybe_set_admin_session(response: Response, token: str | None) -> None:
    if not token:
        return
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
    response.set_cookie(
        ADMIN_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )


def get_profile_and_admin_config(telegram_user_id: int | None) -> dict[str, object]:
    profile = read_payload(telegram_user_id) if telegram_user_id is not None else {}
    admin_config = load_admin_config()
    if not isinstance(admin_config, dict):
        admin_config = {}
    return {
        "profile": profile,
        "admin_config": admin_config,
    }
