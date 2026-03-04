
# BreeLife v2.0 (Telegram MiniApp)

BreeLife это MiniApp внутри Telegram: пользователь заполняет профиль и предпочтения по продуктам, получает рацион и список покупок, ведет дневник питания и привычек (вода, сон), видит прогресс и получает напоминания.

Важно: приложение не дает медицинских обещаний. Это продукт для планирования питания и привычек.

## Что передается заказчику

В этом репозитории находятся все исходники проекта:
- backend (FastAPI, Telegram webhook, бизнес-логика, работа с БД);
- frontend (SPA на Vue 3 + TypeScript: интерфейс MiniApp);
- админ-панель (серверные HTML-шаблоны для управления продуктами, тарифами и настройками).

## Стек и версии

Backend:
- Python: 3.11 (в Docker-образе, см. `Dockerfile`)
- FastAPI + Uvicorn (см. `requirements.txt`)
- aiogram 3.x (Telegram bot/webhook, проверка initData MiniApp)
- SQLite (две базы: данные приложения и каталог продуктов)

Frontend (SPA):
- Vue: 3.5.x (см. `spa/package.json`)
- TypeScript: 5.7.x (см. `spa/package.json`)
- Vite: 5.4.x (см. `spa/package.json`)
- Pinia, Vue Router, TailwindCSS (см. `spa/package.json`)

AI:
- YandexGPT используется как помощник выбора продуктов (подбор product_id); расчет порций и проверки выполняются кодом.

## Архитектура и структура репозитория

Ключевые файлы:
- `main.py` точка входа сервера (запуск Uvicorn).
- `config.py` чтение переменных окружения, нормализация URL и путей к БД.
- `Dockerfile` сборка и запуск в Docker (в т.ч. сборка SPA на хостинге).
- `.dockerignore` уменьшение контекста сборки Docker.

Backend:
- `app/application.py` сборка FastAPI приложения, роутеры, раздача статики и SPA.
- `app/lifespan.py` жизненный цикл: Telegram webhook, inline воркер напоминаний, инициализация/миграции каталога продуктов.
- `app/routers/` HTTP API и админка.

Сервисы:
- `services/storage_db.py` схема и доступ к SQLite базе приложения (включая `meal_plans`).
- `services/products_db.py` схема и доступ к SQLite базе продуктов.
- `services/meal_plan_generator_v2.py` генератор рациона v2.
- `services/products_heuristics.py` эвристики ролей/порций/классификация food/beverage/water.

Frontend:
- `spa/` исходники SPA (Vue/TS) и сборка Vite.
- `static/` общие статические ресурсы (CSS/JS), включая элементы оболочки.
- `fonts/` локальные web-шрифты (woff2).
- `templates/` серверная админ-панель.

## Где и как хранятся данные

Проект использует две SQLite базы.

### 1) База приложения (пользовательские данные)

- Путь: `DB_PATH` (рекомендуется `DB_PATH=/data/breelife.sqlite3`)
- Инициализация: `services/storage_db.py:init_db()` создает таблицы при старте.
- Формат: JSON хранится в колонке `data` (TEXT) в ряде таблиц.

Основные таблицы (упрощенно):
- `profiles` профиль пользователя и флаги завершения шагов (включая предпочтения/онбординг).
- `sessions` сессии MiniApp (cookie `telegram_session`).
- `meal_plans` сохраненные рационы по дням (ключ `(telegram_user_id, plan_date)`), чтобы не пересобирать при каждом открытии.
- `diary_entries`, `food_diary_entries`, `water_entries`, `sleep_entries`, `habit_entries` дневник.
- `reminders`, `user_settings` напоминания и настройки.
- `payments` журнал платежей (под интеграцию).
- `app_kv` конфиги админки и тарифов (ключи `admin_config`, `plans_config`).

### 2) База продуктов (каталог)

- Путь: `PRODUCTS_DB_PATH` (рекомендуется `PRODUCTS_DB_PATH=/data/products.db`)
- Инициализация: `services/products_db.py:ensure_products_db()` создает таблицы при старте.

Таблицы:
- `product_groups`
- `products` (пищевая ценность на 100 г: `kcal`, `protein_g`, `fat_g`, `carbs_g`, и т.д.)

Важно про наполнение каталога:
- При первом запуске база продуктов создается пустой.
- Чтобы рацион и онбординг продуктов работали корректно, добавьте продукты и группы через админ-панель (`/admin`).

### Доступы и эксплуатация

- В продакшене обе базы должны лежать в постоянном хранилище (обычно `/data`).
- Админ-панель защищена `ADMIN_LOGIN`/`ADMIN_PASSWORD`.
- Секреты (токены/ключи) не коммитятся: `.env` в `.gitignore`.

## Подписки, пробный период и оплаты (как реализовано сейчас)

### Пробный период и статус подписки

Роутер: `app/routers/subscription.py`

- `POST /api/subscription/start_trial` запускает пробный период на `trial_days` (значение задается в админке).
- `GET /api/subscription/status` возвращает статус (`trial/paid/expired/none`) и даты начала/окончания.
- Состояние хранится в профиле пользователя (в `profiles.data`, поле `subscription`, плюс поля для совместимости).

### Оплаты

- `POST /api/payments/start` сейчас возвращает данные тарифа, но полноценный платежный провайдер и обработка webhooks в текущем состоянии не подключены.
- Таблица `payments` уже есть, но это задел под интеграцию (ЮKassa/СБП/привязка/автосписание).

### Тарифы

- Тарифы не читаются из файла: конфиг хранится в SQLite (`app_kv`, ключ `plans_config`) и редактируется через админку.

## Как работает MiniApp (кратко)

1) Авторизация:
- SPA отправляет `initData` Telegram WebApp.
- Сервер проверяет подпись и создает сессию: `POST /api/auth/telegram`.

2) Telegram webhook и кнопка MiniApp:
- На старте приложение пытается установить webhook: `PUBLIC_BASE_URL + /telegram/webhook` (см. `app/lifespan.py`).
- Также устанавливается кнопка MiniApp в меню чата бота (`PUBLIC_APP_URL`).
- Если не задан `TELEGRAM_BOT_TOKEN` или `PUBLIC_BASE_URL`, webhook не поднимется (это видно в логах старта).

3) Профиль и предпочтения:
- Данные пользователя и выбор продуктов сохраняются в `profiles`.

4) Рацион и список покупок:
- `GET /api/meal-plan/v2?date=YYYY-MM-DD` отдает сохраненный рацион или генерирует и сохраняет его в `meal_plans`.
- `GET /api/meal-plan/v2/week?week_start=YYYY-MM-DD` возвращает 7 дней (генерирует только отсутствующие/устаревшие).
- `POST /api/meal-plan/v2/rebuild?date=...` пересобирает только текущий день без повторения продуктов подряд.
- `GET /api/shopping-list/v2` агрегирует покупки по сохраненным планам.

5) Напоминания:
- Inline воркер периодически проверяет due-напоминания.

## Переменные окружения (основные)

Обязательные для продакшена:
- `TELEGRAM_BOT_TOKEN` токен Telegram бота.
- `PUBLIC_APP_URL` публичный URL MiniApp (например `https://example.com/profile`).
- `PUBLIC_BASE_URL` публичный базовый URL для webhook (например `https://example.com`).
- `DB_PATH` путь к базе приложения (рекомендуется `/data/breelife.sqlite3`).
- `PRODUCTS_DB_PATH` путь к базе продуктов (рекомендуется `/data/products.db`).
- `ADMIN_LOGIN`, `ADMIN_PASSWORD` доступ в админку.

Опциональные:
- `AI_ENABLED` включает AI-функции.
- `YANDEX_GPT_API_KEY`, `YANDEX_GPT_FOLDER_ID` доступ к YandexGPT.
- `TELEGRAM_HIDDEN_ADMIN_COMMAND` скрытая команда для выдачи ссылки на админку в чате с ботом.

Напоминания (технические интервалы):
- `REMINDERS_WORKER_POLL_SECONDS` как часто воркер проверяет due-напоминания (в секундах).
- `WATER_REMINDER_INTERVAL_MINUTES` базовый интервал напоминаний воды, если включено пользователем (в минутах).
- `WAKE_WATER_DELAY_MINUTES` задержка от времени пробуждения до первого напоминания воды (в минутах).

Примеры смотрите в `.env.example` (секреты туда не добавляются).

## Развертывание с нуля (Docker, рекомендуется для Amvera)

Amvera не дает доступа к npm/консоли в режиме `python/pip`, поэтому сборка SPA делается внутри Docker (multi-stage). Это решает проблему `503` на `/app/`, когда нет `spa/dist/index.html`.

### 1) Собрать образ

```bash
docker build -t breelife .
```

### 2) Запустить контейнер

```bash
docker run --rm -p 8080:80 \
  -e TELEGRAM_BOT_TOKEN=... \
  -e PUBLIC_APP_URL=https://example.com/profile \
  -e PUBLIC_BASE_URL=https://example.com \
  -e DB_PATH=/data/breelife.sqlite3 \
  -e PRODUCTS_DB_PATH=/data/products.db \
  -e ADMIN_LOGIN=admin \
  -e ADMIN_PASSWORD=admin \
  -v "$PWD/data:/data" \
  breelife
```

Проверка:
- SPA оболочка: `http://127.0.0.1:8080/app/`
- Healthcheck: `http://127.0.0.1:8080/healthz`
- Админка: `http://127.0.0.1:8080/admin`

### 3) Amvera (Docker)

1. Запушить репозиторий в Amvera Git (или подключить remote).
2. Включить сборку через Dockerfile.
3. Задать переменные окружения (см. раздел выше).
4. Убедиться, что постоянное хранилище примонтировано в `/data` (обычно по умолчанию).

## Локальная разработка без Docker

Backend:
```bash
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt
python main.py
```

Frontend:
```bash
cd spa
npm install
npm run dev
```

## Админ-панель

URL: `/admin`

Как открыть:
- В браузере: `PUBLIC_BASE_URL + /admin`
- Из Telegram: команда `/<TELEGRAM_HIDDEN_ADMIN_COMMAND>` в чате с ботом, затем кнопка “Открыть админ-панель”.

Что умеет:
- управление каталогом продуктов и группами;
- настройка длительности пробного периода (`trial_days`);
- управление тарифами (цена, старая цена, длительность).
