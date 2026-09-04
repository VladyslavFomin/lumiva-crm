-- Account page redesign: personal 2FA, preferences/notifications, timezone, API-token last-used.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64),
  ADD COLUMN IF NOT EXISTS preferences JSONB,
  ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "twoFactorSecret" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" JSONB;

ALTER TABLE api_tokens
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
