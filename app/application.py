import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from config import APP_NAME
from app.lifespan import lifespan
from app.routers import (
    admin,
    ai,
    core,
    dev,
    diary,
    legal,
    meal_plan_v2,
    products_api,
    profile,
    reminders,
    subscription,
    telegram,
)
from services.storage_db import init_db

logging.basicConfig(level=logging.DEBUG)

def create_app() -> FastAPI:
    app = FastAPI(title=APP_NAME, lifespan=lifespan)
    init_db()
    project_root = Path(__file__).resolve().parent.parent

    app.include_router(core.router)
    app.include_router(dev.router)
    app.include_router(telegram.router)
    app.include_router(profile.router)
    app.include_router(diary.router)
    app.include_router(legal.router)
    app.include_router(meal_plan_v2.router)
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
    async def redirect_user_routes_to_spa_shell(request, call_next):
        if request.method != 'GET':
            return await call_next(request)

        request_path = request.url.path or '/'
        if request_path.startswith(('/api', '/admin', '/telegram', '/static', '/ico', '/fonts', '/spa-assets', '/app', '/healthz')):
            return await call_next(request)

        query = request.url.query or ''
        if request_path == '/':
            target = '/app/'
        else:
            target = f"/app{request_path}"
        if query:
            target = f"{target}?{query}"
        return RedirectResponse(url=target, status_code=307)

    app.mount('/static', StaticFiles(directory=str(project_root / 'static')), name='static')
    app.mount('/ico', StaticFiles(directory=str(project_root / 'ico')), name='ico')
    # Раздаём локальные файлы шрифтов по URL /fonts, чтобы @font-face не получал 404.
    app.mount('/fonts', StaticFiles(directory=str(project_root / 'fonts')), name='fonts')

    # Статические SPA-ассеты (Vite build) отдаются по отдельному префиксу.
    spa_dist_dir = project_root / 'spa' / 'dist'
    if spa_dist_dir.exists():
        app.mount('/spa-assets', StaticFiles(directory=str(spa_dist_dir)), name='spa-assets')
    return app
