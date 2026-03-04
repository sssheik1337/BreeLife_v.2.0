# BreeLife v2.0

BreeLife — Telegram MiniApp про питание.

Что делает приложение:
- собирает персональный рацион на день и на неделю на основе профиля и предпочтений
- показывает список покупок по сохранённому плану
- ведёт дневник питания и привычек (вода, сон)
- показывает прогресс по целям
- отправляет напоминания (по настройкам пользователя)
- управляет пробным периодом и подпиской

Важно: это продукт про планирование питания и привычек без медицинских обещаний.

## Стек

- Backend: Python, FastAPI
- Telegram: aiogram (бот, webhook), Telegram MiniApp
- Хранилище: SQLite (приложение и база продуктов)
- Frontend: Vue 3, TypeScript, Vite, Pinia, TailwindCSS
- AI: YandexGPT (используется как помощник выбора; расчёт порций и проверки выполняются кодом)

## Структура репозитория

- `app/` — FastAPI приложение: роутеры, зависимости, схемы, запуск.
- `services/` — бизнес-логика и работа с БД: рацион, дневник, напоминания, AI, платежи.
- `spa/` — клиент (SPA): Vue/TS исходники и сборка.
- `templates/` — шаблоны админки.
- `static/` — статические файлы админки.
- `fonts/` — локальные шрифты.
- `scripts/` — вспомогательные скрипты (например сборка SPA).
- `tests/` — тесты.

## Python файлы (кратко)

- `main.py` — точка входа backend.
- `config.py` — чтение переменных окружения и нормализация настроек.
- `telegram_bot.py` — отдельный режим запуска Telegram-бота (polling), если нужен.

- `app/application.py` — сборка FastAPI приложения, подключение роутеров, раздача статики/SPA.
- `app/lifespan.py` — жизненный цикл приложения (бот webhook, воркер напоминаний, миграции продуктов).
- `app/context.py` — контекст/настройки из БД (admin config, планы), cookie/TTL, кеширование.
- `app/dependencies.py` — зависимости FastAPI (сессия, авторизация, кеш-ключи).
- `app/schemas.py` — схемы/типы данных API.
- `app/utils.py` — утилиты.
- `app/__init__.py` — пакет приложения (маркер модуля).
- `app/routers/__init__.py` — экспорт роутеров.

- `app/routers/core.py` — SPA shell (`/app/*`), healthcheck, публичные endpoints (url/config).
- `app/routers/dev.py` — dev-логин без Telegram (только development).
- `app/routers/telegram.py` — webhook Telegram.
- `app/routers/admin.py` — админка.
- `app/routers/profile.py` — API профиля.
- `app/routers/products_api.py` — API продуктов.
- `app/routers/diary.py` — API дневника.
- `app/routers/meal_plan_api.py` — вспомогательные функции/контракт для целей/распределения (используется v2).
- `app/routers/meal_plan_v2.py` — рацион v2: хранение/генерация/пересборка, неделя.
- `app/routers/reminders.py` — API напоминаний.
- `app/routers/subscription.py` — API подписки/триала.
- `app/routers/ai.py` — AI endpoints.

- `services/storage_db.py` — SQLite хранилище (профиль, планы, рацион, KV-конфиг).
- `services/products_db.py` — доступ к базе продуктов и её миграции.
- `services/products_heuristics.py` — эвристики классификации продуктов и лимиты порций.

- `services/meal_templates_v2.py` — шаблоны приёмов пищи.
- `services/meal_plan_generator_v2.py` — генерация рациона v2 (выбор + порции + проверки).
- `services/yandex_gpt_meal_picker.py` — строгий выбор продуктов через YandexGPT.
- `services/targets.py` — расчёт целей/норм.
- `services/nutrition.py` — расчёты нутриентов.

- `services/diary_queries.py` — запросы/агрегации для дневника.

- `services/reminders.py` — логика напоминаний.
- `services/reminders_worker.py` — фоновые тики отправки напоминаний.

- `services/telegram_deeplinks.py` — сборка deeplink URL для CTA-кнопок.
- `services/telegram_notify.py` — отправка уведомлений в Telegram.

- `services/payment.py` — платежи/планы (интеграцию ЮКасса подключим отдельно).
- `services/ai_profile.py` — AI-логика для профиля/советов.

## Переменные окружения (.env)

Смотрите `.env.example`. Секреты в репозиторий не коммитятся.

Обязательные:
- `DB_PATH` — абсолютный путь к SQLite базе приложения.
- `PRODUCTS_DB_PATH` — абсолютный путь к SQLite базе продуктов.

URL (чтобы не дублировать):
- достаточно задать только `PUBLIC_APP_URL`.
- `PUBLIC_BASE_URL` можно не задавать: он будет вычислен как origin из `PUBLIC_APP_URL`.
- `TELEGRAM_WEBAPP_URL` оставлен для обратной совместимости и тоже может быть пустым.

Telegram:
- `TELEGRAM_BOT_TOKEN` — токен бота.
- `TELEGRAM_HIDDEN_ADMIN_COMMAND` — скрытая команда для админ-ссылки.

AI:
- `AI_ENABLED` — включает/выключает AI-функции.
- `YANDEX_GPT_API_KEY`, `YANDEX_GPT_FOLDER_ID` — доступ к YandexGPT.

Платежи:
- `PAYMENT_PROVIDER`, `PAYMENT_PUBLIC_KEY`, `PAYMENT_SECRET_KEY` — значения зависят от провайдера (позже переключим на ЮКасса).

Напоминания:
- `REMINDERS_WORKER_POLL_SECONDS`, `WATER_REMINDER_INTERVAL_MINUTES`, `WAKE_WATER_DELAY_MINUTES` — это технические интервалы работы воркера.
  Они не включают/выключают напоминания для пользователя (это делается в интерфейсе и хранится в БД).

## Локальный запуск

1) Установить зависимости: `python -m pip install -r requirements.txt`

2) Создать `.env` по примеру `.env.example`.

3) Запуск backend: `python main.py`

## SPA (клиент)

- Разработка: `cd spa` → `npm install` → `npm run dev`
- Сборка: `cd spa` → `npm ci` → `npm run build`

Backend отдаёт собранные файлы по `/spa-assets`, а пользовательские маршруты перенаправляет в SPA (`/app/*`).

## Админка

- `/admin`
