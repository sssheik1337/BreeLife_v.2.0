from fastapi import APIRouter, HTTPException, Request, Response
import logging
from app.dependencies import (
    apply_profile_patch,
    load_profile,
    require_telegram_user_id,
    update_profile,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/profile")
async def api_profile(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    return profile


@router.get("/api/profile")
async def api_profile_get(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    return load_profile(telegram_user_id)


@router.post("/api/profile/save")
async def api_profile_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    # Диагностика PATCH-профиля: фиксируем, какие ключи пришли и есть ли продуктовые поля.
    product_patch = {
        "preferences_onboarding_completed": payload.get("preferences_onboarding_completed"),
        "favorite_product_ids": payload.get("favorite_product_ids"),
        "excluded_product_ids": payload.get("excluded_product_ids"),
    }
    logger.info(
        "[profile] /api/profile/save patch_keys=%s products_patch_keys=%s",
        sorted(payload.keys()),
        {key: value for key, value in product_patch.items() if value is not None},
    )

    profile = load_profile(telegram_user_id)
    updated = apply_profile_patch(profile, payload)
    # update_profile также инвалидирует кэш рациона (день/неделя) для текущего пользователя.
    update_profile(telegram_user_id, updated)

    if payload.get("preferences_onboarding_completed") is True:
        favorites_count = len(updated.get("favorite_product_ids", [])) if isinstance(updated.get("favorite_product_ids"), list) else 0
        excluded_count = len(updated.get("excluded_product_ids", [])) if isinstance(updated.get("excluded_product_ids"), list) else 0
        completed_event = "completed_with_choices" if (favorites_count > 0 or excluded_count > 0) else "completed_without_choices"

        # Обратная совместимость: оставляем старый event=completed для существующих дашбордов/фильтров логов.
        logger.info(
            "[analytics] preferences_onboarding_event event=completed telegram_user_id=%s favorites_count=%s excluded_count=%s",
            telegram_user_id,
            favorites_count,
            excluded_count,
        )
        logger.info(
            "[analytics] preferences_onboarding_event event=%s telegram_user_id=%s favorites_count=%s excluded_count=%s",
            completed_event,
            telegram_user_id,
            favorites_count,
            excluded_count,
        )

    return updated


@router.post("/api/preferences/onboarding/event")
async def api_preferences_onboarding_event(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    event = payload.get("event")
    if event not in {"entered", "completed", "completed_with_choices", "completed_without_choices", "skipped"}:
        raise HTTPException(status_code=400, detail="INVALID_EVENT")

    favorites_count = payload.get("favorites_count")
    excluded_count = payload.get("excluded_count")
    viewed_count = payload.get("viewed_count")

    def _normalize_int(value: object) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return max(0, value)
        return None

    logger.info(
        "[analytics] preferences_onboarding_event event=%s telegram_user_id=%s favorites_count=%s excluded_count=%s viewed_count=%s",
        event,
        telegram_user_id,
        _normalize_int(favorites_count),
        _normalize_int(excluded_count),
        _normalize_int(viewed_count),
    )
    return {"ok": True}


@router.get("/api/profile/get")
async def api_profile_get_alias(request: Request, response: Response):
    return await api_profile_get(request, response)
