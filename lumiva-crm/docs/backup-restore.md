# Бэкапы и восстановление Lumiva CRM

## Что и когда сохраняется

| Что | Когда | Где | Скрипт |
|---|---|---|---|
| База данных (`pg_dump -Fc`) + загруженные файлы | каждую ночь в 03:00 | `/var/backups/lumiva-crm/` | `/usr/local/bin/backup_lumiva_crm.sh` |
| Проверка восстановления | воскресенье, 04:30 | временный контейнер, живая база не затрагивается | `/usr/local/bin/restore_test_lumiva_crm.sh` |

Хранятся последние 14 комплектов. Каждый комплект — три файла:

- `db-YYYYMMDD-HHMMSS.dump.age` — база, зашифрованная;
- `files-YYYYMMDD-HHMMSS.tar.gz.age` — загруженные файлы (`/app/uploads`), зашифрованные;
- `checksums-YYYYMMDD-HHMMSS.sha256` — контрольные суммы.

Результат бэкапа и проверки приходит в Telegram.

## Ключи шифрования

Шифрование — [age](https://age-encryption.org).

- `/root/.lumiva-backup/age.pub` — открытый ключ. Им только шифруют; расшифровать им нельзя.
- `/root/.lumiva-backup/age.key` — **закрытый ключ**. Без него бэкап не восстановить.

> ⚠️ Копия `age.key` обязательно должна храниться **вне сервера**: в менеджере паролей
> (1Password, Bitwarden) или на флешке в сейфе. Если сервер погибнет вместе с ключом,
> зашифрованные бэкапы станут бесполезны.

Посмотреть ключ, чтобы сохранить его:

```bash
cat /root/.lumiva-backup/age.key
```

## Восстановление на новом сервере

1. Установить Docker, nginx, `age`: `apt install age`.
2. Развернуть код (`/root/lumiva-crm`) и запустить контейнеры из `infra/`, как на старом сервере.
3. Положить закрытый ключ в `/root/.lumiva-backup/age.key` (`chmod 600`).
4. Скопировать нужный комплект бэкапа и проверить контрольные суммы:

   ```bash
   cd /var/backups/lumiva-crm
   sha256sum -c checksums-<STAMP>.sha256
   ```

5. Восстановить базу (контейнер `lumiva_crm_db` должен быть запущен, база `lumiva_crm` — пустая):

   ```bash
   age -d -i /root/.lumiva-backup/age.key db-<STAMP>.dump.age > /tmp/db.dump
   docker cp /tmp/db.dump lumiva_crm_db:/tmp/db.dump
   docker exec lumiva_crm_db pg_restore -U lumiva -d lumiva_crm --no-owner --clean --if-exists /tmp/db.dump
   rm /tmp/db.dump
   ```

6. Восстановить файлы:

   ```bash
   age -d -i /root/.lumiva-backup/age.key files-<STAMP>.tar.gz.age \
     | tar -xzf - -C /var/lib/docker/volumes/infra_lumiva_crm_uploads/_data
   ```

7. Перезапустить API: `docker restart lumiva_crm_api`, проверить `https://crm.lumiva.agency/v1/health`.
8. Вернуть в crontab строки бэкапа (`0 3 * * *`) и проверки (`30 4 * * 0`).

## Ручной запуск

```bash
/usr/local/bin/backup_lumiva_crm.sh        # сделать бэкап сейчас
/usr/local/bin/restore_test_lumiva_crm.sh  # проверить последний бэкап
```

## Копия вне сервера — Backblaze B2

После каждого ночного бэкапа `/usr/local/bin/offsite_lumiva_crm.sh` отправляет зашифрованный
комплект в корзину B2 (доступ — `/root/.lumiva-backup/b2.env`, ключ ограничен этой корзиной):

- `daily/` — последние 30 комплектов;
- `monthly/` — комплект 1-го числа, последние 12.

После загрузки размер и SHA1 сверяются с локальными файлами. Еженедельная проверка
восстановления скачивает последний комплект **из B2**, а не с диска, — так проверяется
именно облачная копия. Корзина приватная, с шифрованием SSE-B2 и Object Lock.

### Восстановление, если сервер потерян полностью

Нужны три вещи: доступ к аккаунту Backblaze, закрытый ключ `age.key` (хранится у владельца
отдельно) и код из git.

```bash
apt install rclone age
export RCLONE_CONFIG=/dev/null RCLONE_CONFIG_B2_TYPE=b2 \
  RCLONE_CONFIG_B2_ACCOUNT=<keyID> RCLONE_CONFIG_B2_KEY=<applicationKey>
rclone lsf b2:<bucket>/daily/                      # выбрать последний STAMP
mkdir -p /var/backups/lumiva-crm && cd /var/backups/lumiva-crm
rclone copy b2:<bucket>/daily/ . --include '*<STAMP>*'
```

Дальше — шаги 4–8 раздела «Восстановление на новом сервере» выше.
