import {
  ALL_DASHBOARD_WIDGET_IDS,
  colSpanToSize,
  getDefaultWidgetHeight,
  type DashboardLayoutState,
  isDashboardPresetInstanceId,
} from './dashboardLayout';
import {
  HOME_DEFAULT_KPIS,
  HOME_DEFAULT_SERIES,
  HOME_DEFAULT_STATS,
  HOME_MAX_SERIES,
  HOME_MAX_STATS,
  type HomePrefs,
} from '../pages/home/homeCatalog';

/**
 * Шаблоны главной v3: шаблон настраивает всю страницу — KPI, цифры профиля, «Динамику» и
 * «Мои блоки» ровными рядами (в ряду ширины в сумме 12, высота одна на ряд). Блоки, которые
 * дублируют разделы новой главной (KPI-лента, лента активности, календарь, задачи…), в шаблоны
 * не входят. Блок без доступа выпадает, а соседи в ряду растягиваются на всю ширину.
 */
export type DashboardLayoutTemplateId = 'sales' | 'marketing' | 'operations' | 'hotels' | 'media';

export const DASHBOARD_TEMPLATE_ORDER: DashboardLayoutTemplateId[] = ['sales', 'marketing', 'hotels', 'media', 'operations'];

export interface DashboardTemplateRow {
  ids: string[];
  height: number;
}

export interface DashboardTemplate {
  home: Required<Pick<HomePrefs, 'kpis' | 'stats' | 'series' | 'period'>>;
  rows: DashboardTemplateRow[];
}

export const DASHBOARD_TEMPLATES: Record<DashboardLayoutTemplateId, DashboardTemplate> = {
  sales: {
    home: {
      kpis: ['leads_kpi', 'deals_rev', 'deals_conv', 'deals_avg'],
      stats: ['deals_rev', 'leads_kpi', 'leads_won'],
      series: ['compare', 'leads_line', 'fin_line'],
      period: '30d',
    },
    rows: [
      { ids: ['funnel_today', 'lead_sources_week'], height: 270 },
      { ids: ['recent_deals', 'staff'], height: 320 },
      { ids: ['recent-leads'], height: 380 },
    ],
  },
  marketing: {
    home: {
      kpis: ['leads_kpi', 'mk_spend', 'mk_cpl', 'deals_conv'],
      stats: ['leads_kpi', 'deals_rev', 'leads_won'],
      series: ['mk_line', 'leads_line', 'compare'],
      period: '30d',
    },
    rows: [
      { ids: ['lead_sources_week', 'channels-funnel'], height: 320 },
      { ids: ['leads-timeline'], height: 280 },
      { ids: ['recent-leads'], height: 380 },
    ],
  },
  hotels: {
    home: {
      kpis: ['rv_avg', 'rv_new', 'rv_noreply', 'book_count'],
      stats: ['rv_new', 'book_count', 'leads_kpi'],
      series: ['rv_line', 'book_line', 'compare'],
      period: '30d',
    },
    rows: [
      { ids: ['hotels-reviews', 'hotels-analytics'], height: 300 },
      { ids: ['bookings-analytics', 'lead_sources_week'], height: 300 },
    ],
  },
  media: {
    home: {
      kpis: ['md_views', 'md_downloads', 'md_leads', 'leads_kpi'],
      stats: ['md_views', 'md_downloads', 'leads_kpi'],
      series: ['md_line', 'leads_line', 'rv_line'],
      period: '30d',
    },
    rows: [
      { ids: ['lead_sources_week', 'recent_deals'], height: 300 },
      { ids: ['recent-leads'], height: 380 },
    ],
  },
  operations: {
    home: {
      kpis: ['tasks_open', 'tasks_overdue', 'leads_kpi', 'deals_rev'],
      stats: ['tasks_open', 'leads_kpi', 'deals_rev'],
      series: ['leads_line', 'compare', 'book_line'],
      period: '7d',
    },
    rows: [
      { ids: ['projects', 'staff'], height: 340 },
      { ids: ['leads-timeline', 'birthdays'], height: 300 },
    ],
  },
};

/** Ширины ряда из n блоков: 12 / 6+6 / 4+4+4. */
function rowSpans(n: number): number[] {
  if (n <= 1) return [12];
  if (n === 2) return [6, 6];
  return Array.from({ length: n }, () => Math.floor(12 / n));
}

function placeRow(
  ids: string[],
  height: number,
  next: Pick<DashboardLayoutState, 'sizes' | 'spans' | 'heights'>,
) {
  rowSpans(ids.length).forEach((span, i) => {
    const id = ids[i]!;
    next.spans[id] = span;
    next.sizes[id] = colSpanToSize(span);
    next.heights[id] = height;
  });
}

/** Свои блоки (со страниц аналитики и т.п.) — парами одной высоты; последний нечётный — на всю ширину. */
function tidyPairs(ids: string[], layout: DashboardLayoutState, next: Pick<DashboardLayoutState, 'sizes' | 'spans' | 'heights'>) {
  for (let i = 0; i < ids.length; i += 2) {
    const pair = ids.slice(i, i + 2);
    const h = Math.max(...pair.map((id) => getDefaultWidgetHeight(id, layout)));
    placeRow(pair, Math.min(520, Math.max(240, h)), next);
  }
}

function topUp(wanted: string[], defaults: string[], available: Set<string>, n: number): string[] {
  const out = wanted.filter((k) => available.has(k));
  for (const k of defaults) {
    if (out.length >= n) break;
    if (available.has(k) && !out.includes(k)) out.push(k);
  }
  return out.slice(0, n);
}

export function applyDashboardLayoutTemplate(
  id: DashboardLayoutTemplateId,
  prev: DashboardLayoutState,
  ctx: { allowed: (blockId: string) => boolean; available: Set<string> },
): DashboardLayoutState {
  const tpl = DASHBOARD_TEMPLATES[id];
  const next = { sizes: { ...prev.sizes }, spans: { ...prev.spans }, heights: { ...prev.heights } };
  const templateIds: string[] = [];
  for (const row of tpl.rows) {
    const ids = row.ids.filter(ctx.allowed);
    if (!ids.length) continue;
    placeRow(ids, row.height, next);
    templateIds.push(...ids);
  }
  const own = prev.order.filter((x) => isDashboardPresetInstanceId(x) && prev.presetInstances[x] && !prev.hidden.has(x));
  tidyPairs(own, prev, next);

  const known = ctx.available.size > 0;
  const home: HomePrefs = {
    ...(prev.home || {}),
    period: tpl.home.period,
    kpis: known ? topUp(tpl.home.kpis, HOME_DEFAULT_KPIS, ctx.available, 4) : tpl.home.kpis,
    stats: known ? topUp(tpl.home.stats, HOME_DEFAULT_STATS, ctx.available, HOME_MAX_STATS) : tpl.home.stats,
    series: known ? topUp(tpl.home.series, HOME_DEFAULT_SERIES, ctx.available, Math.min(3, HOME_MAX_SERIES)) : tpl.home.series,
  };

  const rest = prev.order.filter((x) => !templateIds.includes(x) && !own.includes(x));
  return {
    ...prev,
    ...next,
    order: [...templateIds, ...own, ...rest],
    hidden: new Set(ALL_DASHBOARD_WIDGET_IDS.filter((w) => !templateIds.includes(w))),
    home,
  };
}

/** «Выровнять блоки»: текущие видимые блоки — парами одной высоты, без изменения порядка. */
export function tidyDashboardBlocks(prev: DashboardLayoutState, visibleIds: string[]): DashboardLayoutState {
  const next = { sizes: { ...prev.sizes }, spans: { ...prev.spans }, heights: { ...prev.heights } };
  tidyPairs(visibleIds, prev, next);
  return { ...prev, ...next };
}
