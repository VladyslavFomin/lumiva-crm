/** Строка insights Meta (campaign × day) → плоские колонки для превью/импорта в таблицу. */

export function flattenMetaAdsInsightRow(it: Record<string, unknown>): Record<string, string> {
  const s = (v: unknown) =>
    v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v);
  return {
    campaign_id: s(it.campaign_id),
    campaign_name: s(it.campaign_name),
    date_start: s(it.date_start),
    impressions: s(it.impressions),
    clicks: s(it.clicks),
    spend: s(it.spend),
  };
}

const PREFERRED = [
  'campaign_id',
  'campaign_name',
  'date_start',
  'impressions',
  'clicks',
  'spend',
];

export function mergeMetaAdsColumns(rows: Record<string, string>[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    Object.keys(r).forEach((k) => set.add(k));
  }
  const rest = [...set].filter((k) => !PREFERRED.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...PREFERRED.filter((k) => set.has(k)), ...rest];
}
