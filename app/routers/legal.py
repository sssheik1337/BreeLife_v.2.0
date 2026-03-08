from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id, update_profile
from services.legal_offer import build_offer_status, load_offer_document

router = APIRouter()


def _get_offer_acceptance(profile: dict[str, object]) -> tuple[int | None, str | None]:
    accepted_version_raw = profile.get("terms_offer_accepted_version")
    accepted_version = (
        int(accepted_version_raw)
        if isinstance(accepted_version_raw, (int, float)) and not isinstance(accepted_version_raw, bool)
        else None
    )
    accepted_at = profile.get("terms_offer_accepted_at") if isinstance(profile.get("terms_offer_accepted_at"), str) else None
    return accepted_version, accepted_at


@router.get("/api/legal/offer/current")
async def legal_offer_current():
    document = load_offer_document()
    return {
        "current_version": document.get("current_version"),
        "current_offer": document.get("current_offer"),
        "has_offer": isinstance(document.get("current_offer"), dict),
    }


@router.get("/api/legal/offer/status")
async def legal_offer_status(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    accepted_version, accepted_at = _get_offer_acceptance(profile)
    return build_offer_status(accepted_version, accepted_at)


@router.post("/api/legal/offer/accept")
async def legal_offer_accept(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    status_payload = build_offer_status(*_get_offer_acceptance(profile))
    current_version = status_payload.get("current_version")
    if not isinstance(current_version, int) or current_version <= 0:
        raise HTTPException(status_code=404, detail="OFFER_NOT_PUBLISHED")

    updated_profile = dict(profile)
    accepted_at = datetime.now(timezone.utc).isoformat()
    updated_profile["terms_offer_accepted_version"] = current_version
    updated_profile["terms_offer_accepted_at"] = accepted_at
    update_profile(telegram_user_id, updated_profile)
    return build_offer_status(current_version, accepted_at)
