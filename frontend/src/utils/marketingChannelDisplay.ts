/**
 * Значения utm/source/medium/campaign из канала показываем как есть.
 * В БД иногда попадает строка-ключ i18n (например crm.marketingCampaigns.common.noCampaign) — не показываем её пользователю.
 */
export function sanitizeMarketingDimension(
  value: string | null | undefined,
): string {
  const s = value?.trim();
  if (!s) return '—';
  if (s.startsWith('crm.') && /^crm\.[a-z0-9_.]+$/i.test(s)) return '—';
  return s;
}
