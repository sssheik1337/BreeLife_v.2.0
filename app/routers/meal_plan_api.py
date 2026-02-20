from datetime import date

from fastapi import APIRouter, Query, Request, Response

from app.dependencies import load_profile, require_telegram_user_id

router = APIRouter()


@router.get("/api/meal-plan")
async def meal_plan_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
) -> dict[str, object]:
    """
    Контракт будущего backend-генератора рациона.

    Текущий фронтенд (`static/js/meal_plan.js`) пока продолжает собирать рацион локально
    из `/api/products`. Этот endpoint добавлен как стабильная точка интеграции, чтобы
    поэтапно перенести расчёт на backend без изменения шаблонов и без поломки UI.

    Параметры:
    - date (опционально): дата в формате YYYY-MM-DD. Если не передана, используется today.

    Формат ответа (зафиксирован заранее):
    {
      "date": "2026-02-20",
      "targets": {
        "calories": 2000,
        "macros": {"protein_g": 140, "fat_g": 67, "carbs_g": 210}
      },
      "meals": [
        {
          "key": "breakfast",
          "title": "Завтрак",
          "target_calories": 500,
          "items": [
            {"product_id": 123, "name": "Яйца", "grams": 120, "calories": 186, "p_g": 15, "f_g": 13, "c_g": 1}
          ],
          "suggestion": "Омлет"
        }
      ],
      "totals": {"calories": 1998, "protein_g": 139, "fat_g": 68, "carbs_g": 208},
      "meta": {"seed": "2026-02-20:6953967480", "used_favorites_only": true}
    }

    Обратная совместимость (этап 1):
    - Возвращаем валидный JSON в финальном формате,
    - но значения `targets/meals/totals` пока пустые,
    - чтобы фронт мог безопасно перейти в режим "приёмника данных" на следующем этапе.
    """
    telegram_user_id = require_telegram_user_id(request, response)
    # На этом этапе фиксируем точку интеграции с профилем пользователя.
    # Дальше здесь будет backend-расчёт целей и рациона.
    load_profile(telegram_user_id)

    resolved_date = date.today()
    if isinstance(date_value, str) and date_value.strip():
        try:
            resolved_date = date.fromisoformat(date_value.strip())
        except ValueError:
            # Некорректную дату не роняем: используем today, чтобы сохранить устойчивость API.
            resolved_date = date.today()

    return {
        "date": resolved_date.isoformat(),
        "targets": None,
        "meals": [],
        "totals": None,
        "meta": {
            "legacy_frontend_builder": True,
            "integration_stage": "contract_only",
        },
    }
