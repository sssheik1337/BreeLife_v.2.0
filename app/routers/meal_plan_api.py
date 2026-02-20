from datetime import date

from fastapi import APIRouter, Query, Request, Response

from app.dependencies import load_profile, require_telegram_user_id

router = APIRouter()


MEAL_SLOTS = [
    {"key": "breakfast", "title": "Завтрак"},
    {"key": "lunch", "title": "Обед"},
    {"key": "snack", "title": "Перекус"},
    {"key": "dinner", "title": "Ужин"},
]


def build_empty_meals() -> list[dict[str, object]]:
    """Собрать пустую структуру приёмов пищи по финальному контракту API."""
    meals: list[dict[str, object]] = []
    for slot in MEAL_SLOTS:
        meals.append(
            {
                "key": slot["key"],
                "title": slot["title"],
                "target_calories": None,
                "items": [],
                "suggestion": "Сборный приём пищи",
            },
        )
    return meals


@router.get("/api/meal-plan")
async def meal_plan_api(
    request: Request,
    response: Response,
    date_value: str | None = Query(default=None, alias="date"),
) -> dict[str, object]:
    """
    Вернуть backend-контракт рациона на дату в формате, согласованном для фронтенда.

    Этап 2 (текущий): endpoint уже отдаёт финальную форму ответа (`date`, `targets`,
    `meals`, `totals`, `meta`), но без вычисления персональных целей и граммовок.
    Это позволяет подключать API без поломки старого рендера `/meal-plan`.
    """
    telegram_user_id = require_telegram_user_id(request, response)
    profile = load_profile(telegram_user_id)

    resolved_date = date.today()
    date_parse_error = False
    if isinstance(date_value, str) and date_value.strip():
        try:
            resolved_date = date.fromisoformat(date_value.strip())
        except ValueError:
            # На этапе миграции не падаем на неверной дате, чтобы сохранить совместимость.
            date_parse_error = True

    favorite_ids = profile.get("favorite_product_ids") if isinstance(profile, dict) else []
    excluded_ids = profile.get("excluded_product_ids") if isinstance(profile, dict) else []

    return {
        "date": resolved_date.isoformat(),
        "targets": {
            "calories": None,
            "macros": {"protein_g": None, "fat_g": None, "carbs_g": None},
        },
        "meals": build_empty_meals(),
        "totals": {"calories": None, "protein_g": None, "fat_g": None, "carbs_g": None},
        "meta": {
            "seed": f"{resolved_date.isoformat()}:{telegram_user_id}",
            "used_favorites_only": False,
            "contract_stage": "stage_2_endpoint",
            "date_parse_error": date_parse_error,
            "favorite_ids_count": len(favorite_ids) if isinstance(favorite_ids, list) else 0,
            "excluded_ids_count": len(excluded_ids) if isinstance(excluded_ids, list) else 0,
        },
    }
