-- Custom domain per tenant (white-label URL), configured only from pl1 by an admin — no
-- tenant self-service. See scripts/provision-tenant-domain.sh for the manual cert/vhost step
-- that flips status from pending to active/failed.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain_status VARCHAR(16) NOT NULL DEFAULT 'none';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_custom_domain_unique'
  ) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_custom_domain_unique UNIQUE (custom_domain);
  END IF;
END $$;
