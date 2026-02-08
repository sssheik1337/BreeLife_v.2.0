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
    return templates.TemplateResponse(
        "admin_products.html",
        {
            "request": request,
            "products": products,
            "groups": groups,
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
    return templates.TemplateResponse(
        "admin_norms.html",
        {
            "request": request,
            "norms": {
                "water_l": norms.get("water_l", 2),
                "sleep_hours": norms.get("sleep_hours", 8),
                "fiber_g": norms.get("fiber_g", 25),
            },
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
    save_admin_groups(sorted(updated))
    return render_admin_groups(request, success="Группа удалена.")
