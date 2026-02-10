from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from services.ai_profile import generate_profile_recommendation

router = APIRouter()


@router.post("/api/ai/recommendation")
async def ai_recommendation(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payload = await request.json()
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")

    profile = load_profile(telegram_user_id)

    # Поддерживаем совместимость: если клиент прислал дневник явно, пробрасываем его в профиль.
    diary = payload.get("diary")
    if isinstance(diary, list):
        profile = {**profile, "diary": diary}

    recommendation = generate_profile_recommendation(profile)
    return {"recommendation": recommendation}
