-- Fixes "не удалось удалить тенант: HTTP 500" in pl1 (platform admin) tenant deletion.
--
-- Root cause: platformDeleteTenant() only ever knew about 5 tables (staff_users, api_tokens,
-- leads, sites, users) from when the schema was much smaller. The schema has since grown to
-- 40+ tables with a direct `tenant_id`/`tenantId` FK to tenants(id) with ON DELETE CASCADE —
-- except these 3, which were created with no ON DELETE clause at all (defaults to NO ACTION),
-- so Postgres rejects the tenant DELETE whenever the tenant has any projects/staff rows left
-- (i.e. any real tenant). This migration brings them in line with every other tenant-scoped
-- table. The application-level fix (backend/src/tenants/tenants.service.ts) additionally
-- handles the non-tenant-scoped NO ACTION FKs (sales/crm_project_activities->crm_projects,
-- staff_users<->departments, crm_projects->project_tables) that CASCADE alone can't fix, since
-- those tables aren't linked to tenants(id) directly.

ALTER TABLE crm_projects
  DROP CONSTRAINT "FK_875aa907064c2c3950f05ab77bd",
  ADD CONSTRAINT "FK_875aa907064c2c3950f05ab77bd"
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE crm_project_activities
  DROP CONSTRAINT "FK_1f0996c7b8fbb26ebd471fa5c19",
  ADD CONSTRAINT "FK_1f0996c7b8fbb26ebd471fa5c19"
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE crm_staff_users
  DROP CONSTRAINT "FK_37294af8429ac35c9e2de682dd1",
  ADD CONSTRAINT "FK_37294af8429ac35c9e2de682dd1"
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
