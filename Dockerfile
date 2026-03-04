# syntax=docker/dockerfile:1

# 1) Собираем SPA (Vite) внутри контейнера, чтобы на хостинге не требовались npm/node на рантайме.
FROM node:20-alpine AS spa_builder
WORKDIR /src/spa

COPY spa/package.json spa/package-lock.json ./
RUN npm ci

COPY spa/ ./
RUN npm run build


# 2) Рантайм FastAPI + статика + собранная SPA.
FROM python:3.11-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    APP_ENV=production \
    DEBUG=false \
    APP_HOST=0.0.0.0 \
    APP_PORT=80 \
    DB_PATH=/data/breelife.sqlite3 \
    PRODUCTS_DB_PATH=/data/products.db

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY services/ ./services/
COPY static/ ./static/
COPY fonts/ ./fonts/
COPY templates/ ./templates/
COPY config.py main.py telegram_bot.py ./

# Собранная SPA должна лежать в `spa/dist`, иначе `/app/` вернёт 503 ("SPA не собрана").
COPY --from=spa_builder /src/spa/dist ./spa/dist

EXPOSE 80
CMD ["python", "main.py"]
