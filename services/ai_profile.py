from __future__ import annotations

from datetime import datetime
from typing import Any
import logging

import requests

SYSTEM_PROMPT = (
    "Ты — дружелюбный ассистент по здоровому образу жизни. "
    "Пиши коротко и поддерживающе, без медицинских рекомендаций. "
    "Не ставь диагнозы и не обещай результаты. "
    "Опирайся только на данные профиля пользователя."
)

logger = logging.getLogger(__name__)


def _format_goal(goal: str | None) -> str:
    goal_map = {
        "lose": "похудение",
        "gain": "набор веса",
        "muscle": "набор мышечной массы",
        "maintain": "поддержание формы",
    }
    return goal_map.get(goal, "личная цель")


def _format_number(value: Any) -> str | None:
    try:
        return str(round(float(value)))
    except (TypeError, ValueError):
        return None


def generate_profile_recommendation(profile: dict[str, Any]) -> str:
    """Сформировать короткую рекомендацию только по данным профиля."""
    goal = _format_goal(profile.get("goal") if isinstance(profile, dict) else None)
    activity = profile.get("activity_factor") if isinstance(profile, dict) else None
    food_diary = profile.get("food_diary") if isinstance(profile, dict) else None
    tdee = profile.get("tdee_calories") if isinstance(profile, dict) else None
    predicted_date = profile.get("predicted_goal_date") if isinstance(profile, dict) else None

    parts = [f"Цель: {goal}."]

    if activity:
        parts.append(f"Уровень активности {activity} — хороший ориентир для стабильного темпа.")
    else:
        parts.append("Добавьте немного движения, чтобы поддержать ритм.")

    if tdee:
        parts.append(f"Ориентир по калориям: около {round(float(tdee))} ккал в день.")

    if predicted_date:
        parts.append(f"Ожидаемая дата: {predicted_date}.")

    if food_diary is True:
        parts.append("Дневник питания поможет держать фокус.")
    elif food_diary is False:
        parts.append("Дневник питания можно подключить позже, если захочется.")

    return " ".join(parts)


def build_ai_context(profile: dict[str, Any]) -> str:
    """Собрать user-prompt из данных профиля."""
    if not isinstance(profile, dict):
        profile = {}
    goal = _format_goal(profile.get("goal"))
    activity = profile.get("activity_factor")
    tdee = profile.get("tdee_calories")
    macros = profile.get("macros") or {}
    deadline = profile.get("goal_deadline")
    food_diary = profile.get("food_diary")

    tdee_text = _format_number(tdee)
    lines = [
        f"Цель: {goal}.",
        f"Активность: {activity if activity else 'не указана'}.",
        f"Калорийность: {tdee_text} ккал в день." if tdee_text else "Калорийность: не рассчитана.",
    ]

    if isinstance(macros, dict) and macros:
        protein = _format_number(macros.get("protein_g"))
        fat = _format_number(macros.get("fat_g"))
        carbs = _format_number(macros.get("carbs_g"))
        parts = ["БЖУ:"]
        parts.append(f"белки {protein} г," if protein else "белки не указаны,")
        parts.append(f"жиры {fat} г," if fat else "жиры не указаны,")
        parts.append(f"углеводы {carbs} г." if carbs else "углеводы не указаны.")
        lines.append(" ".join(parts))
    else:
        lines.append("БЖУ: не рассчитаны.")

    if deadline:
        lines.append(f"Дедлайн цели: {deadline}.")
    else:
        lines.append("Дедлайн цели: не указан.")

    if food_diary is True:
        lines.append("Дневник питания: включён.")
    elif food_diary is False:
        lines.append("Дневник питания: выключен.")
    else:
        lines.append("Дневник питания: не указан.")

    return "\n".join(lines)


def generate_yandex_recommendation(
    profile: dict[str, Any],
    api_key: str,
    folder_id: str,
) -> str:
    """Сформировать рекомендацию через YandexGPT, используя только профиль."""
    system_prompt = SYSTEM_PROMPT
    user_prompt = build_ai_context(profile)
    logger.debug("Контекст для YandexGPT: %s", user_prompt)

    payload = {
        "modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {
            "stream": False,
            "temperature": 0.6,
            "maxTokens": 700,
        },
        "messages": [
            {"role": "system", "text": system_prompt},
            {"role": "user", "text": user_prompt},
        ],
    }
    headers = {
        "Authorization": f"Api-Key {api_key}",
        "Content-Type": "application/json",
    }
    response = requests.post(
        "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
        json=payload,
        headers=headers,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    alternatives = data.get("result", {}).get("alternatives", [])
    if not alternatives:
        raise ValueError("Пустой ответ от YandexGPT.")
    message = alternatives[0].get("message", {})
    text = message.get("text")
    if not text:
        raise ValueError("YandexGPT не вернул текст рекомендации.")
    logger.debug("Ответ YandexGPT (текст): %s", text)
    return text


def calculate_deviation_risk(
    profile: dict[str, Any],
    entries: list[dict[str, Any]],
) -> dict[str, str | int | None]:
    """Оценить риск отклонения от цели по последним дням."""
    tdee = profile.get("tdee_calories") if isinstance(profile, dict) else None
    if not tdee or not entries:
        return {
            "risk": "low",
            "comment": "Недостаточно данных для оценки отклонений.",
            "weeks_shift": None,
        }

    recent = sorted(entries, key=lambda item: item.get("date", ""), reverse=True)[:7]
    calories = [item.get("calories") for item in recent if isinstance(item.get("calories"), (int, float))]
    if not calories:
        return {
            "risk": "low",
            "comment": "Недостаточно данных по калориям для оценки отклонений.",
            "weeks_shift": None,
        }

    avg_calories = sum(calories) / len(calories)
    deviation_ratio = (avg_calories - tdee) / tdee
    deviation_abs = abs(deviation_ratio)

    if deviation_abs <= 0.15:
        return {
            "risk": "low",
            "comment": "Пока отклонений от плана не видно. Продолжайте в том же духе.",
            "weeks_shift": None,
        }

    risk = "medium" if deviation_abs <= 0.3 else "high"
    weeks_shift = None
    activity_factor = profile.get("activity_factor") if isinstance(profile, dict) else None
    deadline_raw = profile.get("predicted_goal_date") if isinstance(profile, dict) else None
    if deadline_raw:
        try:
            deadline = datetime.fromisoformat(str(deadline_raw))
        except ValueError:
            deadline = None
        if deadline:
            now = datetime.now(deadline.tzinfo)
            diff_days = (deadline - now).days
            weeks_to_goal = max(1, round(diff_days / 7))
            weeks_shift = max(1, round(weeks_to_goal * deviation_abs))
    if weeks_shift is None:
        weeks_shift = max(1, round(deviation_abs * 6))
    activity_note = f" Текущая активность: {activity_factor}." if activity_factor else ""
    return {
        "risk": risk,
        "comment": (
            "Вы отклоняетесь от плана."
            f"{activity_note} Если продолжите в таком режиме, цель может сдвинуться на {weeks_shift} нед."
        ),
        "weeks_shift": weeks_shift,
    }


def generate_food_diary_recommendation(
    profile: dict[str, Any],
    entries: list[dict[str, Any]],
) -> dict[str, list[str] | str]:
    """Сформировать рекомендации по дневнику без базы знаний."""
    deviation_info = calculate_deviation_risk(profile, entries)

    if not entries:
        return {
            "insights": ["Добавьте несколько дней, чтобы увидеть тенденции."],
            "advice": "Начните с одного-двух дней — так проще поддерживать регулярность.",
            "deviation_risk": deviation_info["risk"],
            "deviation_comment": deviation_info["comment"],
            "deviation_weeks_shift": deviation_info["weeks_shift"],
        }

    recent = sorted(entries, key=lambda item: item.get("date", ""), reverse=True)[:7]
    calories = [item.get("calories") for item in recent if isinstance(item.get("calories"), (int, float))]
    protein = [item.get("protein_g") for item in recent if isinstance(item.get("protein_g"), (int, float))]
    fat = [item.get("fat_g") for item in recent if isinstance(item.get("fat_g"), (int, float))]
    carbs = [item.get("carbs_g") for item in recent if isinstance(item.get("carbs_g"), (int, float))]

    avg_calories = sum(calories) / len(calories) if calories else None
    avg_protein = sum(protein) / len(protein) if protein else None
    avg_fat = sum(fat) / len(fat) if fat else None
    avg_carbs = sum(carbs) / len(carbs) if carbs else None

    tdee = profile.get("tdee_calories") if isinstance(profile, dict) else None
    macros = profile.get("macros") if isinstance(profile, dict) else None

    insights: list[str] = []
    if avg_calories and isinstance(tdee, (int, float)):
        diff = avg_calories - tdee
        if abs(diff) >= 100:
            direction = "выше" if diff > 0 else "ниже"
            insights.append(
                f"Средняя калорийность за последние дни {direction} ориентира примерно на {abs(round(diff))} ккал."
            )

    if macros and isinstance(macros, dict):
        target_protein = macros.get("protein_g")
        target_fat = macros.get("fat_g")
        target_carbs = macros.get("carbs_g")

        def macro_insight(avg_value, target_value, label):
            if not isinstance(avg_value, (int, float)) or not isinstance(target_value, (int, float)):
                return None
            diff_value = avg_value - target_value
            if abs(diff_value) < target_value * 0.1:
                return None
            direction = "выше" if diff_value > 0 else "ниже"
            return f"В среднем {label} {direction} ориентира примерно на {abs(round(diff_value))} г."

        for avg_value, target_value, label in [
            (avg_protein, target_protein, "белки"),
            (avg_fat, target_fat, "жиры"),
            (avg_carbs, target_carbs, "углеводы"),
        ]:
            insight = macro_insight(avg_value, target_value, label)
            if insight:
                insights.append(insight)

    if not insights:
        insights.append("В целом показатели выглядят стабильно за последние дни.")

    advice = "Сфокусируйтесь на одном небольшом улучшении на ближайшие дни."
    if insights:
        first = insights[0].lower()
        if "белки" in first:
            advice = "Добавьте порцию белка в один из приёмов пищи."
        elif "жиры" in first:
            advice = "Попробуйте немного скорректировать количество жиров в рационе."
        elif "углеводы" in first:
            advice = "Проверьте баланс углеводов в основных приёмах пищи."
        elif "калорийность" in first:
            advice = "Сверьте дневной ориентир по калориям и попробуйте приблизиться к нему."

    return {
        "insights": insights[:2],
        "advice": advice,
        "deviation_risk": deviation_info["risk"],
        "deviation_comment": deviation_info["comment"],
        "deviation_weeks_shift": deviation_info["weeks_shift"],
    }
