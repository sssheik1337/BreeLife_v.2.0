from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from config import AI_ENABLED
from app.context import templates
from app.dependencies import (
    get_profile_and_admin_config,
    load_profile,
    optional_current_user,
    require_completed_profile,
    require_telegram_user_id,
    update_profile,
)
from app.spa_rollout import maybe_redirect_to_spa_shell
from app.schemas import FoodDiaryAddRequest
from app.utils import build_food_diary_aggregates
from services.ai_profile import generate_food_diary_recommendation
from services.storage_db import read_payload, write_payload

router = APIRouter()


def normalize_diary_entries(entries: object) -> list[dict[str, object]]:
    """
    Нормализовать записи дневника к минимально необходимой схеме.

    Минимальная схема одной записи:
    - date: str | None
    - meals: list
    - water_l: int | float | None
    - sleep_time: str | None
    - activity: bool | None
    """
    if not isinstance(entries, list):
        return []

    normalized: list[dict[str, object]] = []
    for item in entries:
        if not isinstance(item, dict):
            continue

        entry = dict(item)
        date_value = entry.get("date")
        entry["date"] = date_value if isinstance(date_value, str) else None

        meals_value = entry.get("meals")
        entry["meals"] = meals_value if isinstance(meals_value, list) else []

        water_value = entry.get("water_l")
        entry["water_l"] = water_value if isinstance(water_value, (int, float)) else None

        sleep_value = entry.get("sleep_time")
        entry["sleep_time"] = sleep_value if isinstance(sleep_value, str) else None

        activity_value = entry.get("activity")
        entry["activity"] = activity_value if isinstance(activity_value, bool) else None

        normalized.append(entry)

    return normalized


def migrate_legacy_diary_if_needed(telegram_user_id: int) -> list[dict[str, object]]:
    """
    Перенести legacy-дневник из профиля в diary_entries при первом обращении.

    Идемпотентность:
    - если в diary_entries уже есть список, миграция не выполняется;
    - повторные вызовы не создают дубликатов.
    """
    stored_entries = read_payload("diary_entries", telegram_user_id)
    if isinstance(stored_entries, list):
        return normalize_diary_entries(stored_entries)

    raw_profile = read_payload("profiles", telegram_user_id)
    if not isinstance(raw_profile, dict):
        write_payload("diary_entries", telegram_user_id, [])
        return []

    legacy_entries = raw_profile.get("diary")
    if not isinstance(legacy_entries, list):
        legacy_entries = raw_profile.get("food_diary") if isinstance(raw_profile.get("food_diary"), list) else []

    normalized_legacy_entries = normalize_diary_entries(legacy_entries)
    write_payload("diary_entries", telegram_user_id, normalized_legacy_entries)

    # Очищаем legacy-ключи после успешного переноса.
    updated_profile = dict(raw_profile)
    updated_profile.pop("diary", None)
    if isinstance(updated_profile.get("food_diary"), list):
        updated_profile.pop("food_diary", None)

    nested_profile = updated_profile.get("user_profile")
    if isinstance(nested_profile, dict):
        nested_updated = dict(nested_profile)
        nested_updated.pop("diary", None)
        if isinstance(nested_updated.get("food_diary"), list):
            nested_updated.pop("food_diary", None)
        updated_profile["user_profile"] = nested_updated

    write_payload("profiles", telegram_user_id, updated_profile)
    return normalized_legacy_entries


@router.get("/diary", response_class=HTMLResponse)
async def diary(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    spa_redirect = maybe_redirect_to_spa_shell(request)
    if spa_redirect:
        return spa_redirect
    payload = get_profile_and_admin_config(telegram_user_id)
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "diary.html",
            {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "diary.html",
        {"request": request, "admin_config": payload["admin_config"], "ai_enabled": AI_ENABLED},
    )


@router.get("/food-diary")
async def food_diary(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    spa_redirect = maybe_redirect_to_spa_shell(request)
    if spa_redirect:
        return spa_redirect
    if telegram_user_id is None:
        return RedirectResponse(url="/diary")
    require_completed_profile(telegram_user_id)
    return RedirectResponse(url="/diary")


@router.get("/api/diary")
async def api_diary(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    entries = migrate_legacy_diary_if_needed(telegram_user_id)
    return {"entries": entries}


@router.post("/api/diary")
async def api_diary_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    entries = normalize_diary_entries(payload.get("entries", []))
    write_payload("diary_entries", telegram_user_id, entries)
    return {"entries": entries}


@router.get("/api/water")
async def api_water(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    return {"water": profile.get("water", [])}


@router.post("/api/water")
async def api_water_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    updated["water"] = payload.get("entries", [])
    update_profile(telegram_user_id, updated)
    return updated


@router.get("/api/sleep")
async def api_sleep(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    return {"sleep": profile.get("sleep", [])}


@router.post("/api/sleep")
async def api_sleep_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    updated["sleep"] = payload.get("entries", [])
    update_profile(telegram_user_id, updated)
    return updated


@router.get("/api/habits")
async def api_habits(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    return {"habits": profile.get("habits", {})}


@router.post("/api/habits")
async def api_habits_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    updated["habits"] = payload.get("entries", {})
    update_profile(telegram_user_id, updated)
    return updated


@router.get("/api/diary/get")
async def api_diary_get_alias(request: Request, response: Response):
    return await api_diary(request, response)


@router.post("/api/diary/save")
async def api_diary_save_alias(request: Request, response: Response):
    return await api_diary_save(request, response)


@router.get("/api/habits/get")
async def api_habits_get_alias(request: Request, response: Response):
    return await api_habits(request, response)


@router.post("/api/habits/save")
async def api_habits_save_alias(request: Request, response: Response):
    return await api_habits_save(request, response)


@router.post("/api/food-diary/add")
async def food_diary_add(request: Request, response: Response, payload: FoodDiaryAddRequest):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    entries = migrate_legacy_diary_if_needed(telegram_user_id)
    entries = [entry for entry in entries if entry.get("date") != payload.date]
    entries.append(
        {
            "date": payload.date,
            "meals": payload.meals,
            "water_l": payload.water_l,
            "sleep_time": payload.sleep_time,
            "activity": payload.activity,
        }
    )
    write_payload("diary_entries", telegram_user_id, normalize_diary_entries(entries))

    totals = build_food_diary_aggregates(payload.meals)
    recommendation = generate_food_diary_recommendation(profile, totals)
    return {
        "ok": True,
        "totals": totals,
        "recommendation": recommendation,
    }


@router.get("/api/food-diary/list")
async def food_diary_list(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    entries = migrate_legacy_diary_if_needed(telegram_user_id)
    return {"entries": entries}


@router.post("/api/food-diary/analyze")
async def food_diary_analyze(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    diary_entry = payload.get("entry")
    if not isinstance(diary_entry, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    totals = build_food_diary_aggregates(diary_entry.get("meals", []))
    profile = load_profile(telegram_user_id)
    recommendation = generate_food_diary_recommendation(profile, totals)
    return {"totals": totals, "recommendation": recommendation}
