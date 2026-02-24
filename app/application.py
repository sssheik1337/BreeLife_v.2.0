import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from config import APP_NAME, SPA_ENABLED, SPA_PRIMARY_ROUTES_TO_SHELL_ENABLED
from app.lifespan import lifespan
from app.routers import (
    admin,
    ai,
    core,
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

PRIMARY_SPA_ROUTES = {
    '/menu',
    '/support',
    '/references',
    '/plans',
    '/settings/reminders',
    '/foods',
    '/my-products',
    '/shopping-list',
    '/trial-start',
    '/preferences-onboarding-choice',
    '/preferences-onboarding',
    '/questionnaire',
    '/resume',
    '/meal-plan',
    '/profile',
    '/profile.html',
    '/diary',
    '/food-diary',
}



def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, lifespan=lifespan)
    init_db()

    app.include_router(core.router)
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

        # Админ-часть и API остаются вне автоматического редиректа до отдельной миграции.
        query_string = f"?{request.url.query}" if request.url.query else ''
        return RedirectResponse(url=f'/app{request_path}{query_string}', status_code=307)

    app.mount('/static', StaticFiles(directory='static'), name='static')
    # Раздаём локальные файлы шрифтов по URL /fonts, чтобы @font-face не получал 404.
    app.mount('/fonts', StaticFiles(directory='fonts'), name='fonts')

    # Статические SPA-ассеты (Vite build) отдаются по отдельному префиксу.
    spa_assets_dir = Path('spa/dist/assets')
    spa_assets_dir.mkdir(parents=True, exist_ok=True)
    app.mount('/spa-assets', StaticFiles(directory=str(spa_assets_dir)), name='spa-assets')
    return app
