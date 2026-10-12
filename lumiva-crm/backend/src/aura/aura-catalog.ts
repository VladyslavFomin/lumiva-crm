import type { PermissionKey } from '../rbac/permission.types';
import { isCustomKey, sanitizeCustom, sanitizeStyle, type AuraCustomWidget, type AuraStyle } from './aura-custom';

/** Aura: каталог разделов CRM и виджетов. Один источник правды для расчёта, ИИ и валидации. */

export type AuraSourceKey = 'leads' | 'deals' | 'team' | 'calls' | 'booking' | 'stock' | 'finance' | 'marketing';
export type AuraWidgetType = 'kpi' | 'line' | 'donut' | 'funnel' | 'table' | 'bar' | 'col' | 'col2' | 'heat' | 'list' | 'goal';
export type AuraPeriod = 'today' | '7d' | '30d' | 'quarter' | 'year';
export type AuraFilterKey = 'manager' | 'channel' | 'branch' | 'product';
export type AuraTheme = 'lumiva' | 'bento' | 'graphite' | 'swiss' | 'industry';
export type AuraDensity = 'normal' | 'compact' | 'large';
export type AuraViewer = 'me' | 'leaders' | 'team' | 'tv';

export const AURA_SOURCES: AuraSourceKey[] = ['leads', 'deals', 'team', 'calls', 'booking', 'stock', 'finance', 'marketing'];
export const AURA_PERIODS: AuraPeriod[] = ['today', '7d', '30d', 'quarter', 'year'];
export const AURA_FILTERS: AuraFilterKey[] = ['manager', 'channel', 'branch', 'product'];
export const AURA_THEMES: AuraTheme[] = ['lumiva', 'bento', 'graphite', 'swiss', 'industry'];
export const AURA_DENSITIES: AuraDensity[] = ['normal', 'compact', 'large'];
export const AURA_VIEWERS: AuraViewer[] = ['me', 'leaders', 'team', 'tv'];
export const AURA_REFRESH_SEC = [60, 300, 900, 3600];

/** Право RBAC, без которого раздел не считается (виджет приходит как denied). */
export const AURA_SOURCE_PERMISSION: Record<AuraSourceKey, PermissionKey> = {
  leads: 'leads',
  deals: 'sales',
  team: 'sales',
  calls: 'telephony',
  booking: 'bookings',
  stock: 'products',
  finance: 'finance',
  marketing: 'marketing',
};

export type AuraWidgetDef = {
  key: string;
  source: AuraSourceKey | 'extra';
  type: AuraWidgetType;
  /** Какие разделы реально нужны для расчёта (для прав). */
  needs: AuraSourceKey[];
  /** Какие фильтры шапки влияют на виджет. */
  filters: AuraFilterKey[];
  /** Краткое описание для ИИ (на английском, модель понимает все языки). */
  ai: string;
};

export const AURA_WIDGETS: AuraWidgetDef[] = [
  { key: 'leads_kpi', source: 'leads', type: 'kpi', needs: ['leads'], filters: ['manager', 'channel'], ai: 'new leads count with trend' },
  { key: 'leads_line', source: 'leads', type: 'line', needs: ['leads'], filters: ['manager', 'channel'], ai: 'leads over time vs previous period' },
  { key: 'leads_src', source: 'leads', type: 'donut', needs: ['leads'], filters: ['manager'], ai: 'lead sources breakdown' },
  { key: 'leads_won', source: 'leads', type: 'kpi', needs: ['leads'], filters: ['manager', 'channel'], ai: 'won leads count' },

  { key: 'deals_rev', source: 'deals', type: 'kpi', needs: ['deals'], filters: ['manager', 'channel'], ai: 'revenue from sales' },
  { key: 'deals_conv', source: 'deals', type: 'kpi', needs: ['leads'], filters: ['manager', 'channel'], ai: 'lead to won conversion rate' },
  { key: 'deals_avg', source: 'deals', type: 'kpi', needs: ['deals'], filters: ['manager', 'channel'], ai: 'average deal size' },
  { key: 'deals_funnel', source: 'deals', type: 'funnel', needs: ['leads'], filters: ['manager', 'channel'], ai: 'sales funnel by lead status' },
  { key: 'deals_table', source: 'deals', type: 'table', needs: ['deals'], filters: ['manager', 'channel'], ai: 'table of biggest deals' },

  { key: 'team_goal', source: 'team', type: 'goal', needs: ['deals'], filters: ['manager'], ai: 'monthly revenue goal progress of the team' },
  { key: 'team_bar', source: 'team', type: 'bar', needs: ['deals'], filters: ['channel'], ai: 'revenue by manager (bars)' },
  { key: 'team_table', source: 'team', type: 'table', needs: ['deals', 'leads'], filters: ['channel'], ai: 'manager ranking table (deals, conversion, revenue)' },

  { key: 'calls_kpi', source: 'calls', type: 'kpi', needs: ['calls'], filters: ['manager'], ai: 'calls count' },
  { key: 'calls_miss', source: 'calls', type: 'kpi', needs: ['calls'], filters: ['manager'], ai: 'missed calls count' },
  { key: 'calls_hours', source: 'calls', type: 'col', needs: ['calls'], filters: ['manager'], ai: 'calls by hour of day' },

  { key: 'book_load', source: 'booking', type: 'kpi', needs: ['booking'], filters: [], ai: 'booking occupancy / utilization %' },
  { key: 'book_heat', source: 'booking', type: 'heat', needs: ['booking'], filters: ['manager', 'branch'], ai: 'bookings heatmap by weekday and hour' },
  { key: 'book_noshow', source: 'booking', type: 'kpi', needs: ['booking'], filters: ['manager', 'branch'], ai: 'no-show rate' },
  { key: 'book_count', source: 'booking', type: 'kpi', needs: ['booking'], filters: ['manager', 'branch'], ai: 'bookings count' },

  { key: 'stock_kpi', source: 'stock', type: 'kpi', needs: ['stock'], filters: ['product'], ai: 'total units in stock' },
  { key: 'stock_low', source: 'stock', type: 'table', needs: ['stock'], filters: ['product'], ai: 'products running out (table with days left)' },
  { key: 'stock_top', source: 'stock', type: 'bar', needs: ['stock'], filters: ['product'], ai: 'top selling products by units' },

  { key: 'fin_profit', source: 'finance', type: 'kpi', needs: ['finance'], filters: [], ai: 'income minus ad spend' },
  { key: 'fin_pl', source: 'finance', type: 'col2', needs: ['finance'], filters: [], ai: 'income vs ad spend by month' },
  { key: 'fin_mix', source: 'finance', type: 'donut', needs: ['finance'], filters: [], ai: 'income structure by module (sales, bookings, hotels)' },

  { key: 'mk_cpl', source: 'marketing', type: 'kpi', needs: ['marketing', 'leads'], filters: [], ai: 'cost per lead' },
  { key: 'mk_channels', source: 'marketing', type: 'bar', needs: ['marketing'], filters: [], ai: 'ad spend by channel' },
  { key: 'mk_spend', source: 'marketing', type: 'kpi', needs: ['marketing'], filters: [], ai: 'total ad spend' },

  { key: 'alerts', source: 'extra', type: 'list', needs: [], filters: [], ai: 'needs attention: risks across modules' },
  { key: 'compare', source: 'extra', type: 'line', needs: ['deals'], filters: ['manager', 'channel'], ai: 'revenue current vs previous period' },
];

export const AURA_WIDGET_BY_KEY = new Map(AURA_WIDGETS.map((w) => [w.key, w]));

/** Первые 2 виджета раздела — дефолт, когда пользователь выбрал раздел, но не показатели. */
export function auraDefaultWidgets(sources: AuraSourceKey[]): string[] {
  return sources.flatMap((s) => AURA_WIDGETS.filter((w) => w.source === s).slice(0, 2).map((w) => w.key));
}

export type AuraConfig = {
  prompt?: string;
  sources: AuraSourceKey[];
  widgets: string[];
  period: AuraPeriod;
  breakdown: AuraFilterKey[];
  goals?: { team_goal?: number | null };
  viewer?: AuraViewer | null;
  /** Виджеты, собранные ИИ из любых данных CRM (ключи c_xxx в widgets). */
  custom?: AuraCustomWidget[];
  /** Свои цвета/скругление/шрифт поверх темы. */
  style?: AuraStyle | null;
};

const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Нормализует произвольный JSON от клиента/ИИ в валидный конфиг. */
export function sanitizeAuraConfig(raw: unknown): AuraConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const custom = asArr(r.custom)
    .map(sanitizeCustom)
    .filter((c): c is AuraCustomWidget => !!c)
    .filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
    .slice(0, 24);
  const customIds = new Set(custom.map((c) => c.id));
  const widgets = [...new Set(asArr(r.widgets).map(String).filter((k) => AURA_WIDGET_BY_KEY.has(k) || (isCustomKey(k) && customIds.has(k))))].slice(0, 40);
  // пользовательский виджет без места в раскладке — в конец
  for (const c of custom) if (!widgets.includes(c.id)) widgets.push(c.id);
  let sources = [...new Set(asArr(r.sources).map(String).filter((s): s is AuraSourceKey => (AURA_SOURCES as string[]).includes(s)))];
  // источник любого выбранного виджета всегда в списке разделов
  for (const k of widgets) {
    if (isCustomKey(k)) continue;
    const src = AURA_WIDGET_BY_KEY.get(k)!.source;
    if (src !== 'extra' && !sources.includes(src)) sources.push(src);
  }
  if (!sources.length) sources = ['leads', 'deals'];
  const period = (AURA_PERIODS as string[]).includes(String(r.period)) ? (r.period as AuraPeriod) : '30d';
  const breakdown = [...new Set(asArr(r.breakdown).map(String).filter((f): f is AuraFilterKey => (AURA_FILTERS as string[]).includes(f)))];
  const goalsRaw = (r.goals && typeof r.goals === 'object' ? r.goals : {}) as Record<string, unknown>;
  const teamGoal = Number(goalsRaw.team_goal);
  const viewer = (AURA_VIEWERS as string[]).includes(String(r.viewer)) ? (r.viewer as AuraViewer) : null;
  return {
    prompt: typeof r.prompt === 'string' ? r.prompt.slice(0, 2000) : '',
    sources,
    widgets,
    period,
    breakdown,
    goals: { team_goal: Number.isFinite(teamGoal) && teamGoal > 0 ? Math.round(teamGoal) : null },
    viewer,
    custom,
    style: sanitizeStyle(r.style),
  };
}
