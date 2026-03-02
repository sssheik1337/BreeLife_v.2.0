from __future__ import annotations

from fastapi import Request
from fastapi.responses import RedirectResponse

from config import (
    SPA_ENABLED,
)

SPA_PHASE_1_ROUTES = {
    "/",
    "/index",
    "/menu",
    "/support",
    "/references",
    "/plans",
    "/settings/reminders",
}

SPA_PHASE_2_ROUTES = {
    "/foods",
    "/my-products",
    "/shopping-list",
    "/trial-start",
    "/preferences-onboarding-choice",
    "/preferences-onboarding",
}

SPA_PHASE_3_ROUTES = {
    "/questionnaire",
    "/resume",
    "/meal-plan",
}

SPA_PHASE_4_ROUTES = {
    "/profile",
    "/profile.html",
    "/diary",
    "/food-diary",
}

PRIMARY_SPA_ROUTES = (
    SPA_PHASE_1_ROUTES
    | SPA_PHASE_2_ROUTES
    | SPA_PHASE_3_ROUTES
    | SPA_PHASE_4_ROUTES
)

def should_route_to_spa_shell(path: str) -> bool:
    normalized_path = path if path == "/" else path.rstrip("/")
    # Final migration mode: every primary user route enters SPA shell directly.
    return SPA_ENABLED and normalized_path in PRIMARY_SPA_ROUTES


def build_spa_shell_url(path: str, query_string: str = "") -> str:
    normalized_path = path if path.startswith("/") else f"/{path}"
    query_part = f"?{query_string}" if query_string else ""
    return f"/app{normalized_path}{query_part}"


def maybe_redirect_to_spa_shell(request: Request, path: str | None = None) -> RedirectResponse | None:
    if request.method != "GET":
        return None

    route_path = path or request.url.path or "/"
    if not should_route_to_spa_shell(route_path):
        return None

    query_string = request.url.query or ""
    return RedirectResponse(url=build_spa_shell_url(route_path, query_string), status_code=307)
