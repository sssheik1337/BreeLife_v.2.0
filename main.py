import logging
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware

from config import APP_ENV, APP_HOST, APP_NAME, APP_PORT, DEBUG
from services.nutrition import (
    calculate_bmr,
    calculate_daily_calories,
    calculate_goal_calories,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=APP_NAME)

templates = Jinja2Templates(directory="templates")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        logger.info("%s %s %s", request.method, request.url.path, response.status_code)
        return response


app.add_middleware(RequestLoggingMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/questionnaire", response_class=HTMLResponse)
async def questionnaire(request: Request):
    return templates.TemplateResponse("questionnaire.html", {"request": request})


@app.get("/resume", response_class=HTMLResponse)
async def resume(request: Request):
    return templates.TemplateResponse("resume.html", {"request": request})


@app.get("/profile", response_class=HTMLResponse)
async def profile(request: Request):
    return templates.TemplateResponse("profile.html", {"request": request})


@app.get("/foods", response_class=HTMLResponse)
async def foods(request: Request):
    return templates.TemplateResponse("foods.html", {"request": request})


@app.get("/menu", response_class=HTMLResponse)
async def menu(request: Request):
    return templates.TemplateResponse("menu.html", {"request": request})


@app.get("/api/calculate")
async def calculate(
    sex: str,
    weight: float,
    height: float,
    age: int,
    activity_factor: float,
    goal_type: str,
):
    try:
        bmr = calculate_bmr(sex=sex, weight=weight, height=height, age=age)
        daily_calories = calculate_daily_calories(bmr, activity_factor)
        goal_calories = calculate_goal_calories(daily_calories, goal_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "bmr": bmr,
        "daily_calories": daily_calories,
        "goal_calories": goal_calories,
    }


@app.get("/api/subscription/status")
async def subscription_status(
    registered_at: str | None = None,
    status: str | None = None,
):
    if status:
        normalized_status = status.lower()
        if normalized_status not in {"trial", "active", "expired"}:
            raise HTTPException(status_code=400, detail="Некорректный статус подписки.")
        status_value = normalized_status
    else:
        status_value = None
    if registered_at:
        if registered_at.endswith("Z"):
            registered_at = registered_at.replace("Z", "+00:00")
        try:
            registration_date = datetime.fromisoformat(registered_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Некорректная дата регистрации.") from exc
    else:
        registration_date = datetime.now(timezone.utc)

    trial_end = registration_date + timedelta(days=30)
    now = datetime.now(timezone.utc)
    computed_status = "trial" if now <= trial_end else "expired"
    status_result = status_value or computed_status

    return {
        "subscription_status": status_result,
        "registered_at": registration_date.isoformat(),
        "trial_end": trial_end.isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=APP_HOST,
        port=APP_PORT,
        reload=DEBUG,
    )
