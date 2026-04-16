#!/usr/bin/env bash
# Проверка ручек маркетинга (нужен JWT в переменной TOKEN).
# Пример: export TOKEN='eyJ...' && export API=https://crm.lumiva.agency/v1 && ./scripts/verify-marketing-api.sh
set -euo pipefail
API="${API:-http://127.0.0.1:3000/v1}"
if [[ -z "${TOKEN:-}" ]]; then
  echo "Задайте TOKEN (Bearer JWT) и при необходимости API=.../v1" >&2
  exit 1
fi

echo "=== GET $API/marketing/integrations ==="
curl -sS -H "Authorization: Bearer $TOKEN" "$API/marketing/integrations" | head -c 800
echo ""

INT_ID="${INTEGRATION_ID:-}"
if [[ -z "$INT_ID" ]]; then
  echo "INTEGRATION_ID не задан — пропускаю POST sync (укажите UUID интеграции)." >&2
else
  echo "=== POST $API/marketing/integrations/$INT_ID/sync ==="
  curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{}' "$API/marketing/integrations/$INT_ID/sync"
  echo ""
fi

echo "=== GET $API/marketing/traffic (первые 1200 символов) ==="
curl -sS -H "Authorization: Bearer $TOKEN" "$API/marketing/traffic" | head -c 1200
echo ""

echo "Готово. В ответе traffic должны быть totalRows, providerBreakdown, items."
