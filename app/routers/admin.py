import secrets
import re
import unicodedata
import sqlite3
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

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
    normalized_plans = _normalize_commercial_plans(load_plans_config())
    return templates.TemplateResponse(
        "admin_plans.html",
        {
            "request": request,
            "plans": normalized_plans,
            "trial_days": trial_days,
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
                WHERE lower(status) = 'success'
                """
            ).fetchone()[0]
        )
        revenue_30d_raw = connection.execute(
            """
            SELECT COALESCE(SUM(amount_rub), 0)
            FROM payments
            WHERE lower(status) = 'success'
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
                SUM(CASE WHEN lower(status) = 'success' THEN 1 ELSE 0 END) AS payments_count
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
        active_expr = "(subscription_status = 'paid' AND subscription_until > ?)"
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
    for row in payment_rows:
        raw_meta = row["meta_json"]
        pretty_meta = ""
        if isinstance(raw_meta, str) and raw_meta.strip():
            try:
                pretty_meta = json.dumps(json.loads(raw_meta), ensure_ascii=False, indent=2)
            except (TypeError, json.JSONDecodeError):
                pretty_meta = raw_meta.strip()
        payments.append(
            {
                "id": int(row["id"]),
                "created_at_display": _format_datetime(row["created_at"]),
                "amount_rub": int(row["amount_rub"] or 0),
                "duration_days": int(row["duration_days"] or 0),
                "status": str(row["status"] or ""),
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
        "subscription_status": subscription_status or "inactive",
        "subscription_until_display": _format_datetime(subscription_until_raw),
        "subscription_active": subscription_active,
        "payments_count": len(payments),
        "payments": payments,
    }

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
            "error": None,
            "success": None,
        },
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

