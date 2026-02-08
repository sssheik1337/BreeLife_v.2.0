import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from config import ADMIN_LOGIN, ADMIN_PASSWORD
from app.context import (
    ADMIN_SESSIONS,
    ADMIN_SESSION_COOKIE,
    ADMIN_SESSION_TTL,
    templates,
    load_admin_config,
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
    plans = config.get("plans") if isinstance(config, dict) else []
    if not isinstance(plans, list) or not plans:
        plans = [
            {
                "id": "trial",
                "title": "Пробный период",
                "duration_days": trial_days,
                "price_current": "0 ₽",
                "price_old": "",
                "price_old_enabled": False,
                "features": [],
            },
            {
                "id": "premium",
                "title": "Подписка",
                "duration_days": 30,
                "price_current": "399 ₽ / месяц",
                "price_old": "",
                "price_old_enabled": False,
                "features": [],
            },
        ]
    normalized_plans: list[dict[str, object]] = []
    for plan in plans:
        if not isinstance(plan, dict):
            continue
        normalized_plans.append(
            {
                "id": str(plan.get("id", "")).strip(),
                "title": str(plan.get("title", "")).strip(),
                "duration_days": int(plan.get("duration_days", 0) or 0),
                "price_current": str(plan.get("price_current", plan.get("price", ""))).strip(),
                "price_old": str(plan.get("price_old", "")).strip(),
                "price_old_enabled": bool(plan.get("price_old_enabled", False)),
                "features": plan.get("features", []),
            }
        )
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
            "plans": normalized_plans,
            "error": error,
            "success": success,
        },
    )


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
    return render_admin_norms(request)


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
    kcal: float = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
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
    kcal: float = Form(...),
    protein_g: float = Form(...),
    fat_g: float = Form(...),
    carbs_simple_g: float = Form(...),
    carbs_complex_g: float = Form(...),
    fiber_g: float = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    carbs_g = max(0, carbs_simple_g + carbs_complex_g)
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
async def admin_norms_update(
    request: Request,
    water_l: float = Form(...),
    sleep_hours: float = Form(...),
    fiber_g: float = Form(...),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    config["norms"] = {
        "water_l": water_l,
        "sleep_hours": sleep_hours,
        "fiber_g": fiber_g,
    }
    update_admin_config(config)
    return render_admin_norms(request, success="Нормы обновлены.")


@router.post("/admin/trial/update", response_class=HTMLResponse)
async def admin_trial_update(request: Request, trial_days: int = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    config["trial_days"] = max(0, trial_days)
    update_admin_config(config)
    return render_admin_norms(request, success="Пробный период обновлён.")


@router.post("/admin/plans/add", response_class=HTMLResponse)
async def admin_plans_add(
    request: Request,
    plan_id: str = Form(...),
    title: str = Form(...),
    duration_days: int = Form(...),
    price_current: str = Form(...),
    price_old: str = Form(""),
    price_old_enabled: bool = Form(False),
    features: str = Form(""),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    normalized_id = plan_id.strip()
    normalized_title = title.strip()
    if not normalized_id or not normalized_title:
        return render_admin_norms(request, error="ID и название тарифа обязательны.")
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    plans = config.get("plans") if isinstance(config, dict) else []
    if not isinstance(plans, list):
        plans = []
    if any(isinstance(plan, dict) and plan.get("id") == normalized_id for plan in plans):
        return render_admin_norms(request, error="Тариф с таким ID уже существует.")
    features_list = [line.strip() for line in features.splitlines() if line.strip()]
    plans.append(
        {
            "id": normalized_id,
            "title": normalized_title,
            "duration_days": max(0, duration_days),
            "price_current": price_current.strip(),
            "price_old": price_old.strip(),
            "price_old_enabled": bool(price_old_enabled),
            "features": features_list,
        }
    )
    config["plans"] = plans
    update_admin_config(config)
    return render_admin_norms(request, success="Тариф добавлен.")


@router.post("/admin/plans/update", response_class=HTMLResponse)
async def admin_plans_update(
    request: Request,
    plan_id: str = Form(...),
    title: str = Form(...),
    duration_days: int = Form(...),
    price_current: str = Form(...),
    price_old: str = Form(""),
    price_old_enabled: bool = Form(False),
    features: str = Form(""),
):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    plans = config.get("plans") if isinstance(config, dict) else []
    if not isinstance(plans, list):
        plans = []
    updated = False
    features_list = [line.strip() for line in features.splitlines() if line.strip()]
    for plan in plans:
        if isinstance(plan, dict) and plan.get("id") == plan_id:
            plan["title"] = title.strip()
            plan["duration_days"] = max(0, duration_days)
            plan["price_current"] = price_current.strip()
            plan["price_old"] = price_old.strip()
            plan["price_old_enabled"] = bool(price_old_enabled)
            plan["features"] = features_list
            updated = True
            break
    if not updated:
        return render_admin_norms(request, error="Тариф не найден.")
    config["plans"] = plans
    update_admin_config(config)
    return render_admin_norms(request, success="Тариф обновлён.")


@router.post("/admin/plans/delete", response_class=HTMLResponse)
async def admin_plans_delete(request: Request, plan_id: str = Form(...)):
    if not is_admin_authenticated(request):
        return RedirectResponse(url="/admin", status_code=303)
    config = load_admin_config()
    if not isinstance(config, dict):
        config = {}
    plans = config.get("plans") if isinstance(config, dict) else []
    if not isinstance(plans, list):
        plans = []
    filtered = [plan for plan in plans if not (isinstance(plan, dict) and plan.get("id") == plan_id)]
    if len(filtered) == len(plans):
        return render_admin_norms(request, error="Тариф не найден.")
    config["plans"] = filtered
    update_admin_config(config)
    return render_admin_norms(request, success="Тариф удалён.")


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
