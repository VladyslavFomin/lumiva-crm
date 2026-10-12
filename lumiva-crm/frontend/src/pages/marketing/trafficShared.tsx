/** Общие хелперы страницы «Трафик» и панели аналитики канала (дизайн marketing-traffic.html). */
import React from 'react';
import type { TFunction } from 'i18next';
import type { MarketingTrafficStats } from '../../api/marketing';
import { sanitizeMarketingDimension } from '../../utils/marketingChannelDisplay';
import { convertMarketingAmount, type MarketingCurrencyMode } from './marketingDisplayCurrencyStorage';

export type TrafficItem = MarketingTrafficStats['items'][number];

export const TI = {
  refresh: (
    <>
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 4v5h-5" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 9.5c.5-1 1.4-1.5 2.5-1.5 1.5 0 2.5.8 2.5 2s-1 1.7-2.5 2-2.5.8-2.5 2 1 2 2.5 2c1.1 0 2-.5 2.5-1.5M12 6.5v1.5M12 16v1.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M6 18L18 6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
};

/** Рекламные площадки: у них вместо лидов/выручки CRM — конверсии и их ценность по данным кабинета. */
export const isAdsSource = (ds: string) => /^(google_ads|meta_ads|yandex_direct|vk_ads)/.test(ds);

/** Ключ канала строки: пустой dataSource → 'unknown'. */
export const dsOf = (it: TrafficItem) => (it.dataSource || '').trim() || 'unknown';

export const curOf = (it: { currency?: string | null }) => (it.currency || 'EUR').toUpperCase().slice(0, 8);

export type Sums = {
  impressions: number;
  clicks: number;
  sessions: number;
  leads: number;
  cost: number;
  revenue: number;
  conversions: number;
  conversionValue: number;
};

export function sumRows(rows: TrafficItem[]): Sums & { ctr: number | null } {
  const a: Sums = { impressions: 0, clicks: 0, sessions: 0, leads: 0, cost: 0, revenue: 0, conversions: 0, conversionValue: 0 };
  for (const r of rows) {
    a.impressions += r.impressions || 0;
    a.clicks += r.clicks || 0;
    a.sessions += r.sessions || 0;
    a.leads += r.leads || 0;
    a.cost += r.cost || 0;
    a.revenue += r.revenue || 0;
    a.conversions += r.conversions || 0;
    a.conversionValue += r.conversionValue || 0;
  }
  /** Для GA4 «показы» = просмотры страниц (как клики) — отношение 1:1, не рекламный CTR. */
  const ctr = a.impressions > 0 && a.clicks !== a.impressions ? (a.clicks / a.impressions) * 100 : null;
  return { ...a, ctr };
}

export function dominantCurrency(rows: Array<{ currency?: string | null; cost?: number; revenue?: number }>): string {
  const w: Record<string, number> = {};
  for (const r of rows) {
    const c = curOf(r);
    w[c] = (w[c] || 0) + Math.abs(r.cost || 0) + Math.abs(r.revenue || 0) + 1e-6;
  }
  return Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] || 'EUR';
}

export type CurCtx = { mode: MarketingCurrencyMode; display: string; rates: Record<string, number> };

/** Сумма в валюте отчёта; в режиме «как в канале» — исходная валюта. missing — нет курса (осталась исходная). */
export type Money = { v: number; c: string; miss: boolean };

export function moneyOf(ctx: CurCtx, amount: number, from: string): Money {
  const r = convertMarketingAmount(amount, from, ctx.mode, ctx.display, ctx.rates);
  return { v: r.value, c: r.currency, miss: r.missingRate && ctx.mode === 'converted' };
}

/** Сумма по строкам с пересчётом каждой строки из её валюты. Если валюты не сводятся — c = null. */
export function sumMoney<T extends { currency?: string | null }>(
  ctx: CurCtx,
  rows: T[],
  pick: (r: T) => number,
): { v: number; c: string | null; miss: boolean } {
  let v = 0;
  let miss = false;
  const curs = new Set<string>();
  for (const r of rows) {
    const amt = pick(r) || 0;
    if (!amt) continue;
    const m = moneyOf(ctx, amt, curOf(r));
    v += m.v;
    curs.add(m.c);
    if (m.miss) miss = true;
  }
  const c = curs.size === 0 ? (ctx.mode === 'converted' ? ctx.display : dominantCurrency(rows)) : curs.size === 1 ? [...curs][0] : null;
  return { v, c, miss };
}

export const isEmptyDim = (v: string | null | undefined) => {
  const s = sanitizeMarketingDimension(v);
  return s === '—' || /^\(?(not set|none)\)?$/i.test(s);
};

export const dimLabel = (t: TFunction, v: string | null | undefined) =>
  isEmptyDim(v) ? t('crm.trafficPage.notSet') : sanitizeMarketingDimension(v);

/** Поиск без учёта турецких букв (как на сервере): İ/ı→i, ş→s, ç→c, ğ→g, ö→o, ü→u. */
export function foldTr(v: string): string {
  return v
    .toLocaleLowerCase('tr')
    .replace(/̇/g, '')
    .replace(/[ışçğöüâîû]/g, (ch) => 'iscgouaiu'['ışçğöüâîû'.indexOf(ch)]);
}

export function makeFormatters(locale: string) {
  const nf = (v: number) => Math.round(v || 0).toLocaleString(locale);
  const mf = (v: number) => (v || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /** Крупные суммы в KPI/таблицах — компактно (48,2 тыс. / 48.2K). */
  const mk = (v: number) =>
    Math.abs(v || 0) >= 10_000 ? (v || 0).toLocaleString(locale, { notation: 'compact', maximumFractionDigits: 1 }) : mf(v);
  return { nf, mf, mk };
}

export const Dash: React.FC = () => <span className="tr-na">—</span>;
