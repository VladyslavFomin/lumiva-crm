-- Sales Panel: admin-editable email templates (DB-backed, lazily seeded from code
-- defaults) + attachment metadata on the invitation audit trail.

CREATE TABLE IF NOT EXISTS sales_email_templates (
  language     VARCHAR(8) PRIMARY KEY,
  subject      TEXT NOT NULL,
  "bodyHtml"   TEXT NOT NULL,
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales_invitations ADD COLUMN IF NOT EXISTS attachments JSONB;
