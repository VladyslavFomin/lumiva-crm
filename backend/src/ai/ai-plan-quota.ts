import { normalizeTenantPlan } from '../tenants/plan-entitlements';

/** Включённый месячный пул AI в центах USD-эквивалента по тарифу ($5 = 500 для standard). */
export function defaultMonthlyAiIncludedCents(plan?: string | null): number {
  const p = normalizeTenantPlan(plan);
  switch (p) {
    case 'ultimate':
      return 2500;
    case 'enterprise':
      return 2000;
    case 'professional':
      return 1000;
    case 'standard':
    default:
      return 500;
  }
}
