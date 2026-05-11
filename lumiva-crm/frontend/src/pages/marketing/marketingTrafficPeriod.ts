/** UTC calendar date YYYY-MM-DD for marketing traffic APIs. */
export function marketingTrafficUtcTodayYmd(): string {
  const t = new Date();
  return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()))
    .toISOString()
    .slice(0, 10);
}

export function marketingTrafficAddUtcDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  const ms = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) + deltaDays * 864e5;
  const nd = new Date(ms);
  const yy = nd.getUTCFullYear();
  const mm = String(nd.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(nd.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export type MarketingTrafficPeriodPreset = '7d' | '30d' | '90d' | 'custom' | 'all';

export function marketingTrafficPresetRange(
  p: Exclude<MarketingTrafficPeriodPreset, 'all' | 'custom'>,
): { from: string; to: string } {
  const to = marketingTrafficUtcTodayYmd();
  const back = p === '7d' ? 6 : p === '30d' ? 29 : 89;
  return { from: marketingTrafficAddUtcDaysYmd(to, -back), to };
}

/** Same span as 90d — seeds the custom picker. */
export function marketingTrafficDefaultCustomRange(): { from: string; to: string } {
  return marketingTrafficPresetRange('90d');
}

export function marketingTrafficClampDateRange(range: {
  from: string;
  to: string;
}): { from: string; to: string } {
  let { from, to } = range;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { from, to };
}
