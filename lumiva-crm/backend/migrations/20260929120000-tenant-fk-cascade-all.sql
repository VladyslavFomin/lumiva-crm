-- Every tenant-scoped table gets a real FK to tenants(id) ON DELETE CASCADE.
--
-- Why: ~110 tables (Bookings/Hotels/Products/Marketing/WhatsApp/Esign/Helpdesk/AI/SEO/…) had a
-- tenantId/tenant_id column but NO foreign key to tenants at all. platformDeleteTenant() (pl1)
-- compensates at runtime since 2026-09-02, but any tenant removed another way — before that fix,
-- or by a plain `DELETE FROM tenants` (disposable verification tenants) — left orphaned rows
-- behind: 2026-09-29 found ~250k orphan rows across 23 deleted tenants, incl. 5 still-active
-- marketing integrations synced nightly and 15 integration_connections still holding tokens.
-- With the FK the database itself removes the rows, whichever path deletes the tenant.
--
-- Deliberately left WITHOUT a FK (history/billing that should outlive the tenant, or not tenant data):
--   audit_logs, tenant_logs, ai_usage_logs, iyzico_billing_checkouts, demo_requests,
--   company_tasks_backup_20260924 (one-off backup table), lead_activity (varchar tenantId; it
--   already cascades via leads).
--
-- Idempotent: deletes orphans first (the FK can't be created while they exist), then adds the
-- constraint only where no FK to tenants exists yet. Full backup taken before applying:
-- /root/deploy-backups/full_before_tenant_fk_2026-09-29.sql.gz

DO $$
DECLARE
  r record;
  n bigint;
  cname text;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('tenantId', 'tenant_id')
      AND c.data_type = 'uuid'
      AND c.table_name <> 'tenants'
      AND c.table_name NOT IN (
        'audit_logs', 'tenant_logs', 'ai_usage_logs', 'iyzico_billing_checkouts',
        'demo_requests', 'company_tasks_backup_20260924', 'lead_activity'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint k
        WHERE k.contype = 'f'
          AND k.conrelid = (quote_ident(c.table_name))::regclass
          AND k.confrelid = 'tenants'::regclass
      )
    ORDER BY c.table_name
  LOOP
    EXECUTE format(
      'DELETE FROM %I x WHERE x.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = x.%I)',
      r.table_name, r.column_name, r.column_name
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    cname := left('FK_' || r.table_name || '_tenant', 63);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES tenants(id) ON DELETE CASCADE',
      r.table_name, cname, r.column_name
    );
    RAISE NOTICE '% (%): orphans deleted %, FK added', r.table_name, r.column_name, n;
  END LOOP;
END $$;

-- lead_activity.userId → staff_users had no ON DELETE (NO ACTION): a tenant's staff (and even a
-- single staff user) with lead history couldn't be deleted. The author is optional — keep the
-- history row, drop the author.
ALTER TABLE lead_activity
  DROP CONSTRAINT IF EXISTS "FK_bb24033486d03d1fb044c89758c",
  ADD CONSTRAINT "FK_bb24033486d03d1fb044c89758c"
    FOREIGN KEY ("userId") REFERENCES staff_users(id) ON DELETE SET NULL;
