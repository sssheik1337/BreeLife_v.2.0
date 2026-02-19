from copy import deepcopy
from datetime import datetime, timezone
import logging

from fastapi import HTTPException, Request, Response

from services.storage_db import get_session_user, read_payload, write_payload
from app.context import (
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_TTL,
    ADMIN_SESSIONS,
    TELEGRAM_SESSION_COOKIE,
    load_admin_config,
)
from services.targets import calculate_fiber_target_g, calculate_tdee_kcal, calculate_water_target_l


logger = logging.getLogger(__name__)


def require_telegram_user_id(request: Request, response: Response) -> int:
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    session = get_session_user(token)
    if not session:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    telegram_user_id = session.get("telegram_user_id") if isinstance(session, dict) else session
    if telegram_user_id is None:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    response.set_cookie(
        TELEGRAM_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )
    return telegram_user_id


def optional_current_user(request: Request) -> int | None:
    token = request.cookies.get(TELEGRAM_SESSION_COOKIE)
    if not token:
        return None
    session = get_session_user(token)
    if not session:
        return None
    telegram_user_id = session.get("telegram_user_id") if isinstance(session, dict) else session
    if telegram_user_id is None:
        return None
    return telegram_user_id


def require_completed_profile(telegram_user_id: int) -> dict[str, object]:
    profile = normalize_profile_payload_shape(read_payload("profiles", telegram_user_id))
    if not profile:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")
    if not profile.get("is_completed"):
        raise HTTPException(status_code=409, detail="PROFILE_NOT_COMPLETED")
    return profile




def has_products_onboarding_data(profile: dict[str, object]) -> bool:
    """Проверить, что пользователь заполнил предпочтения по продуктам."""
    favorite_ids = profile.get("favorite_product_ids") if isinstance(profile.get("favorite_product_ids"), list) else []
    excluded_ids = profile.get("excluded_product_ids") if isinstance(profile.get("excluded_product_ids"), list) else []
    return len(favorite_ids) > 0 or len(excluded_ids) > 0


def load_profile(telegram_user_id: int) -> dict[str, object]:
    return normalize_profile_payload_shape(read_payload("profiles", telegram_user_id))


def update_profile(telegram_user_id: int, data: dict[str, object]) -> None:
    write_payload("profiles", telegram_user_id, normalize_profile_payload_shape(data))


def apply_profile_patch(profile: dict[str, object], patch: dict[str, object]) -> dict[str, object]:
    normalized_current = normalize_profile_payload_shape(profile)
    normalized_patch = normalize_profile_payload_shape(patch)
    updated = dict(normalized_current)
    updated.update(normalized_patch)

    # Флаг приветственного экрана триала должен фиксироваться один раз и
    # не сбрасываться при последующих частичных сохранениях профиля.
    if "trial_welcome_seen" not in patch and normalized_current.get("trial_welcome_seen") is True:
        updated["trial_welcome_seen"] = True

    updated["is_completed"] = bool(
        normalized_patch.get("is_completed")
        or normalized_current.get("is_completed")
    )
    updated["last_updated"] = datetime.now(timezone.utc).isoformat()
    return updated


def maybe_set_admin_session(response: Response, token: str | None) -> None:
    if not token:
        return
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
    response.set_cookie(
        ADMIN_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )


def get_profile_and_admin_config(telegram_user_id: int | None) -> dict[str, object]:
    profile = load_profile(telegram_user_id) if telegram_user_id is not None else {}
    admin_config = deepcopy(load_admin_config())
    if not isinstance(admin_config, dict):
        admin_config = {}

    reminders = admin_config.get("reminders")
    if not isinstance(reminders, dict):
        reminders = {}
        admin_config["reminders"] = reminders

    if telegram_user_id is not None and isinstance(profile, dict) and profile:
        water_target = calculate_water_target_l(profile)
        tdee_kcal = calculate_tdee_kcal(profile)
        fiber_target = calculate_fiber_target_g(profile, tdee_kcal)

        if water_target is not None:
            reminders["water_min_l"] = water_target
            if logger.isEnabledFor(logging.DEBUG):
                water_clamp_applied = water_target in {1.5, 4.5}
                fiber_clamp_applied = False
                if isinstance(tdee_kcal, int) and tdee_kcal > 0:
                    raw_fiber = (tdee_kcal / 1000) * 14
                    fiber_clamp_applied = raw_fiber < 18 or raw_fiber > 45

                payload = {
                    "telegram_user_id": telegram_user_id,
                    "water_target_l": water_target,
                    "fiber_target_g": fiber_target,
                    "tdee_kcal": tdee_kcal,
                    "water_clamp_applied": water_clamp_applied,
                    "fiber_clamp_applied": fiber_clamp_applied,
                }
                logger.debug("Вычислены персональные цели воды/клетчатки: %s", payload)

        reminders["fiber_target_g"] = fiber_target

    return {
        "profile": profile,
        "admin_config": admin_config,
    }


def normalize_profile_payload_shape(raw_profile: dict[str, object] | None) -> dict[str, object]:
    """
    Нормализовать профиль к единому canonical-формату и привести legacy-ключи.

    Canonical-поля и типы:
    - sex: str | null (male/female)
    - birth_date: str | null (YYYY-MM-DD)
    - age: int | null
    - height_cm, weight_kg, target_weight_kg: float | null
    - goal: str | null (lose/maintain/gain)
    - activity_factor: float | null
    - goal_deadline, predicted_goal_date: str | null
    - food_diary, trial_welcome_seen, is_completed: bool | null
    - вычисляемые поля калорий/динамики: float | null
    - macros, weekly_stats, weekly_adjustments, weekly_review, subscription: object | null
    - favorite_product_ids, excluded_product_ids: list[int]
    - subscription_until/subscription_status/subscription_started_at/trial_started_at/last_updated: str | null

    На выходе возвращаются только canonical-ключи.
    """
    if not isinstance(raw_profile, dict):
        return {}

    def pick_existing(*values: object) -> object | None:
        for value in values:
            if value is None:
                continue
            if isinstance(value, str) and value.strip() == "":
                continue
            return value
        return None

    def parse_number(value: object) -> float | None:
        if value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed

    def parse_bool(value: object) -> bool | None:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "y", "да"}:
                return True
            if normalized in {"false", "0", "no", "n", "нет"}:
                return False
        if isinstance(value, (int, float)):
            if value == 1:
                return True
            if value == 0:
                return False
        return None

    def parse_int_list(value: object) -> list[int]:
        if not isinstance(value, list):
            return []
        normalized: list[int] = []
        for item in value:
            parsed = parse_number(item)
            if parsed is None:
                continue
            integer = int(parsed)
            if float(integer) != parsed:
                continue
            normalized.append(integer)
        return list(dict.fromkeys(normalized))

    def normalize_goal(value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        goal_map = {
            "loss": "lose",
            "lose": "lose",
            "weight_loss": "lose",
            "maintain": "maintain",
            "maintenance": "maintain",
            "keep": "maintain",
            "gain": "gain",
            "muscle": "gain",
            "mass": "gain",
        }
        return goal_map.get(normalized, normalized if normalized in {"lose", "maintain", "gain"} else None)

    profile = dict(raw_profile)
    nested = profile.get("user_profile")
    if isinstance(nested, dict):
        # Старые версии клиента сохраняли профиль во вложенном ключе user_profile.
        # Разворачиваем его в корень, чтобы фронт и расчёты получали ожидаемую структуру.
        profile = {
            **profile,
            **nested,
        }
        profile.pop("user_profile", None)

    canonical: dict[str, object] = {
        "sex": pick_existing(profile.get("sex"), profile.get("gender")),
        "birth_date": pick_existing(profile.get("birth_date"), profile.get("birthDate")),
        "age": parse_number(profile.get("age")),
        "height_cm": parse_number(pick_existing(profile.get("height_cm"), profile.get("height"))),
        "weight_kg": parse_number(pick_existing(profile.get("weight_kg"), profile.get("currentWeight"))),
        "target_weight_kg": parse_number(pick_existing(profile.get("target_weight_kg"), profile.get("targetWeight"))),
        "goal": normalize_goal(pick_existing(profile.get("goal"), profile.get("goalType"))),
        "activity_factor": parse_number(pick_existing(profile.get("activity_factor"), profile.get("activityLevel"))),
        "goal_deadline": pick_existing(profile.get("goal_deadline"), profile.get("deadline")),
        "food_diary": parse_bool(pick_existing(profile.get("food_diary"), profile.get("foodDiary"))),
        "bmr": parse_number(profile.get("bmr")),
        "tdee_calories": parse_number(profile.get("tdee_calories")),
        "calories_target": parse_number(profile.get("calories_target")),
        "calorie_delta": parse_number(profile.get("calorie_delta")),
        "required_rate_kg_per_week": parse_number(profile.get("required_rate_kg_per_week")),
        "required_calorie_delta": parse_number(profile.get("required_calorie_delta")),
        "required_calories_target": parse_number(profile.get("required_calories_target")),
        "safe_weeks_estimate": parse_number(profile.get("safe_weeks_estimate")),
        "macros": profile.get("macros") if isinstance(profile.get("macros"), dict) else None,
        "weight_rate_kg_per_week": parse_number(profile.get("weight_rate_kg_per_week")),
        "predicted_goal_date": profile.get("predicted_goal_date") if isinstance(profile.get("predicted_goal_date"), str) else None,
        "weekly_stats": profile.get("weekly_stats") if isinstance(profile.get("weekly_stats"), dict) else None,
        "weekly_adjustments": profile.get("weekly_adjustments") if isinstance(profile.get("weekly_adjustments"), dict) else None,
        "weekly_review": profile.get("weekly_review") if isinstance(profile.get("weekly_review"), dict) else None,
        "deviation_risk": profile.get("deviation_risk") if isinstance(profile.get("deviation_risk"), str) else None,
        "deviation_comment": profile.get("deviation_comment") if isinstance(profile.get("deviation_comment"), str) else None,
        "subscription": profile.get("subscription") if isinstance(profile.get("subscription"), dict) else None,
        "subscription_until": profile.get("subscription_until") if isinstance(profile.get("subscription_until"), str) else None,
        "subscription_status": profile.get("subscription_status") if isinstance(profile.get("subscription_status"), str) else None,
        "subscription_started_at": profile.get("subscription_started_at") if isinstance(profile.get("subscription_started_at"), str) else None,
        "trial_started_at": profile.get("trial_started_at") if isinstance(profile.get("trial_started_at"), str) else None,
        "trial_welcome_seen": parse_bool(profile.get("trial_welcome_seen")),
        "favorite_product_ids": parse_int_list(profile.get("favorite_product_ids")),
        "excluded_product_ids": parse_int_list(profile.get("excluded_product_ids")),
        "is_completed": parse_bool(
            pick_existing(profile.get("is_completed"), profile.get("completed"), profile.get("profile_completed"))
        ),
        "last_updated": profile.get("last_updated") if isinstance(profile.get("last_updated"), str) else None,
    }

    if canonical["is_completed"] is None:
        canonical["is_completed"] = False

    return {key: value for key, value in canonical.items() if key in CANONICAL_PROFILE_FIELDS}
CANONICAL_PROFILE_FIELDS = {
    "sex",
    "birth_date",
    "age",
    "height_cm",
    "weight_kg",
    "target_weight_kg",
    "goal",
    "activity_factor",
    "goal_deadline",
    "food_diary",
    "bmr",
    "tdee_calories",
    "calories_target",
    "calorie_delta",
    "required_rate_kg_per_week",
    "required_calorie_delta",
    "required_calories_target",
    "safe_weeks_estimate",
    "macros",
    "weight_rate_kg_per_week",
    "predicted_goal_date",
    "weekly_stats",
    "weekly_adjustments",
    "weekly_review",
    "deviation_risk",
    "deviation_comment",
    "subscription",
    "subscription_until",
    "subscription_status",
    "subscription_started_at",
    "trial_started_at",
    "trial_welcome_seen",
    "favorite_product_ids",
    "excluded_product_ids",
    "is_completed",
    "last_updated",
}
