import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from config import (
    APP_NAME,
    SPA_ENABLED,
    SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED,
    SPA_PHASE_1_ENABLED,
    SPA_PHASE_2_ENABLED,
    SPA_PHASE_3_ENABLED,
    SPA_PHASE_4_ENABLED,
)
from app.lifespan import lifespan
from app.routers import (
    admin,
    ai,
    core,
    dev,
    diary,
    foods,
    meal_plan_api,
    pages,
    products_api,
    profile,
    questionnaire,
    reminders,
    subscription,
    telegram,
)
from services.storage_db import init_db

logging.basicConfig(level=logging.DEBUG)

SPA_PHASE_1_ROUTES = {
    '/menu',
    '/support',
    '/references',
    '/plans',
    '/settings/reminders',
}

SPA_PHASE_2_ROUTES = {
    '/foods',
    '/my-products',
    '/shopping-list',
    '/trial-start',
    '/preferences-onboarding-choice',
    '/preferences-onboarding',
}

SPA_PHASE_3_ROUTES = {
    '/questionnaire',
    '/resume',
    '/meal-plan',
}

SPA_PHASE_4_ROUTES = {
    '/profile',
    '/profile.html',
    '/diary',
    '/food-diary',
}

PRIMARY_SPA_ROUTES = (
    SPA_PHASE_1_ROUTES
    | SPA_PHASE_2_ROUTES
    | SPA_PHASE_3_ROUTES
    | SPA_PHASE_4_ROUTES
)


def is_spa_route_enabled(path: str) -> bool:
    if path in SPA_PHASE_1_ROUTES:
        return SPA_PHASE_1_ENABLED
    if path in SPA_PHASE_2_ROUTES:
        return SPA_PHASE_2_ENABLED
    if path in SPA_PHASE_3_ROUTES:
        return SPA_PHASE_3_ENABLED
    if path in SPA_PHASE_4_ROUTES:
        return SPA_PHASE_4_ENABLED
    return False



def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, lifespan=lifespan)
    init_db()

    app.include_router(core.router)
    app.include_router(dev.router)
    app.include_router(telegram.router)
    app.include_router(questionnaire.router)
    app.include_router(profile.router)
    app.include_router(diary.router)
    app.include_router(foods.router)
    app.include_router(meal_plan_api.router)
    app.include_router(pages.router)
    app.include_router(admin.router)
    app.include_router(products_api.router)
    app.include_router(subscription.router)
    app.include_router(reminders.router)
    app.include_router(ai.router)

    @app.middleware('http')
    async def add_process_time_header(request, call_next):
        start_time = datetime.now()
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()
        response.headers['X-Process-Time'] = str(process_time)
        return response

    @app.middleware('http')
    async def redirect_primary_routes_to_spa_shell(request, call_next):
        if not (SPA_ENABLED and SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED):
            return await call_next(request)

        request_path = request.url.path or '/'
        if request.method != 'GET' or request_path not in PRIMARY_SPA_ROUTES:
            return await call_next(request)

        if not is_spa_route_enabled(request_path):
            return await call_next(request)

        # Админ-часть и API остаются вне автоматического редиректа до отдельной миграции.
        query_string = f"?{request.url.query}" if request.url.query else ''
        return RedirectResponse(url=f'/app{request_path}{query_string}', status_code=307)

    app.mount('/static', StaticFiles(directory='static'), name='static')
    # Раздаём локальные файлы шрифтов по URL /fonts, чтобы @font-face не получал 404.
    app.mount('/fonts', StaticFiles(directory='fonts'), name='fonts')

    # Статические SPA-ассеты (Vite build) отдаются по отдельному префиксу.
    spa_dist_dir = Path('spa/dist')
    spa_dist_dir.mkdir(parents=True, exist_ok=True)
    app.mount('/spa-assets', StaticFiles(directory=str(spa_dist_dir)), name='spa-assets')
    return app
