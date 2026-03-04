# BreeLife v2.0

Backend: FastAPI + Telegram bot (aiogram).
Клиент: SPA (Vue 3 + Vite), доступна под /app/.

## Запуск backend (локально)

1. Установите зависимости:

   pip install -r requirements.txt

2. Создайте .env по примеру .env.example и задайте минимум:

   - DB_PATH (абсолютный путь)
   - PRODUCTS_DB_PATH (абсолютный путь)
   - TELEGRAM_BOT_TOKEN
   - TELEGRAM_WEBAPP_URL (например: https://example.com/app/)

3. Запуск:

   python main.py

## SPA

- Разработка:

  cd spa
  npm install
  npm run dev

- Сборка:

  cd spa
  npm ci
  npm run build

Backend раздаёт собранные файлы по /spa-assets и перенаправляет пользовательские маршруты на /app/.

## Админка

- /admin