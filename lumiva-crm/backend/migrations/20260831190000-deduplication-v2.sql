-- Deduplication v2:
-- 1) contacts/leads/companies never had a delete_at column, yet
--    DeduplicationService.mergeContacts/mergeLeads/mergeCompanies already called
--    repo.softDelete() on them — TypeORM throws MissingDeleteDateColumnError for that (verified
--    against node_modules/typeorm/query-builder/SoftDeleteQueryBuilder.js), so every contact/lead/
--    company merge has been failing after the winner row was already saved but before the loser
--    was removed. Adding the column is what softDelete()/restore() need to actually work — once a
--    @DeleteDateColumn exists, TypeORM's standard repository methods automatically exclude
--    soft-deleted rows, so this doesn't require touching every other read path in the app.
-- 2) duplicate_pairs gets 'reasons' (which rule(s) matched, for the UI's "why" tags and rule
--    counts) and 'snapshot' (pre-merge winner field values + the full loser row, so a merge can
--    actually be undone — without this there is no way to reconstruct what was overwritten).
-- 3) dedup_settings: per-tenant merge behavior (master-record rule, empty-field fill, opt-in
--    auto-merge threshold for the nightly job).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE duplicate_pairs ADD COLUMN IF NOT EXISTS reasons TEXT[];
ALTER TABLE duplicate_pairs ADD COLUMN IF NOT EXISTS snapshot JSONB;

CREATE TABLE IF NOT EXISTS dedup_settings (
  "tenantId"          UUID PRIMARY KEY,
  "masterRule"        VARCHAR(16) NOT NULL DEFAULT 'oldest',
  "fillEmptyFields"   BOOLEAN NOT NULL DEFAULT true,
  "autoMergeThreshold" SMALLINT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
