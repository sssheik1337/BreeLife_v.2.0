from __future__ import annotations

from datetime import date, datetime


def _parse_number(value: object) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed:  # NaN
        return None
    return parsed


def _normalize_goal(goal: object) -> str | None:
    if not isinstance(goal, str):
        return None
    normalized = goal.strip().lower()
    if normalized in {"lose", "loss"}:
        return "lose"
    if normalized in {"gain", "muscle"}:
        return "gain"
    if normalized == "maintain":
        return "maintain"
    return None


def _normalize_sex(sex: object) -> str | None:
    if not isinstance(sex, str):
        return None
    normalized = sex.strip().lower()
    if normalized in {"male", "man", "m", "м", "мужской", "муж"}:
        return "male"
    if normalized in {"female", "woman", "f", "ж", "женский", "жен"}:
        return "female"
    return None


def _calculate_age(birth_date: object) -> int | None:
    if isinstance(birth_date, datetime):
        dt = birth_date.date()
    elif isinstance(birth_date, date):
        dt = birth_date
    elif isinstance(birth_date, str):
        raw = birth_date.strip()
        if not raw:
            return None
        try:
            if "." in raw:
                day_str, month_str, year_str = raw.split(".")
                dt = date(int(year_str), int(month_str), int(day_str))
            else:
                dt = datetime.fromisoformat(raw[:10]).date()
        except (TypeError, ValueError):
            return None
    else:
        return None

    today = date.today()
    years = today.year - dt.year
    if (today.month, today.day) < (dt.month, dt.day):
        years -= 1
    return years if years >= 0 else None


def calculate_tdee_kcal(profile: dict[str, object]) -> int | None:
    tdee_existing = _parse_number(profile.get("tdee_calories"))
    if tdee_existing is not None and tdee_existing > 0:
        return int(round(tdee_existing))

    bmr_existing = _parse_number(profile.get("bmr"))
    activity_factor = _parse_number(profile.get("activity_factor"))
    if bmr_existing is not None and activity_factor is not None and bmr_existing > 0 and activity_factor > 0:
        return int(round(bmr_existing * activity_factor))

    sex = _normalize_sex(profile.get("sex"))
    weight = _parse_number(profile.get("weight_kg"))
    height = _parse_number(profile.get("height_cm"))
    age = _calculate_age(profile.get("birth_date"))
    if sex is None or weight is None or height is None or age is None:
        return None
    if weight <= 0 or height <= 0:
        return None
    if activity_factor is None or activity_factor <= 0:
        return None

    base = 10 * weight + 6.25 * height - 5 * age
    bmr = base + 5 if sex == "male" else base - 161
    return int(round(bmr * activity_factor))


def calculate_water_target_l(profile: dict[str, object]) -> float | None:
    weight = _parse_number(profile.get("weight_kg"))
    if weight is None or weight <= 0:
        return None

    goal = _normalize_goal(profile.get("goal"))
    activity_factor = _parse_number(profile.get("activity_factor"))

    base = weight * 0.033
    activity_bonus = 0.0
    if activity_factor is not None:
        if activity_factor >= 1.725:
            activity_bonus = 0.5
        elif activity_factor >= 1.55:
            activity_bonus = 0.3

    goal_bonus = 0.0
    if goal == "gain":
        goal_bonus = 0.2
    elif goal == "lose":
        goal_bonus = 0.1

    target = base + activity_bonus + goal_bonus
    clamped = min(max(target, 1.5), 4.5)
    return round(clamped, 1)


def calculate_fiber_target_g(profile: dict[str, object], tdee_kcal: int | None) -> int:
    if isinstance(tdee_kcal, int) and tdee_kcal > 0:
        value = (tdee_kcal / 1000) * 14
        return int(round(min(max(value, 18), 45)))

    sex = _normalize_sex(profile.get("sex"))
    if sex == "male":
        return 30
    return 25

