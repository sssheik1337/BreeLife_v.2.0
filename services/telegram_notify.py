from __future__ import annotations

import datetime as dt
import os
from typing import Any

import requests

# TODO: добавить планировщик для регулярных напоминаний.
# TODO: интегрировать cron / celery для фоновых задач.


def send_reminder(chat_id: str, text: str) -> dict[str, Any]:
    """Отправить напоминание в Telegram (заглушка)."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return {"ok": False, "error": "Отсутствует TELEGRAM_BOT_TOKEN"}

    payload = {"chat_id": chat_id, "text": text}
    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json=payload,
        timeout=10,
    )
    return response.json()


def send_deadline_warning(chat_id: str, date: dt.date) -> dict[str, Any]:
    """Отправить предупреждение о дедлайне (заглушка)."""
    text = f"Напоминание: дедлайн {date:%d.%m.%Y} уже близко."
    return send_reminder(chat_id, text)
