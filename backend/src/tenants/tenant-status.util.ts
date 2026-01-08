// backend/src/tenants/tenant-status.util.ts
import type { Tenant } from './tenant.entity';

export type TenantBlockReason = 'blocked' | 'expired';

/**
 * Возвращает причину блокировки тенанта, если он неактивен.
 * - blocked  → статус не active
 * - expired  → есть activeUntil и дата в прошлом
 */
export function getTenantBlockReason(
  tenant: Tenant | null | undefined,
): TenantBlockReason | null {
  if (!tenant) return 'blocked';

  if (tenant.status && tenant.status !== 'active') {
    return 'blocked';
  }

  if (
    tenant.activeUntil &&
    tenant.activeUntil.getTime() <= Date.now()
  ) {
    return 'expired';
  }

  return null;
}

export function isTenantActive(tenant: Tenant | null | undefined): boolean {
  return !getTenantBlockReason(tenant);
}
