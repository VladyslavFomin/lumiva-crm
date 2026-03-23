/**
 * Квоты хранилища по тарифу (байты) + опционально докупка.
 * Уровни: 1 → 3 ГБ, 2 → 5 ГБ, 3 → 10 ГБ, ultimate → «по договорённости» (null = без лимита в UI).
 */
export function getStorageBaseQuotaBytes(plan?: string | null): number | null {
  const p = (plan || '').trim().toLowerCase();
  if (p === 'ultimate') return null;
  if (p === 'enterprise') return 10 * 1024 * 1024 * 1024;
  if (p === 'pro' || p === 'professional') return 5 * 1024 * 1024 * 1024;
  if (
    p === 'basic' ||
    p === 'starter' ||
    p === 'standard' ||
    p === 'free' ||
    p === 'free_locked' ||
    p === ''
  ) {
    return 3 * 1024 * 1024 * 1024;
  }
  return 3 * 1024 * 1024 * 1024;
}

export function getTotalStorageQuotaBytes(
  plan: string | null | undefined,
  extraBytes: number,
): number | null {
  const base = getStorageBaseQuotaBytes(plan);
  if (base === null) return null;
  return base + Math.max(0, extraBytes);
}
