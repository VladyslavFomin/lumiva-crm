#!/usr/bin/env bash
set -euo pipefail

echo "===== ДИАГНОСТИКА ДИСКА (до очистки) ====="
echo
df -h /
echo
echo "----- Docker usage -----"
docker system df || echo "docker system df: docker не отвечает"

echo
echo "===== ШАГ 1: Docker build cache + мусор ====="
read -rp "Очистить неиспользуемые docker-образы/контейнеры/кэш? [y/N]: " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  echo "-> docker system prune -af"
  docker system prune -af || echo "docker system prune: ошибка (проверь вручную)"

  echo "-> docker builder prune -af"
  docker builder prune -af || echo "docker builder prune: ошибка (проверь вручную)"
else
  echo "Пропускаем очистку Docker."
fi

echo
echo "===== ШАГ 2: apt-кэш и старые пакеты ====="
read -rp "Очистить apt-кэш и удалить неиспользуемые пакеты? [y/N]: " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  echo "-> apt-get clean"
  apt-get clean || echo "apt-get clean: ошибка"

  echo "-> apt-get autoremove --purge -y"
  apt-get autoremove --purge -y || echo "apt-get autoremove: ошибка"
else
  echo "Пропускаем очистку apt."
fi

echo
echo "===== ШАГ 3: systemd-журналы ====="
read -rp "Ограничить размер systemd-журналов до ~300M? [y/N]: " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  echo "-> journalctl --vacuum-size=300M"
  journalctl --vacuum-size=300M || echo "journalctl vacuum: ошибка (возможно, нет systemd)"
else
  echo "Пропускаем чистку журналов."
fi

echo
echo "===== ШАГ 4: старые сжатые логи в /var/log ====="
read -rp "Удалить сжатые логи (*.gz, *.1, *.2.gz) в /var/log? [y/N]: " ans
if [[ "$ans" =~ ^[Yy]$ ]]; then
  echo "-> find /var/log -type f \( -name '*.gz' -o -name '*.1' -o -name '*.2.gz' \) -delete"
  find /var/log -type f \( -name '*.gz' -o -name '*.1' -o -name '*.2.gz' \) -delete || echo "Ошибка при удалении логов"
else
  echo "Пропускаем удаление старых логов."
fi

echo
echo "===== ДИАГНОСТИКА ДИСКА (после очистки) ====="
df -h /
echo
echo "Готово ✅"
