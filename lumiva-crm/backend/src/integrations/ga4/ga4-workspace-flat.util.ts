/** Строка GA4 Data API (дата × источник × …) → плоские колонки для превью/импорта в таблицу. */

export function flattenGa4WorkspaceRow(it: Record<string, unknown>): Record<string, string> {
  const s = (v: unknown) =>
    v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v);
  return {
    date: s(it.date),
    country_id: s(it.country_id),
    session_source: s(it.session_source),
    session_medium: s(it.session_medium),
    session_campaign_name: s(it.session_campaign_name),
    sessions: s(it.sessions),
    screen_page_views: s(it.screen_page_views),
  };
}

const PREFERRED = [
  'date',
  'country_id',
  'session_source',
  'session_medium',
  'session_campaign_name',
  'sessions',
  'screen_page_views',
];

export function mergeGa4WorkspaceColumns(rows: Record<string, string>[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    Object.keys(r).forEach((k) => set.add(k));
  }
  const rest = [...set].filter((k) => !PREFERRED.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...PREFERRED.filter((k) => set.has(k)), ...rest];
}

export function ga4WorkspaceRowId(flat: Record<string, string>): string {
  const raw = [
    flat.date || 'd',
    flat.country_id || 'c',
    flat.session_source || 's',
    flat.session_medium || 'm',
    flat.session_campaign_name || 'camp',
  ].join('_');
  return raw.replace(/\s+/g, '_').slice(0, 200);
}
