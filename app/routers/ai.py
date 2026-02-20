import logging

from fastapi import APIRouter, HTTPException, Request, Response

from app.dependencies import load_profile, require_telegram_user_id
from config import AI_ENABLED, YANDEX_GPT_API_KEY, YANDEX_GPT_FOLDER_ID
from services.ai_profile import generate_profile_recommendation, generate_yandex_recommendation

router = APIRouter()
logger = logging.getLogger(__name__)


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
    can_use_yandex = AI_ENABLED and YANDEX_GPT_API_KEY and YANDEX_GPT_FOLDER_ID
    if can_use_yandex:
        try:
            recommendation = generate_yandex_recommendation(
                profile,
                api_key=YANDEX_GPT_API_KEY,
                folder_id=YANDEX_GPT_FOLDER_ID,
            )
        except Exception:
            logger.exception(
                "Не удалось получить рекомендацию YandexGPT, используем локальную генерацию.",
            )

    return {"recommendation": recommendation}
