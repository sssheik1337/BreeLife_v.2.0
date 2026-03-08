from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone

from app.dependencies import load_profile, normalize_profile_payload_shape, update_profile
from app.routers.subscription import attempt_subscription_autopay_for_user
from config import DB_PATH

logger = logging.getLogger(__name__)


def _parse_iso_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_lifetime_status(value: object) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"lifetime", "super", "superaccess"}


def _read_all_profile_rows() -> list[tuple[int, dict[str, object]]]:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute("SELECT telegram_user_id, data FROM profiles").fetchall()

    parsed_rows: list[tuple[int, dict[str, object]]] = []
    for row in rows:
        try:
            payload = json.loads(row["data"])
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if isinstance(payload, dict):
            parsed_rows.append((int(row["telegram_user_id"]), payload))
    return parsed_rows


def audit_subscriptions_once() -> dict[str, int]:
    now_utc = datetime.now(timezone.utc)
    checked = 0
    changed = 0
    expired = 0

    for telegram_user_id, raw_profile in _read_all_profile_rows():
        checked += 1
        profile = normalize_profile_payload_shape(raw_profile)
        subscription = profile.get("subscription") if isinstance(profile.get("subscription"), dict) else {}
        status_raw = str(profile.get("subscription_status") or "").strip().lower()
        until_dt = _parse_iso_datetime(profile.get("subscription_until"))
        auto_renew = (
            subscription.get("subscription_auto_renew")
            if isinstance(subscription.get("subscription_auto_renew"), bool)
            else profile.get("subscription_auto_renew")
        )

        if _is_lifetime_status(status_raw):
            continue

        if until_dt is None or until_dt > now_utc:
            continue

        if status_raw == "paid" and auto_renew is True:
            renewal_result = attempt_subscription_autopay_for_user(telegram_user_id)
            refreshed_profile = load_profile(telegram_user_id)
            refreshed_status = str(refreshed_profile.get("subscription_status") or "").strip().lower()
            refreshed_until_dt = _parse_iso_datetime(refreshed_profile.get("subscription_until"))
            if refreshed_until_dt is not None and refreshed_until_dt > now_utc and refreshed_status == "paid":
                changed += 1
                continue
            if renewal_result.get("reason") in {"provider_error", "synced_existing_attempt"} and refreshed_status == "paid":
                continue

        if status_raw == "expired":
            continue

        updated = dict(profile)
        updated_subscription = dict(updated.get("subscription") if isinstance(updated.get("subscription"), dict) else {})
        updated["subscription_status"] = "expired"
        updated["subscription_auto_renew"] = False
        updated_subscription["subscription_status"] = "expired"
        updated_subscription["subscription_auto_renew"] = False
        if isinstance(updated.get("subscription_until"), str) and updated["subscription_until"].strip():
            updated_subscription["subscription_until"] = updated["subscription_until"]
        if isinstance(updated.get("subscription_started_at"), str) and updated["subscription_started_at"].strip():
            updated_subscription["subscription_started_at"] = updated["subscription_started_at"]
        if isinstance(updated.get("trial_started_at"), str) and updated["trial_started_at"].strip():
            updated_subscription["trial_started_at"] = updated["trial_started_at"]
        if isinstance(updated.get("subscription_cancelled_at"), str) and updated["subscription_cancelled_at"].strip():
            updated_subscription["subscription_cancelled_at"] = updated["subscription_cancelled_at"]
        updated["subscription"] = updated_subscription

        update_profile(telegram_user_id, updated)
        changed += 1
        expired += 1

    stats = {
        "checked": checked,
        "changed": changed,
        "expired": expired,
    }
    logger.info("Subscription audit tick: checked=%s changed=%s expired=%s", checked, changed, expired)
    return stats
