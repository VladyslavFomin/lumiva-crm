-- Short department code shown in the org-structure UI (e.g. "SALES", "HQ") — optional label,
-- not enforced unique at the DB level (tenants may leave it blank or reuse informally).

ALTER TABLE departments ADD COLUMN IF NOT EXISTS code VARCHAR(24);
