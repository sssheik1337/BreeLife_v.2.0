from __future__ import annotations

from typing import Iterable


ACTIVITY_FACTORS: tuple[float, ...] = (1.2, 1.375, 1.55, 1.725, 1.9)


def _normalize_sex(sex: str) -> str:
    normalized = sex.strip().lower()
    if normalized in {"male", "man", "m", "м"}:
        return "male"
    if normalized in {"female", "woman", "f", "ж"}:
        return "female"
    raise ValueError("Неизвестное значение пола.")


def _ensure_activity_factor(activity_factor: float, allowed: Iterable[float]) -> float:
    if activity_factor in allowed:
        return activity_factor
    raise ValueError("Недопустимый коэффициент активности.")


def calculate_bmr(sex: str, weight: float, height: float, age: int) -> float:
    """Рассчитать базовый обмен веществ по Миффлину — Сан Жеору."""
    normalized_sex = _normalize_sex(sex)
    base = 10 * weight + 6.25 * height - 5 * age
    if normalized_sex == "male":
        return base + 5
    return base - 161


def calculate_daily_calories(bmr: float, activity_factor: float) -> float:
    """Рассчитать дневную норму калорий с учётом активности."""
    factor = _ensure_activity_factor(activity_factor, ACTIVITY_FACTORS)
    return bmr * factor


def calculate_goal_calories(calories: float, goal_type: str) -> float:
    """Рассчитать калории под цель: снижение, поддержание или набор."""
    normalized_goal = goal_type.strip().lower()
    if normalized_goal == "loss":
        return calories * 0.85
    if normalized_goal == "maintain":
        return calories
    if normalized_goal == "gain":
        return calories * 1.15
    raise ValueError("Неизвестный тип цели.")
