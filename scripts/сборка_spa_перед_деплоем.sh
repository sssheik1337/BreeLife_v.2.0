#!/usr/bin/env bash
set -euo pipefail

# Локальный шаг для CI/CD: собираем SPA до запуска backend-деплоя.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPA_DIR="$REPO_ROOT/spa"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm не найден. Установите Node.js (включая npm) перед сборкой SPA." >&2
  exit 1
fi

cd "$SPA_DIR"

if [ ! -d node_modules ]; then
  echo "Устанавливаем зависимости SPA..."
  npm install
fi

echo "Собираем SPA..."
npm run build

echo "SPA собрана. Артефакты доступны в $SPA_DIR/dist"
