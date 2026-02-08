from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from app.utils import build_food_diary_aggregates
from services.ai_profile import generate_profile_recommendation, generate_yandex_recommendation

router = APIRouter()


@router.post("/api/ai/recommendation")
async def ai_recommendation(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    profile = load_profile(telegram_user_id)
    diary = payload.get("diary", [])
    recommendation = generate_profile_recommendation(profile, diary)
    return {"recommendation": recommendation}


@router.post("/api/ai/recommendation")
async def ai_recommendation_old(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)
    totals = build_food_diary_aggregates(profile.get("diary", []))
    recommendation = generate_yandex_recommendation(profile, totals)
    return {"recommendation": recommendation}
