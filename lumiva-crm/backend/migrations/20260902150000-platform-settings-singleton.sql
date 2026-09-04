-- Enforces at-most-one-row on platform_settings at the DB level.
--
-- getSettings()/updateSettings() (platform-settings.service.ts) do a plain
-- `findOne({where:{}})` then create-if-missing — two concurrent first-time saves (deploy-time
-- race) could both see no row and both insert, after which getSettings() returns whichever
-- row Postgres happens to pick, making platform config (Stripe/OpenAI keys, OAuth apps) appear
-- to "randomly revert". A unique index on a constant expression is the standard Postgres
-- pattern for enforcing a true singleton table with no natural unique key of its own.
--
-- Confirmed exactly 1 existing row at the time of this migration — applies cleanly.

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_platform_settings_singleton"
  ON platform_settings ((true));
