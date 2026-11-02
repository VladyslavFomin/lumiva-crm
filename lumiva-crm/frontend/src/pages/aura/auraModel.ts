import type { TFunction } from 'i18next';
import type { AuraBlockLayout, AuraConfig, AuraCustomWidget, AuraDensity, AuraFilterKey, AuraPeriod, AuraSourceKey, AuraStyle, AuraTheme, AuraViewer } from '../../api/aura';

/* Каталог — зеркало backend/src/aura/aura-catalog.ts (ключи и типы должны совпадать). */

export const AU_SOURCES: AuraSourceKey[] = ['leads', 'deals', 'team', 'calls', 'booking', 'stock', 'finance', 'marketing'];
export const AU_PERIODS: AuraPeriod[] = ['today', '7d', '30d', 'quarter', 'year'];
export const AU_FILTERS: AuraFilterKey[] = ['manager', 'channel', 'branch', 'product'];
export const AU_THEMES: AuraTheme[] = ['lumiva', 'aurora', 'frost', 'mist', 'ember', 'obsidian', 'nebula', 'bento', 'graphite', 'swiss', 'industry'];
/** Темы с жидким стеклом: живой фон, размытие карточек, блик за курсором. */
export const AU_GLASS = new Set<AuraTheme>(['aurora', 'frost', 'mist', 'ember', 'obsidian', 'nebula']);
/** Новые темы — для бейджа «новое». */
export const AU_NEW_THEMES = new Set<AuraTheme>(['aurora', 'frost', 'mist', 'ember', 'obsidian', 'nebula']);
export const AU_DENSITIES: AuraDensity[] = ['normal', 'compact', 'large'];
export const AU_VIEWERS: AuraViewer[] = ['me', 'leaders', 'team', 'tv'];
export const AU_REFRESH = [60, 300, 900, 3600];

export type AuWidgetType =
  | 'kpi'
  | 'line'
  | 'donut'
  | 'funnel'
  | 'table'
  | 'bar'
  | 'col'
  | 'col2'
  | 'heat'
  | 'list'
  | 'goal'
  | 'hero'
  | 'check'
  | 'gauge'
  | 'segbar'
  | 'forecast'
  | 'stream'
  | 'status'
  | 'multi'
  | 'split'
  | 'cal'
  | 'note'
  | 'section';
export type AuWidgetMeta = { key: string; source: AuraSourceKey | 'extra' | 'custom' | 'deco'; type: AuWidgetType };

/** Оформление без данных: заметка (n_…) и заголовок раздела (s_…); текст — в layout[key].text. */
export const auIsDeco = (k: string) => /^[ns]_[a-z0-9]{4,12}$/.test(k);
export const auNewDecoKey = (kind: 'note' | 'section') => `${kind === 'note' ? 'n' : 's'}_${Math.random().toString(36).slice(2, 10)}`;
export const auNewCustomKey = () => `c_${Math.random().toString(36).slice(2, 10)}`;

/** «Показать как»: в какие виды можно переключить данные блока (первый — родной вид). */
export const AU_VIEWS: Partial<Record<AuWidgetType, string[]>> = {
  kpi: ['kpi', 'kpi_line', 'kpi_ticks', 'kpi_bare', 'kpi_ring'],
  line: ['line', 'area', 'columns', 'kpi'],
  multi: ['multi', 'stacked', 'table'],
  donut: ['donut', 'pie', 'bar', 'segbar', 'table'],
  bar: ['bar', 'donut', 'columns', 'table'],
  segbar: ['segbar', 'donut', 'bar', 'table'],
  col: ['col', 'bar'],
  col2: ['col2', 'table'],
  funnel: ['funnel', 'bar', 'table'],
  gauge: ['gauge', 'donut', 'segbar'],
  split: ['split', 'donut'],
  table: ['table'],
};
/** Типы, где есть список значений (топ-N и сортировка имеют смысл). */
export const AU_LISTY = new Set(['donut', 'pie', 'bar', 'segbar', 'table', 'columns_items', 'funnel']);

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
  { key: 'leads_cal', source: 'leads', type: 'cal' },
  { key: 'leads_status', source: 'leads', type: 'segbar' },
  { key: 'leads_gauge', source: 'leads', type: 'gauge' },
  { key: 'leads_stream', source: 'leads', type: 'stream' },
  { key: 'deals_forecast', source: 'deals', type: 'forecast' },
  { key: 'deals_split', source: 'deals', type: 'split' },
  { key: 'deals_cal', source: 'deals', type: 'cal' },
  { key: 'deals_stream', source: 'deals', type: 'stream' },
  { key: 'team_load', source: 'team', type: 'bar' },
  { key: 'calls_line', source: 'calls', type: 'line' },
  { key: 'calls_split', source: 'calls', type: 'split' },
  { key: 'calls_gauge', source: 'calls', type: 'gauge' },
  { key: 'calls_stream', source: 'calls', type: 'stream' },
  { key: 'book_line', source: 'booking', type: 'line' },
  { key: 'book_gauge', source: 'booking', type: 'gauge' },
  { key: 'book_status', source: 'booking', type: 'segbar' },
  { key: 'book_upcoming', source: 'booking', type: 'stream' },
  { key: 'stock_value', source: 'stock', type: 'kpi' },
  { key: 'stock_health', source: 'stock', type: 'segbar' },
  { key: 'stock_gauge', source: 'stock', type: 'gauge' },
  { key: 'fin_income', source: 'finance', type: 'kpi' },
  { key: 'fin_margin', source: 'finance', type: 'kpi' },
  { key: 'fin_line', source: 'finance', type: 'line' },
  { key: 'fin_forecast', source: 'finance', type: 'forecast' },
  { key: 'mk_line', source: 'marketing', type: 'line' },
  { key: 'mk_mix', source: 'marketing', type: 'donut' },
  { key: 'hero', source: 'extra', type: 'hero' },
  { key: 'setup', source: 'extra', type: 'check' },
  { key: 'stream', source: 'extra', type: 'stream' },
  { key: 'pulse', source: 'extra', type: 'status' },
  { key: 'activity', source: 'extra', type: 'multi' },
];
export const AU_WIDGET = new Map(AU_WIDGETS.map((w) => [w.key, w]));

/** Какие разделы реально нужны блоку для расчёта — зеркало backend AURA_WIDGETS[].needs. */
export const AU_WIDGET_NEEDS: Record<string, AuraSourceKey[]> = {
  leads_kpi: ['leads'],
  leads_line: ['leads'],
  leads_src: ['leads'],
  leads_won: ['leads'],
  deals_rev: ['deals'],
  deals_conv: ['leads'],
  deals_avg: ['deals'],
  deals_funnel: ['leads'],
  deals_table: ['deals'],
  team_goal: ['deals'],
  team_bar: ['deals'],
  team_table: ['deals', 'leads'],
  calls_kpi: ['calls'],
  calls_miss: ['calls'],
  calls_hours: ['calls'],
  book_load: ['booking'],
  book_heat: ['booking'],
  book_noshow: ['booking'],
  book_count: ['booking'],
  stock_kpi: ['stock'],
  stock_low: ['stock'],
  stock_top: ['stock'],
  fin_profit: ['finance'],
  fin_pl: ['finance'],
  fin_mix: ['finance'],
  mk_cpl: ['marketing', 'leads'],
  mk_channels: ['marketing'],
  mk_spend: ['marketing'],
  alerts: [],
  compare: ['deals'],
  leads_cal: ['leads'],
  leads_status: ['leads'],
  leads_gauge: ['leads'],
  leads_stream: ['leads'],
  deals_forecast: ['deals'],
  deals_split: ['deals'],
  deals_cal: ['deals'],
  deals_stream: ['deals'],
  team_load: ['leads'],
  calls_line: ['calls'],
  calls_split: ['calls'],
  calls_gauge: ['calls'],
  calls_stream: ['calls'],
  book_line: ['booking'],
  book_gauge: ['booking'],
  book_status: ['booking'],
  book_upcoming: ['booking'],
  stock_value: ['stock'],
  stock_health: ['stock'],
  stock_gauge: ['stock'],
  fin_income: ['finance'],
  fin_margin: ['finance'],
  fin_line: ['finance'],
  fin_forecast: ['finance'],
  mk_line: ['marketing'],
  mk_mix: ['marketing'],
  hero: [],
  setup: [],
  stream: [],
  pulse: [],
  activity: [],
};

export const auDefaultWidgets = (sources: AuraSourceKey[]) =>
  sources.flatMap((s) => AU_WIDGETS.filter((w) => w.source === s).slice(0, 2).map((w) => w.key));

/** Варианты показателей для выбранных разделов (+ общие блоки). */
export const auWidgetOptions = (sources: AuraSourceKey[]) =>
  AU_WIDGETS.filter((w) => w.source === 'extra' || sources.includes(w.source as AuraSourceKey)).map((w) => w.key);

/* ---------- раскладка (порт auPack из макета) ---------- */

const SPAN: Record<AuWidgetType, number> = {
  kpi: 3,
  line: 8,
  donut: 4,
  funnel: 4,
  table: 6,
  bar: 6,
  col: 6,
  col2: 8,
  heat: 6,
  list: 6,
  goal: 4,
  hero: 8,
  check: 4,
  gauge: 4,
  segbar: 6,
  forecast: 6,
  stream: 6,
  status: 4,
  multi: 8,
  split: 4,
  cal: 8,
  note: 4,
  section: 12,
};
export type AuPlaced = AuWidgetMeta & { span: number };
export type AuLayout = Record<string, AuraBlockLayout>;
/** Ширины блока в редакторе: ¼, ⅓, ½, ⅔, вся строка. */
export const AU_SPANS = [3, 4, 6, 8, 12];
/** Палитра цвета блока (null — цвет темы). */
export const AU_SWATCHES = ['#ff7a2f', '#f5c518', '#22c55e', '#14b8a6', '#0a84ff', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#111113'];
export const auDefaultSpan = (type: AuWidgetType) => SPAN[type] || 6;

/** KPI — строками по 4 сверху, остальное — рядами по 12 колонок, последний в ряду добирает остаток.
 * Если в приложении есть приветствие (hero), блоки, стоящие до первого KPI, идут шапкой над KPI. */
export function auPack(keys: string[], custom: AuraCustomWidget[] = [], layout: AuLayout = {}, freeOrder = false): AuPlaced[] {
  const cm = new Map(custom.map((c) => [c.id, { key: c.id, source: 'custom' as const, type: c.viz as AuWidgetType }]));
  const deco = (k: string): AuWidgetMeta | undefined => (auIsDeco(k) ? { key: k, source: 'deco', type: k.startsWith('n_') ? 'note' : 'section' } : undefined);
  const metas = keys.map((k) => AU_WIDGET.get(k) || cm.get(k) || deco(k)).filter(Boolean) as AuWidgetMeta[];
  const firstKpi = metas.findIndex((w) => w.type === 'kpi');
  const headN = firstKpi > 0 && metas.slice(0, firstKpi).some((w) => w.type === 'hero') ? firstKpi : 0;
  const head = metas.slice(0, headN);
  const kpis = metas.slice(headN).filter((w) => w.type === 'kpi');
  const rest = metas.slice(headN).filter((w) => w.type !== 'kpi');
  const out: AuPlaced[] = [];
  const pack = (list: AuWidgetMeta[]) => {
    let row: AuPlaced[] = [];
    let used = 0;
    const flush = () => {
      // остаток ряда добирает последний блок без заданной вручную ширины
      const auto = [...row].reverse().find((w) => !layout[w.key]?.span);
      if (auto && used < 12) auto.span += 12 - used;
      out.push(...row);
      row = [];
      used = 0;
    };
    list.forEach((w) => {
      // заголовок раздела — всегда отдельной строкой
      const s = w.type === 'section' ? 12 : layout[w.key]?.span || SPAN[w.type] || 6;
      if (used + s > 12 || (w.type === 'section' && used)) flush();
      row.push({ ...w, span: s });
      used += s;
    });
    flush();
  };
  if (freeOrder) {
    // ручной порядок: идём строго по списку, подряд идущие KPI без своей ширины — ряды по 4 на всю ширину
    let i = 0;
    while (i < metas.length) {
      const w = metas[i];
      if (w.type === 'kpi' && !layout[w.key]?.span) {
        let j = i;
        while (j < metas.length && metas[j].type === 'kpi' && !layout[metas[j].key]?.span) j++;
        const run = metas.slice(i, j);
        for (let r = 0; r < run.length; r += 4) {
          const chunk = run.slice(r, r + 4);
          chunk.forEach((x) => out.push({ ...x, span: 12 / chunk.length }));
        }
        i = j;
        continue;
      }
      let j = i;
      while (j < metas.length && !(metas[j].type === 'kpi' && !layout[metas[j].key]?.span)) j++;
      pack(metas.slice(i, j));
      i = j;
    }
    return out;
  }
  pack(head);
  // KPI с заданной шириной — обычными рядами, иначе по 4 в ряд на всю ширину
  if (kpis.some((w) => layout[w.key]?.span)) {
    pack(kpis);
    pack(rest);
    return out;
  }
  kpis.forEach((w, i) => {
    const rowStart = Math.floor(i / 4) * 4;
    const n = Math.min(4, kpis.length - rowStart);
    out.push({ ...w, span: 12 / n });
  });
  pack(rest);
  return out;
}

/* ---------- шаблоны ---------- */

export type AuTemplate = {
  id: string;
  cat: 'overview' | 'sales' | 'marketing' | 'service' | 'ops' | 'finance';
  /** В карусели на главной Aura. */
  featured?: boolean;
  isNew?: boolean;
  theme: AuraTheme;
  density?: AuraDensity;
  kiosk?: boolean;
  period?: AuraPeriod;
  sources: AuraSourceKey[];
  widgets: string[];
  breakdown: AuraFilterKey[];
};

export const AU_TEMPLATES: AuTemplate[] = [
  /* ---- 2026-10-17: командные центры на жидком стекле ---- */
  { id: 'command', cat: 'overview', featured: true, isNew: true, theme: 'aurora', sources: ['leads', 'deals', 'calls'], widgets: ['hero', 'setup', 'leads_kpi', 'deals_rev', 'deals_conv', 'calls_kpi', 'deals_forecast', 'stream', 'leads_gauge', 'activity'], breakdown: ['manager'] },
  { id: 'control', cat: 'overview', featured: true, isNew: true, theme: 'nebula', sources: ['leads', 'deals'], widgets: ['hero', 'leads_gauge', 'deals_conv', 'deals_avg', 'leads_kpi', 'deals_rev', 'stream', 'deals_forecast', 'setup', 'activity'], breakdown: ['manager'] },
  { id: 'pulse', cat: 'overview', featured: true, isNew: true, theme: 'mist', sources: ['leads', 'deals', 'booking', 'calls'], widgets: ['leads_kpi', 'deals_rev', 'book_count', 'calls_kpi', 'activity', 'pulse', 'stream', 'leads_status'], breakdown: [] },
  { id: 'owner', cat: 'finance', featured: true, isNew: true, theme: 'obsidian', sources: ['finance', 'deals', 'team'], widgets: ['fin_income', 'fin_profit', 'fin_margin', 'deals_rev', 'fin_line', 'fin_mix', 'deals_forecast', 'team_bar', 'alerts'], breakdown: [] },
  { id: 'revenue', cat: 'sales', featured: true, isNew: true, theme: 'frost', sources: ['deals', 'leads'], widgets: ['deals_rev', 'deals_avg', 'deals_conv', 'leads_won', 'deals_forecast', 'deals_table', 'compare', 'deals_split', 'deals_cal'], breakdown: ['manager', 'channel'] },
  { id: 'warehouse', cat: 'ops', featured: true, isNew: true, theme: 'ember', sources: ['stock'], widgets: ['stock_kpi', 'stock_value', 'stock_gauge', 'stock_health', 'stock_low', 'stock_top', 'alerts'], breakdown: ['product'] },
  { id: 'wallboard', cat: 'overview', featured: true, isNew: true, theme: 'obsidian', density: 'large', kiosk: true, period: 'today', sources: ['deals', 'leads', 'calls', 'booking', 'team'], widgets: ['deals_rev', 'leads_kpi', 'calls_kpi', 'book_count', 'activity', 'pulse', 'stream', 'team_bar'], breakdown: [] },
  { id: 'frontdesk', cat: 'service', featured: true, isNew: true, theme: 'mist', sources: ['booking'], widgets: ['book_count', 'book_load', 'book_noshow', 'book_upcoming', 'book_gauge', 'book_status', 'book_heat'], breakdown: ['branch'] },
  { id: 'adsroom', cat: 'marketing', featured: true, isNew: true, theme: 'obsidian', sources: ['marketing', 'leads', 'deals'], widgets: ['mk_spend', 'mk_cpl', 'leads_kpi', 'deals_conv', 'mk_line', 'mk_mix', 'mk_channels', 'leads_src'], breakdown: [] },
  { id: 'pipeline', cat: 'sales', isNew: true, theme: 'aurora', sources: ['leads', 'deals'], widgets: ['leads_kpi', 'leads_won', 'deals_conv', 'deals_avg', 'leads_status', 'leads_stream', 'leads_gauge', 'leads_line'], breakdown: ['manager', 'channel'] },
  { id: 'arena', cat: 'sales', isNew: true, theme: 'nebula', density: 'large', kiosk: true, period: 'today', sources: ['deals', 'leads', 'calls', 'team'], widgets: ['deals_rev', 'leads_won', 'calls_kpi', 'team_goal', 'team_bar', 'team_load', 'deals_stream'], breakdown: [] },
  { id: 'myday', cat: 'overview', isNew: true, theme: 'frost', period: 'today', sources: ['leads', 'calls', 'booking', 'deals', 'team'], widgets: ['hero', 'team_goal', 'leads_kpi', 'calls_kpi', 'book_count', 'deals_rev', 'leads_stream', 'book_upcoming'], breakdown: [] },
  { id: 'callcenter', cat: 'service', isNew: true, theme: 'obsidian', sources: ['calls'], widgets: ['calls_kpi', 'calls_miss', 'calls_gauge', 'calls_line', 'calls_split', 'calls_stream', 'calls_hours'], breakdown: ['manager'] },
  { id: 'studio', cat: 'service', isNew: true, theme: 'frost', sources: ['booking', 'calls'], widgets: ['book_count', 'book_load', 'calls_kpi', 'calls_miss', 'book_line', 'book_gauge', 'book_heat', 'calls_hours'], breakdown: ['branch'] },
  { id: 'shop', cat: 'ops', isNew: true, theme: 'aurora', sources: ['deals', 'stock', 'leads'], widgets: ['deals_rev', 'deals_avg', 'stock_value', 'leads_kpi', 'deals_cal', 'stock_gauge', 'stock_top', 'deals_stream', 'stock_health'], breakdown: ['product'] },
  { id: 'growth', cat: 'marketing', isNew: true, theme: 'frost', sources: ['leads', 'marketing', 'deals'], widgets: ['leads_kpi', 'leads_won', 'mk_cpl', 'deals_conv', 'leads_line', 'leads_src', 'leads_cal', 'leads_status'], breakdown: ['channel'] },
  { id: 'cfo', cat: 'finance', isNew: true, theme: 'nebula', sources: ['finance', 'marketing'], widgets: ['fin_income', 'fin_profit', 'fin_margin', 'mk_spend', 'fin_line', 'fin_mix', 'fin_forecast', 'mk_channels', 'fin_pl'], breakdown: [] },
  { id: 'unit', cat: 'finance', isNew: true, theme: 'ember', sources: ['deals', 'marketing', 'finance', 'team', 'leads'], widgets: ['deals_avg', 'mk_cpl', 'deals_conv', 'fin_margin', 'deals_split', 'compare', 'mk_channels', 'team_table'], breakdown: [] },
  { id: 'weekly', cat: 'overview', isNew: true, theme: 'swiss', period: '7d', sources: ['leads', 'deals', 'calls', 'team'], widgets: ['leads_kpi', 'deals_rev', 'deals_conv', 'calls_kpi', 'compare', 'leads_status', 'team_table', 'alerts'], breakdown: ['manager'] },
  { id: 'bentoview', cat: 'overview', isNew: true, theme: 'bento', sources: ['leads', 'deals', 'booking', 'stock'], widgets: ['leads_kpi', 'deals_rev', 'book_count', 'stock_kpi', 'activity', 'leads_gauge', 'deals_forecast', 'leads_stream', 'setup', 'leads_cal'], breakdown: [] },
  { id: 'opscontrol', cat: 'ops', isNew: true, theme: 'industry', sources: ['calls', 'booking', 'stock'], widgets: ['calls_miss', 'book_noshow', 'stock_kpi', 'calls_gauge', 'book_gauge', 'stock_gauge', 'stock_health', 'alerts'], breakdown: [] },
  { id: 'launch', cat: 'overview', isNew: true, theme: 'frost', sources: ['leads', 'deals'], widgets: ['hero', 'setup', 'activity', 'pulse', 'stream'], breakdown: [] },
  { id: 'mktv', cat: 'marketing', isNew: true, theme: 'nebula', density: 'large', kiosk: true, period: 'today', sources: ['leads', 'marketing'], widgets: ['leads_kpi', 'mk_spend', 'mk_cpl', 'leads_line', 'leads_src', 'leads_stream', 'mk_channels'], breakdown: [] },
  /* ---- первые шаблоны ---- */
  { id: 'sales', cat: 'sales', featured: true, theme: 'lumiva', sources: ['deals', 'team'], widgets: ['deals_rev', 'deals_conv', 'deals_avg', 'team_goal', 'deals_funnel', 'team_bar', 'deals_table'], breakdown: ['manager'] },
  { id: 'leads', cat: 'marketing', theme: 'bento', sources: ['leads', 'marketing'], widgets: ['leads_kpi', 'leads_won', 'mk_cpl', 'leads_line', 'leads_src', 'mk_channels'], breakdown: ['channel'] },
  { id: 'tv', cat: 'sales', featured: true, theme: 'graphite', density: 'large', kiosk: true, period: 'today', sources: ['deals', 'calls', 'team'], widgets: ['deals_rev', 'calls_kpi', 'calls_miss', 'deals_conv', 'calls_hours', 'team_goal', 'team_bar'], breakdown: [] },
  { id: 'stock', cat: 'ops', theme: 'industry', sources: ['stock'], widgets: ['stock_kpi', 'stock_low', 'stock_top', 'alerts'], breakdown: ['product'] },
  { id: 'booking', cat: 'service', theme: 'bento', sources: ['booking', 'calls'], widgets: ['book_load', 'book_count', 'book_noshow', 'calls_kpi', 'book_heat', 'calls_hours'], breakdown: ['branch'] },
  { id: 'finance', cat: 'finance', theme: 'swiss', sources: ['finance', 'marketing'], widgets: ['fin_profit', 'mk_spend', 'fin_pl', 'fin_mix', 'mk_channels'], breakdown: [] },
];
export const AU_TPL_CATS = ['all', 'overview', 'sales', 'marketing', 'service', 'ops', 'finance'] as const;
export const AU_FEATURED = AU_TEMPLATES.filter((t) => t.featured);

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
  layout?: AuLayout;
  freeOrder?: boolean;
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
  layout: d.layout || {},
  freeOrder: !!d.freeOrder,
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
  // от миллиона — компактно («4,8 млн»), иначе счётчики разрывают карточки
  if ((format === 'num' || format === 'int') && Math.abs(n) >= 1_000_000) {
    const s = new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
    return opts.unit === 'pcs' && opts.t ? `${s} ${opts.t('crm.aura.unit.pcs')}` : s;
  }
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
