from __future__ import annotations

import hashlib
from datetime import date, timedelta

from fastapi import HTTPException

from config import MEAL_PLAN_ALGO_VERSION

MEAL_SLOTS = [
    {"key": "breakfast", "title": "Завтрак"},
    {"key": "lunch", "title": "Обед"},
    {"key": "snack", "title": "Перекус"},
    {"key": "dinner", "title": "Ужин"},
]

BASE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.35, "snack": 0.15, "dinner": 0.25}
LOW_CALORIE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.35, "snack": 0.10, "dinner": 0.30}
HIGH_CALORIE_MEAL_SHARES = {"breakfast": 0.25, "lunch": 0.33, "snack": 0.20, "dinner": 0.22}


def build_seed_value(telegram_user_id: int, day_date: date, version: str = MEAL_PLAN_ALGO_VERSION) -> str:
    """Построить детерминированный seed как sha256(user_id:date:version)."""
    raw_value = f"{telegram_user_id}:{day_date.isoformat()}:{version}"
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def parse_positive_number(value: object) -> float | None:
    """Преобразовать значение к положительному числу, иначе вернуть None."""
    if isinstance(value, bool) or value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed <= 0:
        return None
    return parsed


def normalize_profile_id_set(value: object) -> set[int]:
    """Нормализовать id из профиля к множеству целых чисел без дублей."""
    if not isinstance(value, list):
        return set()
    normalized: set[int] = set()
    for item in value:
        if isinstance(item, bool):
            continue
        try:
            normalized.add(int(item))
        except (TypeError, ValueError):
            continue
    return normalized


def build_empty_meals() -> list[dict[str, object]]:
    """Собрать пустую структуру приёмов пищи по контракту API."""
    meals: list[dict[str, object]] = []
    for slot in MEAL_SLOTS:
        meals.append(
            {
                "key": slot["key"],
                "title": slot["title"],
                "target_calories": None,
                "items": [],
                "suggestion": "Сборный приём пищи",
            }
        )
    return meals


def normalize_shares(raw_shares: dict[str, float]) -> dict[str, float]:
    """Нормализовать доли так, чтобы сумма была равна 1.0."""
    total = sum(raw_shares.values())
    if total <= 0:
        return dict(BASE_MEAL_SHARES)
    return {key: value / total for key, value in raw_shares.items()}


def resolve_meal_shares(calories_target: int | None) -> dict[str, float]:
    """Подобрать доли калорий по приёмам пищи."""
    if isinstance(calories_target, int) and calories_target > 0:
        if calories_target < 1600:
            return normalize_shares(LOW_CALORIE_MEAL_SHARES)
        if calories_target > 2600:
            return normalize_shares(HIGH_CALORIE_MEAL_SHARES)
    return normalize_shares(BASE_MEAL_SHARES)


def distribute_meal_targets(targets: dict[str, object] | None) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Распределить дневные цели по приёмам пищи с теми же долями для макросов."""
    meal_shares = resolve_meal_shares(targets.get("calories") if isinstance(targets, dict) else None)
    meals = build_empty_meals()

    calories_target = targets.get("calories") if isinstance(targets, dict) else None
    macros_target = targets.get("macros") if isinstance(targets, dict) else None

    meal_macros_targets: dict[str, dict[str, int] | None] = {}
    for meal in meals:
        meal_key = str(meal["key"])
        share = meal_shares.get(meal_key, 0)

        if isinstance(calories_target, int) and calories_target > 0:
            meal["target_calories"] = int(round(calories_target * share))

        meal_macros_targets[meal_key] = None
        if isinstance(macros_target, dict):
            protein = macros_target.get("protein_g")
            fat = macros_target.get("fat_g")
            carbs = macros_target.get("carbs_g")
            if isinstance(protein, int) and isinstance(fat, int) and isinstance(carbs, int):
                meal_macros_targets[meal_key] = {
                    "protein_g": int(round(protein * share)),
                    "fat_g": int(round(fat * share)),
                    "carbs_g": int(round(carbs * share)),
                }

    diagnostics = {"meal_shares": meal_shares, "meal_macros_targets": meal_macros_targets}
    return meals, diagnostics


def resolve_calories_target(profile: dict[str, object]) -> tuple[int | None, str]:
    """Определить целевые калории строго из profile.calories_target."""
    direct_target = parse_positive_number(profile.get("calories_target"))
    if direct_target is not None:
        return int(round(direct_target)), "profile.calories_target"
    return None, "target_not_computed"


def normalize_macros_payload(value: object) -> dict[str, int] | None:
    """Нормализовать готовые макросы из профиля до целых граммов."""
    if not isinstance(value, dict):
        return None
    protein = parse_positive_number(value.get("protein_g"))
    fat = parse_positive_number(value.get("fat_g"))
    carbs = parse_positive_number(value.get("carbs_g"))
    if protein is None and fat is None and carbs is None:
        return None
    return {
        "protein_g": int(round(protein or 0)),
        "fat_g": int(round(fat or 0)),
        "carbs_g": int(round(carbs or 0)),
    }


def calculate_macros_target(calories_target: int, weight_kg: float) -> dict[str, int]:
    """Рассчитать целевые макросы: белок 1.6 г/кг, жир 0.8 г/кг, углеводы — остаток."""
    protein_g = max(0, int(round(weight_kg * 1.6)))
    fat_g = max(0, int(round(weight_kg * 0.8)))

    calories_left = calories_target - (protein_g * 4 + fat_g * 9)
    carbs_g = int(round(calories_left / 4))

    if carbs_g < 0:
        fat_min_g = max(30, int(round(weight_kg * 0.6)))
        fat_g = max(fat_min_g, 0)
        calories_left = calories_target - (protein_g * 4 + fat_g * 9)
        carbs_g = int(round(calories_left / 4))

        if carbs_g < 0:
            carbs_g = 0
            fat_available = calories_target - protein_g * 4
            fat_g = max(0, int(round(fat_available / 9)))

    return {"protein_g": protein_g, "fat_g": fat_g, "carbs_g": max(0, carbs_g)}


def collect_missing_target_fields(profile: dict[str, object]) -> list[str]:
    """Собрать список отсутствующих полей, мешающих расчёту calories_target."""
    missing: list[str] = []
    if parse_positive_number(profile.get("calories_target")) is not None:
        return missing

    required_fields = ("goal", "sex", "birth_date", "height_cm", "weight_kg", "activity_factor")
    for field in required_fields:
        value = profile.get(field)
        if field in {"height_cm", "weight_kg", "activity_factor"}:
            if parse_positive_number(value) is None:
                missing.append(field)
        else:
            if not isinstance(value, str) or not value.strip():
                missing.append(field)

    goal_value = str(profile.get("goal")).strip().lower() if isinstance(profile.get("goal"), str) else ""
    if goal_value in {"lose", "gain"}:
        if parse_positive_number(profile.get("target_weight_kg")) is None:
            missing.append("target_weight_kg")

    missing.insert(0, "calories_target")
    return list(dict.fromkeys(missing))


def resolve_targets(profile: dict[str, object]) -> tuple[dict[str, object] | None, dict[str, object]]:
    """Определить целевые калории и БЖУ с прозрачным источником и списком missing-полей."""
    calories_target, calories_source = resolve_calories_target(profile)
    if calories_target is None:
        missing_fields = collect_missing_target_fields(profile)
        return None, {
            "targets_source": {"calories": "missing", "macros": None},
            "missing_fields": missing_fields,
            "calories_source": calories_source,
            "macros_source": "unresolved",
        }

    macros_from_profile = normalize_macros_payload(profile.get("macros_target"))
    if macros_from_profile is not None:
        return {"calories": calories_target, "macros": macros_from_profile}, {
            "targets_source": {"calories": calories_source, "macros": "profile.macros_target"},
            "missing_fields": [],
            "calories_source": calories_source,
            "macros_source": "profile.macros_target",
        }

    weight_kg = parse_positive_number(profile.get("weight_kg"))
    if weight_kg is None:
        missing_fields = collect_missing_target_fields(profile)
        if "weight_kg" not in missing_fields:
            missing_fields.append("weight_kg")
        return None, {
            "targets_source": {"calories": calories_source, "macros": None},
            "missing_fields": missing_fields,
            "calories_source": calories_source,
            "macros_source": "weight_missing",
        }

    return {"calories": calories_target, "macros": calculate_macros_target(calories_target, weight_kg)}, {
        "targets_source": {"calories": calories_source, "macros": "calculated_from_weight"},
        "missing_fields": [],
        "calories_source": calories_source,
        "macros_source": "calculated_from_weight",
    }


def ensure_preferences_completed(profile: dict[str, object], favorite_ids: set[int]) -> None:
    """Проверить обязательность продуктового онбординга перед генерацией рациона."""
    onboarding_completed = profile.get("preferences_onboarding_completed") is True
    if onboarding_completed and len(favorite_ids) > 0:
        return
    raise HTTPException(status_code=422, detail={"reason": "preferences_not_completed"})


def resolve_requested_date(date_value: str | None) -> tuple[date, bool]:
    """Преобразовать входную дату; при ошибке вернуть today и флаг ошибки."""
    resolved_date = date.today()
    date_parse_error = False
    if isinstance(date_value, str) and date_value.strip():
        try:
            resolved_date = date.fromisoformat(date_value.strip())
        except ValueError:
            date_parse_error = True
    return resolved_date, date_parse_error


def resolve_week_start(start_value: str | None) -> tuple[date, bool]:
    """Определить начало недели (ISO, понедельник) по входной дате или текущей дате."""
    parse_error = False
    if isinstance(start_value, str) and start_value.strip():
        try:
            start_date = date.fromisoformat(start_value.strip())
        except ValueError:
            start_date = date.today()
            parse_error = True
    else:
        start_date = date.today()

    week_start = start_date - timedelta(days=start_date.weekday())
    return week_start, parse_error

