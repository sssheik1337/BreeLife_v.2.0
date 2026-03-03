from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from config import IS_DEV
from app.context import load_admin_config, load_plans_config
from app.dependencies import load_profile, require_telegram_user_id
from app.schemas import PaymentRequest, SubscriptionRequest

router = APIRouter()


def _pick_first_non_empty(*values: object) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    if not raw:
        return None
    try:
        normalized = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def compute_subscription_status(payload: dict[str, str | None]) -> dict[str, str | None]:
    started_at = _pick_first_non_empty(payload.get("subscription_started_at"))
    until = _pick_first_non_empty(payload.get("subscription_until"))
    status_raw = _pick_first_non_empty(payload.get("subscription_status")) or ""

    now_utc = datetime.now(timezone.utc)
    until_dt = _parse_iso_datetime(until)
    is_active = bool(until_dt and until_dt > now_utc)
    is_expired = bool(until_dt and until_dt <= now_utc)

    if is_active:
        if status_raw == "paid":
            subscription_status = "paid"
        elif status_raw in {"active", "trial"}:
            subscription_status = status_raw
        else:
            subscription_status = "trial"
    elif is_expired:
        subscription_status = "expired"
    else:
        subscription_status = "none"

    return {
        "status": "active" if is_active else "inactive",
        "subscription_status": subscription_status,
        "subscription_started_at": started_at,
        "subscription_until": until,
    }


def load_subscription(telegram_user_id: int) -> dict[str, str | None]:
    profile = load_profile(telegram_user_id)
    subscription = profile.get("subscription") if isinstance(profile.get("subscription"), dict) else {}

    started_at = _pick_first_non_empty(
        subscription.get("subscription_started_at"),
        profile.get("subscription_started_at"),
        subscription.get("trial_started_at"),
        profile.get("trial_started_at"),
    )
    until = _pick_first_non_empty(
        subscription.get("subscription_until"),
        profile.get("subscription_until"),
    )
    status = _pick_first_non_empty(
        subscription.get("subscription_status"),
        subscription.get("status"),
        profile.get("subscription_status"),
    )

    return {
        "subscription_started_at": started_at,
        "subscription_until": until,
        "subscription_status": status,
    }


def save_subscription(telegram_user_id: int, payload: dict[str, str]) -> None:
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    updated["subscription"] = payload
    started_at = _pick_first_non_empty(payload.get("subscription_started_at"))
    until = _pick_first_non_empty(payload.get("subscription_until"))
    updated["subscription_started_at"] = started_at
    updated["trial_started_at"] = started_at
    updated["subscription_until"] = until
    updated["subscription_status"] = "trial" if until else "none"
    from app.dependencies import update_profile

    update_profile(telegram_user_id, updated)


@router.get("/api/subscription/status")
async def subscription_status(request: Request, response: Response):
    try:
        telegram_user_id = require_telegram_user_id(request, response)
    except HTTPException:
        return {
            "status": "inactive",
            "subscription_until": None,
            "subscription_started_at": None,
        }
    stored = load_subscription(telegram_user_id)
    return compute_subscription_status(stored)


@router.post("/api/subscription/start_trial")
async def start_trial(request: Request, response: Response, payload: SubscriptionRequest | None = None):
    if IS_DEV:
        raise HTTPException(status_code=403, detail="DEV_MODE_DISABLED")
    telegram_user_id = require_telegram_user_id(request, response)
    stored = load_subscription(telegram_user_id)
    if stored and stored.get("subscription_until"):
        return compute_subscription_status(stored)

    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    now = datetime.now(timezone.utc)
    subscription_until = (now + timedelta(days=trial_days)).isoformat()
    payload_to_store = {
        "subscription_started_at": now.isoformat(),
        "subscription_until": subscription_until,
    }
    save_subscription(telegram_user_id, payload_to_store)
    return compute_subscription_status(payload_to_store)


@router.post("/api/payments/start")
async def start_payment(payload: PaymentRequest):
    plan_id = payload.plan_id
    if not plan_id:
        raise HTTPException(status_code=400, detail="PLAN_REQUIRED")
    admin_config = load_admin_config()
    plans = load_plans_config()
    matched = None
    if isinstance(plans, list):
        matched = next((plan for plan in plans if plan.get("id") == plan_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    return {
        "ok": True,
        "plan": matched,
        "trial_days": admin_config.get("trial_days", 30),
    }
