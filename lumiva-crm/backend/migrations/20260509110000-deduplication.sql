CREATE TABLE IF NOT EXISTS duplicate_pairs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"   UUID NOT NULL,
  "entityType" VARCHAR(32) NOT NULL,
  "entityAId"  UUID NOT NULL,
  "entityBId"  UUID NOT NULL,
  score        SMALLINT NOT NULL DEFAULT 0,
  status       VARCHAR(16) NOT NULL DEFAULT 'pending',
  "resolvedAt" TIMESTAMPTZ,
  "resolvedBy" UUID,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", "entityType", "entityAId", "entityBId")
);

CREATE INDEX IF NOT EXISTS idx_dup_pairs_tenant  ON duplicate_pairs ("tenantId", "entityType", status);
CREATE INDEX IF NOT EXISTS idx_dup_pairs_entity_a ON duplicate_pairs ("tenantId", "entityType", "entityAId");
CREATE INDEX IF NOT EXISTS idx_dup_pairs_entity_b ON duplicate_pairs ("tenantId", "entityType", "entityBId");
