import { MigrationInterface, QueryRunner } from 'typeorm';

/** Merges the free-text `CustomObject.meta.sidebarCategory` sidebar-grouping tag into real
 * WorkspaceArea rows, since the frontend no longer reads that tag (grouping is now by
 * workspaceAreaId — see WorkspaceSidebarBlock.tsx). Tables already sitting in a deliberately
 * chosen, non-'main' area just get the tag stripped. Tables that were never deliberately
 * placed (workspaceAreaId null or 'main') get moved into a real area named after their
 * category (find-or-create, case-insensitive match against existing area names first).
 * Also replicates WorkspaceAreasService.ensureDefaultArea() for any touched tenant that
 * currently has zero WorkspaceArea rows, so that service's "first list() call creates main"
 * invariant doesn't silently break for that tenant's other, non-categorized null-area rows. */
export class WorkspaceAreaCategoryBackfill1783200000000 implements MigrationInterface {
  name = 'WorkspaceAreaCategoryBackfill1783200000000';

  private static readonly PRESET_LABELS: Record<string, string> = {
    leads: 'Лиды',
    sales: 'Продажи',
    projects: 'Проекты',
    marketing: 'Маркетинг',
    finance: 'Финансы',
    other: 'Прочее',
  };

  private slugify(input: string): string {
    return (
      String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180) || 'workspace'
    );
  }

  private async uniqueSlug(
    queryRunner: QueryRunner,
    tenantId: string,
    base: string,
  ): Promise<string> {
    let candidate = this.slugify(base);
    let i = 1;
    for (;;) {
      const found = await queryRunner.query(
        `SELECT id FROM "workspace_areas" WHERE "tenantId" = $1 AND slug = $2`,
        [tenantId, candidate],
      );
      if (!found.length) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants: Array<{ id: string }> = await queryRunner.query(
      `SELECT DISTINCT "tenantId" AS id FROM "custom_objects"
       WHERE meta ? 'sidebarCategory' AND coalesce(meta->>'sidebarCategory', '') <> ''`,
    );

    for (const { id: tenantId } of tenants) {
      // Replicate ensureDefaultArea(): guarantee `main` exists and backfill ALL null-area
      // objects for this tenant (not just the categorized ones) before we touch anything,
      // so this tenant's auto-heal invariant still holds once WorkspaceArea count > 0.
      const areaCount = await queryRunner.query(
        `SELECT count(*)::int AS c FROM "workspace_areas" WHERE "tenantId" = $1`,
        [tenantId],
      );
      let mainId: string;
      if (areaCount[0].c === 0) {
        const inserted = await queryRunner.query(
          `INSERT INTO "workspace_areas"
             ("id", "tenantId", name, slug, "iconKey", "iconColor", "coverImageUrl", description, meta, "sortOrder", "createdAt", "updatedAt")
           VALUES (uuid_generate_v4(), $1, 'Основная рабочая область', 'main', 'home', '#3b82f6', NULL, NULL, NULL, 0, now(), now())
           RETURNING id`,
          [tenantId],
        );
        mainId = inserted[0].id;
        await queryRunner.query(
          `UPDATE "custom_objects" SET "workspaceAreaId" = $1 WHERE "tenantId" = $2 AND "workspaceAreaId" IS NULL`,
          [mainId, tenantId],
        );
      } else {
        const main = await queryRunner.query(
          `SELECT id FROM "workspace_areas" WHERE "tenantId" = $1 AND slug = 'main'`,
          [tenantId],
        );
        // Invariant: once areaCount > 0, WorkspaceAreasService.ensureDefaultArea() guarantees
        // a 'main' row exists (create()/list()/getOne() all call it first) — but be defensive
        // in case this tenant's areas predate that invariant somehow.
        mainId = main.length ? main[0].id : '';
      }

      const rows: Array<{
        id: string;
        workspaceAreaId: string | null;
        sidebarCategory: string;
      }> = await queryRunner.query(
        `SELECT id, "workspaceAreaId", meta->>'sidebarCategory' AS "sidebarCategory"
         FROM "custom_objects"
         WHERE "tenantId" = $1 AND meta ? 'sidebarCategory' AND coalesce(meta->>'sidebarCategory', '') <> ''`,
        [tenantId],
      );

      for (const row of rows) {
        const deliberatePlacement =
          row.workspaceAreaId != null && row.workspaceAreaId !== mainId;
        if (deliberatePlacement) {
          await queryRunner.query(
            `UPDATE "custom_objects" SET meta = meta - 'sidebarCategory' WHERE id = $1`,
            [row.id],
          );
          continue;
        }

        const raw = row.sidebarCategory.trim();
        const targetName =
          WorkspaceAreaCategoryBackfill1783200000000.PRESET_LABELS[raw] ?? raw;

        const existing = await queryRunner.query(
          `SELECT id FROM "workspace_areas" WHERE "tenantId" = $1 AND lower(name) = lower($2) LIMIT 1`,
          [tenantId, targetName],
        );

        let targetAreaId: string;
        if (existing.length) {
          targetAreaId = existing[0].id;
        } else {
          const slug = await this.uniqueSlug(queryRunner, tenantId, targetName);
          const inserted = await queryRunner.query(
            `INSERT INTO "workspace_areas"
               ("id", "tenantId", name, slug, "iconKey", "iconColor", "coverImageUrl", description, meta, "sortOrder", "createdAt", "updatedAt")
             VALUES (uuid_generate_v4(), $1, $2, $3, 'folder', '#6366f1', NULL, NULL, NULL, 0, now(), now())
             RETURNING id`,
            [tenantId, targetName, slug],
          );
          targetAreaId = inserted[0].id;
        }

        await queryRunner.query(
          `UPDATE "custom_objects" SET "workspaceAreaId" = $1, meta = meta - 'sidebarCategory' WHERE id = $2`,
          [targetAreaId, row.id],
        );
      }
    }
  }

  public async down(): Promise<void> {
    // Intentionally a no-op — this reassigns tables into new areas and strips a legacy tag;
    // by the time this could be rolled back, users may have edited/renamed/deleted the new
    // areas or the affected tables, so blindly reverting risks destroying real changes. Same
    // rationale as EsignDefaultTemplates1782300000000.
  }
}
