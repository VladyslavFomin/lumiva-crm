// One-off backfill: re-run today's plan-entitlements logic for every existing tenant.
//
// Before this fix, buildState() (plan-entitlements.ts) persisted an explicit `false` for every
// module/component a tenant's plan didn't allow. That "false" then survived any later plan
// upgrade — a tenant moved off free_locked (or upgraded standard -> professional/enterprise) kept
// showing every not-yet-allowed-at-the-old-plan item as disabled, forcing pl1 admins to manually
// re-toggle each one. buildState() now omits disallowed keys instead of writing `false`, so a
// fresh call correctly re-defaults them to enabled. This script applies that fresh call once to
// every tenant already in the database so the fix takes effect without waiting for their next
// plan change.
//
// Run: npx ts-node -r tsconfig-paths/register scripts/backfill-tenant-entitlements.ts
import { AppDataSource } from '../src/data-source';
import { Tenant } from '../src/tenants/tenant.entity';
import { buildPlanEntitlements } from '../src/tenants/plan-entitlements';

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Tenant);
  const tenants = await repo.find();

  let changed = 0;
  for (const tenant of tenants) {
    const before = JSON.stringify({
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });

    const ent = buildPlanEntitlements({
      plan: tenant.plan,
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });
    tenant.plan = ent.normalizedPlan;
    tenant.enabledModules = ent.enabledModules;
    tenant.enabledComponents = ent.enabledComponents;

    const after = JSON.stringify({
      enabledModules: tenant.enabledModules,
      enabledComponents: tenant.enabledComponents,
    });

    if (before !== after) {
      await repo.save(tenant);
      changed += 1;
      console.log(`Updated tenant ${tenant.id} (${tenant.clientKey}, plan=${tenant.plan})`);
    }
  }

  console.log(`Done. ${changed}/${tenants.length} tenants updated.`);
  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
