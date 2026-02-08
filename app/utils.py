from datetime import datetime, timedelta, timezone


def build_food_diary_aggregates(entries: list[dict[str, object]]) -> dict[str, object]:
    totals = {
        "calories": 0,
        "protein": 0,
        "fat": 0,
        "carbs": 0,
        "carbs_simple": 0,
        "carbs_complex": 0,
        "fiber": 0,
    }
    for entry in entries:
        totals["calories"] += entry.get("calories", 0) or 0
        totals["protein"] += entry.get("protein", 0) or 0
        totals["fat"] += entry.get("fat", 0) or 0
        totals["carbs"] += entry.get("carbs", 0) or 0
        totals["carbs_simple"] += entry.get("carbs_simple", 0) or 0
        totals["carbs_complex"] += entry.get("carbs_complex", 0) or 0
        totals["fiber"] += entry.get("fiber", 0) or 0
    totals["calories"] = round(totals["calories"], 1)
    totals["protein"] = round(totals["protein"], 1)
    totals["fat"] = round(totals["fat"], 1)
    totals["carbs"] = round(totals["carbs"], 1)
    totals["carbs_simple"] = round(totals["carbs_simple"], 1)
    totals["carbs_complex"] = round(totals["carbs_complex"], 1)
    totals["fiber"] = round(totals["fiber"], 1)
    return totals


def normalize_iso_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def format_goal_label(goal: str | None) -> str:
    goal_map = {
        "lose": "похудение",
        "gain": "набор веса",
        "muscle": "набор мышечной массы",
        "maintain": "поддержание формы",
    }
    return goal_map.get(goal, "здоровый баланс")


def build_reminder_time(base: datetime, hours: int, days: int = 0) -> str:
    scheduled = base + timedelta(days=days)
    scheduled = scheduled.replace(hour=hours, minute=0, second=0, microsecond=0)
    return scheduled.isoformat()
