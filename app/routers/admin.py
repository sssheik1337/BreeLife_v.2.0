import secrets
import re
import unicodedata
import sqlite3
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from urllib.parse import urlparse

from fastapi import APIRouter, Form, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from config import ADMIN_LOGIN, ADMIN_PASSWORD, DB_PATH
from app.context import (
    ADMIN_SESSIONS,
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_TTL,
    load_plans_config,
    templates,
    load_admin_config,
    update_plans_config,
    update_admin_config,
)
from app.dependencies import load_profile, update_profile
from services.legal_offer import load_offer_document, publish_offer_version
from services.products_db import (
    collect_product_groups,
    load_admin_groups,
    load_admin_products,
    save_admin_groups,
    save_admin_products,
)

router = APIRouter()
ALLOWED_PAGE_SIZES = {10, 20, 50, 100}
ALLOWED_USER_SORTS = {"registered_desc", "registered_asc", "payments_desc", "payments_asc"}
MSK_TIMEZONE = timezone(timedelta(hours=3))
SUCCESS_PAYMENT_STATUSES = ("success", "succeeded", "paid")
LEGAL_VERSIONS_PAGE_SIZE = 5
LEGAL_PAGINATION_WINDOW = 5


def _slugify_plan_id(title: str) -> str:
    normalized = unicodedata.normalize("NFKD", title or "")
    ascii_title = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_title).strip("-")
    return slug or "plan"


def _generate_unique_plan_id(title: str, existing_ids: set[str]) -> str:
    base = _slugify_plan_id(title)
    candidate = base
    suffix = 2
    while candidate in existing_ids:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _coerce_price(value: object) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return max(0, int(value))
    if isinstance(value, str):
        digits = re.sub(r"\D+", "", value)
        return int(digits) if digits else 0
    return 0


def _normalize_contact_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _normalize_channel_url(value: object) -> str:
    raw = _normalize_contact_text(value)
    if not raw:
        return ""
    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return candidate


def _normalize_telegram_username(value: object) -> str:
    raw = _normalize_contact_text(value)
    if not raw:
        return ""
    candidate = raw
    lowered = candidate.lower()
    if lowered.startswith("http://") or lowered.startswith("https://"):
        parsed = urlparse(candidate)
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if host not in {"t.me", "telegram.me"}:
            return ""
        candidate = parsed.path
    elif lowered.startswith("t.me/"):
        candidate = candidate[5:]
    elif lowered.startswith("telegram.me/"):
        candidate = candidate[12:]

    candidate = candidate.strip().lstrip("@")
    if "/" in candidate:
        candidate = candidate.split("/", maxsplit=1)[0]
    if "?" in candidate:
        candidate = candidate.split("?", maxsplit=1)[0]
    if not re.fullmatch(r"[A-Za-z0-9_]+", candidate):
        return ""
    return candidate


def _extract_support_contacts(config: dict[str, object]) -> dict[str, str]:
    contacts = config.get("support_contacts")
    if not isinstance(contacts, dict):
        contacts = {}
    normalized_username = _normalize_telegram_username(contacts.get("username"))
    username = f"@{normalized_username}" if normalized_username else ""
    username_url = f"https://t.me/{normalized_username}" if normalized_username else ""
    return {
        "phone": _normalize_contact_text(contacts.get("phone")),
        "email": _normalize_contact_text(contacts.get("email")),
        "username": username,
        "username_url": username_url,
        "channel_url": _normalize_channel_url(contacts.get("channel_url")),
    }


def _normalize_commercial_plans(plans: object) -> list[dict[str, object]]:
    if not isinstance(plans, list):
        return []

    normalized: list[dict[str, object]] = []
    for plan in plans:
        if not isinstance(plan, dict):
            continue
        plan_id = str(plan.get("id", "")).strip().lower()
        title = str(plan.get("title", "")).strip()
        if not plan_id or not title or plan_id == "trial":
            continue
        normalized.append(
            {
                "id": plan_id,
                "title": title,
                "duration_days": int(plan.get("duration_days", 0) or 0),
                "price_current": _coerce_price(plan.get("price_current")),
                "price_old": _coerce_price(plan.get("price_old")),
                "price_old_enabled": bool(plan.get("price_old_enabled", False)),
            }
        )
    return normalized


def is_admin_authenticated(request: Request) -> bool:
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    if not token:
        return False
    expires_at = ADMIN_SESSIONS.get(token)
    if not expires_at:
        return False
    if datetime.now(timezone.utc) >= expires_at:
        ADMIN_SESSIONS.pop(token, None)
        return False
    return True


def verify_admin_credentials(login: str, password: str) -> bool:
    if not ADMIN_LOGIN or not ADMIN_PASSWORD:
        return False
    login_ok = secrets.compare_digest(login, ADMIN_LOGIN)
    password_ok = secrets.compare_digest(password, ADMIN_PASSWORD)
    return login_ok and password_ok


def render_admin_index(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "admin_index.html",
        {
            "request": request,
            "error": error,
            "success": success,
        },
    )


def render_admin_products(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    products = load_admin_products()
    groups = collect_product_groups(products, load_admin_groups())
    default_group = "Без группы"
    grouped_products: dict[str, list[dict[str, object]]] = {group: [] for group in groups}
    for product in products:
        group_value = product.get("group")
        normalized_group = group_value.strip() if isinstance(group_value, str) else ""
        group_key = normalized_group or default_group
        if group_key not in grouped_products:
            grouped_products[group_key] = []
        grouped_products[group_key].append(product)
    ordered_groups = sorted(
        grouped_products.keys(),
        key=lambda value: (value == default_group, value.lower()),
    )
    grouped_list = [
        {"name": group_name, "products": grouped_products[group_name]}
        for group_name in ordered_groups
    ]
    return templates.TemplateResponse(
        "admin_products.html",
        {
            "request": request,
            "products": products,
            "groups": groups,
            "grouped_products": grouped_list,
            "error": error,
            "success": success,
        },
    )


def render_admin_groups(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    groups = load_admin_groups()
    return templates.TemplateResponse(
        "admin_groups.html",
        {
            "request": request,
            "groups": sorted(groups),
            "error": error,
            "success": success,
        },
    )


def render_admin_norms(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    config = load_admin_config()
    norms = config.get("norms") if isinstance(config, dict) else {}
    if not isinstance(norms, dict):
        norms = {}
    trial_days = int(config.get("trial_days", 30))
    return templates.TemplateResponse(
        "admin_norms.html",
        {
            "request": request,
            "norms": {
                "water_l": norms.get("water_l", 2),
                "sleep_hours": norms.get("sleep_hours", 8),
                "fiber_g": norms.get("fiber_g", 25),
            },
            "trial_days": trial_days,
            "error": error,
            "success": success,
        },
    )


def render_admin_plans(
    request: Request,
    error: str | None = None,
    success: str | None = None,
) -> HTMLResponse:
    config = load_admin_config()
    trial_days = int(config.get("trial_days", 30))
    support_contacts = _extract_support_contacts(config if isinstance(config, dict) else {})
    normalized_plans = _normalize_commercial_plans(load_plans_config())
    return templates.TemplateResponse(
        "admin_plans.html",
        {
            "request": request,
            "plans": normalized_plans,
            "trial_days": trial_days,
            "support_contacts": support_contacts,
            "error": error,
            "success": success,
        },
    )


def render_admin_legal(
    request: Request,
    error: str | None = None,
    success: str | None = None,
    form_data: dict[str, str] | None = None,
    source_version: int | None = None,
    clear_editor: bool = False,
    preview_payload: dict[str, str] | None = None,
    page: int = 1,
) -> HTMLResponse:
    document = load_offer_document()
    raw_versions = document.get("versions") if isinstance(document.get("versions"), list) else []
    versions: list[dict[str, object]] = []
    for item in raw_versions:
        if not isinstance(item, dict):
            continue
        prepared = dict(item)
        prepared["published_at_display"] = _format_datetime(item.get("published_at"))
        versions.append(prepared)
    total_versions = len(versions)
    total_pages = max(1, (total_versions + LEGAL_VERSIONS_PAGE_SIZE - 1) // LEGAL_VERSIONS_PAGE_SIZE)
    current_page = min(max(1, int(page or 1)), total_pages)
    start_idx = (current_page - 1) * LEGAL_VERSIONS_PAGE_SIZE
    end_idx = start_idx + LEGAL_VERSIONS_PAGE_SIZE
    versions_page = versions[start_idx:end_idx]
    page_window_index = (current_page - 1) // LEGAL_PAGINATION_WINDOW
    page_window_start = page_window_index * LEGAL_PAGINATION_WINDOW + 1
    page_window_end = min(total_pages, page_window_start + LEGAL_PAGINATION_WINDOW - 1)
    selected_version = next(
        (
            item for item in versions
            if isinstance(item, dict) and int(item.get("version") or 0) == int(source_version or 0)
        ),
        None,
    )
    current_offer_raw = document.get("current_offer") if isinstance(document.get("current_offer"), dict) else None
    current_offer = dict(current_offer_raw) if isinstance(current_offer_raw, dict) else None
    if isinstance(current_offer, dict):
        current_offer["published_at_display"] = _format_datetime(current_offer.get("published_at"))

    if isinstance(form_data, dict):
        editor_source = form_data
    elif clear_editor:
        editor_source = {
            "title": "",
            "summary": "",
            "body_markdown": "",
        }
    elif isinstance(selected_version, dict):
        editor_source = {
            "title": str(selected_version.get("title") or "").strip(),
            "summary": str(selected_version.get("summary") or "").strip(),
            "body_markdown": str(selected_version.get("body_markdown") or "").strip(),
        }
    else:
        editor_source = {
            "title": "",
            "summary": "",
            "body_markdown": "",
        }
    return templates.TemplateResponse(
        "admin_legal.html",
        {
            "request": request,
            "offer_document": document,
            "versions": versions_page,
            "current_offer": current_offer,
            "editor_source": editor_source,
            "preview_payload": preview_payload,
            "source_version": source_version,
            "current_page": current_page,
            "total_pages": total_pages,
            "page_numbers": list(range(page_window_start, page_window_end + 1)),
            "error": error,
            "success": success,
        },
    )


def _parse_iso_datetime(raw_value: object) -> datetime | None:
    if not isinstance(raw_value, str):
        return None
    normalized = raw_value.strip()
    if not normalized:
        return None
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _format_datetime(raw_value: object) -> str:
    parsed = _parse_iso_datetime(raw_value)
    if parsed is None:
        return "—"
    return parsed.astimezone(MSK_TIMEZONE).strftime("%Y-%m-%d %H:%M МСК")


def _translate_payment_status(raw_status: object, meta_payload: dict[str, object] | None = None) -> str:
    status = str(raw_status or "").strip().lower()
    if not status and isinstance(meta_payload, dict):
        status = str(meta_payload.get("provider_status") or "").strip().lower()

    mapping = {
        "pending": "Ожидает оплаты",
        "processing": "В обработке",
        "waiting_for_capture": "Ожидает подтверждения",
        "succeeded": "Успешно",
        "success": "Успешно",
        "paid": "Оплачено",
        "canceled": "Отменён",
        "cancelled": "Отменён",
        "failed": "Ошибка",
        "refunded": "Возврат",
        "partially_refunded": "Частичный возврат",
    }
    return mapping.get(status, str(raw_status or "—"))


def _is_success_payment_status(raw_status: object) -> bool:
    return str(raw_status or "").strip().lower() in SUCCESS_PAYMENT_STATUSES


def _extract_profile_value(profile: dict[str, object], key: str) -> str:
    direct = profile.get(key)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    nested = profile.get("subscription")
    if isinstance(nested, dict):
        nested_value = nested.get(key)
        if isinstance(nested_value, str) and nested_value.strip():
            return nested_value.strip()
    return ""


def _is_subscription_active_paid(subscription_status: str, subscription_until_raw: str, now_utc: datetime) -> bool:
    if subscription_status == "lifetime":
        return True
    if subscription_status != "paid":
        return False
    until_dt = _parse_iso_datetime(subscription_until_raw)
    if until_dt is None:
        return False
    return until_dt > now_utc


def _normalize_page_size(page_size: int) -> int:
    if page_size in ALLOWED_PAGE_SIZES:
        return page_size
    return 20


def _parse_optional_int(raw_value: str | None) -> int | None:
    if raw_value is None:
        return None
    value = raw_value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _monitor_payload(trial_days: int) -> dict[str, object]:
    now_utc = datetime.now(timezone.utc)
    trial_delta = timedelta(days=max(0, int(trial_days)))

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        total_users = int(connection.execute("SELECT COUNT(1) FROM telegram_users").fetchone()[0])
        paid_ever_users = int(
            connection.execute(
                """
                SELECT COUNT(DISTINCT telegram_user_id)
                FROM payments
                WHERE lower(status) IN ('success', 'succeeded', 'paid')
                """
            ).fetchone()[0]
        )
        revenue_30d_raw = connection.execute(
            """
            SELECT COALESCE(SUM(amount_rub), 0)
            FROM payments
            WHERE lower(status) IN ('success', 'succeeded', 'paid')
              AND created_at >= ?
            """,
            ((now_utc - timedelta(days=30)).isoformat(),),
        ).fetchone()[0]
        revenue_30d = int(revenue_30d_raw or 0)
        recent_payment_rows = connection.execute(
            """
            SELECT
                p.id,
                p.telegram_user_id,
                p.created_at,
                p.amount_rub,
                p.duration_days,
                p.status,
                COALESCE(u.username, '') AS username,
                COALESCE(u.first_name, '') AS first_name,
                COALESCE(u.last_name, '') AS last_name
            FROM payments p
            LEFT JOIN telegram_users u ON u.telegram_user_id = p.telegram_user_id
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT 10
            """
        ).fetchall()
        profile_rows = connection.execute("SELECT telegram_user_id, data FROM profiles").fetchall()

    active_paid_subscriptions = 0
    trial_active_users = 0
    for row in profile_rows:
        try:
            payload = json.loads(row["data"] or "{}")
        except (TypeError, json.JSONDecodeError):
            payload = {}
        if not isinstance(payload, dict):
            payload = {}

        subscription_status = _extract_profile_value(payload, "subscription_status").lower()
        subscription_until_raw = _extract_profile_value(payload, "subscription_until")
        if _is_subscription_active_paid(subscription_status, subscription_until_raw, now_utc):
            active_paid_subscriptions += 1

        trial_started_raw = (
            _extract_profile_value(payload, "trial_started_at")
            or _extract_profile_value(payload, "subscription_started_at")
        )
        trial_started_dt = _parse_iso_datetime(trial_started_raw)
        if trial_started_dt is not None and (trial_started_dt + trial_delta) > now_utc:
            trial_active_users += 1
            continue

        if subscription_status == "trial":
            until_dt = _parse_iso_datetime(subscription_until_raw)
            if until_dt is not None and until_dt > now_utc:
                trial_active_users += 1

    recent_payments = [
        {
            "id": int(row["id"]),
            "telegram_user_id": int(row["telegram_user_id"]),
            "created_at_display": _format_datetime(row["created_at"]),
            "amount_rub": int(row["amount_rub"] or 0),
            "duration_days": int(row["duration_days"] or 0),
            "status": str(row["status"] or ""),
            "username": str(row["username"] or ""),
            "first_name": str(row["first_name"] or ""),
            "last_name": str(row["last_name"] or ""),
        }
        for row in recent_payment_rows
    ]

    return {
        "total_users": total_users,
        "active_paid_subscriptions": active_paid_subscriptions,
        "trial_active_users": trial_active_users,
        "paid_ever_users": paid_ever_users,
        "revenue_30d": revenue_30d,
        "recent_payments": recent_payments,
    }


def _query_admin_users_page(
    q: str | None,
    registered_from: str | None,
    registered_to: str | None,
    has_active_subscription: int | None,
    payments_min: int | None,
    payments_max: int | None,
    sort: str,
    page: int,
    page_size: int,
    trial_days: int,
) -> dict[str, object]:
    safe_page = max(1, page)
    safe_page_size = _normalize_page_size(page_size)
    normalized_sort = sort if sort in ALLOWED_USER_SORTS else "registered_desc"
    now_iso = datetime.now(timezone.utc).isoformat()
    now_utc = datetime.now(timezone.utc)
    trial_delta = timedelta(days=max(0, int(trial_days)))

    base_sql = """
        WITH payments_stats AS (
            SELECT
                telegram_user_id,
                SUM(CASE WHEN lower(status) IN ('success', 'succeeded', 'paid') THEN 1 ELSE 0 END) AS payments_count
            FROM payments
            GROUP BY telegram_user_id
        ),
        registration AS (
            SELECT telegram_user_id, MIN(created_at) AS registered_at
            FROM sessions
            GROUP BY telegram_user_id
        ),
        base AS (
            SELECT
                u.telegram_user_id,
                COALESCE(u.username, '') AS username,
                COALESCE(u.first_name, '') AS first_name,
                COALESCE(u.last_name, '') AS last_name,
                COALESCE(r.registered_at, u.updated_at, p.updated_at) AS registered_at,
                COALESCE(ps.payments_count, 0) AS payments_count,
                COALESCE(
                    json_extract(p.data, '$.trial_started_at'),
                    json_extract(p.data, '$.subscription.trial_started_at'),
                    json_extract(p.data, '$.subscription_started_at'),
                    json_extract(p.data, '$.subscription.subscription_started_at'),
                    json_extract(p.data, '$.subscription.started_at'),
                    ''
                ) AS trial_started_at,
                COALESCE(json_extract(p.data, '$.subscription_until'), json_extract(p.data, '$.subscription.subscription_until'), '') AS subscription_until,
                lower(
                    COALESCE(
                        json_extract(p.data, '$.subscription_status'),
                        json_extract(p.data, '$.subscription.subscription_status'),
                        json_extract(p.data, '$.subscription.status'),
                        ''
                    )
                ) AS subscription_status
            FROM telegram_users u
            LEFT JOIN registration r ON r.telegram_user_id = u.telegram_user_id
            LEFT JOIN profiles p ON p.telegram_user_id = u.telegram_user_id
            LEFT JOIN payments_stats ps ON ps.telegram_user_id = u.telegram_user_id
        )
        SELECT
            telegram_user_id,
            username,
            first_name,
            last_name,
            registered_at,
            payments_count,
            trial_started_at,
            subscription_until,
            subscription_status
        FROM base
        WHERE 1 = 1
    """

    where_parts: list[str] = []
    params: list[object] = []

    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        where_parts.append(
            "AND (lower(username) LIKE ? OR lower(first_name) LIKE ? OR lower(last_name) LIKE ? OR CAST(telegram_user_id AS TEXT) LIKE ?)"
        )
        params.extend([like, like, like, like])

    if registered_from and registered_from.strip():
        where_parts.append("AND date(registered_at) >= date(?)")
        params.append(registered_from.strip())

    if registered_to and registered_to.strip():
        where_parts.append("AND date(registered_at) <= date(?)")
        params.append(registered_to.strip())

    if payments_min is not None:
        where_parts.append("AND payments_count >= ?")
        params.append(max(0, int(payments_min)))

    if payments_max is not None:
        where_parts.append("AND payments_count <= ?")
        params.append(max(0, int(payments_max)))

    if has_active_subscription in (0, 1):
        active_expr = "((subscription_status = 'paid' AND subscription_until > ?) OR subscription_status = 'lifetime')"
        if has_active_subscription == 1:
            where_parts.append(f"AND {active_expr}")
        else:
            where_parts.append(f"AND NOT {active_expr}")
        params.append(now_iso)

    sort_clause = {
        "registered_desc": "ORDER BY (registered_at IS NULL) ASC, registered_at DESC, telegram_user_id DESC",
        "registered_asc": "ORDER BY (registered_at IS NULL) ASC, registered_at ASC, telegram_user_id ASC",
        "payments_desc": "ORDER BY payments_count DESC, (registered_at IS NULL) ASC, registered_at DESC",
        "payments_asc": "ORDER BY payments_count ASC, (registered_at IS NULL) ASC, registered_at DESC",
    }[normalized_sort]

    where_sql = " ".join(where_parts)
    count_sql = f"SELECT COUNT(1) FROM ({base_sql} {where_sql}) AS filtered_users"

    offset = (safe_page - 1) * safe_page_size
    rows_sql = f"{base_sql} {where_sql} {sort_clause} LIMIT ? OFFSET ?"
    rows_params = [*params, safe_page_size, offset]

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        total = int(connection.execute(count_sql, params).fetchone()[0])
        rows_raw = connection.execute(rows_sql, rows_params).fetchall()

    total_pages = max(1, (total + safe_page_size - 1) // safe_page_size)
    safe_page = min(safe_page, total_pages)
    if safe_page != page:
        offset = (safe_page - 1) * safe_page_size
        rows_params = [*params, safe_page_size, offset]
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            rows_raw = connection.execute(rows_sql, rows_params).fetchall()

    rows: list[dict[str, object]] = []
    for row in rows_raw:
        trial_started_raw = str(row["trial_started_at"] or "").strip()
        trial_started_dt = _parse_iso_datetime(trial_started_raw)
        trial_until_dt = (trial_started_dt + trial_delta) if trial_started_dt is not None else None

        subscription_status = str(row["subscription_status"] or "").lower().strip()
        subscription_until_raw = str(row["subscription_until"] or "").strip()
        subscription_active = _is_subscription_active_paid(subscription_status, subscription_until_raw, now_utc)

        rows.append(
            {
                "telegram_id": int(row["telegram_user_id"]),
                "username": str(row["username"] or ""),
                "first_name": str(row["first_name"] or ""),
                "last_name": str(row["last_name"] or ""),
                "registered_at_display": _format_datetime(row["registered_at"]),
                "trial_until_display": _format_datetime(trial_until_dt.isoformat() if trial_until_dt else None),
                "payments_count": int(row["payments_count"] or 0),
                "subscription_active": subscription_active,
            }
        )

    start_page = max(1, safe_page - 2)
    end_page = min(total_pages, safe_page + 2)
    page_numbers = list(range(start_page, end_page + 1))

    return {
        "rows": rows,
        "pagination": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "total_pages": total_pages,
            "has_prev": safe_page > 1,
            "has_next": safe_page < total_pages,
            "prev_page": safe_page - 1,
            "next_page": safe_page + 1,
            "page_numbers": page_numbers,
        },
        "filters": {
            "q": q or "",
            "registered_from": registered_from or "",
            "registered_to": registered_to or "",
            "has_active_subscription": "" if has_active_subscription is None else str(has_active_subscription),
            "payments_min": "" if payments_min is None else str(max(0, int(payments_min))),
            "payments_max": "" if payments_max is None else str(max(0, int(payments_max))),
            "sort": normalized_sort,
            "page_size": safe_page_size,
        },
        "allowed_page_sizes": sorted(ALLOWED_PAGE_SIZES),
    }


def _load_admin_user_detail(telegram_user_id: int, trial_days: int) -> dict[str, object] | None:
    trial_delta = timedelta(days=max(0, int(trial_days)))
    now_utc = datetime.now(timezone.utc)

    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        user_row = connection.execute(
            """
            SELECT
                u.telegram_user_id,
                COALESCE(u.username, '') AS username,
                COALESCE(u.first_name, '') AS first_name,
                COALESCE(u.last_name, '') AS last_name,
                COALESCE(r.registered_at, u.updated_at, p.updated_at) AS registered_at,
                COALESCE(
                    json_extract(p.data, '$.trial_started_at'),
                    json_extract(p.data, '$.subscription.trial_started_at'),
                    json_extract(p.data, '$.subscription_started_at'),
                    json_extract(p.data, '$.subscription.subscription_started_at'),
                    json_extract(p.data, '$.subscription.started_at'),
                    ''
                ) AS trial_started_at,
                COALESCE(json_extract(p.data, '$.subscription_until'), json_extract(p.data, '$.subscription.subscription_until'), '') AS subscription_until,
                lower(
                    COALESCE(
                        json_extract(p.data, '$.subscription_status'),
                        json_extract(p.data, '$.subscription.subscription_status'),
                        json_extract(p.data, '$.subscription.status'),
                        ''
                    )
                ) AS subscription_status
            FROM telegram_users u
            LEFT JOIN (
                SELECT telegram_user_id, MIN(created_at) AS registered_at
                FROM sessions
                GROUP BY telegram_user_id
            ) r ON r.telegram_user_id = u.telegram_user_id
            LEFT JOIN profiles p ON p.telegram_user_id = u.telegram_user_id
            WHERE u.telegram_user_id = ?
            LIMIT 1
            """,
            (telegram_user_id,),
        ).fetchone()
        if user_row is None:
            return None

        payment_rows = connection.execute(
            """
            SELECT id, created_at, amount_rub, duration_days, status, meta_json
            FROM payments
            WHERE telegram_user_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (telegram_user_id,),
        ).fetchall()

    trial_started_dt = _parse_iso_datetime(user_row["trial_started_at"])
    trial_until_dt = (trial_started_dt + trial_delta) if trial_started_dt is not None else None
    subscription_status = str(user_row["subscription_status"] or "").lower().strip()
    subscription_until_raw = str(user_row["subscription_until"] or "").strip()
    subscription_active = _is_subscription_active_paid(subscription_status, subscription_until_raw, now_utc)

    payments: list[dict[str, object]] = []
    successful_payments_count = 0
    for row in payment_rows:
        raw_meta = row["meta_json"]
        pretty_meta = ""
        meta_payload: dict[str, object] | None = None
        if isinstance(raw_meta, str) and raw_meta.strip():
            try:
                parsed_meta = json.loads(raw_meta)
                if isinstance(parsed_meta, dict):
                    meta_payload = parsed_meta
                pretty_meta = json.dumps(parsed_meta, ensure_ascii=False, indent=2)
            except (TypeError, json.JSONDecodeError):
                pretty_meta = raw_meta.strip()
        if _is_success_payment_status(row["status"]):
            successful_payments_count += 1
        payments.append(
            {
                "id": int(row["id"]),
                "created_at_display": _format_datetime(row["created_at"]),
                "amount_rub": int(row["amount_rub"] or 0),
                "duration_days": int(row["duration_days"] or 0),
                "status": _translate_payment_status(row["status"], meta_payload),
                "meta_json_pretty": pretty_meta,
            }
        )

    return {
        "telegram_id": int(user_row["telegram_user_id"]),
        "username": str(user_row["username"] or ""),
        "first_name": str(user_row["first_name"] or ""),
        "last_name": str(user_row["last_name"] or ""),
        "registered_at_display": _format_datetime(user_row["registered_at"]),
        "trial_until_display": _format_datetime(trial_until_dt.isoformat() if trial_until_dt else None),
        "trial_until_input": trial_until_dt.astimezone(MSK_TIMEZONE).strftime("%Y-%m-%d") if trial_until_dt else "",
        "subscription_status": subscription_status or "inactive",
        "subscription_until_display": "Без ограничения" if subscription_status == "lifetime" else _format_datetime(subscription_until_raw),
        "subscription_active": subscription_active,
        "payments_count": successful_payments_count,
        "payments": payments,
    }


def render_admin_user_detail(
    request: Request,
    telegram_user_id: int,
    error: str | None = None,
    success: str | None = None,
    reset_confirmation_value: str = "",
    lifetime_confirmation_value: str = "",
    trial_confirmation_value: str = "",
    trial_until_value: str = "",
) -> HTMLResponse:
    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    user_payload = _load_admin_user_detail(telegram_user_id, trial_days)
    if user_payload is None:
        return RedirectResponse(url="/admin/users", status_code=303)
    return templates.TemplateResponse(
        "admin_user_detail.html",
        {
            "request": request,
            "user": user_payload,
            "error": error,
            "success": success,
            "reset_confirmation_value": reset_confirmation_value,
            "lifetime_confirmation_value": lifetime_confirmation_value,
            "trial_confirmation_value": trial_confirmation_value,
            "trial_until_value": trial_until_value or str(user_payload.get("trial_until_input") or ""),
        },
    )


def _expire_trial_for_user(telegram_user_id: int, trial_days: int) -> None:
    now_utc = datetime.now(timezone.utc)
    expired_at = now_utc - timedelta(minutes=1)
    trial_started_at = expired_at - timedelta(days=max(0, trial_days))

    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    subscription_payload = updated.get("subscription") if isinstance(updated.get("subscription"), dict) else {}
    updated_subscription = dict(subscription_payload)
    updated_subscription.update(
        {
            "subscription_started_at": trial_started_at.isoformat(),
            "trial_started_at": trial_started_at.isoformat(),
            "subscription_until": expired_at.isoformat(),
            "subscription_status": "expired",
        }
    )

    updated["subscription"] = updated_subscription
    updated["subscription_started_at"] = trial_started_at.isoformat()
    updated["trial_started_at"] = trial_started_at.isoformat()
    updated["subscription_until"] = expired_at.isoformat()
    updated["subscription_status"] = "expired"
    update_profile(telegram_user_id, updated)


def _grant_lifetime_access_for_user(telegram_user_id: int) -> None:
    now_utc = datetime.now(timezone.utc)
    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    subscription_payload = updated.get("subscription") if isinstance(updated.get("subscription"), dict) else {}
    updated_subscription = dict(subscription_payload)
    updated_subscription.update(
        {
            "subscription_started_at": now_utc.isoformat(),
            "subscription_until": None,
            "subscription_status": "lifetime",
        }
    )

    existing_trial_started_at = updated.get("trial_started_at")
    if not isinstance(existing_trial_started_at, str) or not existing_trial_started_at.strip():
        existing_trial_started_at = now_utc.isoformat()
        updated_subscription["trial_started_at"] = existing_trial_started_at

    updated["subscription"] = updated_subscription
    updated["subscription_started_at"] = now_utc.isoformat()
    updated["subscription_until"] = None
    updated["subscription_status"] = "lifetime"
    updated["trial_started_at"] = existing_trial_started_at
    update_profile(telegram_user_id, updated)


def _set_trial_until_for_user(telegram_user_id: int, trial_until_raw: str, trial_days: int) -> tuple[str, str]:
    normalized = str(trial_until_raw or "").strip()
    if not normalized:
        raise ValueError("DATE_REQUIRED")

    try:
        until_local = datetime.fromisoformat(f"{normalized}T23:59:59+03:00")
    except ValueError as exc:
        raise ValueError("DATE_INVALID") from exc

    until_utc = until_local.astimezone(timezone.utc)
    trial_started_at = until_utc - timedelta(days=max(0, int(trial_days)))
    now_utc = datetime.now(timezone.utc)
    subscription_status = "trial" if until_utc > now_utc else "expired"

    profile = load_profile(telegram_user_id)
    updated = dict(profile)
    subscription_payload = updated.get("subscription") if isinstance(updated.get("subscription"), dict) else {}
    updated_subscription = dict(subscription_payload)
    updated_subscription.update(
        {
            "subscription_started_at": trial_started_at.isoformat(),
            "trial_started_at": trial_started_at.isoformat(),
            "subscription_until": until_utc.isoformat(),
            "subscription_status": subscription_status,
        }
    )

    updated["subscription"] = updated_subscription
    updated["subscription_started_at"] = trial_started_at.isoformat()
    updated["trial_started_at"] = trial_started_at.isoformat()
    updated["subscription_until"] = until_utc.isoformat()
    updated["subscription_status"] = subscription_status
    update_profile(telegram_user_id, updated)

    return subscription_status, until_local.strftime("%Y-%m-%d 23:59 МСК")

@router.get("/admin", response_class=HTMLResponse)
async def admin(request: Request):
    if not is_admin_authenticated(request):
        return templates.TemplateResponse(
            "admin_login.html",
            {"request": request, "error": None},
        )
    return render_admin_index(request)


@router.get("/admin/products", response_class=HTMLResponse)
async def admin_products(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return render_admin_products(request)


@router.get("/admin/groups", response_class=HTMLResponse)
async def admin_groups(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return render_admin_groups(request)


@router.get("/admin/norms", response_class=HTMLResponse)
async def admin_norms(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return RedirectResponse(url="/admin/plans", status_code=303)


@router.get("/admin/plans", response_class=HTMLResponse)
async def admin_plans(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return render_admin_plans(request)


@router.get("/admin/legal", response_class=HTMLResponse)
async def admin_legal(
    request: Request,
    source_version: int | None = Query(default=None),
    clear_editor: bool = Query(default=False),
    page: int = Query(default=1),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return render_admin_legal(
        request,
        source_version=None if clear_editor else source_version,
        clear_editor=clear_editor,
        page=page,
    )


@router.get("/admin/monitor", response_class=HTMLResponse)
async def admin_monitor(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    monitor = _monitor_payload(trial_days)
    return templates.TemplateResponse(
        "admin_monitor.html",
        {
            "request": request,
            "monitor": monitor,
            "trial_days": trial_days,
            "error": None,
            "success": None,
        },
    )


@router.get("/admin/users", response_class=HTMLResponse)
async def admin_users(
    request: Request,
    q: str | None = Query(default=None),
    registered_from: str | None = Query(default=None),
    registered_to: str | None = Query(default=None),
    has_active_subscription_raw: str | None = Query(default=None, alias="has_active_subscription"),
    payments_min_raw: str | None = Query(default=None, alias="payments_min"),
    payments_max_raw: str | None = Query(default=None, alias="payments_max"),
    sort: str = Query(default="registered_desc"),
    page: int = Query(default=1),
    page_size: int = Query(default=20),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    has_active_subscription = _parse_optional_int(has_active_subscription_raw)
    payments_min = _parse_optional_int(payments_min_raw)
    payments_max = _parse_optional_int(payments_max_raw)
    payload = _query_admin_users_page(
        q=q,
        registered_from=registered_from,
        registered_to=registered_to,
        has_active_subscription=has_active_subscription,
        payments_min=payments_min,
        payments_max=payments_max,
        sort=sort,
        page=page,
        page_size=page_size,
        trial_days=trial_days,
    )
    return templates.TemplateResponse(
        "admin_users.html",
        {
            "request": request,
            "rows": payload["rows"],
            "pagination": payload["pagination"],
            "filters": payload["filters"],
            "allowed_page_sizes": payload["allowed_page_sizes"],
            "query_without_page": urlencode(
                {
                    "q": str(payload["filters"]["q"]),
                    "registered_from": str(payload["filters"]["registered_from"]),
                    "registered_to": str(payload["filters"]["registered_to"]),
                    "has_active_subscription": str(payload["filters"]["has_active_subscription"]),
                    "payments_min": str(payload["filters"]["payments_min"]),
                    "payments_max": str(payload["filters"]["payments_max"]),
                    "sort": str(payload["filters"]["sort"]),
                    "page_size": str(payload["filters"]["page_size"]),
                }
            ),
            "error": None,
            "success": None,
        },
    )


@router.get("/admin/users/{telegram_user_id}", response_class=HTMLResponse)
async def admin_user_detail(request: Request, telegram_user_id: int):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return render_admin_user_detail(request, telegram_user_id)


@router.post("/admin/users/{telegram_user_id}/reset-trial", response_class=HTMLResponse)
async def admin_user_reset_trial(
    request: Request,
    telegram_user_id: int,
    confirmation_value: str = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    expected_value = str(telegram_user_id)
    normalized_confirmation = confirmation_value.strip()
    if normalized_confirmation != expected_value:
        return render_admin_user_detail(
            request,
            telegram_user_id,
            error=f"Введите {expected_value} чтобы подтвердить обнуление.",
            reset_confirmation_value=normalized_confirmation,
        )

    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    if _load_admin_user_detail(telegram_user_id, trial_days) is None:
        return RedirectResponse(url="/admin/users", status_code=303)

    _expire_trial_for_user(telegram_user_id, trial_days)
    return render_admin_user_detail(
        request,
        telegram_user_id,
        success="Пробный период обнулён. Пользователь переведён в состояние истёкшего trial.",
    )


@router.post("/admin/users/{telegram_user_id}/grant-lifetime", response_class=HTMLResponse)
async def admin_user_grant_lifetime(
    request: Request,
    telegram_user_id: int,
    confirmation_value: str = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    expected_value = str(telegram_user_id)
    normalized_confirmation = confirmation_value.strip()
    if normalized_confirmation != expected_value:
        return render_admin_user_detail(
            request,
            telegram_user_id,
            error=f"Введите {expected_value} чтобы подтвердить выдачу супердоступа.",
            lifetime_confirmation_value=normalized_confirmation,
        )

    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    if _load_admin_user_detail(telegram_user_id, trial_days) is None:
        return RedirectResponse(url="/admin/users", status_code=303)

    _grant_lifetime_access_for_user(telegram_user_id)
    return render_admin_user_detail(
        request,
        telegram_user_id,
        success="Супердоступ выдан. Пользователь получил бессрочный доступ к приложению.",
    )


@router.post("/admin/users/{telegram_user_id}/set-trial-until", response_class=HTMLResponse)
async def admin_user_set_trial_until(
    request: Request,
    telegram_user_id: int,
    confirmation_value: str = Form(...),
    trial_until_date: str = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    expected_value = str(telegram_user_id)
    normalized_confirmation = confirmation_value.strip()
    normalized_trial_until = trial_until_date.strip()
    if normalized_confirmation != expected_value:
        return render_admin_user_detail(
            request,
            telegram_user_id,
            error=f"Введите {expected_value} чтобы подтвердить установку срока trial.",
            trial_confirmation_value=normalized_confirmation,
            trial_until_value=normalized_trial_until,
        )

    admin_config = load_admin_config()
    trial_days = int(admin_config.get("trial_days", 30))
    if _load_admin_user_detail(telegram_user_id, trial_days) is None:
        return RedirectResponse(url="/admin/users", status_code=303)

    try:
        status, until_display = _set_trial_until_for_user(telegram_user_id, normalized_trial_until, trial_days)
    except ValueError as exc:
        detail = str(exc)
        if detail == "DATE_REQUIRED":
            error_message = "Укажите дату окончания trial."
        else:
            error_message = "Неверный формат даты trial."
        return render_admin_user_detail(
            request,
            telegram_user_id,
            error=error_message,
            trial_confirmation_value=normalized_confirmation,
            trial_until_value=normalized_trial_until,
        )

    status_text = "активного trial" if status == "trial" else "истёкшего trial"
    return render_admin_user_detail(
        request,
        telegram_user_id,
        success=f"Срок trial установлен до {until_display}. Пользователь переведён в состояние {status_text}.",
        trial_until_value=normalized_trial_until,
    )


@router.post("/admin/login", response_class=HTMLResponse)
async def admin_login(request: Request, login: str = Form(...), password: str = Form(...)):
    if not verify_admin_credentials(login, password):
        return templates.TemplateResponse(
            "admin_login.html",
            {"request": request, "error": "Неверный логин или пароль."},
        )
    token = secrets.token_urlsafe(32)
    ADMIN_SESSIONS[token] = datetime.now(timezone.utc) + ADMIN_SESSION_TTL
    response = RedirectResponse(url="/admin", status_code=303)
    response.set_cookie(
        ADMIN_SESSION_COOKIE,
        token,
        httponly=True,
        max_age=int(ADMIN_SESSION_TTL.total_seconds()),
        samesite="lax",
    )
    return response


@router.post("/admin/logout")
async def admin_logout(request: Request):
    token = request.cookies.get(ADMIN_SESSION_COOKIE)
    if token:
        ADMIN_SESSIONS.pop(token, None)
    response = RedirectResponse(url="/admin", status_code=303)
    response.delete_cookie(ADMIN_SESSION_COOKIE)
    return response


@router.post("/admin/products/add", response_class=HTMLResponse)
async def admin_products_add(
    request: Request,
    name: str = Form(...),
    group: str = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
    kcal = max(0, round(protein_g * 4 + fat_g * 9 + carbs_g * 4))
    products = load_admin_products()
    next_id = max((item.get("id", 0) for item in products if isinstance(item.get("id"), int)), default=0) + 1
    products.append(
        {
            "id": next_id,
            "name": name.strip(),
            "group": group.strip(),
            "kcal": kcal,
            "protein_g": protein_g,
            "fat_g": fat_g,
            "carbs_g": carbs_g,
            "carbs_simple_g": carbs_simple_g,
            "carbs_complex_g": carbs_complex_g,
            "fiber_g": fiber_g,
            "tags": [],
            "health_level": "neutral",
        }
    )
    save_admin_products(products)
    normalized_group = group.strip()
    if normalized_group:
        groups = load_admin_groups()
        if normalized_group not in groups:
            groups.append(normalized_group)
            save_admin_groups(sorted(groups))
    return render_admin_products(request, success="Продукт добавлен.")


@router.post("/admin/products/update", response_class=HTMLResponse)
async def admin_products_update(
    request: Request,
    product_id: int = Form(...),
    name: str = Form(...),
    group: str = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
    kcal = max(0, round(protein_g * 4 + fat_g * 9 + carbs_g * 4))
    products = load_admin_products()
    updated = False
    for item in products:
        if item.get("id") == product_id:
            item["name"] = name.strip()
            item["group"] = group.strip()
            item["kcal"] = kcal
            item["protein_g"] = protein_g
            item["fat_g"] = fat_g
            item["carbs_g"] = carbs_g
            item["carbs_simple_g"] = carbs_simple_g
            item["carbs_complex_g"] = carbs_complex_g
            item["fiber_g"] = fiber_g
            updated = True
            break
    if not updated:
        return render_admin_products(request, error="Продукт не найден.")
    save_admin_products(products)
    normalized_group = group.strip()
    if normalized_group:
        groups = load_admin_groups()
        if normalized_group not in groups:
            groups.append(normalized_group)
            save_admin_groups(sorted(groups))
    return render_admin_products(request, success="Продукт обновлён.")


@router.post("/admin/products/delete", response_class=HTMLResponse)
async def admin_products_delete(request: Request, product_id: int = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    products = load_admin_products()
    filtered = [item for item in products if item.get("id") != product_id]
    if len(filtered) == len(products):
        return render_admin_products(request, error="Продукт не найден.")
    save_admin_products(filtered)
    return render_admin_products(request, success="Продукт удалён.")


@router.post("/admin/norms", response_class=HTMLResponse)
async def admin_norms_update(request: Request):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    return RedirectResponse(url="/admin/plans", status_code=303)

@router.post("/admin/trial/update", response_class=HTMLResponse)
async def admin_trial_update(request: Request, trial_days: int = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    config["trial_days"] = max(0, trial_days)
    update_admin_config(config)
    return render_admin_plans(request, success="Пробный период обновлён.")


@router.post("/admin/support/contacts/update", response_class=HTMLResponse)
async def admin_support_contacts_update(
    request: Request,
    support_phone: str = Form(default=""),
    support_email: str = Form(default=""),
    support_username: str = Form(default=""),
    support_channel_url: str = Form(default=""),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}

    normalized_phone = _normalize_contact_text(support_phone)
    normalized_email = _normalize_contact_text(support_email)
    normalized_username = _normalize_telegram_username(support_username)
    normalized_channel_url = _normalize_channel_url(support_channel_url)

    contacts: dict[str, str] = {}
    if normalized_phone:
        contacts["phone"] = normalized_phone
    if normalized_email:
        contacts["email"] = normalized_email
    if normalized_username:
        contacts["username"] = normalized_username
    if normalized_channel_url:
        contacts["channel_url"] = normalized_channel_url

    config["support_contacts"] = contacts
    update_admin_config(config)
    return render_admin_plans(request, success="Контакты поддержки обновлены.")


@router.post("/admin/legal/publish", response_class=HTMLResponse)
async def admin_legal_publish(
    request: Request,
    title: str = Form(default=""),
    summary: str = Form(default=""),
    body_markdown: str = Form(default=""),
    page: int = Form(default=1),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    normalized_title = title.strip()
    normalized_summary = summary.strip()
    normalized_body = body_markdown.strip()
    form_data = {
        "title": normalized_title,
        "summary": normalized_summary,
        "body_markdown": normalized_body,
    }
    if not normalized_title:
        return render_admin_legal(request, error="Укажите заголовок редакции.", form_data=form_data, page=page)
    if len(normalized_body) < 80:
        return render_admin_legal(
            request,
            error="Текст оферты слишком короткий. Нужен полный текст новой редакции.",
            form_data=form_data,
            page=page,
        )

    return render_admin_legal(
        request,
        preview_payload=form_data,
        page=page,
    )


@router.post("/admin/legal/edit", response_class=HTMLResponse)
async def admin_legal_edit(
    request: Request,
    title: str = Form(default=""),
    summary: str = Form(default=""),
    body_markdown: str = Form(default=""),
    page: int = Form(default=1),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    return render_admin_legal(
        request,
        form_data={
            "title": title.strip(),
            "summary": summary.strip(),
            "body_markdown": body_markdown.strip(),
        },
        page=page,
    )


@router.post("/admin/legal/confirm", response_class=HTMLResponse)
async def admin_legal_confirm(
    request: Request,
    title: str = Form(default=""),
    summary: str = Form(default=""),
    body_markdown: str = Form(default=""),
    page: int = Form(default=1),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    normalized_title = title.strip()
    normalized_summary = summary.strip()
    normalized_body = body_markdown.strip()
    form_data = {
        "title": normalized_title,
        "summary": normalized_summary,
        "body_markdown": normalized_body,
    }
    if not normalized_title:
        return render_admin_legal(request, error="Укажите заголовок редакции.", form_data=form_data, page=page)
    if len(normalized_body) < 80:
        return render_admin_legal(
            request,
            error="Текст оферты слишком короткий. Нужен полный текст новой редакции.",
            form_data=form_data,
            page=page,
        )

    published = publish_offer_version(
        title=normalized_title,
        summary=normalized_summary,
        body_markdown=normalized_body,
    )
    return render_admin_legal(
        request,
        success=f"Опубликована новая версия оферты: v{int(published['version'])}. Пользователи увидят её при следующем входе.",
        page=page,
    )


@router.post("/admin/plans/add", response_class=HTMLResponse)
async def admin_plans_add(
    request: Request,
    title: str = Form(...),
    duration_days: int = Form(...),
    price_current: int = Form(...),
    price_old: int = Form(0),
    price_old_enabled: bool = Form(False),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    normalized_title = title.strip()
    if not normalized_title:
        return render_admin_plans(request, error="Название тарифа обязательно.")

    plans = _normalize_commercial_plans(load_plans_config())
    existing_ids = {str(plan.get("id", "")).strip().lower() for plan in plans}
    normalized_id = _generate_unique_plan_id(normalized_title, existing_ids)

    plans.append(
        {
            "id": normalized_id,
            "title": normalized_title,
            "duration_days": max(0, duration_days),
            "price_current": max(0, int(price_current)),
            "price_old": max(0, int(price_old)) if price_old_enabled else 0,
            "price_old_enabled": bool(price_old_enabled),
        }
    )
    update_plans_config(plans)
    return render_admin_plans(request, success="Тариф добавлен.")

@router.post("/admin/plans/update", response_class=HTMLResponse)
async def admin_plans_update(
    request: Request,
    plan_id: str = Form(...),
    title: str = Form(...),
    duration_days: int = Form(...),
    price_current: int = Form(...),
    price_old: int = Form(0),
    price_old_enabled: bool = Form(False),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    target_plan_id = plan_id.strip().lower()
    plans = _normalize_commercial_plans(load_plans_config())
    updated = False
    for plan in plans:
        if str(plan.get("id", "")).strip().lower() == target_plan_id:
            plan["title"] = title.strip()
            plan["duration_days"] = max(0, duration_days)
            plan["price_current"] = max(0, int(price_current))
            plan["price_old"] = max(0, int(price_old)) if price_old_enabled else 0
            plan["price_old_enabled"] = bool(price_old_enabled)
            updated = True
            break
    if not updated:
        return render_admin_plans(request, error="Тариф не найден.")

    update_plans_config(plans)
    return render_admin_plans(request, success="Тариф обновлён.")

@router.post("/admin/plans/delete", response_class=HTMLResponse)
async def admin_plans_delete(request: Request, plan_id: str = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)

    target_plan_id = plan_id.strip().lower()
    plans = _normalize_commercial_plans(load_plans_config())
    filtered = [
        plan
        for plan in plans
        if str(plan.get("id", "")).strip().lower() != target_plan_id
    ]
    if len(filtered) == len(plans):
        return render_admin_plans(request, error="Тариф не найден.")

    update_plans_config(filtered)
    return render_admin_plans(request, success="Тариф удалён.")

@router.post("/admin/groups/add", response_class=HTMLResponse)
async def admin_groups_add(request: Request, name: str = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized = name.strip()
    if not normalized:
        return render_admin_groups(request, error="Название группы не может быть пустым.")
    groups = load_admin_groups()
    if normalized in groups:
        return render_admin_groups(request, error="Такая группа уже существует.")
    groups.append(normalized)
    save_admin_groups(sorted(groups))
    return render_admin_groups(request, success="Группа добавлена.")


@router.post("/admin/groups/delete", response_class=HTMLResponse)
async def admin_groups_delete(request: Request, name: str = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized = name.strip()
    groups = load_admin_groups()
    updated = [group for group in groups if group != normalized]
    if len(updated) == len(groups):
        return render_admin_groups(request, error="Группа не найдена.")
    products = load_admin_products()
    has_products = any(
        item.get("group") == normalized
        for item in products
        if isinstance(item.get("group"), str)
    )
    if has_products:
        return render_admin_groups(
            request,
            error="Нельзя удалить группу, пока в ней есть продукты.",
        )
    save_admin_groups(sorted(updated))
    return render_admin_groups(request, success="Группа удалена.")


@router.post("/admin/groups/update", response_class=HTMLResponse)
async def admin_groups_update(
    request: Request,
    name: str = Form(...),
    new_name: str = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized = name.strip()
    normalized_new = new_name.strip()
    if not normalized_new:
        return render_admin_groups(request, error="Новое название не может быть пустым.")
    groups = load_admin_groups()
    if normalized not in groups:
        return render_admin_groups(request, error="Группа не найдена.")
    if normalized_new != normalized and normalized_new in groups:
        return render_admin_groups(request, error="Такая группа уже существует.")
    updated_groups = [
        normalized_new if group == normalized else group
        for group in groups
    ]
    products = load_admin_products()
    for item in products:
        if item.get("group") == normalized:
            item["group"] = normalized_new
    save_admin_products(products)
    save_admin_groups(sorted(updated_groups))
    return render_admin_groups(request, success="Группа переименована.")

