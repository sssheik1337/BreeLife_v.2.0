import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response

from config import IS_DEV, PUBLIC_BASE_URL, TELEGRAM_WEBAPP_URL
from app.context import load_admin_config, load_plans_config
from app.dependencies import load_profile, require_telegram_user_id, update_profile
from app.schemas import PaymentRequest, SubscriptionCancelRequest, SubscriptionRequest
from services.storage_db import (
    create_payment_record,
    get_latest_payment_for_user,
    get_payment_record_by_provider_payment_id,
    update_payment_record_by_provider_payment_id,
)
from services.yookassa_payments import (
    YooKassaError,
    create_autopay_payment,
    create_embedded_payment,
    get_payment,
    yookassa_is_configured,
)

router = APIRouter()
PENDING_PAYMENT_SYNC_MAX_AGE = timedelta(minutes=30)


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


def _is_lifetime_status(status_raw: str | None) -> bool:
    normalized = str(status_raw or "").strip().lower()
    return normalized in {"lifetime", "super", "superaccess"}


def _is_payment_sync_stale(payment_record: dict[str, object]) -> bool:
    created_at = _parse_iso_datetime(str(payment_record.get("created_at") or ""))
    if created_at is None:
        return False
    return datetime.now(timezone.utc) - created_at > PENDING_PAYMENT_SYNC_MAX_AGE


def _is_subscription_active_payload(payload: dict[str, object]) -> bool:
    status_raw = _pick_first_non_empty(payload.get("subscription_status")) or ""
    if _is_lifetime_status(status_raw):
        return True
    until = _pick_first_non_empty(payload.get("subscription_until"))
    until_dt = _parse_iso_datetime(until)
    return bool(until_dt and until_dt > datetime.now(timezone.utc))


def _coerce_bool(value: object) -> bool:
    return bool(value) if isinstance(value, bool) else False


def _get_subscription_dict(payload: dict[str, object]) -> dict[str, object]:
    subscription = payload.get("subscription")
    return dict(subscription) if isinstance(subscription, dict) else {}


def _subscription_runtime_payload(payload: dict[str, object]) -> dict[str, object]:
    subscription = _get_subscription_dict(payload)
    payment_method_title = _pick_first_non_empty(
        subscription.get("subscription_payment_method_title"),
        subscription.get("payment_method_title"),
    )
    payment_method_id = _pick_first_non_empty(
        subscription.get("subscription_payment_method_id"),
        subscription.get("payment_method_id"),
    )
    return {
        "subscription_started_at": _pick_first_non_empty(
            subscription.get("subscription_started_at"),
            payload.get("subscription_started_at"),
            subscription.get("trial_started_at"),
            payload.get("trial_started_at"),
        ),
        "subscription_until": _pick_first_non_empty(
            subscription.get("subscription_until"),
            payload.get("subscription_until"),
        ),
        "subscription_status": _pick_first_non_empty(
            subscription.get("subscription_status"),
            subscription.get("status"),
            payload.get("subscription_status"),
        ),
        "subscription_auto_renew": (
            subscription.get("subscription_auto_renew")
            if isinstance(subscription.get("subscription_auto_renew"), bool)
            else payload.get("subscription_auto_renew")
        ),
        "subscription_cancelled_at": _pick_first_non_empty(
            subscription.get("subscription_cancelled_at"),
            payload.get("subscription_cancelled_at"),
        ),
        "subscription_plan_id": _pick_first_non_empty(
            subscription.get("subscription_plan_id"),
            payload.get("subscription_plan_id"),
        ),
        "subscription_payment_method_id": payment_method_id,
        "subscription_payment_method_type": _pick_first_non_empty(
            subscription.get("subscription_payment_method_type"),
            subscription.get("payment_method_type"),
        ),
        "subscription_payment_method_title": payment_method_title,
        "subscription_payment_method_bound": bool(payment_method_id),
        "subscription_renewal_last_attempt_for": _pick_first_non_empty(
            subscription.get("subscription_renewal_last_attempt_for"),
        ),
        "subscription_renewal_last_attempt_status": _pick_first_non_empty(
            subscription.get("subscription_renewal_last_attempt_status"),
        ),
        "subscription_renewal_last_attempt_payment_id": _pick_first_non_empty(
            subscription.get("subscription_renewal_last_attempt_payment_id"),
        ),
        "subscription_renewal_last_error": _pick_first_non_empty(
            subscription.get("subscription_renewal_last_error"),
        ),
    }


def _describe_payment_method(payment_method: dict[str, object]) -> str | None:
    title = _pick_first_non_empty(payment_method.get("title"))
    if title:
        return title
    card = payment_method.get("card") if isinstance(payment_method.get("card"), dict) else {}
    first6 = _pick_first_non_empty(card.get("first6"))
    last4 = _pick_first_non_empty(card.get("last4"))
    if first6 and last4:
        return f"{first6}******{last4}"
    if last4:
        return f"**** {last4}"
    return _pick_first_non_empty(payment_method.get("type"))


def _build_saved_payment_method_fields(provider_payload: dict[str, object]) -> dict[str, object]:
    payment_method = provider_payload.get("payment_method") if isinstance(provider_payload.get("payment_method"), dict) else {}
    payment_method_id = _pick_first_non_empty(payment_method.get("id"))
    payment_method_saved = _coerce_bool(payment_method.get("saved"))
    if not payment_method_id or not payment_method_saved:
        return {
            "subscription_payment_method_id": None,
            "subscription_payment_method_type": None,
            "subscription_payment_method_title": None,
            "subscription_payment_method_bound": False,
        }
    return {
        "subscription_payment_method_id": payment_method_id,
        "subscription_payment_method_type": _pick_first_non_empty(payment_method.get("type")),
        "subscription_payment_method_title": _describe_payment_method(payment_method),
        "subscription_payment_method_bound": True,
    }


def _renewal_idempotence_key(telegram_user_id: int, renewal_for_until: str, payment_method_id: str) -> str:
    raw = f"renewal:{telegram_user_id}:{renewal_for_until}:{payment_method_id}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def compute_subscription_status(payload: dict[str, object]) -> dict[str, object]:
    runtime = _subscription_runtime_payload(payload)
    started_at = _pick_first_non_empty(runtime.get("subscription_started_at"))
    until = _pick_first_non_empty(runtime.get("subscription_until"))
    status_raw = _pick_first_non_empty(runtime.get("subscription_status")) or ""
    cancelled_at = _pick_first_non_empty(runtime.get("subscription_cancelled_at"))
    auto_renew = _coerce_bool(runtime.get("subscription_auto_renew"))
    payment_method_bound = _coerce_bool(runtime.get("subscription_payment_method_bound"))

    now_utc = datetime.now(timezone.utc)
    until_dt = _parse_iso_datetime(until)
    is_lifetime = _is_lifetime_status(status_raw)
    is_active = is_lifetime or bool(until_dt and until_dt > now_utc)
    is_expired = bool(until_dt and until_dt <= now_utc)

    if is_lifetime:
        subscription_status = "lifetime"
    elif is_active:
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
        "subscription_auto_renew": auto_renew if subscription_status == "paid" and is_active else False,
        "subscription_cancelled_at": cancelled_at,
        "subscription_plan_id": _pick_first_non_empty(runtime.get("subscription_plan_id")),
        "subscription_payment_method_bound": payment_method_bound,
        "subscription_payment_method_title": _pick_first_non_empty(runtime.get("subscription_payment_method_title")),
        "subscription_renewal_last_error": _pick_first_non_empty(runtime.get("subscription_renewal_last_error")),
    }


def load_subscription(telegram_user_id: int) -> dict[str, object]:
    profile = load_profile(telegram_user_id)
    return _subscription_runtime_payload(profile)


def save_subscription(telegram_user_id: int, payload: dict[str, object]) -> None:
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    existing_subscription = updated.get("subscription") if isinstance(updated.get("subscription"), dict) else {}
    merged_payload = dict(existing_subscription)
    merged_payload.update(payload)
    updated["subscription"] = merged_payload
    started_at = _pick_first_non_empty(merged_payload.get("subscription_started_at"))
    until = _pick_first_non_empty(merged_payload.get("subscription_until"))
    explicit_status = _pick_first_non_empty(merged_payload.get("subscription_status"))
    status = explicit_status or ("trial" if until else "none")
    updated["subscription_started_at"] = started_at
    if status == "trial":
        updated["trial_started_at"] = _pick_first_non_empty(merged_payload.get("trial_started_at"), started_at)
    elif isinstance(updated.get("trial_started_at"), str):
        updated["trial_started_at"] = updated.get("trial_started_at")
    else:
        updated["trial_started_at"] = None
    updated["subscription_until"] = until
    updated["subscription_status"] = status
    updated["subscription_auto_renew"] = _coerce_bool(merged_payload.get("subscription_auto_renew"))
    updated["subscription_cancelled_at"] = _pick_first_non_empty(merged_payload.get("subscription_cancelled_at"))
    update_profile(telegram_user_id, updated)


def _resolve_payment_plan(plan_id: str) -> dict[str, object]:
    plans = load_plans_config()
    if not isinstance(plans, list):
        raise HTTPException(status_code=503, detail="PLANS_UNAVAILABLE")
    matched = next(
        (
            plan
            for plan in plans
            if isinstance(plan, dict) and str(plan.get("id", "")).strip().lower() == plan_id
        ),
        None,
    )
    if not isinstance(matched, dict):
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    return matched


def _parse_plan_amount_rub(plan: dict[str, object]) -> int:
    candidates = (plan.get("price_current"), plan.get("price"))
    for candidate in candidates:
        if isinstance(candidate, bool):
            continue
        if isinstance(candidate, (int, float)):
            return max(0, int(candidate))
        digits = "".join(ch for ch in str(candidate or "") if ch.isdigit())
        if digits:
            return max(0, int(digits))
    return 0


def _build_payment_return_url() -> str:
    base_url = str(PUBLIC_BASE_URL or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=503, detail="PAYMENT_RETURN_URL_NOT_CONFIGURED")
    return f"{base_url}/payments/return"


def _build_payment_meta(
    *,
    provider_payload: dict[str, object],
    plan: dict[str, object],
    provider_status: str,
    extra_meta: dict[str, object] | None = None,
) -> dict[str, object]:
    confirmation = provider_payload.get("confirmation") if isinstance(provider_payload.get("confirmation"), dict) else {}
    amount = provider_payload.get("amount") if isinstance(provider_payload.get("amount"), dict) else {}
    metadata = provider_payload.get("metadata") if isinstance(provider_payload.get("metadata"), dict) else {}
    payment_method = provider_payload.get("payment_method") if isinstance(provider_payload.get("payment_method"), dict) else {}
    cancellation_details = provider_payload.get("cancellation_details") if isinstance(provider_payload.get("cancellation_details"), dict) else {}
    result = {
        "plan_id": str(plan.get("id") or "").strip().lower(),
        "plan_title": str(plan.get("title") or "").strip(),
        "provider_status": provider_status,
        "provider_paid": provider_payload.get("paid") is True,
        "provider_created_at": provider_payload.get("created_at"),
        "provider_description": provider_payload.get("description"),
        "provider_confirmation_type": confirmation.get("type"),
        "provider_confirmation_url": confirmation.get("confirmation_url"),
        "provider_amount_value": amount.get("value"),
        "provider_amount_currency": amount.get("currency"),
        "provider_metadata": metadata,
        "provider_payment_method_id": payment_method.get("id"),
        "provider_payment_method_type": payment_method.get("type"),
        "provider_payment_method_saved": payment_method.get("saved"),
        "provider_payment_method_title": _describe_payment_method(payment_method),
        "provider_cancellation_party": cancellation_details.get("party"),
        "provider_cancellation_reason": cancellation_details.get("reason"),
    }
    if isinstance(extra_meta, dict):
        result.update(extra_meta)
    return result


def _set_subscription_fields(telegram_user_id: int, updates: dict[str, object]) -> dict[str, object]:
    profile = load_profile(telegram_user_id)
    updated_profile = dict(profile)
    subscription = _get_subscription_dict(updated_profile)
    subscription.update(updates)
    updated_profile["subscription"] = subscription

    if "subscription_started_at" in updates:
        updated_profile["subscription_started_at"] = _pick_first_non_empty(subscription.get("subscription_started_at"))
    if "subscription_until" in updates:
        updated_profile["subscription_until"] = _pick_first_non_empty(subscription.get("subscription_until"))
    if "subscription_status" in updates:
        updated_profile["subscription_status"] = _pick_first_non_empty(subscription.get("subscription_status"))
    if "subscription_auto_renew" in updates:
        updated_profile["subscription_auto_renew"] = _coerce_bool(subscription.get("subscription_auto_renew"))
    if "subscription_cancelled_at" in updates:
        updated_profile["subscription_cancelled_at"] = _pick_first_non_empty(subscription.get("subscription_cancelled_at"))

    update_profile(telegram_user_id, updated_profile)
    return updated_profile


def _apply_paid_subscription(
    telegram_user_id: int,
    duration_days: int,
    *,
    plan_id: str | None = None,
    auto_renew: bool | None = None,
    preserve_existing_anchor: bool = False,
) -> dict[str, object]:
    now_utc = datetime.now(timezone.utc)
    stored = load_subscription(telegram_user_id)
    existing_until_dt = _parse_iso_datetime(stored.get("subscription_until"))
    if existing_until_dt is not None:
        if preserve_existing_anchor:
            subscription_until_dt = existing_until_dt
        else:
            subscription_until_dt = max(existing_until_dt, now_utc)
    else:
        subscription_until_dt = now_utc
    subscription_until_dt = subscription_until_dt + timedelta(days=max(0, int(duration_days)))
    payload_to_store = {
        "subscription_started_at": now_utc.isoformat(),
        "subscription_until": subscription_until_dt.isoformat(),
        "subscription_status": "paid",
        "subscription_auto_renew": auto_renew if isinstance(auto_renew, bool) else _coerce_bool(stored.get("subscription_auto_renew")),
        "subscription_cancelled_at": None,
        "subscription_plan_id": _pick_first_non_empty(plan_id, stored.get("subscription_plan_id")),
        "subscription_renewal_last_error": None,
        "subscription_renewal_last_attempt_for": None,
        "subscription_renewal_last_attempt_status": None,
        "subscription_renewal_last_attempt_payment_id": None,
        "trial_started_at": _pick_first_non_empty(stored.get("trial_started_at"), stored.get("subscription_started_at")),
    }
    save_subscription(telegram_user_id, payload_to_store)
    return compute_subscription_status(payload_to_store)


def _record_saved_payment_method(
    telegram_user_id: int,
    *,
    plan_id: str | None,
    provider_payload: dict[str, object],
    auto_renew_requested: bool,
) -> None:
    saved_fields = _build_saved_payment_method_fields(provider_payload)
    updates = {
        "subscription_plan_id": _pick_first_non_empty(plan_id),
        "subscription_auto_renew": auto_renew_requested and _coerce_bool(saved_fields.get("subscription_payment_method_bound")),
        "subscription_cancelled_at": None,
        "subscription_renewal_last_error": None,
        "subscription_renewal_last_attempt_for": None,
        "subscription_renewal_last_attempt_status": None,
        "subscription_renewal_last_attempt_payment_id": None,
        **saved_fields,
    }
    _set_subscription_fields(telegram_user_id, updates)


def _handle_failed_renewal(
    telegram_user_id: int,
    *,
    subscription_until: str | None,
    payment_method_should_clear: bool,
    error_reason: str | None,
    provider_payment_id: str | None = None,
    provider_status: str | None = None,
) -> None:
    updates: dict[str, object] = {
        "subscription_auto_renew": False,
        "subscription_renewal_last_error": _pick_first_non_empty(error_reason),
        "subscription_renewal_last_attempt_payment_id": _pick_first_non_empty(provider_payment_id),
        "subscription_renewal_last_attempt_status": _pick_first_non_empty(provider_status),
    }
    if payment_method_should_clear:
        updates.update(
            {
                "subscription_payment_method_id": None,
                "subscription_payment_method_type": None,
                "subscription_payment_method_title": None,
                "subscription_payment_method_bound": False,
            }
        )

    until_dt = _parse_iso_datetime(subscription_until)
    if until_dt is not None and until_dt <= datetime.now(timezone.utc):
        updates["subscription_status"] = "expired"
        updates["subscription_until"] = subscription_until
    _set_subscription_fields(telegram_user_id, updates)


def attempt_subscription_autopay_for_user(telegram_user_id: int) -> dict[str, object]:
    stored = load_subscription(telegram_user_id)
    status_raw = str(stored.get("subscription_status") or "").strip().lower()
    until_raw = _pick_first_non_empty(stored.get("subscription_until"))
    until_dt = _parse_iso_datetime(until_raw)
    auto_renew = _coerce_bool(stored.get("subscription_auto_renew"))
    payment_method_id = _pick_first_non_empty(stored.get("subscription_payment_method_id"))
    plan_id = _pick_first_non_empty(stored.get("subscription_plan_id"))

    if status_raw != "paid" or not auto_renew or until_dt is None or until_dt > datetime.now(timezone.utc):
        return {"ok": False, "reason": "not_due"}
    if not payment_method_id or not plan_id:
        _handle_failed_renewal(
            telegram_user_id,
            subscription_until=until_raw,
            payment_method_should_clear=not bool(payment_method_id),
            error_reason="renewal_setup_missing",
        )
        return {"ok": False, "reason": "renewal_setup_missing"}

    renewal_for_until = until_dt.isoformat()
    last_attempt_for = _pick_first_non_empty(stored.get("subscription_renewal_last_attempt_for"))
    last_attempt_status = str(stored.get("subscription_renewal_last_attempt_status") or "").strip().lower()
    last_attempt_payment_id = _pick_first_non_empty(stored.get("subscription_renewal_last_attempt_payment_id"))

    if last_attempt_for == renewal_for_until and last_attempt_payment_id and last_attempt_status in {"pending", "waiting_for_capture"}:
        payment_record = get_payment_record_by_provider_payment_id(last_attempt_payment_id)
        if payment_record is not None:
            synced = _sync_payment_state(payment_record)
            return {"ok": True, "reason": "synced_existing_attempt", "payment": synced}

    plan = _resolve_payment_plan(plan_id)
    duration_days = max(0, int(plan.get("duration_days", 0) or 0))
    amount_rub = _parse_plan_amount_rub(plan)
    if amount_rub <= 0 or duration_days <= 0:
        _handle_failed_renewal(
            telegram_user_id,
            subscription_until=until_raw,
            payment_method_should_clear=False,
            error_reason="plan_invalid_for_renewal",
        )
        return {"ok": False, "reason": "plan_invalid_for_renewal"}

    description = f"{str(plan.get('title') or 'Подписка').strip()} - {duration_days} дней"
    renewal_idempotence_key = _renewal_idempotence_key(telegram_user_id, renewal_for_until, payment_method_id)
    try:
        provider_payment = create_autopay_payment(
            amount_rub=amount_rub,
            payment_method_id=payment_method_id,
            description=description,
            metadata={
                "telegram_user_id": str(telegram_user_id),
                "plan_id": plan_id,
                "duration_days": str(duration_days),
                "app": "BreeLife",
                "payment_reason": "subscription_renewal",
                "renewal_for_until": renewal_for_until,
            },
            idempotence_key=renewal_idempotence_key,
        )
    except YooKassaError as exc:
        _set_subscription_fields(
            telegram_user_id,
            {
                "subscription_renewal_last_attempt_for": renewal_for_until,
                "subscription_renewal_last_attempt_status": "provider_error",
                "subscription_renewal_last_attempt_payment_id": None,
                "subscription_renewal_last_error": str(exc),
            },
        )
        return {"ok": False, "reason": "provider_error", "error": str(exc)}

    provider_payment_id = str(provider_payment.get("id") or "").strip()
    provider_status = str(provider_payment.get("status") or "").strip().lower() or "pending"
    meta = _build_payment_meta(
        provider_payload=provider_payment,
        plan=plan,
        provider_status=provider_status,
        extra_meta={
            "payment_reason": "subscription_renewal",
            "renewal_for_until": renewal_for_until,
            "auto_renew": True,
        },
    )
    payment_record = get_payment_record_by_provider_payment_id(provider_payment_id)
    if payment_record is None:
        payment_record = create_payment_record(
            telegram_user_id=telegram_user_id,
            amount_rub=amount_rub,
            duration_days=duration_days,
            provider="yookassa",
            provider_payment_id=provider_payment_id,
            idempotence_key=str(provider_payment.get("_idempotence_key") or renewal_idempotence_key).strip(),
            status=provider_status,
            meta=meta,
        )
    else:
        payment_record = update_payment_record_by_provider_payment_id(
            provider_payment_id,
            status=provider_status,
            meta=meta,
        ) or payment_record

    _set_subscription_fields(
        telegram_user_id,
        {
            "subscription_renewal_last_attempt_for": renewal_for_until,
            "subscription_renewal_last_attempt_status": provider_status,
            "subscription_renewal_last_attempt_payment_id": provider_payment_id,
            "subscription_renewal_last_error": None,
        },
    )

    synced = _sync_payment_state(payment_record)
    return {"ok": True, "reason": "renewal_attempt_created", "payment": synced}


def _sync_payment_state(payment_record: dict[str, object]) -> dict[str, object]:
    provider_payment_id = str(payment_record.get("provider_payment_id") or "").strip()
    if not provider_payment_id:
        raise HTTPException(status_code=404, detail="PAYMENT_NOT_FOUND")

    provider_payload = get_payment(provider_payment_id)
    provider_status = str(provider_payload.get("status") or "").strip().lower() or "pending"
    payment_reason = ""
    existing_meta = payment_record.get("meta") if isinstance(payment_record.get("meta"), dict) else {}
    if isinstance(existing_meta, dict):
        payment_reason = str(existing_meta.get("payment_reason") or "").strip().lower()
    meta_update = _build_payment_meta(
        provider_payload=provider_payload,
        plan={
            "id": existing_meta.get("plan_id") if isinstance(existing_meta, dict) else "",
            "title": existing_meta.get("plan_title") if isinstance(existing_meta, dict) else "",
        },
        provider_status=provider_status,
        extra_meta={
            "payment_reason": payment_reason,
            "renewal_for_until": existing_meta.get("renewal_for_until") if isinstance(existing_meta, dict) else None,
            "auto_renew": existing_meta.get("auto_renew") if isinstance(existing_meta, dict) else None,
        },
    )

    current_status = str(payment_record.get("status") or "").strip().lower()
    if provider_status == "succeeded" and current_status != "succeeded":
        saved_payment_fields = _build_saved_payment_method_fields(provider_payload)
        auto_renew_enabled = _coerce_bool(saved_payment_fields.get("subscription_payment_method_bound"))
        _record_saved_payment_method(
            int(payment_record["telegram_user_id"]),
            plan_id=str(existing_meta.get("plan_id") or "").strip() if isinstance(existing_meta, dict) else None,
            provider_payload=provider_payload,
            auto_renew_requested=auto_renew_enabled,
        )
        _apply_paid_subscription(
            int(payment_record["telegram_user_id"]),
            int(payment_record.get("duration_days") or 0),
            plan_id=str(existing_meta.get("plan_id") or "").strip() if isinstance(existing_meta, dict) else None,
            auto_renew=auto_renew_enabled,
            preserve_existing_anchor=payment_reason == "subscription_renewal",
        )
    elif provider_status == "canceled" and payment_reason == "subscription_renewal":
        cancellation_reason = meta_update.get("provider_cancellation_reason")
        _handle_failed_renewal(
            int(payment_record["telegram_user_id"]),
            subscription_until=_pick_first_non_empty(load_subscription(int(payment_record["telegram_user_id"])).get("subscription_until")),
            payment_method_should_clear=str(cancellation_reason or "").strip().lower() == "permission_revoked",
            error_reason=_pick_first_non_empty(
                meta_update.get("provider_cancellation_reason"),
                meta_update.get("provider_status"),
            ),
            provider_payment_id=provider_payment_id,
            provider_status=provider_status,
        )

    updated_payment = update_payment_record_by_provider_payment_id(
        provider_payment_id,
        status=provider_status,
        meta=meta_update,
    )
    if updated_payment is None:
        raise HTTPException(status_code=404, detail="PAYMENT_NOT_FOUND")
    return updated_payment


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
    if stored and _is_subscription_active_payload(stored):
        return compute_subscription_status(stored)

    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    now = datetime.now(timezone.utc)
    subscription_until = (now + timedelta(days=trial_days)).isoformat()
    payload_to_store = {
        "subscription_started_at": now.isoformat(),
        "subscription_until": subscription_until,
        "subscription_auto_renew": False,
        "subscription_cancelled_at": None,
    }
    save_subscription(telegram_user_id, payload_to_store)
    return compute_subscription_status(payload_to_store)


@router.post("/api/subscription/cancel")
async def cancel_subscription(request: Request, response: Response, payload: SubscriptionCancelRequest | None = None):
    telegram_user_id = require_telegram_user_id(request, response)
    stored = load_subscription(telegram_user_id)
    status_raw = str(stored.get("subscription_status") or "").strip().lower()
    until_dt = _parse_iso_datetime(_pick_first_non_empty(stored.get("subscription_until")))

    if _is_lifetime_status(status_raw):
        raise HTTPException(status_code=400, detail="LIFETIME_ACCESS_CANNOT_BE_CANCELLED")
    if status_raw != "paid" or until_dt is None or until_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="NO_ACTIVE_PAID_SUBSCRIPTION")

    updated_payload = {
        "subscription_started_at": _pick_first_non_empty(stored.get("subscription_started_at")),
        "subscription_until": _pick_first_non_empty(stored.get("subscription_until")),
        "subscription_status": "paid",
        "subscription_auto_renew": False,
        "subscription_cancelled_at": datetime.now(timezone.utc).isoformat(),
        "trial_started_at": _pick_first_non_empty(stored.get("trial_started_at"), stored.get("subscription_started_at")),
    }
    save_subscription(telegram_user_id, updated_payload)
    return compute_subscription_status(updated_payload)


@router.post("/api/payments/start")
async def start_payment(request: Request, response: Response, payload: PaymentRequest):
    telegram_user_id = require_telegram_user_id(request, response)
    plan_id = str(payload.plan_id or "").strip().lower()
    if not plan_id:
        raise HTTPException(status_code=400, detail="PLAN_REQUIRED")
    if not yookassa_is_configured():
        raise HTTPException(status_code=503, detail="PAYMENT_PROVIDER_NOT_CONFIGURED")

    plan = _resolve_payment_plan(plan_id)
    duration_days = max(0, int(plan.get("duration_days", 0) or 0))
    amount_rub = _parse_plan_amount_rub(plan)
    if amount_rub <= 0:
        raise HTTPException(status_code=400, detail="PLAN_IS_NOT_COMMERCIAL")
    if duration_days <= 0:
        raise HTTPException(status_code=400, detail="PLAN_DURATION_INVALID")

    description = f"{str(plan.get('title') or 'Подписка').strip()} - {duration_days} дней"

    try:
        provider_payment = create_embedded_payment(
            amount_rub=amount_rub,
            description=description,
            metadata={
                "telegram_user_id": str(telegram_user_id),
                "plan_id": plan_id,
                "duration_days": str(duration_days),
                "app": "BreeLife",
                "payment_reason": "initial_purchase",
            },
            save_payment_method=True,
        )
    except YooKassaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    provider_payment_id = str(provider_payment.get("id") or "").strip()
    confirmation = provider_payment.get("confirmation") if isinstance(provider_payment.get("confirmation"), dict) else {}
    confirmation_token = str(confirmation.get("confirmation_token") or "").strip()
    provider_status = str(provider_payment.get("status") or "").strip().lower() or "pending"
    if not provider_payment_id or not confirmation_token:
        raise HTTPException(status_code=502, detail="PAYMENT_CONFIRMATION_TOKEN_MISSING")

    record = create_payment_record(
        telegram_user_id=telegram_user_id,
        amount_rub=amount_rub,
        duration_days=duration_days,
        provider="yookassa",
        provider_payment_id=provider_payment_id,
        idempotence_key=str(provider_payment.get("_idempotence_key") or "").strip(),
        status=provider_status,
        meta=_build_payment_meta(
            provider_payload=provider_payment,
            plan=plan,
            provider_status=provider_status,
            extra_meta={"payment_reason": "initial_purchase", "auto_renew": True},
        ),
    )

    return {
        "ok": True,
        "provider": "yookassa",
        "plan": {
            "id": plan_id,
            "title": str(plan.get("title") or "").strip(),
            "duration_days": duration_days,
            "amount_rub": amount_rub,
        },
        "payment_id": provider_payment_id,
        "confirmation_type": "embedded",
        "confirmation_token": confirmation_token,
        "return_url": _build_payment_return_url(),
        "status": provider_status,
        "local_payment_id": record.get("id"),
    }


@router.post("/api/payments/sync-last")
async def sync_last_payment(request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payment_record = get_latest_payment_for_user(telegram_user_id, statuses=("pending", "waiting_for_capture"))
    if payment_record is None:
        return {"ok": True, "payment": None}
    if _is_payment_sync_stale(payment_record):
        return {"ok": True, "payment": payment_record, "sync_skipped": "stale_pending"}
    try:
        synced = _sync_payment_state(payment_record)
    except YooKassaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"ok": True, "payment": synced}


@router.get("/api/payments/status/{payment_id}")
async def payment_status_api(payment_id: str, request: Request, response: Response):
    telegram_user_id = require_telegram_user_id(request, response)
    payment_record = get_payment_record_by_provider_payment_id(payment_id)
    if payment_record is None or int(payment_record.get("telegram_user_id") or 0) != telegram_user_id:
        raise HTTPException(status_code=404, detail="PAYMENT_NOT_FOUND")
    try:
        synced = _sync_payment_state(payment_record)
    except YooKassaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"ok": True, "payment": synced}


@router.post("/api/payments/webhook/yookassa")
async def yookassa_webhook(request: Request):
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="INVALID_PAYLOAD")
    event = str(payload.get("event") or "").strip().lower()
    payment_object = payload.get("object") if isinstance(payload.get("object"), dict) else {}
    provider_payment_id = str(payment_object.get("id") or "").strip()
    if not provider_payment_id:
        raise HTTPException(status_code=400, detail="PAYMENT_ID_REQUIRED")
    payment_record = get_payment_record_by_provider_payment_id(provider_payment_id)
    if payment_record is None:
        return {"ok": True, "ignored": True, "reason": "payment_not_found"}
    if event not in {"payment.succeeded", "payment.waiting_for_capture", "payment.canceled"}:
        return {"ok": True, "ignored": True, "reason": "event_ignored"}
    try:
        synced = _sync_payment_state(payment_record)
    except YooKassaError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"ok": True, "payment": synced}


@router.get("/payments/return")
async def payment_return_page():
    app_url = str(TELEGRAM_WEBAPP_URL or "").strip() or "/app/"
    html = f"""
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Возврат в BreeLife</title>
      <style>
        body {{
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: linear-gradient(180deg, #f8fafc 0%, #ecfdf5 100%);
          color: #0f172a;
        }}
        .card {{
          width: min(100%, 420px);
          background: #ffffff;
          border: 1px solid #d1fae5;
          border-radius: 24px;
          padding: 28px 24px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
          text-align: center;
        }}
        .btn {{
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 18px;
          min-height: 48px;
          padding: 0 20px;
          border-radius: 999px;
          background: #16a34a;
          color: #ffffff;
          text-decoration: none;
          font-weight: 700;
        }}
        p {{
          margin: 12px 0 0;
          color: #475569;
          line-height: 1.5;
        }}
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Оплата обрабатывается</h1>
        <p>Если платёж прошёл успешно, доступ обновится автоматически. Вернитесь в Telegram и откройте BreeLife ещё раз.</p>
        <a class="btn" href="{app_url}">Вернуться в приложение</a>
      </div>
    </body>
    </html>
    """
    return Response(content=html, media_type="text/html")
