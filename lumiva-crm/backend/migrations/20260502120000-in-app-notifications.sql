CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  "userId"    UUID NOT NULL,
  title       VARCHAR(255),
  body        TEXT NOT NULL,
  "isRead"    BOOLEAN NOT NULL DEFAULT FALSE,
  meta        JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_user
  ON in_app_notifications ("tenantId", "userId", "createdAt" DESC);
