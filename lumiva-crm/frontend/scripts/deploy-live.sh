#!/usr/bin/env bash
# Выкатка собранного фронтенда на crm.lumiva.agency.
# Старые хэшированные файлы из assets/ НЕ удаляются сразу: вкладка, открытая до деплоя, ещё
# ссылается на них, и при переходе на страницу получила бы 404 → экран ошибки + перезагрузка.
# Храним их 7 дней, удаляем только то, чего нет в новой сборке и что старше 7 дней.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=/var/www/crm.lumiva.agency
[ -d dist/assets ] || { echo "нет dist/ — сначала npm run build"; exit 1; }
# всё, кроме assets/, — точная копия сборки
rsync -a --delete --exclude 'assets/' dist/ "$DEST/"
# assets — добавляем новые, старые оставляем
rsync -a dist/assets/ "$DEST/assets/"
# чистка: файлы старше 7 дней, которых нет в текущей сборке
find "$DEST/assets" -type f -mtime +7 -print0 | while IFS= read -r -d '' f; do
  [ -e "dist/assets/$(basename "$f")" ] || rm -f "$f"
done
echo "deployed $(date -Is)"
