#!/usr/bin/env bash
# Накатить SQL-миграцию таблиц «формы для сайта» в БД, из которой работает API.
# Запуск на машине, где крутится docker compose из этого репозитория:
#   chmod +x apply-embed-forms-migration.sh && ./apply-embed-forms-migration.sh
set -euo pipefail
cd "$(dirname "$0")"
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker compose)
elif docker-compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE=(docker-compose)
else
  echo "Установите Docker Compose" >&2
  exit 1
fi
exec "${DOCKER_COMPOSE[@]}" exec -T api npm run migration:embed-forms
