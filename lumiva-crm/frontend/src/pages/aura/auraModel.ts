import type { TFunction } from 'i18next';
import type { AuraConfig, AuraCustomWidget, AuraDensity, AuraFilterKey, AuraPeriod, AuraSourceKey, AuraStyle, AuraTheme, AuraViewer } from '../../api/aura';

/* Каталог — зеркало backend/src/aura/aura-catalog.ts (ключи и типы должны совпадать). */

export const AU_SOURCES: AuraSourceKey[] = ['leads', 'deals', 'team', 'calls', 'booking', 'stock', 'finance', 'marketing'];
export const AU_PERIODS: AuraPeriod[] = ['today', '7d', '30d', 'quarter', 'year'];
export const AU_FILTERS: AuraFilterKey[] = ['manager', 'channel', 'branch', 'product'];
export const AU_THEMES: AuraTheme[] = ['lumiva', 'bento', 'graphite', 'swiss', 'industry'];
export const AU_DENSITIES: AuraDensity[] = ['normal', 'compact', 'large'];
export const AU_VIEWERS: AuraViewer[] = ['me', 'leaders', 'team', 'tv'];
export const AU_REFRESH = [60, 300, 900, 3600];

export type AuWidgetType = 'kpi' | 'line' | 'donut' | 'funnel' | 'table' | 'bar' | 'col' | 'col2' | 'heat' | 'list' | 'goal';
export type AuWidgetMeta = { key: string; source: AuraSourceKey | 'extra' | 'custom'; type: AuWidgetType };

export const AU_WIDGETS: AuWidgetMeta[] = [
  { key: 'leads_kpi', source: 'leads', type: 'kpi' },
  { key: 'leads_line', source: 'leads', type: 'line' },
  { key: 'leads_src', source: 'leads', type: 'donut' },
  { key: 'leads_won', source: 'leads', type: 'kpi' },
  { key: 'deals_rev', source: 'deals', type: 'kpi' },
  { key: 'deals_conv', source: 'deals', type: 'kpi' },
  { key: 'deals_avg', source: 'deals', type: 'kpi' },
  { key: 'deals_funnel', source: 'deals', type: 'funnel' },
  { key: 'deals_table', source: 'deals', type: 'table' },
  { key: 'team_goal', source: 'team', type: 'goal' },
  { key: 'team_bar', source: 'team', type: 'bar' },
  { key: 'team_table', source: 'team', type: 'table' },
  { key: 'calls_kpi', source: 'calls', type: 'kpi' },
  { key: 'calls_miss', source: 'calls', type: 'kpi' },
  { key: 'calls_hours', source: 'calls', type: 'col' },
  { key: 'book_load', source: 'booking', type: 'kpi' },
  { key: 'book_heat', source: 'booking', type: 'heat' },
  { key: 'book_noshow', source: 'booking', type: 'kpi' },
  { key: 'book_count', source: 'booking', type: 'kpi' },
  { key: 'stock_kpi', source: 'stock', type: 'kpi' },
  { key: 'stock_low', source: 'stock', type: 'table' },
  { key: 'stock_top', source: 'stock', type: 'bar' },
  { key: 'fin_profit', source: 'finance', type: 'kpi' },
  { key: 'fin_pl', source: 'finance', type: 'col2' },
  { key: 'fin_mix', source: 'finance', type: 'donut' },
  { key: 'mk_cpl', source: 'marketing', type: 'kpi' },
  { key: 'mk_channels', source: 'marketing', type: 'bar' },
  { key: 'mk_spend', source: 'marketing', type: 'kpi' },
  { key: 'alerts', source: 'extra', type: 'list' },
  { key: 'compare', source: 'extra', type: 'line' },
];
export const AU_WIDGET = new Map(AU_WIDGETS.map((w) => [w.key, w]));

export const auDefaultWidgets = (sources: AuraSourceKey[]) =>
  sources.flatMap((s) => AU_WIDGETS.filter((w) => w.source === s).slice(0, 2).map((w) => w.key));

/** Варианты показателей для выбранных разделов (+ общие блоки). */
export const auWidgetOptions = (sources: AuraSourceKey[]) =>
  AU_WIDGETS.filter((w) => w.source === 'extra' || sources.includes(w.source as AuraSourceKey)).map((w) => w.key);

/* ---------- раскладка (порт auPack из макета) ---------- */

const SPAN: Record<AuWidgetType, number> = { kpi: 3, line: 8, donut: 4, funnel: 4, table: 6, bar: 6, col: 6, col2: 8, heat: 6, list: 6, goal: 4 };
export type AuPlaced = AuWidgetMeta & { span: number };

/** KPI — строками по 4 сверху, остальное — рядами по 12 колонок, последний в ряду добирает остаток. */
export function auPack(keys: string[], custom: AuraCustomWidget[] = []): AuPlaced[] {
  const cm = new Map(custom.map((c) => [c.id, { key: c.id, source: 'custom' as const, type: c.viz as AuWidgetType }]));
  const metas = keys.map((k) => AU_WIDGET.get(k) || cm.get(k)).filter(Boolean) as AuWidgetMeta[];
  const kpis = metas.filter((w) => w.type === 'kpi');
  const rest = metas.filter((w) => w.type !== 'kpi');
  const out: AuPlaced[] = [];
  kpis.forEach((w, i) => {
    const rowStart = Math.floor(i / 4) * 4;
    const n = Math.min(4, kpis.length - rowStart);
    out.push({ ...w, span: 12 / n });
  });
  let row: AuPlaced[] = [];
  let used = 0;
  const flush = () => {
    if (row.length && used < 12) row[row.length - 1].span += 12 - used;
    out.push(...row);
    row = [];
    used = 0;
  };
  rest.forEach((w) => {
    const s = SPAN[w.type] || 6;
    if (used + s > 12) flush();
    row.push({ ...w, span: s });
    used += s;
  });
  flush();
  return out;
}

/* ---------- шаблоны ---------- */

export type AuTemplate = {
  id: string;
  cat: 'sales' | 'marketing' | 'ops' | 'finance';
  theme: AuraTheme;
  density?: AuraDensity;
  kiosk?: boolean;
  period?: AuraPeriod;
  sources: AuraSourceKey[];
  widgets: string[];
  breakdown: AuraFilterKey[];
};

export const AU_TEMPLATES: AuTemplate[] = [
  { id: 'sales', cat: 'sales', theme: 'lumiva', sources: ['deals', 'team'], widgets: ['deals_rev', 'deals_conv', 'deals_avg', 'team_goal', 'deals_funnel', 'team_bar', 'deals_table'], breakdown: ['manager'] },
  { id: 'leads', cat: 'marketing', theme: 'bento', sources: ['leads', 'marketing'], widgets: ['leads_kpi', 'leads_won', 'mk_cpl', 'leads_line', 'leads_src', 'mk_channels'], breakdown: ['channel'] },
  { id: 'tv', cat: 'sales', theme: 'graphite', density: 'large', kiosk: true, period: 'today', sources: ['deals', 'calls', 'team'], widgets: ['deals_rev', 'calls_kpi', 'calls_miss', 'deals_conv', 'calls_hours', 'team_goal', 'team_bar'], breakdown: [] },
  { id: 'stock', cat: 'ops', theme: 'industry', sources: ['stock'], widgets: ['stock_kpi', 'stock_low', 'stock_top', 'alerts'], breakdown: ['product'] },
  { id: 'booking', cat: 'ops', theme: 'bento', sources: ['booking', 'calls'], widgets: ['book_load', 'book_count', 'book_noshow', 'calls_kpi', 'book_heat', 'calls_hours'], breakdown: ['branch'] },
  { id: 'finance', cat: 'finance', theme: 'swiss', sources: ['finance', 'marketing'], widgets: ['fin_profit', 'mk_spend', 'fin_pl', 'fin_mix', 'mk_channels'], breakdown: [] },
];
export const AU_TPL_CATS = ['all', 'sales', 'marketing', 'ops', 'finance'] as const;

/** Все виджеты шаблонов — одним запросом для превью. */
export const AU_TEMPLATE_WIDGETS = [...new Set(AU_TEMPLATES.flatMap((t) => t.widgets))];

/* ---------- черновик ---------- */

export type AuDraft = {
  prompt: string;
  sources: AuraSourceKey[];
  widgets: string[];
  period: AuraPeriod;
  breakdown: AuraFilterKey[];
  goals: { team_goal?: number | null };
  viewer: AuraViewer | null;
  theme: AuraTheme;
  density: AuraDensity;
  kiosk: boolean;
  title: string;
  step: number;
  /** Ждём разбор запроса ИИ на странице брифа. */
  briefPending?: boolean;
  /** Сборка в редакторе ещё не проиграна. */
  gen?: boolean;
  /** Сохранённое приложение, которое редактируется. */
  appId?: string | null;
  /** Шаблон-источник (для сообщения в чате). */
  tpl?: string | null;
  custom?: AuraCustomWidget[];
  style?: AuraStyle | null;
};

export const AU_EMPTY: AuDraft = {
  prompt: '',
  sources: ['leads', 'deals'],
  widgets: auDefaultWidgets(['leads', 'deals']),
  period: '30d',
  breakdown: [],
  goals: {},
  viewer: null,
  theme: 'lumiva',
  density: 'normal',
  kiosk: false,
  title: '',
  step: 0,
};

export const draftConfig = (d: AuDraft): AuraConfig => ({
  prompt: d.prompt,
  sources: d.sources,
  widgets: d.widgets,
  period: d.period,
  breakdown: d.breakdown,
  goals: d.goals,
  viewer: d.viewer,
  custom: d.custom || [],
  style: d.style || null,
});

export const draftFromTemplate = (tp: AuTemplate, title: string, viaAi: boolean): AuDraft => ({
  ...AU_EMPTY,
  prompt: '',
  sources: tp.sources,
  widgets: tp.widgets,
  period: tp.period || '30d',
  breakdown: tp.breakdown,
  theme: tp.theme,
  density: tp.density || 'normal',
  kiosk: !!tp.kiosk,
  viewer: tp.kiosk ? 'tv' : null,
  title,
  step: viaAi ? 0 : 5,
  gen: !viaAi,
  tpl: tp.id,
  appId: null,
});

/* ---------- подсказка разделов под полем ввода (до ИИ) ---------- */

const KEYWORDS: Array<[RegExp, AuraSourceKey]> = [
  [/лид|заявк|lead|başvuru|talep/i, 'leads'],
  [/сделк|продаж|воронк|выручк|deal|sale|revenue|funnel|satış|gelir|huni|ciro/i, 'deals'],
  [/менеджер|команд|сотрудн|отдел|manager|team|staff|ekip|personel|yönetici/i, 'team'],
  [/звон|sms|смс|телефон|call|phone|arama|telefon/i, 'calls'],
  [/брон|запис|загруз|салон|booking|appointment|rezervasyon|randevu|doluluk/i, 'booking'],
  [/склад|товар|остат|stock|inventor|product|stok|ürün|depo/i, 'stock'],
  [/финанс|прибыл|расход|p&l|доход|finance|profit|income|finans|gider/i, 'finance'],
  [/маркет|реклам|roi|канал|трафик|marketing|advert|traffic|channel|pazarlama|reklam|kanal/i, 'marketing'],
];
export const auDetectSources = (p: string): AuraSourceKey[] => {
  const s = KEYWORDS.filter(([r]) => r.test(p || '')).map(([, k]) => k);
  return s.length ? [...new Set(s)] : [];
};

/* ---------- форматирование ---------- */

export const auLocale = (lang: string) => (lang.startsWith('tr') ? 'tr-TR' : lang.startsWith('en') ? 'en-US' : 'ru-RU');

export function auFmt(n: number | null | undefined, format: 'int' | 'money' | 'pct' | 'num', currency: string, lang: string, opts: { unit?: 'pcs'; t?: TFunction; compact?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const loc = auLocale(lang);
  if (format === 'pct') return `${n.toLocaleString(loc, { maximumFractionDigits: 1 })}%`;
  if (format === 'num') return n.toLocaleString(loc, { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 });
  if (format === 'money') {
    const big = Math.abs(n) >= 1_000_000 || (opts.compact && Math.abs(n) >= 10_000);
    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency',
        currency,
        notation: big ? 'compact' : 'standard',
        maximumFractionDigits: big ? 2 : 0,
      }).format(n);
    } catch {
      return `${Math.round(n).toLocaleString(loc)} ${currency}`;
    }
  }
  const s = Math.round(n).toLocaleString(loc);
  return opts.unit === 'pcs' && opts.t ? `${s} ${opts.t('crm.aura.unit.pcs')}` : s;
}

/** Подпись бакета периода по оси X. */
export function auBucketLabel(label: string, granularity: 'hour' | 'day' | 'week' | 'month', lang: string): string {
  const loc = auLocale(lang);
  if (granularity === 'hour') return `${label}:00`;
  if (granularity === 'month') {
    const [y, m] = label.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(loc, { month: 'short', timeZone: 'UTC' });
  }
  const [y, m, d] = label.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(loc, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const auInitials = (n: string) =>
  String(n || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
