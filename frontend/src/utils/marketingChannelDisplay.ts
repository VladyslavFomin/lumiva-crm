import type { TFunction } from 'i18next';

/**
 * Значения utm/source/medium/campaign из канала показываем как есть.
 * В БД иногда попадает строка-ключ i18n (crm.* или усечённый campaigns.common.*) — не показываем её пользователю.
 */
export function sanitizeMarketingDimension(
  value: string | null | undefined,
): string {
  const s = value?.trim();
  if (!s) return '—';
  if (s.startsWith('crm.') && /^crm\.[a-z0-9_.]+$/i.test(s)) return '—';
  // Без префикса crm. (старые/битые записи)
  if (
    /^[\w.]+$/i.test(s) &&
    /\.common\.(noCampaign|unknown|none|noData)$/i.test(s)
  ) {
    return '—';
  }
  return s;
}

/** Подпись для таблицы/графика: вместо «—» для кампании — человекочитаемый текст. */
export function formatMarketingChannelDimension(
  t: TFunction,
  value: string | null | undefined,
  kind: 'campaign' | 'source' | 'medium',
): string {
  const s = sanitizeMarketingDimension(value);
  if (s !== '—') return s;
  if (kind === 'campaign') {
    return t('crm.marketingChannels.common.noCampaign');
  }
  return t('crm.marketingChannels.common.none');
}
