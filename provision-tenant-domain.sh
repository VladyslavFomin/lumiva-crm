#!/usr/bin/env bash
# Manually run by the admin after a tenant's custom domain is recorded as "pending" in pl1
# (TenantDetailsPage -> "Кастомный домен" -> Сохранить). Issues the cert and installs the
# nginx vhost from templates/tenant-domain.conf.template.
#
# Does NOT call the platform API itself (that would need a platform-admin credential sitting
# on disk, which is worse than just doing it by hand for something this rare) — after this
# script prints "Done", go flip the status in pl1 (TenantDetailsPage -> Кастомный домен ->
# "Отметить активным"), or "Отметить ошибкой" if it failed.
#
# Usage: ./provision-tenant-domain.sh <domain>

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"

TEMPLATE="/etc/nginx/templates/tenant-domain.conf.template"
VHOST_PATH="/etc/nginx/sites-available/${DOMAIN}.conf"
WEBROOT="/var/www/crm.lumiva.agency"

fail() {
  echo "FAILED: $1" >&2
  echo "Go mark this domain as failed in pl1 (Кастомный домен -> Отметить ошибкой) with this message." >&2
  exit 1
}

echo "==> Checking DNS for $DOMAIN"
RESOLVED_IP="$(dig +short "$DOMAIN" | tail -1)"
SERVER_IP="$(curl -s ifconfig.me || true)"
if [[ -z "$RESOLVED_IP" ]]; then
  fail "Домен $DOMAIN не резолвится — клиент ещё не настроил DNS"
fi
if [[ -n "$SERVER_IP" && "$RESOLVED_IP" != "$SERVER_IP" ]]; then
  echo "WARNING: $DOMAIN resolves to $RESOLVED_IP, this server is $SERVER_IP — continuing anyway, but this will likely fail the ACME challenge." >&2
fi

echo "==> Requesting certificate via certbot (webroot)"
if ! certbot certonly --non-interactive --agree-tos --webroot -w "$WEBROOT" -d "$DOMAIN" \
  --register-unsafely-without-email 2>/tmp/certbot-${DOMAIN}.log; then
  fail "certbot не смог выпустить сертификат: $(tail -5 /tmp/certbot-${DOMAIN}.log)"
fi

echo "==> Rendering nginx vhost"
sed "s/__DOMAIN__/${DOMAIN}/g" "$TEMPLATE" > "$VHOST_PATH"
ln -sf "$VHOST_PATH" "/etc/nginx/sites-enabled/${DOMAIN}.conf"

echo "==> Testing and reloading nginx"
if ! nginx -t 2>/tmp/nginx-test-${DOMAIN}.log; then
  rm -f "/etc/nginx/sites-enabled/${DOMAIN}.conf"
  fail "nginx -t упал после установки vhost: $(tail -5 /tmp/nginx-test-${DOMAIN}.log)"
fi
systemctl reload nginx

echo "Done. https://${DOMAIN} is live and should redirect / to /login."
echo "Now go to pl1 -> tenant -> Кастомный домен -> \"Отметить активным\"."
