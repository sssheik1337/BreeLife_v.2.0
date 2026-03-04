import hashlib
import json
import logging

from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from config import AI_ENABLED, YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID
from services.ai_profile import generate_profile_recommendation, generate_yandex_recommendation
from services.storage_db import read_cache_payload, write_cache_payload

router = APIRouter()
logger = logging.getLogger(__name__)

AI_RECOMMENDATION_CACHE_TTL_SECONDS = 24 * 60 * 60


def _build_profile_hash(profile: dict) -> str:
    try:
        serialized = json.dumps(profile, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except TypeError:
        serialized = json.dumps(str(profile), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


@router.post("/api/ai/recommendation")
async def ai_recommendation(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    profile = load_profile(telegram_user_id)

    # Keep backward compatibility: if client passes diary explicitly, use it in AI context.
    diary = payload.get("diary")
    if isinstance(diary, list):
        profile = {**profile, "diary": diary}

    profile_hash = _build_profile_hash(profile)
    cache_key = f"ai_recommendation:{telegram_user_id}"
    cached_payload = read_cache_payload(cache_key)
    if isinstance(cached_payload, dict):
        cached_hash = cached_payload.get("profile_hash")
        cached_recommendation = cached_payload.get("recommendation")
        if (
            isinstance(cached_hash, str)
            and cached_hash == profile_hash
            and isinstance(cached_recommendation, str)
            and cached_recommendation.strip()
        ):
            return {"recommendation": cached_recommendation, "cached": True}

    recommendation = generate_profile_recommendation(profile)
    can_use_yandex = AI_ENABLED and YANDEX_GPT_API_KEY and YANDEX_GPT_FOLDER_ID
    if can_use_yandex:
        try:
            recommendation = generate_yandex_recommendation(
                profile,
                api_key=YANDEX_GPT_API_KEY,
                folder_id=YANDEX_GPT_FOLDER_ID,
            )
        except Exception:
            logger.exception("Failed to get YandexGPT recommendation; using local fallback.")

    write_cache_payload(
        cache_key,
        {"profile_hash": profile_hash, "recommendation": recommendation},
        AI_RECOMMENDATION_CACHE_TTL_SECONDS,
    )
    return {"recommendation": recommendation, "cached": False}
