from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from app.context import templates
from app.dependencies import (
    load_profile,
    optional_current_user,
    require_completed_profile,
    require_telegram_user_id,
    update_profile,
)
from app.schemas import FoodDiaryAddRequest
from app.utils import build_food_diary_aggregates
from services.ai_profile import generate_food_diary_recommendation

router = APIRouter()


@router.get("/diary", response_class=HTMLResponse)
async def diary(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return templates.TemplateResponse(
            "diary.html",
            {"request": request},
        )
    require_completed_profile(telegram_user_id)
    return templates.TemplateResponse(
        "diary.html",
        {"request": request},
    )


@router.get("/food-diary")
async def food_diary(request: Request, telegram_user_id: int | None = Depends(optional_current_user)):
    if telegram_user_id is None:
        return RedirectResponse(url="/diary")
    require_completed_profile(telegram_user_id)
    return RedirectResponse(url="/diary")


@router.get("/api/diary")
async def api_diary(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    diary = profile.get("diary", []) if isinstance(profile.get("diary"), list) else []
    return {"entries": diary}


@router.post("/api/diary")
async def api_diary_save(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    updated["diary"] = payload.get("entries", [])
    update_profile(telegram_user_id, updated)
    return updated


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
    updated = dict(profile)
    updated.setdefault("food_diary", [])
    updated["food_diary"] = [entry for entry in updated["food_diary"] if entry.get("date") != payload.date]
    updated["food_diary"].append(
        {
            "date": payload.date,
            "meals": payload.meals,
            "water_l": payload.water_l,
            "sleep_time": payload.sleep_time,
            "activity": payload.activity,
        }
    )
    update_profile(telegram_user_id, updated)
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
    profile = load_profile(telegram_user_id)
    return {"entries": profile.get("food_diary", [])}


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
