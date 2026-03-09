from __future__ import annotations

import logging
import uuid
from typing import Any

import requests

from config import PAYMENT_PUBLIC_KEY, PAYMENT_SECRET_KEY

YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"
logger = logging.getLogger(__name__)


class YooKassaError(RuntimeError):
    pass


def _resolve_shop_id() -> str:
    return str(PAYMENT_PUBLIC_KEY or "").strip()


def _resolve_secret_key() -> str:
    return str(PAYMENT_SECRET_KEY or "").strip()


def yookassa_is_configured() -> bool:
    return bool(_resolve_shop_id() and _resolve_secret_key())


def _request(
    method: str,
    path: str,
    *,
    json_payload: dict[str, Any] | None = None,
    idempotence_key: str | None = None,
) -> dict[str, Any]:
    shop_id = _resolve_shop_id()
    secret_key = _resolve_secret_key()
    if not shop_id or not secret_key:
        raise YooKassaError("PAYMENT_CREDENTIALS_NOT_CONFIGURED")
    if not shop_id.isdigit():
        raise YooKassaError("PAYMENT_PUBLIC_KEY_MUST_BE_NUMERIC_SHOP_ID")

    headers = {"Content-Type": "application/json"}
    if idempotence_key:
        headers["Idempotence-Key"] = idempotence_key

    try:
        response = requests.request(
            method=method.upper(),
            url=f"{YOOKASSA_API_BASE}{path}",
            auth=(shop_id, secret_key),
            headers=headers,
            json=json_payload,
            timeout=20,
        )
    except requests.RequestException as exc:
        raise YooKassaError("YOOKASSA_NETWORK_ERROR") from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise YooKassaError(f"YOOKASSA_HTTP_{response.status_code}") from exc

    if response.status_code >= 400:
        error_code = payload.get("code") if isinstance(payload, dict) else None
        description = payload.get("description") if isinstance(payload, dict) else None
        parameter = payload.get("parameter") if isinstance(payload, dict) else None
        logger.warning(
            "YooKassa error: status=%s code=%s parameter=%s description=%s",
            response.status_code,
            error_code,
            parameter,
            description,
        )
        details: list[str] = [f"YOOKASSA_HTTP_{response.status_code}"]
        if isinstance(error_code, str) and error_code.strip():
            details.append(error_code.strip())
        if isinstance(parameter, str) and parameter.strip():
            details.append(f"parameter={parameter.strip()}")
        if isinstance(description, str) and description.strip():
            details.append(description.strip())
        raise YooKassaError(" | ".join(details))

    if not isinstance(payload, dict):
        raise YooKassaError("YOOKASSA_INVALID_RESPONSE")
    return payload


def create_redirect_payment(
    *,
    amount_rub: int,
    return_url: str,
    description: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    idempotence_key = str(uuid.uuid4())
    payload = _request(
        "POST",
        "/payments",
        idempotence_key=idempotence_key,
        json_payload={
            "amount": {
                "value": f"{max(0, int(amount_rub)):.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "confirmation": {
                "type": "redirect",
                "return_url": return_url,
            },
            "description": description,
            "metadata": metadata or {},
        },
    )
    payload["_idempotence_key"] = idempotence_key
    return payload


def create_embedded_payment(
    *,
    amount_rub: int,
    description: str,
    metadata: dict[str, Any] | None = None,
    save_payment_method: bool = False,
) -> dict[str, Any]:
    idempotence_key = str(uuid.uuid4())
    payload = _request(
        "POST",
        "/payments",
        idempotence_key=idempotence_key,
        json_payload={
            "amount": {
                "value": f"{max(0, int(amount_rub)):.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "confirmation": {
                "type": "embedded",
            },
            "save_payment_method": save_payment_method is True,
            "description": description,
            "metadata": metadata or {},
        },
    )
    payload["_idempotence_key"] = idempotence_key
    return payload


def create_autopay_payment(
    *,
    amount_rub: int,
    payment_method_id: str,
    description: str,
    metadata: dict[str, Any] | None = None,
    idempotence_key: str | None = None,
) -> dict[str, Any]:
    normalized_payment_method_id = str(payment_method_id or "").strip()
    if not normalized_payment_method_id:
        raise YooKassaError("PAYMENT_METHOD_ID_REQUIRED")
    request_idempotence_key = str(idempotence_key or uuid.uuid4()).strip()
    payload = _request(
        "POST",
        "/payments",
        idempotence_key=request_idempotence_key,
        json_payload={
            "amount": {
                "value": f"{max(0, int(amount_rub)):.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "payment_method_id": normalized_payment_method_id,
            "description": description,
            "metadata": metadata or {},
        },
    )
    payload["_idempotence_key"] = request_idempotence_key
    return payload


def get_payment(payment_id: str) -> dict[str, Any]:
    normalized_payment_id = str(payment_id or "").strip()
    if not normalized_payment_id:
        raise YooKassaError("PAYMENT_ID_REQUIRED")
    return _request("GET", f"/payments/{normalized_payment_id}")
