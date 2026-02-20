import logging
from datetime import datetime

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from config import APP_NAME
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

    @app.middleware("http")
    async def add_process_time_header(request, call_next):
        start_time = datetime.now()
        response = await call_next(request)
        process_time = (datetime.now() - start_time).total_seconds()
        response.headers["X-Process-Time"] = str(process_time)
        return response

    app.mount("/static", StaticFiles(directory="static"), name="static")
    # Раздаём локальные файлы шрифтов по URL /fonts, чтобы @font-face не получал 404.
    app.mount("/fonts", StaticFiles(directory="fonts"), name="fonts")
    return app

