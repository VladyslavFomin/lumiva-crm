-- Data visibility rules: per-role "own vs all records" / amounts / contact-masking / office-IP
-- login enforcement, plus the tenant-wide office IP allowlist those rules match against.
-- Absence of a row for a given (tenantId, role, ruleKey) means the rule is off (status quo —
-- see DataVisibilityService's defaults), same convention as staff_role_permissions.

CREATE TABLE IF NOT EXISTS staff_data_visibility_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  role        VARCHAR(32) NOT NULL,
  "ruleKey"   VARCHAR(32) NOT NULL,
  value       VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dvr_tenant_role_rule ON staff_data_visibility_rules ("tenantId", role, "ruleKey");

CREATE TABLE IF NOT EXISTS tenant_ip_allowlist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  UUID NOT NULL,
  cidr        VARCHAR(64) NOT NULL,
  label       VARCHAR(120),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_ip_allowlist_tenant ON tenant_ip_allowlist ("tenantId");
