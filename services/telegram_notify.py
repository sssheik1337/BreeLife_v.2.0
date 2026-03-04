from __future__ import annotations

import datetime as dt
import os
from typing import Any

import requests

from services.telegram_deeplinks import build_reminder_action_url


def send_reminder(
    chat_id: str,
    text: str,
    button_text: str | None = None,
    webapp_url: str | None = None,
) -> dict[str, Any]:
    """Отправить напоминание в Telegram с опциональной web_app кнопкой."""
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return {"ok": False, "error": "Отсутствует TELEGRAM_BOT_TOKEN"}

    payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
    normalized_webapp_url = (webapp_url or "").strip()
    normalized_button_text = (button_text or "").strip() or "Открыть"

    if normalized_webapp_url:
        payload["reply_markup"] = {
            "inline_keyboard": [
                [
                    {
                        "text": normalized_button_text,
                        "web_app": {"url": normalized_webapp_url},
                    }
                ]
            ]
        }

    try:
        response = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json=payload,
            timeout=10,
        )
    except requests.Timeout:
        return {"ok": False, "error": "TELEGRAM_TIMEOUT"}
    except requests.RequestException as exc:
        return {"ok": False, "error": f"TELEGRAM_NETWORK_ERROR: {exc}"}

    try:
        data = response.json()
    except ValueError:
        text_preview = (response.text or "").strip()
        return {
            "ok": False,
            "error": f"TELEGRAM_INVALID_JSON_RESPONSE: HTTP_{response.status_code}",
            "result": text_preview[:500] if text_preview else None,
        }

    if not response.ok:
        return {
            "ok": False,
            "error": data.get("description") or f"TELEGRAM_HTTP_{response.status_code}",
            "error_code": data.get("error_code"),
            "result": data.get("result"),
        }

    if data.get("ok") is True:
        return {"ok": True, "result": data.get("result")}

    return {
        "ok": False,
        "error": data.get("description") or "TELEGRAM_API_ERROR",
        "error_code": data.get("error_code"),
        "result": data.get("result"),
    }


def send_deadline_warning(chat_id: str, date: dt.date) -> dict[str, Any]:
    """Отправить предупреждение о дедлайне (заглушка)."""
    text = f"Напоминание: дедлайн {date:%d.%m.%Y} уже близко."
    return send_reminder(chat_id, text)


def resolve_reminder_deeplink(
    reminder_type: str,
    target_date: dt.date | str | None = None,
) -> str | None:
    """Вернуть deeplink Mini App для типа напоминания."""
    return build_reminder_action_url(reminder_type=reminder_type, target_date=target_date)
