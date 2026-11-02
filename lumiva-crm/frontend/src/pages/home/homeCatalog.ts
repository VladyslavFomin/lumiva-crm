/**
 * Главная v3: какие цифры можно вывести в KPI, в профиль и в «Динамику». Ключи совпадают с
 * виджетами Aura (считаются тем же движком на бэкенде) + свои: отзывы (rv_*), медиа (md_*), задачи.
 * Подписи — crm.home.metrics.<key>, категории — crm.home.cats.<cat>.
 */
export type HomeCat = 'sales' | 'marketing' | 'finance' | 'calls' | 'booking' | 'stock' | 'reviews' | 'media' | 'team';

export const HOME_KPIS: Array<{ key: string; cat: HomeCat }> = [
  { key: 'leads_kpi', cat: 'sales' },
  { key: 'leads_won', cat: 'sales' },
  { key: 'deals_rev', cat: 'sales' },
  { key: 'deals_conv', cat: 'sales' },
  { key: 'deals_avg', cat: 'sales' },
  { key: 'mk_spend', cat: 'marketing' },
  { key: 'mk_cpl', cat: 'marketing' },
  { key: 'fin_income', cat: 'finance' },
  { key: 'fin_profit', cat: 'finance' },
  { key: 'fin_margin', cat: 'finance' },
  { key: 'calls_kpi', cat: 'calls' },
  { key: 'calls_miss', cat: 'calls' },
  { key: 'book_count', cat: 'booking' },
  { key: 'book_load', cat: 'booking' },
  { key: 'book_noshow', cat: 'booking' },
  { key: 'stock_kpi', cat: 'stock' },
  { key: 'stock_value', cat: 'stock' },
  { key: 'rv_avg', cat: 'reviews' },
  { key: 'rv_new', cat: 'reviews' },
  { key: 'rv_noreply', cat: 'reviews' },
  { key: 'md_views', cat: 'media' },
  { key: 'md_downloads', cat: 'media' },
  { key: 'md_leads', cat: 'media' },
  { key: 'tasks_open', cat: 'team' },
  { key: 'tasks_overdue', cat: 'team' },
];

export const HOME_SERIES: Array<{ key: string; cat: HomeCat }> = [
  { key: 'compare', cat: 'sales' },
  { key: 'leads_line', cat: 'sales' },
  { key: 'fin_line', cat: 'finance' },
  { key: 'mk_line', cat: 'marketing' },
  { key: 'calls_line', cat: 'calls' },
  { key: 'book_line', cat: 'booking' },
  { key: 'rv_line', cat: 'reviews' },
  { key: 'md_line', cat: 'media' },
];

export const HOME_MAX_KPIS = 8;
export const HOME_MAX_STATS = 3;
export const HOME_MAX_SERIES = 4;

/** Порядок предпочтений по умолчанию — из него берутся первые доступные пользователю. */
export const HOME_DEFAULT_KPIS = ['leads_kpi', 'deals_rev', 'deals_conv', 'rv_avg', 'tasks_open', 'book_count', 'mk_cpl', 'md_views'];
export const HOME_DEFAULT_STATS = ['deals_rev', 'leads_kpi', 'leads_won', 'book_count', 'rv_new', 'tasks_open'];
export const HOME_DEFAULT_SERIES = ['compare', 'leads_line', 'fin_line', 'mk_line', 'book_line', 'rv_line'];

export type HomePeriod = 'today' | '7d' | '30d';

/** Личные настройки главной — лежат в раскладке (layout.home), синхронизируются с сервером вместе с ней. */
export interface HomePrefs {
  kpis?: string[];
  stats?: string[];
  series?: string[];
  goals?: Record<string, number>;
  period?: HomePeriod;
  /** Сколько месяцев в «Динамике». */
  months?: 6 | 12;
}

export function pickDefaults(preferred: string[], available: Set<string>, max: number): string[] {
  return preferred.filter((k) => available.has(k)).slice(0, max);
}
