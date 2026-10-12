/* Демо-данные для превью Aura на публичной главной. Никаких реальных данных клиентов —
 * только иллюстрация того, как выглядит дашборд; на странице подписано «Пример на демо-данных». */
import type { AuraData, AuraWidgetData } from '../../api/aura';

export type LandingDemoText = { managers: string[]; deals: string[]; products: string[]; channels: string[] };

const days = (n: number) => {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

/** Гладкая «живая» кривая без случайности — одинаковая при каждом рендере. */
const wave = (n: number, base: number, amp: number, trend: number, phase = 0) =>
  Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base + trend * i + amp * Math.sin(i / 2.3 + phase) + (amp / 2) * Math.sin(i / 0.9 + phase))));

const kpi = (value: number, format: 'int' | 'money' | 'pct', delta: number, good: boolean | null, spark: number[], pp = false, unit?: 'pcs'): AuraWidgetData => ({
  type: 'kpi',
  value,
  format,
  ...(unit ? { unit } : {}),
  delta: { kind: pp ? 'pp' : 'pct', value: delta },
  good,
  spark,
});

export function landingDemoData(tx: LandingDemoText): AuraData {
  const labels = days(30);
  const m = tx.managers;
  const widgets: Record<string, AuraWidgetData> = {
    deals_rev: kpi(84250, 'money', 12.4, true, wave(14, 5200, 900, 120)),
    deals_conv: kpi(27.6, 'pct', 3.1, true, wave(14, 24, 2, 0.25), true),
    deals_avg: kpi(2340, 'money', 4.8, true, wave(14, 2100, 180, 12, 1)),
    team_goal: { type: 'goal', target: 100000, done: 84250, pct: 84, daysLeft: 9 },
    deals_funnel: { type: 'funnel', steps: [{ key: 'all', value: 412 }, { key: 'contacted', value: 318 }, { key: 'active', value: 164 }, { key: 'won', value: 36 }] },
    team_bar: { type: 'bar', format: 'money', people: true, items: [{ name: m[0], value: 24800 }, { name: m[1], value: 19650 }, { name: m[2], value: 16400 }, { name: m[3], value: 13100 }, { name: m[4], value: 10300 }] },
    deals_table: {
      type: 'table',
      cols: [{ key: 'deal', kind: 'text' }, { key: 'manager', kind: 'person' }, { key: 'status', kind: 'chip' }, { key: 'amount', kind: 'money' }],
      rows: [
        { deal: tx.deals[0], manager: m[0], status: 'confirmed', amount: 12400 },
        { deal: tx.deals[1], manager: m[1], status: 'confirmed', amount: 9800 },
        { deal: tx.deals[2], manager: m[2], status: 'pending', amount: 7350 },
        { deal: tx.deals[3], manager: m[3], status: 'new', amount: 5200 },
        { deal: tx.deals[4], manager: m[0], status: 'confirmed', amount: 4600 },
      ],
    },
    leads_kpi: kpi(412, 'int', 18.2, true, wave(14, 26, 5, 0.6)),
    leads_won: kpi(36, 'int', 9.1, true, wave(14, 2, 1, 0.08, 2)),
    mk_cpl: kpi(14.2, 'money', -6.3, true, wave(14, 15, 1.2, -0.08, 0.5)),
    leads_line: { type: 'line', format: 'int', current: wave(30, 10, 3, 0.18), previous: wave(30, 9, 2.5, 0.05, 1.7), total: 412, prevTotal: 349 },
    leads_src: { type: 'donut', format: 'int', items: [{ key: 'web', name: 'web', value: 148 }, { key: 'whatsapp', name: 'whatsapp', value: 96 }, { key: 'instagram', name: 'instagram', value: 71 }, { key: 'telegram', name: 'telegram', value: 58 }, { key: 'other', name: 'other', value: 39 }] },
    mk_channels: { type: 'bar', format: 'money', items: tx.channels.map((name, i) => ({ name, value: [2480, 1920, 1150, 640][i] ?? 300 })) },
    calls_kpi: kpi(186, 'int', 7.5, true, wave(12, 14, 4, 0.4)),
    calls_miss: kpi(9, 'int', -22, true, wave(12, 1, 1, 0, 3)),
    calls_hours: { type: 'col', labels: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18], data: [12, 21, 26, 19, 14, 23, 28, 22, 15, 6] },
    // Бронирования (шаблон «Загрузка салона»): занятость, записи, неявки, теплокарта по дням недели и часам.
    book_load: kpi(74.5, 'pct', 3.2, true, wave(14, 70, 4, 0.3), true),
    book_count: kpi(642, 'int', 8.1, true, wave(14, 44, 7, 0.5)),
    book_noshow: kpi(4.2, 'pct', -1.1, true, wave(14, 5, 1, -0.05), true),
    book_heat: {
      type: 'heat',
      hours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      values: [
        [0, 1, 2, 2, 1, 2, 3, 3, 2, 1, 0, 0],
        [1, 4, 6, 5, 3, 4, 6, 7, 6, 4, 2, 0],
        [1, 5, 7, 6, 4, 5, 7, 8, 7, 5, 2, 1],
        [2, 5, 6, 6, 4, 6, 8, 8, 7, 5, 3, 1],
        [1, 4, 7, 7, 5, 6, 8, 9, 8, 6, 3, 1],
        [2, 6, 8, 8, 6, 7, 9, 9, 9, 7, 4, 2],
        [3, 7, 9, 9, 8, 8, 9, 8, 6, 4, 2, 0],
      ],
    },
    stock_kpi: kpi(3840, 'int', -4.2, null, wave(14, 4000, 120, -12), false, 'pcs'),
    stock_low: {
      type: 'table',
      cols: [{ key: 'product', kind: 'text' }, { key: 'sku', kind: 'text' }, { key: 'qty', kind: 'int' }, { key: 'left', kind: 'days' }],
      rows: [
        { product: tx.products[0], sku: 'CF-1000', qty: 14, left: 3 },
        { product: tx.products[1], sku: 'FL-102', qty: 40, left: 5 },
        { product: tx.products[2], sku: 'SY-VAN', qty: 9, left: 6 },
        { product: tx.products[3], sku: 'CP-350', qty: 220, left: 11 },
      ],
    },
    stock_top: { type: 'bar', format: 'int', unit: 'pcs', items: tx.products.slice(0, 5).map((name, i) => ({ name, value: [640, 515, 430, 310, 245][i] })) },
    alerts: {
      type: 'list',
      items: [
        { kind: 'low_stock', n: 3, name: tx.products[0] },
        { kind: 'stale_leads', n: 7 },
        { kind: 'missed_calls', n: 9 },
      ],
    },
  };
  return {
    period: { key: '30d', from: labels[0], to: labels[labels.length - 1], granularity: 'day', labels },
    currency: 'EUR',
    generatedAt: new Date().toISOString(),
    own: false,
    widgets,
    filterOptions: {},
  };
}
