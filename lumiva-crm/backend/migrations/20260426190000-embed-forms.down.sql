-- Откат миграции embed_forms (выполнять только при необходимости, данные будут потеряны)
BEGIN;
DROP TABLE IF EXISTS "embed_form_uploads" CASCADE;
DROP TABLE IF EXISTS "embed_forms" CASCADE;
COMMIT;
