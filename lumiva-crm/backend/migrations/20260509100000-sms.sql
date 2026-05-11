CREATE TABLE IF NOT EXISTS sms_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL UNIQUE,
  provider    VARCHAR(32) NOT NULL DEFAULT 'twilio',
  credentials JSONB NOT NULL DEFAULT '{}',
  "senderName" VARCHAR(64),
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_configs_tenant ON sms_configs ("tenantId");

CREATE TABLE IF NOT EXISTS sms_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  direction    VARCHAR(16) NOT NULL DEFAULT 'outbound',
  "fromPhone"  VARCHAR(64),
  "toPhone"    VARCHAR(64) NOT NULL,
  body         TEXT NOT NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'pending',
  provider     VARCHAR(32),
  "externalId" VARCHAR(255),
  "entityType" VARCHAR(32),
  "entityId"   UUID,
  "sentByUserId" UUID,
  meta         JSONB,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant   ON sms_messages ("tenantId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_entity   ON sms_messages ("tenantId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_sms_messages_external ON sms_messages ("provider", "externalId");
