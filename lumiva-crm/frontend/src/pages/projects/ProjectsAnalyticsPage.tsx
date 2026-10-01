// src/pages/projects/ProjectsAnalyticsPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useTranslation } from 'react-i18next';
import { requestAddDashboardPreset } from '../../dashboard/dashboardLayout';
import { notifyAnalyticsWidgetsChanged } from '../../dashboard/analyticsStorage';
import { fetchUserPreferences, updateUserPreferences } from '../../api/userPreferences';
import { fetchProjects } from '../../api/projects';
import { postAiBuildAnalyticsDashboard } from '../../api/ai';
import type { MarketingFxRatesResponse } from '../../api/marketing';
import { WorkspaceShareModal } from '../../components/workspace/WorkspaceShareModal';
import { AnalyticsReportEmailModal } from '../../components/workspace/AnalyticsReportEmailModal';
import { BLOCK_CHROME_HEIGHT, EmbedBody } from '../../components/analytics/EmbedBody';
import { AiBuildDashboardModal, type AiBuildMode } from '../../components/analytics/AiBuildDashboardModal';
import { AnalyticsGeoMap, type Geocoder } from '../../components/analytics/AnalyticsGeoMap';
import { geocodeWorkspaceValues } from '../../api/workspaceShare';
import {
  ALL_MAP_COUNTRIES,
  REGION_SCOPES,
  countryMatchRate,
  type MapScope,
} from '../../components/analytics/geoCountries';
import { fetchCompanySettings } from '../../api/settings';
import type { Project } from './projectTypes';
import { AnalyticsCurrencyControl } from '../../components/AnalyticsCurrencyControl';
import { MetricCard } from '../../components/analytics/MetricCard';
import { applyVisibleOrder, useBlockGridInteractions } from '../../components/analytics/useBlockGridInteractions';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import {
  MARKETING_ALLOWED_CURRENCIES,
  convertMarketingAmount,
  normalizeMarketingDisplayCurrency,
} from '../marketing/marketingDisplayCurrencyStorage';
import { DateRangePicker, toIsoDate } from '../../components/ui/DateRangePicker';
import {
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Line,
  LineChart,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
} from 'recharts';

const ANALYTICS_LAYOUT_VERSION = '2026-05-03-projects-sales-visual-parity';

const CHART_COLORS = [
  '#222222',
  '#1769d1',
  '#3b6cb6',
  '#214b8a',
  '#1f8a5e',
  '#c08319',
];
const PALETTES: Record<string, string[]> = {
  lumiva: CHART_COLORS,
  ocean: ['#0ea5e9', '#22d3ee', '#38bdf8', '#2563eb', '#14b8a6', '#06b6d4'],
  sunset: ['#f97316', '#fb7185', '#f43f5e', '#f59e0b', '#fbbf24', '#fca5a5'],
  forest: ['#22c55e', '#16a34a', '#4ade80', '#10b981', '#34d399', '#86efac'],
};
const THEME_PRESETS = [
  { key: 'lumiva', label: 'Lumiva', primary: '#222222', palette: ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319'] },
  { key: 'ocean', label: 'Ocean', primary: '#2563eb', palette: PALETTES.ocean },
  { key: 'sunset', label: 'Sunset', primary: '#f97316', palette: PALETTES.sunset },
  { key: 'forest', label: 'Forest', primary: '#16a34a', palette: PALETTES.forest },
  { key: 'red', label: 'Red', primary: '#dc2626', palette: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'] },
] as const;

type PeriodId = '7d' | '30d' | '1y' | 'all' | 'custom';
/** Пользовательская вкладка дашборда: свой набор блоков (analyticsLayouts[`${ns}__tab_${id}`])
 * и свои сохранённые фильтры. Вкладка 'main' — исходный дашборд (analyticsLayouts[ns]),
 * её нельзя удалить, только переименовать. */
type AnalyticsTab = { id: string; name?: string; filters?: GlobalFilterRow[] };
type NewTabSource = 'empty' | 'copy' | 'default';
const MAIN_TAB_ID = 'main';
const NO_FILTERS: GlobalFilterRow[] = [];

type WidgetType = 'metric' | 'donut' | 'bar' | 'line' | 'funnel' | 'leaderboard' | 'table' | 'heatmap' | 'note' | 'formula' | 'pivot' | 'map';
type WidgetSize = 'sm' | 'md' | 'lg';
type ThemeKey = typeof THEME_PRESETS[number]['key'];

type FormulaScope = string;
type FormulaMode = 'count' | 'percent' | 'sum';
type FormulaFn = 'count' | 'percent' | 'ratio' | 'diff' | 'sumif';
type FormulaOperandType = string;
type ChartValueMode = 'count' | 'sum';
type CompareDisplay = 'number' | 'bar' | 'line' | 'donut' | 'table';
/** Одна сторона сравнения месячных групп ("Первая", "Вторая", ...) — сумма выбранных месяцев,
 * с необязательными своими подписью и цветом. */
type CompareSide = { id: string; label?: string; monthKeys: string[]; color?: string };

type PivotMeasureConfig = {
  id: string;
  mode: ChartValueMode;
  valueField?: string;
  shortLabel?: string;
};

type FormulaFilterRow = { scope: FormulaScope; keys: string[] };
type GlobalFilterRow = FormulaFilterRow & { id: string };

type MetricKey = string;
type ChartKey = string;
type TableKey = string;

interface AnalyticsFieldMeta {
  key: string;
  label: string;
  type?: string;
}

const EMPTY_ANALYTICS_FIELDS: AnalyticsFieldMeta[] = [];

const PIVOT_MAX_ROWS = 32;
const PIVOT_MAX_COLS = 14;
const PIVOT_MAX_MEASURES = 4;
const TABLE_MAX_DIMENSIONS = 4;
const TABLE_MULTI_MAX_ROWS = 400;

function cartesianBucketCombos(buckets: Array<Array<{ code: string; label: string }>>) {
  if (!buckets.length) return [] as Array<Array<{ code: string; label: string }>>;
  return buckets.reduce<Array<Array<{ code: string; label: string }>>>(
    (acc, curr) => acc.flatMap((prefix) => curr.map((el) => [...prefix, el])),
    [[]],
  );
}

function migrateFormulaFilterRow(raw: {
  scope?: string;
  key?: string;
  keys?: unknown;
}): FormulaFilterRow {
  const scope = (raw.scope || 'status') as FormulaScope;
  if (Array.isArray(raw.keys)) {
    return { scope, keys: raw.keys.map(String) };
  }
  if (raw.key !== undefined && raw.key !== null && String(raw.key) !== '') {
    return { scope, keys: [String(raw.key)] };
  }
  return { scope, keys: [] };
}

function migrateWidgetFromStorage(raw: Record<string, unknown>): WidgetConfig {
  const w = { ...raw } as unknown as WidgetConfig;
  if (Array.isArray(raw.formulaFilters)) {
    w.formulaFilters = (raw.formulaFilters as unknown[]).map((f) =>
      migrateFormulaFilterRow(f as { scope?: string; key?: string; keys?: unknown }),
    );
  }
  const tk = raw.tableKey;
  const td = raw.tableDimensions;
  if (
    (!Array.isArray(td) || td.length === 0) &&
    typeof tk === 'string' &&
    tk.startsWith('field:')
  ) {
    w.tableDimensions = [tk];
  }
  return w;
}

type FilterValueOption = { id: string; label: string };

function AnalyticsFilterKeysPicker({
  list,
  keys,
  onChange,
  allLabel,
  multiHint,
}: {
  list: FilterValueOption[];
  keys: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
  multiHint: string;
}) {
  const allIds = list.map((o) => o.id);
  const allSelected = keys.length === 0;
  const itemChecked = (id: string) => allSelected || keys.includes(id);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] cursor-pointer text-slate-700">
        <input
          type="checkbox"
          className="rounded border-slate-300"
          checked={allSelected}
          onChange={(e) => {
            if (e.target.checked) onChange([]);
          }}
        />
        {allLabel}
      </label>
      <div className="text-[10px] text-slate-500">{multiHint}</div>
      <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white px-2 py-2 space-y-1.5">
        {list.map((opt) => (
          <label
            key={opt.id}
            className="flex items-center gap-2 text-[11px] cursor-pointer text-slate-700"
          >
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={itemChecked(opt.id)}
              onChange={() => {
                if (allSelected) {
                  onChange([opt.id]);
                  return;
                }
                if (keys.includes(opt.id)) {
                  const nk = keys.filter((k) => k !== opt.id);
                  onChange(nk);
                } else {
                  const next = [...keys, opt.id];
                  const coversAll =
                    allIds.length > 0 &&
                    next.length === allIds.length &&
                    allIds.every((id) => next.includes(id));
                  onChange(coversAll ? [] : next);
                }
              }}
            />
            <span className="truncate">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  span?: number;
  height?: number;
  themeKey?: ThemeKey;
  showLabels?: boolean;
  formulaFn?: FormulaFn;
  formulaLeftType?: FormulaOperandType;
  formulaLeftKey?: string;
  formulaRightType?: FormulaOperandType;
  formulaRightKey?: string;
  /** Что считать по части формулы, заданной значением измерения (Источник = google):
   * 'count' — строки (по умолчанию), 'sum:<поле>' / 'avg:<поле>' — сумма/среднее числового поля. */
  formulaLeftMeasure?: string;
  formulaRightMeasure?: string;
  formulaMode?: FormulaMode;
  formulaFilters?: FormulaFilterRow[];
  /** Для formula-сравнения месячных полей (любая formulaFn — sumif/count/percent/ratio/diff):
   * как показать результат, помимо заголовочного числа. Работает только если formulaLeftType
   * и formulaRightType — оба месячные суммы (см. isMonthOperand), иначе рендер молча падает на 'number'. */
  compareDisplay?: CompareDisplay;
  /** Стороны сравнения месячных групп (2+) — только для diff/ratio; если заданы, используются
   * для графика вместо старой пары Левая/Правая (та пара остаётся источником заголовочного числа
   * diff/ratio, его считаем по первым двум сторонам). */
  compareSides?: CompareSide[];
  metricKey?: MetricKey;
  chartKey?: ChartKey;
  chartValueMode?: ChartValueMode;
  chartValueField?: string;
  tableKey?: TableKey;
  pivotRowKey?: string;
  pivotColKey?: string;
  pivotMeasures?: PivotMeasureConfig[];
  /** field:* — несколько столбцов группировки в таблице (workspace) */
  tableDimensions?: string[];
  /** Блок «Карта»: 'world' | континент | `country:DE` (см. geoCountries.MapScope) */
  mapScope?: string;
  /** 'countries' — закраска стран, 'points' — города/адреса точками */
  mapMode?: 'countries' | 'points';
  /** Блок «Заметка»: свой текст (вывод, комментарий). Пусто — автосводка по данным. */
  noteText?: string;
};

type StatusChartPoint = { code: string; label: string; count: number };

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function parseDate(value?: string | null) {
  if (!value) return null;
  // Date-only values must stay on the user's calendar day instead of being shifted by UTC.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? value.trim().split('-').map(Number)
    : null;
  if (dateOnly) {
    const [year, month, day] = dateOnly;
    const localDate = new Date(year, month - 1, day);
    return Number.isFinite(localDate.getTime()) ? localDate : null;
  }
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts);
}

const MONTH_NAMES = [
  ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'],
];

/** Колонка вида "m_2026_09" / "2026-09" или подпись "Сентябрь 2026" → 1-е число этого месяца. Нужно, чтобы
 * отличать "широкие" таблицы (строка = категория, колонки = месяцы) от обычных таблиц с датой создания. */
function parseMonthFieldDate(field: { key: string; label?: string }): Date | null {
  const keyMatch = /^m_(\d{4})_(\d{1,2})$/.exec(field.key) || /^(\d{4})-(\d{1,2})$/.exec(field.key);
  if (keyMatch) {
    const year = Number(keyMatch[1]);
    const month = Number(keyMatch[2]);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) return new Date(year, month - 1, 1);
  }
  const label = (field.label || '').toLowerCase().trim();
  const yearMatch = /\b(19|20)\d{2}\b/.exec(label);
  if (yearMatch) {
    const monthPart = label.replace(yearMatch[0], '').trim();
    for (const names of MONTH_NAMES) {
      const idx = names.findIndex((name) => monthPart === name || monthPart.startsWith(name.slice(0, 4)));
      if (idx >= 0) return new Date(Number(yearMatch[0]), idx, 1);
    }
  }
  return null;
}

const isFilled = (value: any) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const splitMulti = (raw: any) => {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '')
    .split(/[,;/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
};

const parseNumericLoose = (raw: any) => {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const normalized = String(raw)
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.\-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Денежные колонки таблиц рабочей области — их значения пересчитываются в валюту отчёта.
 * Раньше пересчитывалось только project.amount, а блоки Workspace суммируют сами колонки,
 * поэтому выбор «Валюты отчёта» там ни на что не влиял. */
const EN_WORD = (words: string) => new RegExp(`(?:^|[^a-z])(?:${words})(?:[^a-z]|$)`, 'i');
const NON_MONEY_EN = EN_WORD('qty|quantity|count|duration|mins?|minutes?|hours?|percent|pct|rate|ctr|cr|clicks?|impressions?|leads?|rating|score|age|adet|sure|oran');
const NON_MONEY_RU = /(кол-?во|количеств|длительн|минут|(?:^|[^а-яё])мин(?:[^а-яё]|$)|(?:^|[^а-яё])час|процент|конверс|клик|показ|лид|рейтинг|балл|возраст|%|süre|tıklama|gösterim)/i;
const MONEY_RE =
  /(amount|price|sum|value|total|cost|budget|spend|revenue|profit|discount|income|expense|tutar|miktar|fiyat|maliyet|gelir|gider|indirim|ücret|сумм|цена|стоимост|скидк|итого|расход|доход|выручк|прибыл|оплат|бюджет|тутар)/i;
const KNOWN_CURRENCIES = ['USD', 'EUR', 'TRY', 'RUB', 'GBP', 'CHF', 'PLN', 'UAH', 'KZT', 'AED', 'CNY', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'RON', 'BGN', 'ILS', 'INR', 'BRL', 'MXN'];

/** Что за колонка по РЕАЛЬНЫМ данным — единый источник правды для всех списков редактора,
 * формул, группировок и подсказок (раньше каждое место решало по-своему и противоречило другим). */
export type FieldKind = 'number' | 'category' | 'date' | 'unique' | 'longtext' | 'constant' | 'empty';
export type FieldProfile = { kind: FieldKind; distinct: number; filled: number };

const NOT_NUMERIC_NAME_RE = /(тел|phone|id|код|номер|время|time|дата|date|час)/i;
const NUMBER_LIKE_RE = /^[+-]?[\d\s.,]+\s*(%|₺|\$|€|£|₽|try|usd|eur|rub|tl)?$/i;
const DATE_LIKE_RE = /^(\d{4}-\d{2}-\d{2}([T\s][\d:.]+Z?)?|\d{1,2}[./]\d{1,2}[./]\d{2,4})$/;

function profileField(field: { key: string; label?: string; type?: string }, rows: Project[]): FieldProfile {
  const type = String(field.type || '').toLowerCase();
  const values: string[] = [];
  for (const row of rows) {
    const raw = row.customFields?.[field.key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (Array.isArray(raw)) raw.forEach((v) => String(v).trim() && values.push(String(v).trim()));
    else if (String(raw).trim()) values.push(String(raw).trim());
  }
  const distinct = new Set(values).size;
  const base = { distinct, filled: values.length };
  if (type === 'date' || type === 'datetime') return { kind: 'date', ...base };
  if (type === 'number') return { kind: 'number', ...base };
  if (['status', 'select', 'multiselect', 'boolean'].includes(type)) {
    return { kind: values.length ? 'category' : 'empty', ...base };
  }
  if (!values.length) return { kind: 'empty', ...base };
  if (distinct === 1 && values.length > 1) return { kind: 'constant', ...base };
  const name = `${field.key} ${field.label || ''}`;
  const numberLike = values.filter((v) => NUMBER_LIKE_RE.test(v) && (v.match(/\d/g) || []).length <= 9).length;
  if (!NOT_NUMERIC_NAME_RE.test(name) && numberLike / values.length >= 0.8) return { kind: 'number', ...base };
  if (values.filter((v) => DATE_LIKE_RE.test(v)).length / values.length >= 0.8) return { kind: 'date', ...base };
  const avgLen = values.reduce((sum, v) => sum + v.length, 0) / values.length;
  if (avgLen > 40) return { kind: 'longtext', ...base };
  if (distinct > 40 || (values.length >= 20 && distinct / values.length > 0.9)) return { kind: 'unique', ...base };
  return { kind: 'category', ...base };
}

/** Валюта, явно указанная в самой колонке: «Итого (TRY)», key «price_usd». */
function fieldLabelCurrency(field: { key: string; label?: string }): string | null {
  const text = `${field.label || ''} ${field.key}`.toUpperCase();
  const paren = /\(([A-Z]{3})\)/.exec(text);
  if (paren && KNOWN_CURRENCIES.includes(paren[1])) return paren[1];
  const found = KNOWN_CURRENCIES.find((code) => new RegExp(`(?:^|[^A-Z])${code}(?:[^A-Z]|$)`).test(text));
  return found || null;
}

const isCurrencyColumn = (field: { key: string; label?: string }) => {
  const text = `${field.key} ${field.label || ''}`.toLowerCase();
  return text.includes('currency') || text.includes('валют') || text.includes('para birimi');
};

const V2_PALETTE = ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319', '#cc2f47', '#5a45a8'];
const COMPARE_SIDE_ORDINALS = ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая', 'Седьмая', 'Восьмая'];

function compactNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}

/** Подбирает размер шрифта под длину числа в центре пончика — фиксированный размер рано или
 * поздно вылезает за кольцо (суммы денег могут быть сколь угодно длинными, в отличие от счётчиков
 * записей). thresholds — пары [макс. длина строки, класс], отсортированные по возрастанию. */
function donutCenterFontClass(text: string, thresholds: Array<[number, string]>): string {
  for (const [maxLen, cls] of thresholds) {
    if (text.length <= maxLen) return cls;
  }
  return thresholds[thresholds.length - 1][1];
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const MIN_WIDGET_SPAN = 3;
const MIN_WIDGET_H = 100;
const MAX_WIDGET_H = 1400;

function spanFromSize(size: WidgetSize) {
  if (size === 'lg') return 12;
  if (size === 'md') return 6;
  return 3;
}

function sizeFromSpan(span: number): WidgetSize {
  if (span >= 9) return 'lg';
  if (span >= 5) return 'md';
  return 'sm';
}

function clampSpan(value: number) {
  return Math.min(12, Math.max(MIN_WIDGET_SPAN, Math.round(value)));
}

function isChartWidgetType(type: WidgetType) {
  return type === 'donut' || type === 'bar' || type === 'line' || type === 'funnel' || type === 'leaderboard' || type === 'map';
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const paths: Record<string, React.ReactNode> = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    x: <><path d="M6 6l12 12" /><path d="M6 18 18 6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.8a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.4a7 7 0 0 0-2.1 1.2l-2.4-.8-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.8a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.4a7 7 0 0 0 2.1-1.2l2.4.8 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>,
    drag: <><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" /></>,
    resize: <><path d="M16 8 8 16" /><path d="M16 14v2h-2" /><path d="M14 10h-2v2" /><path d="M14 8h2v2" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
    share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 11l7.6-4" /><path d="M8.2 13l7.6 4" /></>,
    download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18" /><path d="M3 16h18" /><path d="M9 4v16" /></>,
  };
  return <svg {...common}>{paths[name] || paths.table}</svg>;
}

interface ProjectsAnalyticsPageProps {
  externalItems?: Project[];
  storageNamespace?: string;
  toolbarSlot?: React.ReactNode;
  analyticsFields?: AnalyticsFieldMeta[];
  /** Источник данных для пресета на главной */
  dashboardPresetSource?: 'projects' | 'sales' | 'leads' | 'workspace' | 'client-account';
  /** Для 'workspace'/'client-account' — id таблицы/клиента, нужен главной, чтобы подгрузить те же данные заново */
  dashboardPresetRef?: string;
  header?: {
    kicker?: string;
    title?: string;
    subtitle?: string;
  };
  analyticsLabels?: {
    total?: string;
    line?: string;
    table?: string;
    record?: string;
  };
  defaultWidgetsOverride?: WidgetConfig[];
  /** UUID таблицы рабочей области — нужен только для «Разобрать через АИ» в workspace-режиме. */
  workspaceObjectId?: string;
  /** Произвольный блок над вкладками представлений (напр. WorkspaceAiAnalyticsPanel) — рендерится
   * после toolbarSlot, до переключателя видов. */
  beforeContentSlot?: React.ReactNode;
  /** Публичная ссылка «только аналитика»: без меню CRM, без редактирования/ИИ/экспорта,
   * раскладка и вкладки приходят готовыми с сервера (раскладка того, кто открыл доступ). */
  publicView?: {
    layouts: Record<string, unknown>;
    primaryCurrency: string | null;
    companyName: string;
    fetchRates: (display: string) => Promise<MarketingFxRatesResponse>;
    /** Когда перестанет работать ссылка (null — бессрочно). */
    expiresAt: string | null;
    geocode?: Geocoder;
  };
  /** Режим «один блок» для главной: тот же расчёт и та же отрисовка, что на странице аналитики,
   * но без шапки/вкладок/редактирования — только тело блока, растянутое на ячейку главной. */
  /** Название таблицы — для темы письма «Отчёт на почту». */
  reportObjectName?: string;
  embed?: {
    widget: WidgetConfig;
    /** Фильтры вкладки, с которой блок отправили на главную */
    globalFilters?: GlobalFilterRow[];
    dateFrom?: string;
    dateTo?: string;
  };
}

export type ProjectsAnalyticsEmbedWidget = WidgetConfig;
export type ProjectsAnalyticsGlobalFilter = GlobalFilterRow;

/** Обёртка публичной ссылки: вместо MainLayout (меню, шапка CRM) — только поля страницы. */
const PublicShell: React.FC<{ children: React.ReactNode; header?: React.ReactNode }> = ({ children, header }) => (
  <div className="min-h-screen bg-[#f7f7f9]">
    {header}
    <div className="mx-auto max-w-[1600px] px-3 md:px-6">{children}</div>
  </div>
);

export const ProjectsAnalyticsPage: React.FC<ProjectsAnalyticsPageProps> = ({
  externalItems,
  storageNamespace = 'projects_analytics',
  toolbarSlot,
  analyticsFields = EMPTY_ANALYTICS_FIELDS,
  dashboardPresetSource = 'projects',
  dashboardPresetRef,
  header,
  analyticsLabels,
  defaultWidgetsOverride,
  workspaceObjectId,
  beforeContentSlot,
  publicView,
  embed,
  reportObjectName,
}) => {
  const readOnly = Boolean(publicView) || Boolean(embed);
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>(embed?.dateFrom || embed?.dateTo ? 'custom' : 'all');
  const [customFrom, setCustomFrom] = useState(embed?.dateFrom || '');
  const [customTo, setCustomTo] = useState(embed?.dateTo || '');
  const [search, setSearch] = useState('');
  const tabsStorageKey = `${storageNamespace}__tabs`;
  const [tabs, setTabs] = useState<AnalyticsTab[]>([{ id: MAIN_TAB_ID }]);
  const [activeTabId, setActiveTabId] = useState<string>(MAIN_TAB_ID);
  const tabsLoadedRef = useRef(false);
  const [tabModal, setTabModal] = useState<
    null | { mode: 'create' } | { mode: 'rename'; id: string } | { mode: 'delete'; id: string }
  >(null);
  const [tabDraftName, setTabDraftName] = useState('');
  const [tabDraftSource, setTabDraftSource] = useState<NewTabSource>('empty');
  const [tabMenuId, setTabMenuId] = useState<string | null>(null);
  const [tabMenuPos, setTabMenuPos] = useState<{ left: number; top: number } | null>(null);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const isMainTab = activeTab.id === MAIN_TAB_ID;
  const layoutNamespaceFor = (tabId: string) =>
    tabId === MAIN_TAB_ID ? storageNamespace : `${storageNamespace}__tab_${tabId}`;
  const layoutNamespace = layoutNamespaceFor(activeTab.id);
  const tabLabel = (tab: AnalyticsTab) =>
    tab.name?.trim() || (tab.id === MAIN_TAB_ID ? t('crm.projects.analytics.tabs.overview') : '—');
  // Фильтры хранятся во вкладке — у каждой вкладки свой срез данных.
  const globalFilters = activeTab.filters ?? NO_FILTERS;
  const setGlobalFilters = useCallback(
    (updater: GlobalFilterRow[] | ((prev: GlobalFilterRow[]) => GlobalFilterRow[])) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, filters: typeof updater === 'function' ? updater(tab.filters ?? []) : updater }
            : tab,
        ),
      );
    },
    [activeTabId],
  );
  const [editMode, setEditMode] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // «Отправить на почту» из панели ИИ-анализа (она живёт вне этого компонента).
  useEffect(() => {
    if (!workspaceObjectId) return;
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ objectId?: string }>).detail;
      if (!detail?.objectId || detail.objectId === workspaceObjectId) setReportOpen(true);
    };
    window.addEventListener('lumiva:analytics-report', open);
    return () => window.removeEventListener('lumiva:analytics-report', open);
  }, [workspaceObjectId]);
  const [shareToast, setShareToast] = useState(false);
  const periodLabels = useMemo<Record<PeriodId, string>>(
    () => ({
      '7d': t('crm.projects.analytics.period.days7'),
      '30d': t('crm.projects.analytics.period.days30'),
      '1y': t('crm.projects.analytics.period.year1'),
      all: t('crm.projects.analytics.period.all'),
      custom: t('crm.projects.analytics.period.custom'),
    }),
    [t],
  );

  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const serverLayoutLoadedRef = useRef(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [addedToHomeToast, setAddedToHomeToast] = useState(false);
  const [draftType, setDraftType] = useState<WidgetType>('metric');
  const [draftMetric, setDraftMetric] = useState<MetricKey>('total');
  const [draftChart, setDraftChart] = useState<ChartKey>('status');
  const [draftChartValueMode, setDraftChartValueMode] = useState<ChartValueMode>('count');
  const [draftChartValueField, setDraftChartValueField] = useState<string>('');
  const [draftTable, setDraftTable] = useState<TableKey>('projects');
  const [draftTableDimensions, setDraftTableDimensions] = useState<string[]>([]);
  const [draftFormulaFn, setDraftFormulaFn] = useState<FormulaFn>('sumif');
  const [draftFormulaMode, setDraftFormulaMode] = useState<FormulaMode>('count');
  const [draftFormulaLeftType, setDraftFormulaLeftType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaLeftKey, setDraftFormulaLeftKey] = useState<string>('');
  const [draftFormulaRightType, setDraftFormulaRightType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaRightKey, setDraftFormulaRightKey] = useState<string>('');
  const [draftFormulaLeftMeasure, setDraftFormulaLeftMeasure] = useState<string>('count');
  const [draftFormulaRightMeasure, setDraftFormulaRightMeasure] = useState<string>('count');
  const [draftFormulaFilters, setDraftFormulaFilters] = useState<FormulaFilterRow[]>([]);
  const [draftCompareDisplay, setDraftCompareDisplay] = useState<CompareDisplay>('bar');
  const [draftCompareSides, setDraftCompareSides] = useState<CompareSide[]>([]);
  const [draftPivotRowKey, setDraftPivotRowKey] = useState<string>('category');
  const [draftPivotColKey, setDraftPivotColKey] = useState<string>('status');
  const [draftPivotMeasures, setDraftPivotMeasures] = useState<PivotMeasureConfig[]>([
    { id: 'pv-count', mode: 'count' },
    { id: 'pv-sum', mode: 'sum', valueField: 'amount' },
  ]);
  const [draftSize, setDraftSize] = useState<WidgetSize>('md');
  const [draftSpan, setDraftSpan] = useState(6);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState<ThemeKey>('lumiva');
  const [draftShowLabels, setDraftShowLabels] = useState(true);
  const [draftMapScope, setDraftMapScope] = useState<string>('world');
  const [draftMapMode, setDraftMapMode] = useState<'countries' | 'points'>('countries');
  const [draftNoteText, setDraftNoteText] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [aiConfirmOpen, setAiConfirmOpen] = useState(false);
  const [aiBuilding, setAiBuilding] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Пояснение ИИ после построения: что из просьбы не удалось и почему. */
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [activeDonut, setActiveDonut] = useState<Record<string, number | null>>(
    {},
  );
  const [isMobile, setIsMobile] = useState(false);
  const prevAddOpenRef = useRef(false);

  useEffect(() => {
    if (externalItems) {
      setItems(externalItems);
      setLoading(false);
      setError(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProjects()
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
      })
      .catch((e: any) => {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.projects.analytics.errors.loadFailed'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [externalItems, t]);

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      Новый: t('crm.projects.statuses.new'),
      'В работе': t('crm.projects.statuses.inProgress'),
      'На проверке': t('crm.projects.statuses.review'),
      Заморожен: t('crm.projects.statuses.paused'),
      Выиграно: t('crm.projects.statuses.won'),
      Проиграно: t('crm.projects.statuses.lost'),
    }),
    [t],
  );
  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      Аналитика: t('crm.projects.categories.analytics'),
      Разработка: t('crm.projects.categories.development'),
      Маркетинг: t('crm.projects.categories.marketing'),
      Реклама: t('crm.projects.categories.ads'),
      SEO: t('crm.projects.categories.seo'),
      SMM: t('crm.projects.categories.smm'),
    }),
    [t],
  );

  const workspaceCurrencyColumn = useMemo(
    () => analyticsFields.find((field) => isCurrencyColumn(field)) ?? null,
    [analyticsFields],
  );
  /** key → валюта из подписи колонки (или null — тогда валюта строки / валюта данных). */
  /** Профиль каждой колонки по реальным строкам таблицы (не зависит от фильтров/периода). */
  const fieldProfiles = useMemo(() => {
    const map = new Map<string, FieldProfile>();
    analyticsFields.forEach((field) => map.set(field.key, profileField(field, items)));
    return map;
  }, [analyticsFields, items]);
  const profileOf = useCallback((key: string) => fieldProfiles.get(key.replace(/^(field:|sum:|avg:|filled:)/, '')), [fieldProfiles]);

  const moneyFieldCurrency = useMemo(() => {
    const map = new Map<string, string | null>();
    analyticsFields.forEach((field) => {
      const type = String(field.type || '').toLowerCase();
      // Текстовая колонка считается денежной только с валютой в названии: «Итого (TRY)».
      if (type !== 'number' && type !== 'ai' && fieldProfiles.get(field.key)?.kind !== 'number') return;
      if (isCurrencyColumn(field)) return;
      const labelCurrency = fieldLabelCurrency(field);
      if (labelCurrency) {
        map.set(field.key, labelCurrency);
        return;
      }
      const text = `${field.key} ${field.label || ''}`;
      if (NON_MONEY_EN.test(text.replace(/[^a-z]+/gi, ' ')) || NON_MONEY_RU.test(text)) return;
      const isMonth = parseMonthFieldDate(field) !== null;
      if (MONEY_RE.test(text) || (workspaceCurrencyColumn && (isMonth || type === 'number'))) {
        map.set(field.key, null);
      }
    });
    return map;
  }, [analyticsFields, workspaceCurrencyColumn, fieldProfiles]);

  /** Валюта данных для таблиц без колонки «Валюта»: по умолчанию основная валюта компании. */
  const dataCurrencyStorageKey = `${storageNamespace}_dataCurrency`;
  const [dataCurrencyOverride, setDataCurrencyOverride] = useState<string | null>(() => {
    try {
      return localStorage.getItem(dataCurrencyStorageKey);
    } catch {
      return null;
    }
  });
  const [companyCurrency, setCompanyCurrency] = useState<string | null>(null);
  useEffect(() => {
    if (!analyticsFields.length) return;
    if (publicView) {
      if (publicView.primaryCurrency) setCompanyCurrency(normalizeMarketingDisplayCurrency(publicView.primaryCurrency));
      return;
    }
    let alive = true;
    fetchCompanySettings({ skipUnauthorizedRedirect: true })
      .then((settings) => {
        if (alive && settings.primaryCurrency) {
          setCompanyCurrency(normalizeMarketingDisplayCurrency(settings.primaryCurrency));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [analyticsFields.length, publicView]);
  const dataCurrency = normalizeMarketingDisplayCurrency(dataCurrencyOverride || companyCurrency || 'EUR');
  const changeDataCurrency = (next: string) => {
    setDataCurrencyOverride(next);
    try {
      localStorage.setItem(dataCurrencyStorageKey, next);
    } catch {
      // ignore
    }
  };
  const needsDataCurrency =
    analyticsFields.length > 0 &&
    !workspaceCurrencyColumn &&
    [...moneyFieldCurrency.values()].some((code) => code === null);

  const rowSourceCurrency = useCallback(
    (p: Project) => {
      if (analyticsFields.length === 0) {
        return String(p.currency || 'EUR').toUpperCase().slice(0, 8) || 'EUR';
      }
      const raw = workspaceCurrencyColumn ? p.customFields?.[workspaceCurrencyColumn.key] : null;
      const code = String(raw ?? '').trim().toUpperCase();
      return /^[A-Z]{3}$/.test(code) ? code : dataCurrency;
    },
    [analyticsFields.length, workspaceCurrencyColumn, dataCurrency],
  );

  const currenciesPresent = useMemo(
    () => Array.from(new Set(items.map((p) => rowSourceCurrency(p)))),
    [items, rowSourceCurrency],
  );
  const { state: currencyPrefs, setState: setCurrencyPrefs } = useMarketingDisplayCurrencyPrefs(
    currenciesPresent,
    publicView
      ? { fetchRates: publicView.fetchRates, defaultCurrency: publicView.primaryCurrency, persist: false }
      : undefined,
  );
  const reportCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const convertedItemsResult = useMemo(() => {
    const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
    const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
    let missing = false;
    const converted = items.map((p) => {
      const sourceAmount = Number(p.amount) || 0;
      const sourceCurrency = rowSourceCurrency(p);
      const result = convertMarketingAmount(sourceAmount, sourceCurrency, 'converted', displayCurrency, rates);
      if (result.missingRate) missing = true;
      if (!moneyFieldCurrency.size || !p.customFields) {
        return { ...p, amount: Math.round(result.value * 100) / 100, currency: result.currency };
      }
      const customFields = { ...p.customFields };
      moneyFieldCurrency.forEach((labelCurrency, key) => {
        const value = parseNumericLoose(customFields[key]);
        if (value === null) return;
        const fieldResult = convertMarketingAmount(
          value,
          labelCurrency || sourceCurrency,
          'converted',
          displayCurrency,
          rates,
        );
        if (fieldResult.missingRate) missing = true;
        customFields[key] = Math.round(fieldResult.value * 100) / 100;
      });
      return { ...p, amount: Math.round(result.value * 100) / 100, currency: result.currency, customFields };
    });
    return { items: converted, missing };
  }, [items, currencyPrefs, rowSourceCurrency, moneyFieldCurrency]);
  /** Подсказка графика: 2 знака после запятой, валюта для денежных сумм, понятная подпись вместо «count». */
  const chartTooltipFormatter = (mode: ChartValueMode | undefined, valueField?: string) =>
    (value: number) => {
      const isSum = mode === 'sum';
      const n = Number(value) || 0;
      const text =
        isSum && (isMoneyValueField(valueField) || (!valueField && analyticsFields.length === 0))
          ? t('crm.projects.common.amountWithCurrency', {
              amount: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n),
              currency: reportCurrency,
            })
          : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
      return [text, isSum ? t('crm.projects.analytics.tooltip.sum') : t('crm.projects.analytics.tooltip.count')];
    };
  const isMoneyValueField = (valueField?: string) => {
    if (!valueField) return false;
    const key = valueField.replace(/^(sum:|avg:|field:)/, '');
    return key === 'amount' || moneyFieldCurrency.has(key);
  };
  const displayItems = convertedItemsResult.items;
  const currencyRateMissing = convertedItemsResult.missing;

  const searchedItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return displayItems;
    return displayItems.filter((item) => {
      const customText = Object.entries(item.customFields || {})
        .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(' ') : String(value ?? '')}`)
        .join(' ');
      const fieldText = analyticsFields
        .map((field) => `${field.label} ${String(item.customFields?.[field.key] ?? '')}`)
        .join(' ');
      return [
        item.name,
        item.description,
        item.status,
        item.category,
        item.owner,
        item.leadName,
        item.leadEmail,
        item.currency,
        (item.tags || []).join(' '),
        customText,
        fieldText,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [displayItems, search, analyticsFields]);

  const isWorkspaceMode = analyticsFields.length > 0;
  const analyticsFieldMap = useMemo(
    () => new Map(analyticsFields.map((field) => [field.key, field])),
    [analyticsFields],
  );
  const getCustomFieldValue = (item: Project, key: string) => item.customFields?.[key];
  const workspaceDateFieldKey = useMemo(() => {
    if (!isWorkspaceMode) return null;
    const dateFields = analyticsFields.filter((field) =>
      ['date', 'datetime'].includes(String(field.type || '').toLowerCase()),
    );
    return (
      dateFields.find((field) => /date|дата|datum/i.test(`${field.key} ${field.label || ''}`))?.key ||
      dateFields[0]?.key ||
      null
    );
  }, [analyticsFields, isWorkspaceMode]);
  const getAnalyticsDate = useCallback(
    (item: Project) => {
      const raw = workspaceDateFieldKey ? item.customFields?.[workspaceDateFieldKey] : null;
      return parseDate(raw == null ? item.createdAt : String(raw)) || parseDate(item.createdAt);
    },
    [workspaceDateFieldKey],
  );

  /** "Широкая" таблица (строка = категория, одна числовая колонка на месяц, напр. расходы по
   * странам из маркетингового импорта) — у строк нет собственной даты события, поэтому период
   * нельзя применять построчно по createdAt (это дата импорта, а не дата расхода). Вместо этого
   * период сужает то, СУММА КАКИХ МЕСЯЧНЫХ КОЛОНОК идёт в расчёт метрик/графиков. */
  const monthFieldDates = useMemo(() => {
    const map = new Map<string, Date>();
    if (!isWorkspaceMode) return map;
    analyticsFields.forEach((field) => {
      if (String(field.type || '').toLowerCase() !== 'number') return;
      const date = parseMonthFieldDate(field);
      if (date) map.set(field.key, date);
    });
    return map;
  }, [analyticsFields, isWorkspaceMode]);
  const isWideMonthlyTable = monthFieldDates.size >= 2;
  /** Два самых свежих месячных поля (старое, новое) — авто-подстановка в Левую/Правую часть,
   * когда пользователь впервые включает график сравнения, чтобы не искать их вручную в списке. */
  const pickTwoRecentMonthKeys = (): [string, string] | null => {
    const sorted = [...monthFieldDates.entries()].sort((a, b) => b[1].getTime() - a[1].getTime());
    if (sorted.length < 2) return null;
    return [`sum:${sorted[1][0]}`, `sum:${sorted[0][0]}`];
  };

  const activePeriodRange = useMemo(() => {
    if (period === 'all') return null;
    const now = new Date();
    if (period === 'custom') {
      if (!customFrom && !customTo) return null;
      const start = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
      const end = customTo ? new Date(`${customTo}T23:59:59.999`) : now;
      return { start, end };
    }
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (period === '7d') start.setDate(now.getDate() - 6);
    if (period === '30d') start.setDate(now.getDate() - 29);
    if (period === '1y') start.setFullYear(now.getFullYear() - 1);
    return { start, end: now };
  }, [period, customFrom, customTo]);

  /** Месячная колонка хранит ОДНО число на весь месяц — суточной детализации внутри него нет.
   * Поэтому "попадание в период" — это пересечение периода с календарным месяцем (а не только
   * попадание 1-го числа месяца в узкое окно вроде "7 дней", иначе такие окна всегда были бы пустыми). */
  const monthOverlapsRange = (monthStart: Date, range: { start: Date; end: Date }) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
    return monthStart <= range.end && monthEnd >= range.start;
  };

  /** Числовое значение поля с учётом периода: для обычных полей и для КОНКРЕТНОЙ месячной
   * колонки (её явно выбрали руками — например чтобы сравнить "Август" с "Сентябрь" в формуле,
   * такое сравнение не должно зависеть от периода на странице) — как есть, без фильтрации.
   * Период сужает только АГРЕГАТНОЕ поле (напр. "Итого") — сумму месячных колонок, попадающих
   * в период. */
  const getPeriodAwareFieldValue = (item: Project, fieldKey: string): number => {
    const raw = parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
    if (!isWideMonthlyTable || !activePeriodRange) return raw;
    if (monthFieldDates.has(fieldKey)) return raw;
    let sum = 0;
    monthFieldDates.forEach((date, key) => {
      if (monthOverlapsRange(date, activePeriodRange)) {
        sum += parseNumericLoose(getCustomFieldValue(item, key)) ?? 0;
      }
    });
    return sum;
  };

  const periodItems = useMemo(() => {
    if (isWideMonthlyTable || !activePeriodRange) return searchedItems;
    return searchedItems.filter((p) => {
      const date = getAnalyticsDate(p);
      if (!date) return true;
      return date >= activePeriodRange.start && date <= activePeriodRange.end;
    });
  }, [searchedItems, activePeriodRange, isWideMonthlyTable, getAnalyticsDate]);

  const dashboardFilterFields = useMemo(
    () =>
      isWorkspaceMode
        ? analyticsFields
            .filter((field) => !['date', 'datetime'].includes(String(field.type || '').toLowerCase()))
            .map((field) => ({ id: `field:${field.key}`, label: field.label || field.key }))
        : [
            { id: 'status', label: t('crm.projects.analytics.statusChart.title') },
            { id: 'category', label: t('crm.projects.analytics.categoryChart.title') },
            { id: 'owner', label: t('crm.projects.analytics.ownerChart.title') },
            { id: 'tag', label: t('crm.projects.analytics.tagChart.title') },
          ],
    [analyticsFields, isWorkspaceMode, t],
  );

  const getDashboardFieldValue = (item: Project, scope: string): unknown => {
    if (scope.startsWith('field:')) return getCustomFieldValue(item, scope.replace('field:', ''));
    if (scope === 'status') return item.status;
    if (scope === 'category') return item.category || t('crm.projects.analytics.noCategory');
    if (scope === 'owner') return item.owner || t('crm.projects.analytics.unknownOwner');
    if (scope === 'tag') return item.tags || [];
    return '';
  };

  const dashboardValueOptionsByScope = useMemo(() => {
    const out: Record<string, Array<{ id: string; label: string }>> = {};
    dashboardFilterFields.forEach((field) => {
      const values = new Map<string, number>();
      periodItems.forEach((item) => {
        const raw = getDashboardFieldValue(item, field.id);
        const list = Array.isArray(raw)
          ? raw.map(String)
          : String(raw ?? '')
              .split(/[,;/]+/)
              .map((value) => value.trim());
        list.filter(Boolean).forEach((value) => values.set(value, (values.get(value) || 0) + 1));
      });
      out[field.id] = Array.from(values.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 120)
        .map(([id, count]) => ({ id, label: `${id} · ${count}` }));
    });
    return out;
  }, [dashboardFilterFields, periodItems]);

  const itemMatchesGlobalFilter = (item: Project, filter: GlobalFilterRow) => {
    if (!filter.keys.length) return true;
    const raw = getDashboardFieldValue(item, filter.scope);
    const values = Array.isArray(raw)
      ? raw.map(String)
      : String(raw ?? '')
          .split(/[,;/]+/)
          .map((value) => value.trim())
          .filter(Boolean);
    return filter.keys.some((key) => values.includes(key));
  };

  const filteredItems = useMemo(
    () =>
      globalFilters.length
        ? periodItems.filter((item) => globalFilters.every((filter) => itemMatchesGlobalFilter(item, filter)))
        : periodItems,
    [globalFilters, periodItems],
  );

  const totalProjects = filteredItems.length;
  const totalAmount = useMemo(
    () => filteredItems.reduce((sum, p) => sum + (p.amount || 0), 0),
    [filteredItems],
  );
  const avgAmount = totalProjects > 0 ? Math.round(totalAmount / totalProjects) : 0;

  /** Группировка (chartKey/tableKey-как-измерение/formula "count по значению") имеет смысл
   * только для категориальных полей — числовое поле (включая помесячные колонки "широких"
   * таблиц) как измерение даёт по сути одну "категорию" на строку и бессмысленный график. */
  const dynamicDimensionOptions = useMemo(
    () =>
      analyticsFields
        .filter((field) => fieldProfiles.get(field.key)?.kind === 'category')
        .map((field) => ({
          id: `field:${field.key}`,
          label: field.label || field.key,
        })),
    [analyticsFields, fieldProfiles],
  );

  // Фильтры и «количество записей со значением» — шире групп: можно фильтровать и по имени клиента.
  const dynamicFormulaScopeOptions = useMemo(
    () =>
      analyticsFields
        .filter((field) => {
          const kind = fieldProfiles.get(field.key)?.kind;
          return kind === 'category' || kind === 'unique' || kind === 'constant';
        })
        .map((field) => ({
          id: `field:${field.key}`,
          label: field.label || field.key,
        })),
    [analyticsFields, fieldProfiles],
  );

  const numericKeyLooksMonetary = (key: string, label: string) => {
    const k = key.toLowerCase();
    const l = label.toLowerCase();
    return (
      k.includes('amount') ||
      k.includes('price') ||
      k.includes('sum') ||
      k.includes('value') ||
      k.includes('tutar') ||
      k.includes('miktar') ||
      k.includes('total') ||
      k.includes('cost') ||
      k.includes('budget') ||
      l.includes('amount') ||
      l.includes('price') ||
      l.includes('sum') ||
      l.includes('value') ||
      l.includes('сумм') ||
      l.includes('цена') ||
      l.includes('тутар') ||
      l.includes('бюджет')
    );
  };

  const dynamicNumericFields = useMemo(
    () => analyticsFields.filter((field) => fieldProfiles.get(field.key)?.kind === 'number'),
    [analyticsFields, fieldProfiles],
  );

  /** В режиме только проектов (без analyticsFields) — поля суммы из customFields по данным. */
  const inferredNumericCustomFields = useMemo(() => {
    if (isWorkspaceMode) return [];
    const seen = new Set<string>();
    const out: AnalyticsFieldMeta[] = [];
    filteredItems.forEach((item) => {
      const cf = item.customFields || {};
      Object.keys(cf).forEach((key) => {
        if (seen.has(key)) return;
        const raw = cf[key];
        const n = parseNumericLoose(raw);
        if (n !== null || numericKeyLooksMonetary(key, key)) {
          seen.add(key);
          out.push({ key, label: key });
        }
      });
    });
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }, [isWorkspaceMode, filteredItems]);

  const numericFieldsForMetrics = isWorkspaceMode ? dynamicNumericFields : inferredNumericCustomFields;

  const pivotMeasureFieldOptions = useMemo(() => {
    const amountOpt = {
      value: 'amount',
      label: t('crm.projects.analytics.table.headers.amount'),
    };
    if (!isWorkspaceMode) {
      return [
        amountOpt,
        ...inferredNumericCustomFields.map((f) => ({
          value: `field:${f.key}`,
          label: f.label,
        })),
      ];
    }
    return [
      amountOpt,
      ...dynamicNumericFields.map((f) => ({
        value: `field:${f.key}`,
        label: f.label,
      })),
    ];
  }, [t, isWorkspaceMode, dynamicNumericFields, inferredNumericCustomFields]);

  const owners = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((p) => {
      const owner = p.owner || t('crm.projects.analytics.unknownOwner');
      map.set(owner, (map.get(owner) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredItems, t]);

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((p) => {
      (p.tags || []).forEach((tag) => {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredItems]);

  const statusChartData: StatusChartPoint[] = useMemo(
    () =>
      filteredItems.reduce((acc, p) => {
        const label = statusLabels[p.status] ?? p.status;
        const row = acc.find((s) => s.label === label);
        if (row) row.count += 1;
        else acc.push({ code: p.status, label, count: 1 });
        return acc;
      }, [] as StatusChartPoint[]),
    [filteredItems, statusLabels],
  );

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredItems.forEach((p) => {
      if (isWorkspaceMode && !p.category) return;
      const raw = p.category || t('crm.projects.analytics.noCategory');
      const label = categoryLabels[raw] ?? raw;
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredItems, categoryLabels, t, isWorkspaceMode]);

  const seriesByKey = useMemo<Record<string, Array<{ code: string; label: string; count: number }>>>(() => {
    if (!isWorkspaceMode) {
      return {
        status: statusChartData,
        category: categoryChartData.map((item) => ({
          code: item.label,
          label: item.label,
          count: item.count,
        })),
        owner: owners.map((item) => ({
          code: item.label,
          label: item.label,
          count: item.count,
        })),
        tag: tags.map((item) => ({
          code: item.label,
          label: item.label,
          count: item.count,
        })),
      };
    }

    const map: Record<string, Array<{ code: string; label: string; count: number }>> = {};
    analyticsFields.forEach((field) => {
      const bucket = new Map<string, number>();
      filteredItems.forEach((item) => {
        const raw = getCustomFieldValue(item, field.key);
        if (!isFilled(raw)) return;
        const values =
          field.type === 'multiselect'
            ? splitMulti(raw)
            : [String(raw).trim()].filter(Boolean);
        values.forEach((value) => {
          const label = value;
          bucket.set(label, (bucket.get(label) ?? 0) + 1);
        });
      });
      map[`field:${field.key}`] = Array.from(bucket.entries()).map(([label, count]) => ({
        code: label,
        label,
        count,
      }));
    });
    return map;
  }, [isWorkspaceMode, statusChartData, categoryChartData, owners, tags, analyticsFields, filteredItems]);

  const currency = reportCurrency;
  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  const metricOptions = useMemo(
    () => {
      if (isWorkspaceMode) {
        return [
          { id: 'total', label: t('crm.projects.analytics.kpis.total') },
          ...dynamicNumericFields.flatMap((field) => [
            {
              id: `sum:${field.key}`,
              label: `${field.label} (${t('crm.projects.analytics.metric.suffix.sum')})`,
            },
            {
              id: `avg:${field.key}`,
              label: `${field.label} (${t('crm.projects.analytics.metric.suffix.avg')})`,
            },
          ]),
          ...analyticsFields
            .filter((field) => String(field.type || '').toLowerCase() !== 'number')
            .map((field) => ({
              id: `filled:${field.key}`,
              label: `${field.label} (filled)`,
            })),
        ];
      }
      return [
        { id: 'total', label: t('crm.projects.analytics.kpis.total') },
        { id: 'amount', label: t('crm.projects.analytics.kpis.amount') },
        { id: 'avgAmount', label: t('crm.projects.analytics.kpis.avgAmount') },
        ...numericFieldsForMetrics.flatMap((field) => [
          { id: `sum:${field.key}`, label: `${field.label} (${t('crm.projects.analytics.metric.suffix.sum')})` },
          { id: `avg:${field.key}`, label: `${field.label} (${t('crm.projects.analytics.metric.suffix.avg')})` },
        ]),
        {
          id: 'filteredPercent',
          label: t('crm.projects.analytics.metric.filteredPercent'),
        },
        { id: 'owners', label: t('crm.projects.analytics.kpis.owners') },
        { id: 'categories', label: t('crm.projects.analytics.kpis.categories') },
        { id: 'tags', label: t('crm.projects.analytics.kpis.tags') },
        { id: 'statuses', label: t('crm.projects.analytics.kpis.statuses') },
      ];
    },
    [t, isWorkspaceMode, analyticsFields, dynamicNumericFields, numericFieldsForMetrics],
  );

  const chartOptions = useMemo(
    () =>
      isWorkspaceMode
        ? dynamicDimensionOptions
        : [
            { id: 'status', label: t('crm.projects.analytics.statusChart.title') },
            { id: 'category', label: t('crm.projects.analytics.categoryChart.title') },
            { id: 'owner', label: t('crm.projects.analytics.ownerChart.title') },
            { id: 'tag', label: t('crm.projects.analytics.tagChart.title') },
          ],
    [t, isWorkspaceMode, dynamicDimensionOptions],
  );

  const widgetTypeOptions = useMemo(
    () => [
      { id: 'metric', label: t('crm.projects.analytics.widgets.type.metric') },
      { id: 'donut', label: t('crm.projects.analytics.widgets.type.donut') },
      { id: 'bar', label: t('crm.projects.analytics.widgets.type.bar') },
      { id: 'line', label: 'Линия' },
      { id: 'funnel', label: 'Воронка' },
      { id: 'leaderboard', label: 'Рейтинг' },
      { id: 'table', label: t('crm.projects.analytics.widgets.type.table') },
      { id: 'heatmap', label: 'Heatmap' },
      { id: 'note', label: 'Заметка' },
      { id: 'pivot', label: t('crm.projects.analytics.widgets.type.pivot') },
      { id: 'formula', label: t('crm.projects.analytics.widgets.type.formula') },
      { id: 'map', label: t('crm.projects.analytics.widgets.type.map') },
    ],
    [t],
  );

  const tableOptions = useMemo(
    () =>
      isWorkspaceMode
        ? [
            { id: 'projects', label: t('crm.projects.analytics.table.title') },
            ...dynamicDimensionOptions,
          ]
        : [
            { id: 'projects', label: t('crm.projects.analytics.table.title') },
            { id: 'owners', label: t('crm.projects.analytics.ownersTable.title') },
            { id: 'categories', label: t('crm.projects.analytics.categoriesTable.title') },
          ],
    [t, isWorkspaceMode, dynamicDimensionOptions],
  );

  const formulaScopeOptions = useMemo(
    () =>
      isWorkspaceMode
        ? dynamicFormulaScopeOptions
        : [
            { id: 'status', label: t('crm.projects.analytics.formula.scope.status') },
            { id: 'category', label: t('crm.projects.analytics.formula.scope.category') },
            { id: 'owner', label: t('crm.projects.analytics.formula.scope.owner') },
            { id: 'tag', label: t('crm.projects.analytics.formula.scope.tag') },
          ],
    [t, isWorkspaceMode, dynamicFormulaScopeOptions],
  );

  const formulaFunctionOptions = useMemo(
    () => [
      { id: 'sumif', label: t('crm.projects.analytics.formula.fn.sumif') },
      { id: 'count', label: t('crm.projects.analytics.formula.fn.count') },
      { id: 'percent', label: t('crm.projects.analytics.formula.fn.percent') },
      { id: 'ratio', label: t('crm.projects.analytics.formula.fn.ratio') },
      { id: 'diff', label: t('crm.projects.analytics.formula.fn.diff') },
    ],
    [t],
  );

  const formulaModeOptions = useMemo(
    () => [
      { id: 'count', label: t('crm.projects.analytics.formula.mode.count') },
      { id: 'percent', label: t('crm.projects.analytics.formula.mode.percent') },
      { id: 'sum', label: t('crm.projects.analytics.formula.mode.sum') },
    ],
    [t],
  );

  const formulaValueItems = useMemo(
    () => {
      if (isWorkspaceMode) {
        return Object.fromEntries(
          Object.entries(seriesByKey).map(([key, list]) => [
            key,
            list.map((item) => ({ id: item.code, label: item.label })),
          ]),
        ) as Record<string, Array<{ id: string; label: string }>>;
      }
      return {
        status: Object.entries(statusLabels).map(([id, label]) => ({ id, label })),
        category: categoryChartData.map((c) => ({ id: c.label, label: c.label })),
        owner: owners.map((o) => ({ id: o.label, label: o.label })),
        tag: tags.map((t) => ({ id: t.label, label: t.label })),
      } as Record<string, Array<{ id: string; label: string }>>;
    },
    [statusLabels, categoryChartData, owners, tags, isWorkspaceMode, seriesByKey],
  );

  const formulaValueFallback = useMemo(
    () => [{ id: 'unknown', label: t('crm.projects.analytics.tooltips.unknown') }],
    [t],
  );

  const defaultFormulaFilterRow = useMemo((): FormulaFilterRow => {
    const scope = (formulaScopeOptions[0]?.id || 'status') as FormulaScope;
    return { scope, keys: [] };
  }, [formulaScopeOptions]);

  /** Группы для «Лучший/худший по группе»: только настоящие категории (мастер, салон, страна) —
   * без дат, числовых колонок («Итого») и колонок, где почти все значения разные (имя, ID). */
  const groupDimOptions = useMemo(
    () => (isWorkspaceMode ? dynamicDimensionOptions : ([] as Array<{ id: string; label: string }>)),
    [isWorkspaceMode, dynamicDimensionOptions],
  );
  const groupMeasureOptions = useMemo(
    () => [
      ...dynamicNumericFields.map((field) => ({ id: `sum:${field.key}`, label: field.label || field.key })),
      { id: 'count', label: t('crm.projects.analytics.formula.group.count') },
    ],
    [dynamicNumericFields, t],
  );

  const formulaOperandOptions = useMemo(
    () => {
      if (isWorkspaceMode) {
        return [
          { id: 'total', label: t('crm.projects.analytics.kpis.total') },
          ...dynamicNumericFields.flatMap((field) => [
            {
              id: `sum:${field.key}`,
              label: `${field.label} (${t('crm.projects.analytics.metric.suffix.sum')})`,
            },
            {
              id: `avg:${field.key}`,
              label: `${field.label} (${t('crm.projects.analytics.metric.suffix.avg')})`,
            },
          ]),
          ...analyticsFields
            .filter((field) => String(field.type || '').toLowerCase() !== 'number')
            .map((field) => ({
              id: `filled:${field.key}`,
              label: `${field.label} (filled)`,
            })),
          ...dynamicDimensionOptions,
          ...(groupDimOptions.length
            ? [
                { id: 'groupmax', label: t('crm.projects.analytics.formula.group.maxOption') },
                { id: 'groupmin', label: t('crm.projects.analytics.formula.group.minOption') },
              ]
            : []),
        ];
      }
      return [
        { id: 'total', label: t('crm.projects.analytics.kpis.total') },
        { id: 'amount', label: t('crm.projects.analytics.kpis.amount') },
        { id: 'avgAmount', label: t('crm.projects.analytics.kpis.avgAmount') },
        ...inferredNumericCustomFields.flatMap((field) => [
          { id: `sum:${field.key}`, label: `${field.label} (${t('crm.projects.analytics.metric.suffix.sum')})` },
          { id: `avg:${field.key}`, label: `${field.label} (${t('crm.projects.analytics.metric.suffix.avg')})` },
        ]),
        { id: 'owners', label: t('crm.projects.analytics.kpis.owners') },
        { id: 'categories', label: t('crm.projects.analytics.kpis.categories') },
        { id: 'tags', label: t('crm.projects.analytics.kpis.tags') },
        { id: 'status', label: t('crm.projects.analytics.formula.scope.status') },
        { id: 'category', label: t('crm.projects.analytics.formula.scope.category') },
        { id: 'owner', label: t('crm.projects.analytics.formula.scope.owner') },
        { id: 'tag', label: t('crm.projects.analytics.formula.scope.tag') },
      ];
    },
    [
      t,
      isWorkspaceMode,
      analyticsFields,
      dynamicNumericFields,
      dynamicDimensionOptions,
      inferredNumericCustomFields,
      groupDimOptions,
    ],
  );

  /** «Что считать» для части формулы, заданной значением измерения. */
  const formulaMeasureOptions = useMemo(
    () => [
      { id: 'count', label: t('crm.projects.analytics.formula.measure.count', { defaultValue: 'Количество строк' }) },
      ...formulaOperandOptions.filter((opt) => opt.id.startsWith('sum:') || opt.id.startsWith('avg:')),
    ],
    [formulaOperandOptions, t],
  );


  const getDefaultHeight = (size: WidgetSize, type: WidgetType) => {
    if (type === 'pivot') {
      return size === 'lg' ? 420 : size === 'md' ? 360 : 320;
    }
    if (type === 'map') {
      return size === 'lg' ? 480 : size === 'md' ? 420 : 360;
    }
    if (type === 'line' || type === 'funnel' || type === 'leaderboard') {
      return size === 'lg' ? 400 : size === 'md' ? 320 : 280;
    }
    if (type === 'heatmap' || type === 'note') {
      return size === 'lg' ? 320 : size === 'md' ? 240 : 220;
    }
    if (type === 'table') {
      return size === 'lg' ? 380 : size === 'md' ? 320 : 260;
    }
    if (type === 'donut' || type === 'bar') {
      return size === 'lg' ? 380 : size === 'md' ? 320 : 280;
    }
    return size === 'lg' ? 260 : size === 'md' ? 220 : 200;
  };

  const defaultWidgets = useMemo<WidgetConfig[]>(
    () => {
      if (defaultWidgetsOverride?.length) return defaultWidgetsOverride;
      if (isWorkspaceMode) {
        const firstDimension = dynamicFormulaScopeOptions[0] || dynamicDimensionOptions[0];
        const firstNumeric = dynamicNumericFields[0];
        return [
          {
            id: 'metric-total',
            type: 'metric',
            title: analyticsLabels?.total || t('crm.projects.analytics.kpis.total'),
            metricKey: 'total',
            size: 'sm',
            span: 3,
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'metric-filled',
            type: 'metric',
            title: firstDimension ? `${firstDimension.label} (filled)` : t('crm.projects.analytics.kpis.total'),
            metricKey: firstDimension ? `filled:${firstDimension.id.replace('field:', '')}` : 'total',
            size: 'sm',
            span: 3,
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'metric-sum',
            type: 'metric',
            title: firstNumeric ? `${firstNumeric.label} (sum)` : t('crm.projects.analytics.kpis.total'),
            metricKey: firstNumeric ? `sum:${firstNumeric.key}` : 'total',
            size: 'sm',
            span: 3,
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'metric-avg',
            type: 'metric',
            title: firstNumeric ? `${firstNumeric.label} (avg)` : t('crm.projects.analytics.kpis.total'),
            metricKey: firstNumeric ? `avg:${firstNumeric.key}` : 'total',
            size: 'sm',
            span: 3,
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'chart-workspace-line',
            type: 'line',
            title: analyticsLabels?.line || 'Динамика записей',
            chartKey: firstDimension?.id || 'projects',
            chartValueMode: firstNumeric ? 'sum' : 'count',
            chartValueField: firstNumeric ? `field:${firstNumeric.key}` : undefined,
            size: 'md',
            span: 8,
            height: getDefaultHeight('md', 'line'),
          },
          {
            id: 'chart-dimension-donut',
            type: 'donut',
            title: firstDimension?.label || t('crm.projects.analytics.statusChart.title'),
            chartKey: firstDimension?.id || 'projects',
            size: 'md',
            span: 4,
            height: getDefaultHeight('md', 'donut'),
            showLabels: true,
          },
          {
            id: 'chart-dimension-bar',
            type: 'bar',
            title: firstDimension?.label || t('crm.projects.analytics.categoryChart.title'),
            chartKey: firstDimension?.id || 'projects',
            size: 'md',
            span: 6,
            height: getDefaultHeight('md', 'bar'),
          },
          {
            id: 'table-records',
            type: 'table',
            title: analyticsLabels?.table || t('crm.projects.analytics.table.title'),
            tableKey: 'projects',
            size: 'md',
            span: 6,
            height: getDefaultHeight('md', 'table'),
          },
          {
            id: 'note-workspace',
            type: 'note',
            title: 'Главное по workspace',
            size: 'md',
            span: 6,
            height: getDefaultHeight('md', 'note'),
          },
        ];
      }
      return [
        {
          id: 'metric-total',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.total'),
          metricKey: 'total',
          size: 'sm',
          span: 3,
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'metric-amount',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.amount'),
          metricKey: 'amount',
          size: 'sm',
          span: 3,
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'metric-avg-amount',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.avgAmount'),
          metricKey: 'avgAmount',
          size: 'sm',
          span: 3,
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'metric-owners',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.owners'),
          metricKey: 'owners',
          size: 'sm',
          span: 3,
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'chart-projects-line',
          type: 'line',
          title: 'Динамика проектов',
          chartKey: 'status',
          chartValueMode: 'sum',
          chartValueField: 'amount',
          size: 'md',
          span: 8,
          height: getDefaultHeight('md', 'line'),
        },
        {
          id: 'chart-status',
          type: 'donut',
          title: t('crm.projects.analytics.statusChart.title'),
          chartKey: 'status',
          size: 'md',
          span: 4,
          height: getDefaultHeight('md', 'donut'),
          showLabels: true,
        },
        {
          id: 'chart-categories',
          type: 'bar',
          title: t('crm.projects.analytics.categoryChart.title'),
          chartKey: 'category',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'bar'),
        },
        {
          id: 'funnel-statuses',
          type: 'funnel',
          title: 'Воронка статусов',
          chartKey: 'status',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'funnel'),
        },
        {
          id: 'leaderboard-owners',
          type: 'leaderboard',
          title: 'Рейтинг ответственных',
          chartKey: 'owner',
          chartValueMode: 'sum',
          chartValueField: 'amount',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'leaderboard'),
        },
        {
          id: 'table-owners',
          type: 'table',
          title: t('crm.projects.analytics.ownersTable.title'),
          tableKey: 'owners',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'table'),
        },
        {
          id: 'table-categories',
          type: 'table',
          title: t('crm.projects.analytics.categoriesTable.title'),
          tableKey: 'categories',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'table'),
        },
        {
          id: 'table-projects',
          type: 'table',
          title: t('crm.projects.analytics.table.title'),
          tableKey: 'projects',
          size: 'md',
          span: 6,
          height: getDefaultHeight('md', 'table'),
        },
        {
          id: 'heatmap-projects',
          type: 'heatmap',
          title: 'Активность по дням',
          size: 'md',
          span: 8,
          height: getDefaultHeight('md', 'heatmap'),
        },
        {
          id: 'note-projects',
          type: 'note',
          title: 'Главное за период',
          size: 'md',
          span: 4,
          height: getDefaultHeight('md', 'note'),
        },
      ];
    },
    [t, isWorkspaceMode, dynamicDimensionOptions, dynamicFormulaScopeOptions, dynamicNumericFields, analyticsLabels, defaultWidgetsOverride],
  );

  const hasData = !loading && !error;
  const isEditing = editOpen;

  // Список вкладок: localStorage сразу, потом серверные предпочтения (они главнее).
  useEffect(() => {
    tabsLoadedRef.current = false;
    const normalizeTabs = (raw: unknown): AnalyticsTab[] | null => {
      if (!Array.isArray(raw)) return null;
      const list = raw
        .filter((tab): tab is AnalyticsTab => Boolean(tab && typeof (tab as AnalyticsTab).id === 'string'))
        .map((tab): AnalyticsTab => ({
          id: tab.id,
          name: typeof tab.name === 'string' ? tab.name : undefined,
          filters: Array.isArray(tab.filters) ? tab.filters : undefined,
        }));
      if (!list.some((tab) => tab.id === MAIN_TAB_ID)) list.unshift({ id: MAIN_TAB_ID });
      return list;
    };
    if (embed) {
      setTabs([{ id: MAIN_TAB_ID, filters: embed.globalFilters }]);
      setActiveTabId(MAIN_TAB_ID);
      return;
    }
    if (publicView) {
      setTabs(normalizeTabs(publicView.layouts[tabsStorageKey]) || [{ id: MAIN_TAB_ID }]);
      setActiveTabId(MAIN_TAB_ID);
      return;
    }
    let localTabs: AnalyticsTab[] | null = null;
    try {
      const raw = localStorage.getItem(tabsStorageKey);
      if (raw) localTabs = normalizeTabs(JSON.parse(raw));
    } catch {
      // ignore
    }
    setTabs(localTabs || [{ id: MAIN_TAB_ID }]);
    setActiveTabId(MAIN_TAB_ID);
    void fetchUserPreferences()
      .then(({ preferences }) => {
        const serverTabs = normalizeTabs(preferences?.analyticsLayouts?.[tabsStorageKey]);
        if (serverTabs) setTabs(serverTabs);
      })
      .catch(() => {
        // localStorage fallback
      })
      .finally(() => {
        tabsLoadedRef.current = true;
      });
  }, [tabsStorageKey, publicView, embed]);

  useEffect(() => {
    if (!tabsLoadedRef.current || readOnly) return;
    try {
      localStorage.setItem(tabsStorageKey, JSON.stringify(tabs));
    } catch {
      // ignore
    }
    const timer = window.setTimeout(() => {
      void updateUserPreferences({ analyticsLayouts: { [tabsStorageKey]: tabs } }).catch(() => {
        // localStorage fallback
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [tabs, tabsStorageKey]);

  /** Последний ещё не отправленный на сервер снимок раскладки — дожимаем его при смене вкладки,
   * иначе debounce-таймер сбрасывается и правки последних 400мс теряются. */
  const pendingLayoutSaveRef = useRef<{ ns: string; widgets: WidgetConfig[] } | null>(null);
  const layoutLoadSeqRef = useRef(0);

  useEffect(() => {
    serverLayoutLoadedRef.current = false;
    const seq = ++layoutLoadSeqRef.current;
    // Основной дашборд без сохранённой раскладки показывает стандартный набор;
    // пользовательская вкладка может быть и пустой.
    const isMain = layoutNamespace === storageNamespace;
    const acceptLayout = (raw: unknown): raw is unknown[] =>
      Array.isArray(raw) && (isMain ? raw.length > 0 : true);
    if (embed) {
      setWidgets([migrateWidgetFromStorage(embed.widget as unknown as Record<string, unknown>)]);
      return;
    }
    if (publicView) {
      const raw = publicView.layouts[layoutNamespace];
      setWidgets(
        acceptLayout(raw)
          ? raw.map((w) => migrateWidgetFromStorage(w as Record<string, unknown>))
          : isMain
            ? defaultWidgets
            : [],
      );
      return;
    }
    let localLayout: WidgetConfig[] | null = null;
    try {
      const version = localStorage.getItem(`${layoutNamespace}_version`);
      const raw = localStorage.getItem(`${layoutNamespace}_widgets`);
      if (raw && version === ANALYTICS_LAYOUT_VERSION) {
        const parsed = JSON.parse(raw) as unknown;
        if (acceptLayout(parsed)) {
          localLayout = parsed.map((w) => migrateWidgetFromStorage(w as Record<string, unknown>));
        }
      }
    } catch {
      // ignore
    }
    setWidgets(localLayout || (isMain ? defaultWidgets : []));
    void fetchUserPreferences()
      .then(({ preferences }) => {
        if (seq !== layoutLoadSeqRef.current) return;
        const raw = preferences?.analyticsLayouts?.[layoutNamespace];
        if (acceptLayout(raw)) {
          setWidgets(raw.map((w) => migrateWidgetFromStorage(w as Record<string, unknown>)));
        } else if (localLayout && localLayout.length > 0) {
          // One-time migration: preserve an existing browser layout when the server
          // has no layout for this user/table yet.
          void updateUserPreferences({
            analyticsLayouts: { [layoutNamespace]: localLayout },
          }).catch(() => {
            // localStorage remains the fallback if the migration cannot be saved.
          });
        }
      })
      .catch(() => {
        // localStorage remains the offline/legacy fallback
      })
      .finally(() => {
        if (seq === layoutLoadSeqRef.current) serverLayoutLoadedRef.current = true;
      });
  }, [defaultWidgets, layoutNamespace, storageNamespace, publicView, embed]);

  useEffect(() => {
    if (!serverLayoutLoadedRef.current || readOnly) return;
    const isMain = layoutNamespace === storageNamespace;
    try {
      if (widgets.length > 0 || !isMain) {
        localStorage.setItem(`${layoutNamespace}_widgets`, JSON.stringify(widgets));
        localStorage.setItem(`${layoutNamespace}_version`, ANALYTICS_LAYOUT_VERSION);
      }
    } catch {
      // ignore
    }
    pendingLayoutSaveRef.current = { ns: layoutNamespace, widgets };
    const timer = window.setTimeout(() => {
      pendingLayoutSaveRef.current = null;
      void updateUserPreferences({
        analyticsLayouts: { [layoutNamespace]: widgets },
      }).catch(() => {
        // Keep localStorage usable if the preferences request is temporarily unavailable.
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [widgets, layoutNamespace, storageNamespace]);

  const flushPendingLayoutSave = () => {
    const pending = pendingLayoutSaveRef.current;
    if (!pending) return;
    pendingLayoutSaveRef.current = null;
    void updateUserPreferences({ analyticsLayouts: { [pending.ns]: pending.widgets } }).catch(() => {
      // localStorage already has it
    });
  };

  const switchTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    if (!readOnly) flushPendingLayoutSave();
    setTabMenuId(null);
    setActiveTabId(tabId);
  };

  const openCreateTab = () => {
    setTabDraftName('');
    setTabDraftSource('empty');
    setTabMenuId(null);
    setTabModal({ mode: 'create' });
  };

  const openRenameTab = (tab: AnalyticsTab) => {
    setTabDraftName(tabLabel(tab));
    setTabMenuId(null);
    setTabModal({ mode: 'rename', id: tab.id });
  };

  const writeTabLayout = (tabId: string, layout: WidgetConfig[] | null) => {
    const ns = layoutNamespaceFor(tabId);
    try {
      if (layout) {
        localStorage.setItem(`${ns}_widgets`, JSON.stringify(layout));
        localStorage.setItem(`${ns}_version`, ANALYTICS_LAYOUT_VERSION);
      } else {
        localStorage.removeItem(`${ns}_widgets`);
        localStorage.removeItem(`${ns}_version`);
      }
    } catch {
      // ignore
    }
    return updateUserPreferences({ analyticsLayouts: { [ns]: layout } }).catch(() => {
      // localStorage fallback
    });
  };

  const submitTabModal = () => {
    if (!tabModal) return;
    const name = tabDraftName.trim();
    if (tabModal.mode === 'delete') {
      const id = tabModal.id;
      if (id === MAIN_TAB_ID) return;
      if (activeTabId === id) {
        pendingLayoutSaveRef.current = null;
        setActiveTabId(MAIN_TAB_ID);
      }
      setTabs((prev) => prev.filter((tab) => tab.id !== id));
      void writeTabLayout(id, null);
      setTabModal(null);
      return;
    }
    if (!name) return;
    if (tabModal.mode === 'rename') {
      const id = tabModal.id;
      setTabs((prev) => prev.map((tab) => (tab.id === id ? { ...tab, name } : tab)));
      setTabModal(null);
      return;
    }
    const id = `t${Date.now().toString(36)}`;
    const initial: WidgetConfig[] =
      tabDraftSource === 'copy'
        ? widgets.map((w, i) => ({ ...w, id: `${w.id}-${id}-${i}` }))
        : tabDraftSource === 'default'
          ? defaultWidgets
          : [];
    const initialFilters = tabDraftSource === 'copy' ? globalFilters : undefined;
    flushPendingLayoutSave();
    void writeTabLayout(id, initial);
    setTabs((prev) => [...prev, { id, name, filters: initialFilters }]);
    setActiveTabId(id);
    setTabModal(null);
  };

  const moveTab = (id: string, dir: -1 | 1) => {
    setTabMenuId(null);
    setTabs((prev) => {
      const index = prev.findIndex((tab) => tab.id === id);
      const target = index + dir;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  useEffect(() => {
    if (readOnly) return;
    notifyAnalyticsWidgetsChanged(storageNamespace);
  }, [widgets, storageNamespace, readOnly]);

  useEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  /** Новый блок: при открытии модалки «Добавить» — без условий (весь период). */
  useEffect(() => {
    const opened = addOpen && !prevAddOpenRef.current;
    prevAddOpenRef.current = addOpen;
    if (opened && !editOpen && editingWidgetId === null) {
      setDraftType('metric');
      setDraftTitle('');
      setDraftNoteText('');
      // Значения по умолчанию ('status', 'category') есть только у проектов — в таблицах рабочей
      // области ключи вида 'field:…'; иначе список показывал «Status», а блок сохранялся с
      // несуществующим ключом.
      const firstDim = chartOptions[0]?.id;
      const secondDim = chartOptions[1]?.id ?? firstDim;
      if (firstDim) {
        setDraftChart((prev) => (chartOptions.some((o) => o.id === prev) ? prev : (firstDim as ChartKey)));
        setDraftPivotRowKey((prev) => (chartOptions.some((o) => o.id === prev) ? prev : String(firstDim)));
        setDraftPivotColKey((prev) => (chartOptions.some((o) => o.id === prev) ? prev : String(secondDim)));
      }
      setDraftTable((prev) => (tableOptions.some((o) => o.id === prev) ? prev : ((tableOptions[0]?.id ?? prev) as TableKey)));
      setDraftSpan(3);
      setDraftSize('sm');
      setDraftFormulaFilters([]);
      setDraftCompareDisplay('bar');
      setDraftCompareSides([makeCompareSide(0), makeCompareSide(1)]);
      const co = chartOptions;
      setDraftPivotRowKey(String(co[0]?.id || 'category'));
      setDraftPivotColKey(String(co.length > 1 ? co[1].id : co[0]?.id || 'status'));
      setDraftPivotMeasures([
        { id: `pv-${Date.now()}`, mode: 'count' },
        { id: `pv-${Date.now() + 1}`, mode: 'sum', valueField: 'amount' },
      ]);
      setDraftTableDimensions([]);
    }
  }, [addOpen, chartOptions, editOpen, editingWidgetId]);

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const swapFormulaLeftRight = () => {
    setDraftFormulaLeftType(draftFormulaRightType);
    setDraftFormulaRightType(draftFormulaLeftType);
    setDraftFormulaLeftKey(draftFormulaRightKey);
    setDraftFormulaRightKey(draftFormulaLeftKey);
    setDraftFormulaLeftMeasure(draftFormulaRightMeasure);
    setDraftFormulaRightMeasure(draftFormulaLeftMeasure);
  };

  const addWidget = () => {
    const id = `${draftType}-${Date.now()}`;
    const usingCompareSides =
      isWideMonthlyTable &&
      (draftFormulaFn === 'diff' || draftFormulaFn === 'ratio') &&
      draftCompareSides.length >= 2;
    const effectiveFormulaLeftType = usingCompareSides
      ? buildSumMonthsType(draftCompareSides[0].monthKeys)
      : draftFormulaLeftType;
    const effectiveFormulaRightType = usingCompareSides
      ? buildSumMonthsType(draftCompareSides[1].monthKeys)
      : draftFormulaRightType;
    const next: WidgetConfig = {
      id,
      type: draftType,
      title: draftTitle || t('crm.projects.analytics.widgets.defaultTitle'),
      size: sizeFromSpan(draftSpan),
      span: draftSpan,
      height: getDefaultHeight(sizeFromSpan(draftSpan), draftType),
      themeKey: draftTheme,
      showLabels: draftType === 'donut' ? draftShowLabels : undefined,
      mapScope: draftType === 'map' ? draftMapScope : undefined,
      mapMode: draftType === 'map' ? draftMapMode : undefined,
      noteText: draftType === 'note' ? draftNoteText.trim() || undefined : undefined,
      formulaFn: draftType === 'formula' ? draftFormulaFn : undefined,
      formulaLeftType: draftType === 'formula' ? effectiveFormulaLeftType : undefined,
      formulaLeftKey: draftType === 'formula' ? draftFormulaLeftKey : undefined,
      formulaRightType: draftType === 'formula' ? effectiveFormulaRightType : undefined,
      formulaRightKey: draftType === 'formula' ? draftFormulaRightKey : undefined,
      formulaLeftMeasure: draftType === 'formula' ? draftFormulaLeftMeasure : undefined,
      formulaRightMeasure: draftType === 'formula' ? draftFormulaRightMeasure : undefined,
      formulaMode: draftType === 'formula' ? draftFormulaMode : undefined,
      formulaFilters: draftFormulaFilters,
      compareDisplay: draftType === 'formula' ? draftCompareDisplay : undefined,
      compareSides: draftType === 'formula' && usingCompareSides ? draftCompareSides : undefined,
      metricKey: draftType === 'metric' ? draftMetric : undefined,
      chartKey:
        isChartWidgetType(draftType) ? draftChart : undefined,
      chartValueMode:
        isChartWidgetType(draftType) ||
        (draftType === 'table' && draftTable !== 'projects')
          ? draftChartValueMode
          : undefined,
      chartValueField:
        isChartWidgetType(draftType) ||
        (draftType === 'table' && draftTable !== 'projects')
          ? draftChartValueField || undefined
          : undefined,
      tableKey: draftType === 'table' ? draftTable : undefined,
      tableDimensions:
        draftType === 'table' && isWorkspaceMode && String(draftTable).startsWith('field:')
          ? [draftTable, ...draftTableDimensions.slice(1)]
              .filter((id, i, arr) => arr.indexOf(id) === i)
              .slice(0, TABLE_MAX_DIMENSIONS)
          : undefined,
      pivotRowKey: draftType === 'pivot' ? draftPivotRowKey : undefined,
      pivotColKey: draftType === 'pivot' ? draftPivotColKey : undefined,
      pivotMeasures:
        draftType === 'pivot'
          ? (draftPivotMeasures.length
              ? draftPivotMeasures.slice(0, PIVOT_MAX_MEASURES)
              : [{ id: 'pv1', mode: 'count' as ChartValueMode }]
            )
          : undefined,
    };
    setWidgets((prev) => [next, ...prev]);
    setAddOpen(false);
  };

  const openEditWidget = (widget: WidgetConfig) => {
    setEditMode(true);
    setDraftType(widget.type);
    setDraftTitle(widget.title);
    setDraftSize(widget.size);
    setDraftSpan(widget.span ?? spanFromSize(widget.size));
    setDraftTheme(widget.themeKey ?? THEME_PRESETS[0].key);
    setDraftShowLabels(widget.showLabels ?? true);
    setDraftMapScope(widget.mapScope || 'world');
    setDraftMapMode(widget.mapMode === 'points' ? 'points' : 'countries');
    setDraftNoteText(widget.noteText || '');
    setDraftFormulaFn((widget.formulaFn ?? 'sumif') as FormulaFn);
    setDraftFormulaLeftType(
      (widget.formulaLeftType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaLeftKey(widget.formulaLeftKey ?? '');
    setDraftFormulaRightType(
      (widget.formulaRightType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaRightKey(widget.formulaRightKey ?? '');
    setDraftFormulaLeftMeasure(widget.formulaLeftMeasure || 'count');
    setDraftFormulaRightMeasure(widget.formulaRightMeasure || 'count');
    setDraftFormulaMode((widget.formulaMode ?? 'count') as FormulaMode);
    setDraftFormulaFilters(
      (Array.isArray(widget.formulaFilters) ? widget.formulaFilters : []).map((f) =>
        migrateFormulaFilterRow(f as { scope?: string; key?: string; keys?: unknown }),
      ),
    );
    setDraftCompareDisplay((widget.compareDisplay ?? 'bar') as CompareDisplay);
    if (Array.isArray(widget.compareSides) && widget.compareSides.length >= 2) {
      setDraftCompareSides(widget.compareSides);
    } else {
      // Старый двухсторонний формат (Левая/Правая) — переносим в стороны, чтобы можно было
      // сразу редактировать/добавлять новые в новом интерфейсе.
      const extractMonthKeys = (type?: string): string[] => {
        if (!type) return [];
        if (type.startsWith('summonths:')) return parseSumMonthsKeys(type);
        if (type.startsWith('sum:') && monthFieldDates.has(type.slice(4))) return [type.slice(4)];
        return [];
      };
      setDraftCompareSides([
        { ...makeCompareSide(0), monthKeys: extractMonthKeys(widget.formulaLeftType) },
        { ...makeCompareSide(1), monthKeys: extractMonthKeys(widget.formulaRightType) },
      ]);
    }
    setDraftPivotRowKey(widget.pivotRowKey ?? String(chartOptions[0]?.id || 'category'));
    setDraftPivotColKey(
      widget.pivotColKey ?? String(chartOptions.length > 1 ? chartOptions[1].id : chartOptions[0]?.id || 'status'),
    );
    setDraftPivotMeasures(
      widget.pivotMeasures?.length
        ? widget.pivotMeasures.slice(0, PIVOT_MAX_MEASURES)
        : [
            { id: 'pv-count', mode: 'count' },
            { id: 'pv-sum', mode: 'sum', valueField: 'amount' },
          ],
    );
    setDraftMetric((widget.metricKey ?? metricOptions[0]?.id ?? 'total') as MetricKey);
    setDraftChart((widget.chartKey ?? chartOptions[0]?.id ?? 'status') as ChartKey);
    setDraftChartValueMode((widget.chartValueMode ?? 'count') as ChartValueMode);
    setDraftChartValueField(widget.chartValueField ?? '');
    const tk = (widget.tableKey ?? tableOptions[0]?.id ?? 'projects') as TableKey;
    const tdim = widget.tableDimensions;
    if (String(tk).startsWith('field:')) {
      if (Array.isArray(tdim) && tdim.length) {
        const cleaned = tdim
          .map(String)
          .filter((id) => id.startsWith('field:'))
          .slice(0, TABLE_MAX_DIMENSIONS);
        const dims = cleaned.length ? cleaned : [tk];
        setDraftTableDimensions(dims);
        setDraftTable(dims[0] as TableKey);
      } else {
        setDraftTableDimensions([tk]);
        setDraftTable(tk);
      }
    } else {
      setDraftTableDimensions([]);
      setDraftTable(tk);
    }
    setEditingWidgetId(widget.id);
    setEditOpen(true);
  };

  const saveWidget = () => {
    if (editingWidgetId) {
      const usingCompareSides =
        isWideMonthlyTable &&
        (draftFormulaFn === 'diff' || draftFormulaFn === 'ratio') &&
        draftCompareSides.length >= 2;
      const effectiveFormulaLeftType = usingCompareSides
        ? buildSumMonthsType(draftCompareSides[0].monthKeys)
        : draftFormulaLeftType;
      const effectiveFormulaRightType = usingCompareSides
        ? buildSumMonthsType(draftCompareSides[1].monthKeys)
        : draftFormulaRightType;
      setWidgets((prev) =>
        prev.map((item) =>
          item.id === editingWidgetId
            ? {
                ...item,
                type: draftType,
                title: draftTitle || item.title || t('crm.projects.analytics.widgets.defaultTitle'),
                size: sizeFromSpan(draftSpan),
                span: draftSpan,
                height: item.height ?? getDefaultHeight(sizeFromSpan(draftSpan), draftType),
                themeKey: draftTheme,
                showLabels: draftType === 'donut' ? draftShowLabels : undefined,
                mapScope: draftType === 'map' ? draftMapScope : undefined,
                mapMode: draftType === 'map' ? draftMapMode : undefined,
                noteText: draftType === 'note' ? draftNoteText.trim() || undefined : undefined,
                formulaFn: draftType === 'formula' ? draftFormulaFn : undefined,
                formulaLeftType:
                  draftType === 'formula' ? effectiveFormulaLeftType : undefined,
                formulaLeftKey:
                  draftType === 'formula' ? draftFormulaLeftKey : undefined,
                formulaRightType:
                  draftType === 'formula' ? effectiveFormulaRightType : undefined,
                formulaRightKey:
                  draftType === 'formula' ? draftFormulaRightKey : undefined,
                formulaLeftMeasure:
                  draftType === 'formula' ? draftFormulaLeftMeasure : undefined,
                formulaRightMeasure:
                  draftType === 'formula' ? draftFormulaRightMeasure : undefined,
                formulaMode:
                  draftType === 'formula' ? draftFormulaMode : undefined,
                formulaFilters: draftFormulaFilters,
                compareDisplay:
                  draftType === 'formula' ? draftCompareDisplay : undefined,
                compareSides:
                  draftType === 'formula' && usingCompareSides ? draftCompareSides : undefined,
                metricKey: draftType === 'metric' ? draftMetric : undefined,
                chartKey:
                  isChartWidgetType(draftType)
                    ? draftChart
                    : undefined,
                chartValueMode:
                  isChartWidgetType(draftType) ||
                  (draftType === 'table' && draftTable !== 'projects')
                    ? draftChartValueMode
                    : undefined,
                chartValueField:
                  isChartWidgetType(draftType) ||
                  (draftType === 'table' && draftTable !== 'projects')
                    ? draftChartValueField || undefined
                    : undefined,
                tableKey: draftType === 'table' ? draftTable : undefined,
                tableDimensions:
                  draftType === 'table' && isWorkspaceMode && String(draftTable).startsWith('field:')
                    ? [draftTable, ...draftTableDimensions.slice(1)]
                        .filter((id, i, arr) => arr.indexOf(id) === i)
                        .slice(0, TABLE_MAX_DIMENSIONS)
                    : undefined,
                pivotRowKey: draftType === 'pivot' ? draftPivotRowKey : undefined,
                pivotColKey: draftType === 'pivot' ? draftPivotColKey : undefined,
                pivotMeasures:
                  draftType === 'pivot'
                    ? (draftPivotMeasures.length
                        ? draftPivotMeasures.slice(0, PIVOT_MAX_MEASURES)
                        : [{ id: 'pv1', mode: 'count' as ChartValueMode }]
                      )
                    : undefined,
              }
            : item,
        ),
      );
      setEditOpen(false);
      setEditingWidgetId(null);
      return;
    }
    addWidget();
  };

  const closeModal = () => {
    setAddOpen(false);
    setEditOpen(false);
    setEditingWidgetId(null);
  };

  const resetLayout = () => {
    setWidgets(defaultWidgets);
    try {
      localStorage.setItem(`${layoutNamespace}_widgets`, JSON.stringify(defaultWidgets));
      localStorage.setItem(`${layoutNamespace}_version`, ANALYTICS_LAYOUT_VERSION);
    } catch {
      // ignore
    }
    setResetOpen(false);
  };

  const buildWithAi = async ({ instructions, mode }: { instructions: string; mode: AiBuildMode }) => {
    setAiError(null);
    setAiBuilding(true);
    try {
      const res = await postAiBuildAnalyticsDashboard({
        module: isWorkspaceMode ? 'workspace' : 'projects',
        workspaceObjectId: isWorkspaceMode ? workspaceObjectId : undefined,
        periodFrom: activePeriodRange ? activePeriodRange.start.toISOString() : undefined,
        periodTo: activePeriodRange ? activePeriodRange.end.toISOString() : undefined,
        instructions: instructions || undefined,
      });
      if (!res.ok || !res.widgets || !res.widgets.length) {
        setAiError(res.note || res.error || 'Не удалось построить дашборд — недостаточно данных.');
        return;
      }
      const stamp = Date.now().toString(36);
      const built = (res.widgets as unknown as WidgetConfig[]).map((w, i) => {
        const migrated = migrateWidgetFromStorage({ ...(w as unknown as Record<string, unknown>), id: `ai-${stamp}-${i}` });
        return { ...migrated, height: migrated.height ?? getDefaultHeight(migrated.size, migrated.type) };
      });
      const nextWidgets = mode === 'append' ? [...widgets, ...built] : built;
      setAiConfirmOpen(false);
      setAiNote(res.note || null);
      setWidgets(nextWidgets);
      try {
        localStorage.setItem(`${layoutNamespace}_widgets`, JSON.stringify(nextWidgets));
        localStorage.setItem(`${layoutNamespace}_version`, ANALYTICS_LAYOUT_VERSION);
      } catch {
        // ignore
      }
    } catch (e: any) {
      setAiError(e?.message || 'Не удалось построить дашборд.');
    } finally {
      setAiBuilding(false);
    }
  };

  const periodRangeLabel = useMemo(() => {
    if (period === 'all') return periodLabels[period];
    const format = (date: Date) =>
      date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    if (period === 'custom') {
      if (!activePeriodRange) return periodLabels.custom;
      return `${format(activePeriodRange.start)} – ${format(activePeriodRange.end)}`;
    }
    if (!activePeriodRange) return periodLabels[period];
    return `${format(activePeriodRange.start)} – ${format(activePeriodRange.end)}`;
  }, [locale, period, periodLabels, activePeriodRange]);

  const handleShare = () => {
    // Таблица рабочей области — настоящая публичная ссылка «только аналитика».
    if (workspaceObjectId && !readOnly) {
      setShareModalOpen(true);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('period', period);
    if (search.trim()) url.searchParams.set('q', search.trim());
    navigator.clipboard.writeText(url.toString()).catch(() => {
      window.prompt('Скопируйте ссылку:', url.toString());
    });
    setShareToast(true);
    window.setTimeout(() => setShareToast(false), 2500);
  };

  const exportCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = isWorkspaceMode
      ? ['Название', ...analyticsFields.map((field) => field.label || field.key)]
      : [
          t('crm.projects.analytics.table.headers.project'),
          t('crm.projects.analytics.table.headers.status'),
          t('crm.projects.analytics.table.headers.category'),
          t('crm.projects.analytics.table.headers.owner'),
          t('crm.projects.analytics.table.headers.amount'),
        ];
    const rows = filteredItems.map((item) =>
      isWorkspaceMode
        ? [item.name, ...analyticsFields.map((field) => item.customFields?.[field.key] ?? '')]
        : [
            item.name,
            statusLabels[item.status] ?? item.status,
            item.category || t('crm.projects.analytics.noCategory'),
            item.owner || t('crm.projects.analytics.unknownOwner'),
            item.amount || 0,
          ],
    );
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isWorkspaceMode ? 'workspace' : 'projects'}-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const defaultGlobalFilterScope = () => {
    if (isWorkspaceMode) return dashboardFilterFields[0]?.id || 'field:name';
    return 'status';
  };

  const addGlobalFilter = (scope = defaultGlobalFilterScope()) => {
    if (!scope || globalFilters.some((filter) => filter.scope === scope)) return;
    setGlobalFilters((prev) => [...prev, { id: `gf-${Date.now()}`, scope, keys: [] }]);
  };

  const removeGlobalFilter = (id: string) =>
    setGlobalFilters((prev) => prev.filter((filter) => filter.id !== id));

  const widgetSpan = (widget: WidgetConfig) => clampSpan(widget.span ?? spanFromSize(widget.size));

  const duplicateWidget = (id: string) => {
    setWidgets((prev) => {
      const index = prev.findIndex((widget) => widget.id === id);
      if (index < 0) return prev;
      const copy = {
        ...prev[index],
        id: `${prev[index].id}-copy-${Date.now()}`,
        title: `${prev[index].title} copy`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const visibleWidgets = widgets;

  const pageKicker = header?.kicker || 'Аналитика проектов';
  const pageTitle = header?.title || 'Проекты — обзор';
  const pageSubtitle =
    header?.subtitle ||
    'KPI, графики, сводные таблицы и собственные блоки по статусам, категориям, ответственным и полям проектов.';
  const pageRoot = isWorkspaceMode ? 'Workspace' : 'Проекты';
  const filteredCountLabel = loading
    ? 'Загрузка'
    : `${filteredItems.length} ${isWorkspaceMode ? 'записей' : 'проектов'} · обновлено только что`;

  const minWidgetHeight = (id: string) => {
    const type = widgets.find((w) => w.id === id)?.type ?? 'metric';
    return type === 'pivot'
      ? 280
      : type === 'table'
        ? 240
        : type === 'map'
          ? 300
          : type === 'donut' || type === 'bar' || type === 'line' || type === 'funnel' || type === 'leaderboard'
            ? 220
            : 160;
  };

  const visibleWidgetIds = useMemo(() => visibleWidgets.map((w) => w.id), [visibleWidgets]);
  const { beginDrag, beginResize, dragId, previewOrder, live } = useBlockGridInteractions({
    gridRef,
    enabled: editMode && !isMobile,
    order: visibleWidgetIds,
    minSpan: MIN_WIDGET_SPAN,
    minHeight: minWidgetHeight,
    maxHeight: MAX_WIDGET_H,
    onResizeCommit: (id, m) =>
      setWidgets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, size: sizeFromSpan(m.span), span: m.span, height: m.height } : item)),
      ),
    onReorderCommit: (nextVisible) =>
      setWidgets((prev) => {
        const byId = new Map(prev.map((w) => [w.id, w]));
        return applyVisibleOrder(prev.map((w) => w.id), nextVisible)
          .map((id) => byId.get(id))
          .filter((w): w is WidgetConfig => !!w);
      }),
  });
  // во время перетаскивания рисуем «живой» порядок, во время растягивания — живые размеры
  const renderedWidgets = useMemo(() => {
    if (!previewOrder) return visibleWidgets;
    const byId = new Map(visibleWidgets.map((w) => [w.id, w]));
    return previewOrder.map((id) => byId.get(id)).filter((w): w is WidgetConfig => !!w);
  }, [previewOrder, visibleWidgets]);

  useEffect(() => {
    const ensureKey = (
      scope: FormulaScope,
      current: string,
      setter: (value: string) => void,
    ) => {
      const items = formulaValueItems[scope];
      const list = items.length ? items : formulaValueFallback;
      if (!list.find((item) => item.id === current)) {
        setter(list[0].id);
      }
    };
    if (formulaValueItems[draftFormulaLeftType]) {
      ensureKey(draftFormulaLeftType as FormulaScope, draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (formulaValueItems[draftFormulaRightType]) {
      ensureKey(draftFormulaRightType as FormulaScope, draftFormulaRightKey, setDraftFormulaRightKey);
    }
    const validIdsForScope = (scope: FormulaScope) => {
      const items = formulaValueItems[scope]?.length ? formulaValueItems[scope] : formulaValueFallback;
      return new Set(items.map((x) => x.id));
    };
    let batchChanged = false;
    const nextFilters = draftFormulaFilters.map((filter) => {
      const normalizedScope = formulaValueItems[filter.scope]
        ? filter.scope
        : (formulaScopeOptions[0]?.id as FormulaScope);
      const ids = validIdsForScope(normalizedScope);
      const keys = (filter.keys || []).filter((k) => ids.has(k));
      if (normalizedScope !== filter.scope || JSON.stringify(keys) !== JSON.stringify(filter.keys || [])) {
        batchChanged = true;
        return { scope: normalizedScope, keys };
      }
      return filter;
    });
    if (batchChanged) {
      setDraftFormulaFilters(nextFilters);
    }
  }, [
    draftFormulaLeftType,
    draftFormulaLeftKey,
    draftFormulaRightType,
    draftFormulaRightKey,
    draftFormulaFilters,
    formulaScopeOptions,
    formulaValueItems,
    formulaValueFallback,
  ]);

  useEffect(() => {
    if (!isWorkspaceMode) return;
    if (draftFormulaFn !== 'sumif') return;
    if (draftFormulaMode !== 'sum') return;
    if (draftFormulaLeftType.startsWith('sum:')) return;
    const firstSumField = dynamicNumericFields[0];
    if (firstSumField) {
      setDraftFormulaLeftType(`sum:${firstSumField.key}`);
    }
  }, [
    isWorkspaceMode,
    draftFormulaFn,
    draftFormulaMode,
    draftFormulaLeftType,
    dynamicNumericFields,
  ]);

  useEffect(() => {
    const needsChartValue =
      draftType === 'donut' ||
      draftType === 'bar' ||
      draftType === 'line' ||
      draftType === 'funnel' ||
      draftType === 'leaderboard' ||
      draftType === 'map' ||
      (draftType === 'table' && draftTable !== 'projects');
    if (!needsChartValue) return;
    if (draftChartValueMode !== 'sum') return;
    if (draftChartValueField) return;
    if (!isWorkspaceMode) {
      setDraftChartValueField('amount');
      return;
    }
    if (dynamicNumericFields[0]) {
      setDraftChartValueField(`field:${dynamicNumericFields[0].key}`);
      return;
    }
    if (analyticsFields[0]) {
      setDraftChartValueField(`field:${analyticsFields[0].key}`);
    }
  }, [
    draftType,
    draftTable,
    draftChartValueMode,
    draftChartValueField,
    dynamicNumericFields,
    analyticsFields,
    isWorkspaceMode,
  ]);

  const resolveMetricValue = (
    key?: MetricKey,
    sourceItems: Project[] = filteredItems,
    denominatorItems: Project[] = filteredItems,
  ) => {
    const sourceTotal = sourceItems.length;
    const sourceAmount = sourceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const sourceAvg = sourceTotal > 0 ? Math.round(sourceAmount / sourceTotal) : 0;
    const sourceOwners = new Set(
      sourceItems.map((item) => item.owner || t('crm.projects.analytics.unknownOwner')),
    ).size;
    const sourceCategories = new Set(
      sourceItems.map((item) => item.category || t('crm.projects.analytics.noCategory')),
    ).size;
    const sourceTags = new Set(sourceItems.flatMap((item) => item.tags || [])).size;
    const sourceStatuses = new Set(sourceItems.map((item) => item.status)).size;

    if (key === 'filteredPercent') {
      const d = denominatorItems.length;
      return d > 0 ? `${Math.round((sourceItems.length / d) * 100)}%` : '0%';
    }
    if (key?.startsWith('sum:')) {
      const fieldKey = key.slice(4);
      const sum = sourceItems.reduce((acc, item) => acc + getPeriodAwareFieldValue(item, fieldKey), 0);
      if (moneyFieldCurrency.has(fieldKey)) return formatAmount(sum);
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(sum);
    }
    if (key?.startsWith('avg:')) {
      const fieldKey = key.slice(4);
      const values = sourceItems.map((item) => getPeriodAwareFieldValue(item, fieldKey));
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      if (moneyFieldCurrency.has(fieldKey)) return formatAmount(avg);
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(avg);
    }
    if (key?.startsWith('filled:')) {
      const fieldKey = key.slice(7);
      const count = sourceItems.filter((item) => isFilled(getCustomFieldValue(item, fieldKey))).length;
      return count.toLocaleString(locale);
    }
    switch (key) {
      case 'total':
        return sourceTotal.toLocaleString(locale);
      case 'amount':
        return formatAmount(sourceAmount);
      case 'avgAmount':
        return formatAmount(sourceAvg);
      case 'owners':
        return sourceOwners.toLocaleString(locale);
      case 'categories':
        return sourceCategories.toLocaleString(locale);
      case 'tags':
        return sourceTags.toLocaleString(locale);
      case 'statuses':
        return sourceStatuses.toLocaleString(locale);
      default:
        return '—';
    }
  };

  const resolveTheme = (key?: ThemeKey) =>
    THEME_PRESETS.find((preset) => preset.key === key) || THEME_PRESETS[0];

  const itemMatchesOneKey = (item: Project, scope: FormulaScope, key: string) => {
    if (scope.startsWith('field:')) {
      const fieldKey = scope.replace('field:', '');
      const raw = getCustomFieldValue(item, fieldKey);
      if (!isFilled(raw)) return false;
      if (Array.isArray(raw)) return raw.map((v) => String(v)).includes(key);
      const values = splitMulti(raw);
      if (values.length > 1) return values.includes(key);
      return String(raw) === key;
    }
    if (scope === 'status') return item.status === key;
    if (scope === 'category') return (item.category || '') === key;
    if (scope === 'owner') return (item.owner || '') === key;
    if (scope === 'tag') return (item.tags || []).includes(key);
    return false;
  };

  const filterRowMatches = (item: Project, filter: FormulaFilterRow & { key?: string }) => {
    const rawKeys = filter.keys;
    const keys =
      Array.isArray(rawKeys) && rawKeys.length > 0
        ? rawKeys
        : filter.key
          ? [String(filter.key)]
          : [];
    if (keys.length === 0) return true;
    return keys.some((key) => itemMatchesOneKey(item, filter.scope, key));
  };

  const applyWidgetFilters = (sourceItems: Project[], filters: FormulaFilterRow[] | undefined) => {
    if (!filters?.length) return sourceItems;
    return sourceItems.filter((item) => filters.every((filter) => filterRowMatches(item, filter)));
  };

  const buildSeriesForWidget = (
    chartKey: string,
    sourceItems: Project[],
    mode: ChartValueMode,
    valueField?: string,
  ) => {
    const getNumericValue = (item: Project) => {
      if (!valueField) return isWorkspaceMode ? 0 : item.amount || 0;
      if (valueField.startsWith('sum:')) return getPeriodAwareFieldValue(item, valueField.slice(4));
      if (valueField.startsWith('field:')) return getPeriodAwareFieldValue(item, valueField.slice(6));
      if (valueField === 'amount') return item.amount || 0;
      return getPeriodAwareFieldValue(item, valueField);
    };

    if (!isWorkspaceMode) {
      const grouped = new Map<string, { code: string; label: string; count: number }>();
      sourceItems.forEach((item) => {
        let code = '';
        let label = '';
        if (chartKey === 'category') {
          code = item.category || t('crm.projects.analytics.noCategory');
          label = categoryLabels[code] ?? code;
        } else if (chartKey === 'owner') {
          code = item.owner || t('crm.projects.analytics.unknownOwner');
          label = code;
        } else if (chartKey === 'tag') {
          (item.tags || []).forEach((tag) => {
            const row = grouped.get(tag) || { code: tag, label: tag, count: 0 };
            row.count += mode === 'sum' ? getNumericValue(item) : 1;
            grouped.set(tag, row);
          });
          return;
        } else {
          code = item.status;
          label = statusLabels[item.status] ?? item.status;
        }
        const row = grouped.get(code) || { code, label, count: 0 };
        row.count += mode === 'sum' ? getNumericValue(item) : 1;
        grouped.set(code, row);
      });
      return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
    }

    if (!chartKey.startsWith('field:')) return [];
    const fieldKey = chartKey.replace('field:', '');
    const grouped = new Map<string, { code: string; label: string; count: number }>();
    sourceItems.forEach((item) => {
      const raw = getCustomFieldValue(item, fieldKey);
      if (!isFilled(raw)) return;
      const values = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : (() => {
            const multi = splitMulti(raw);
            return multi.length > 1 ? multi : [String(raw).trim()].filter(Boolean);
          })();
      values.forEach((value) => {
        const row = grouped.get(value) || { code: value, label: value, count: 0 };
        row.count += mode === 'sum' ? getNumericValue(item) : 1;
        grouped.set(value, row);
      });
    });
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  };

  const extractPivotBuckets = (
    item: Project,
    chartKey: string,
  ): Array<{ code: string; label: string }> => {
    if (!isWorkspaceMode) {
      if (chartKey === 'category') {
        const code = item.category || t('crm.projects.analytics.noCategory');
        return [{ code, label: categoryLabels[code] ?? code }];
      }
      if (chartKey === 'owner') {
        const code = item.owner || t('crm.projects.analytics.unknownOwner');
        return [{ code, label: code }];
      }
      if (chartKey === 'tag') {
        const tags = item.tags || [];
        if (!tags.length) {
          return [{ code: '__none__', label: t('crm.projects.analytics.pivot.emptyBucket') }];
        }
        return tags.map((tg) => ({ code: tg, label: tg }));
      }
      const code = item.status;
      return [{ code, label: statusLabels[item.status] ?? item.status }];
    }
    if (chartKey.startsWith('field:')) {
      const fieldKey = chartKey.replace('field:', '');
      const raw = getCustomFieldValue(item, fieldKey);
      if (!isFilled(raw)) return [];
      const values = Array.isArray(raw)
        ? raw.map((v) => String(v).trim()).filter(Boolean)
        : (() => {
            const multi = splitMulti(raw);
            return multi.length > 1 ? multi : [String(raw).trim()].filter(Boolean);
          })();
      return values.map((v) => ({ code: v, label: v }));
    }
    return [];
  };

  function buildMultiDimensionWorkspaceTableRows(
    dimensions: string[],
    sourceItems: Project[],
    mode: ChartValueMode,
    valueField?: string,
  ) {
    const getNumericValue = (item: Project) => {
      if (!valueField) return isWorkspaceMode ? 0 : item.amount || 0;
      if (valueField.startsWith('sum:')) return getPeriodAwareFieldValue(item, valueField.slice(4));
      if (valueField.startsWith('field:')) return getPeriodAwareFieldValue(item, valueField.slice(6));
      if (valueField === 'amount') return item.amount || 0;
      return getPeriodAwareFieldValue(item, valueField);
    };
    const grouped = new Map<string, { cells: string[]; count: number }>();
    sourceItems.forEach((item) => {
      const perDim = dimensions.map((dim) => extractPivotBuckets(item, dim));
      if (perDim.some((b) => b.length === 0)) return;
      const combos = cartesianBucketCombos(perDim);
      for (const combo of combos) {
        const key = combo.map((b) => b.code).join('\x1e');
        const cells = combo.map((b) => b.label);
        const delta = mode === 'sum' ? getNumericValue(item) : 1;
        const row = grouped.get(key);
        if (row) row.count += delta;
        else grouped.set(key, { cells, count: delta });
      }
    });
    const rows = Array.from(grouped.entries()).map(([key, v]) => ({
      key,
      cells: v.cells,
      count: v.count,
    }));
    rows.sort((a, b) => {
      const len = Math.max(a.cells.length, b.cells.length);
      for (let i = 0; i < len; i++) {
        const cmp = (a.cells[i] || '').localeCompare(b.cells[i] || '', undefined, { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
    return rows.slice(0, TABLE_MULTI_MAX_ROWS);
  }

  const collectPivotAxisUnique = (sourceItems: Project[], chartKey: string) => {
    const map = new Map<string, string>();
    sourceItems.forEach((item) => {
      extractPivotBuckets(item, chartKey).forEach((b) => map.set(b.code, b.label));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, label]) => ({ code, label }));
  };

  const pivotNumericValue = (item: Project, valueField?: string): number => {
    if (!valueField) return isWorkspaceMode ? 0 : item.amount || 0;
    if (valueField.startsWith('sum:')) return getPeriodAwareFieldValue(item, valueField.slice(4));
    if (valueField.startsWith('field:')) return getPeriodAwareFieldValue(item, valueField.slice(6));
    if (valueField === 'amount') return item.amount || 0;
    return getPeriodAwareFieldValue(item, valueField);
  };

  const pivotMeasureAggregate = (
    cellItems: Project[],
    mode: ChartValueMode,
    valueField?: string,
  ): number => {
    if (mode === 'count') return cellItems.length;
    return cellItems.reduce((acc, item) => acc + pivotNumericValue(item, valueField), 0);
  };

  const formatDateShort = (date: Date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const buildTrend = (
    sourceItems: Project[],
    mode: ChartValueMode = 'count',
    valueField?: string,
  ) => {
    const dated = sourceItems
      .map((item) => ({ item, date: getAnalyticsDate(item) }))
      .filter((entry): entry is { item: Project; date: Date } => Boolean(entry.date));
    if (!dated.length) return [{ name: '—', value: 0, previous: 0 }];

    // reduce, а не Math.min(...arr): на десятках тысяч строк spread переполняет стек вызовов.
    const minTime = dated.reduce((m, entry) => Math.min(m, entry.date.getTime()), Infinity);
    const maxTime = dated.reduce((m, entry) => Math.max(m, entry.date.getTime()), -Infinity);
    const from = new Date(minTime);
    const to = new Date(maxTime || Date.now());
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1);
    const pointCount = Math.max(2, Math.min(days, 12));
    const bucketSize = Math.max(1, Math.ceil(days / pointCount));
    const aggregate = (rows: Project[]) =>
      mode === 'sum' ? rows.reduce((sum, item) => sum + pivotNumericValue(item, valueField), 0) : rows.length;

    return Array.from({ length: pointCount }, (_, index) => {
      const start = new Date(from);
      start.setDate(from.getDate() + index * bucketSize);
      const end = new Date(start);
      end.setDate(start.getDate() + bucketSize);
      const rows = dated
        .filter((entry) => entry.date >= start && entry.date < end)
        .map((entry) => entry.item);
      return {
        name: formatDateShort(start),
        value: aggregate(rows),
        previous: 0,
      };
    });
  };

  /** Для "широкой" помесячной таблицы обычный тренд по createdAt бессмысленен (все строки
   * импортированы почти одновременно, дата импорта — не дата расхода). Строим тренд иначе: одна
   * точка на каждую месячную колонку (ось X), значение — сумма этой колонки по всем строкам. */
  const buildMonthTrend = (sourceItems: Project[]) => {
    const sortedMonths = [...monthFieldDates.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
    const relevant = activePeriodRange
      ? sortedMonths.filter(([, date]) => monthOverlapsRange(date, activePeriodRange))
      : sortedMonths;
    const points = (relevant.length ? relevant : sortedMonths).map(([key, date]) => ({
      name: date.toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
      value: sourceItems.reduce((sum, item) => sum + (parseNumericLoose(getCustomFieldValue(item, key)) ?? 0), 0),
      previous: 0,
    }));
    return points.length ? points : [{ name: '—', value: 0, previous: 0 }];
  };

  /** "summonths:m_2025_08,m_2025_09" — операнд формулы = сумма НЕСКОЛЬКИХ месячных колонок разом
   * (например «Август+Сентябрь 2025» одной группой) — для сравнения произвольных групп месяцев,
   * а не только двух отдельных месяцев. Ключи не зависят от периода страницы (выбраны явно). */
  const parseSumMonthsKeys = (type: string): string[] =>
    type.startsWith('summonths:') ? type.slice(10).split(',').filter(Boolean) : [];
  const buildSumMonthsType = (keys: string[]): string => (keys.length ? `summonths:${keys.join(',')}` : 'total');
  const isMonthOperand = (type: string): boolean =>
    type.startsWith('summonths:') || (type.startsWith('sum:') && monthFieldDates.has(type.slice(4)));
  /** Подмножество formulaOperandOptions, проходящее isMonthOperand — используем его в полях
   * "Правая часть" (и в СУММЕСЛИ), которые нужны только для графика сравнения, чтобы нельзя
   * было выбрать поле, с которым canCompareVisually всё равно окажется false. */
  const monthOperandOptions = formulaOperandOptions.filter((opt) => isMonthOperand(opt.id));
  const describeMonthOperand = (type: string): string => {
    const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
    if (type.startsWith('summonths:')) {
      const dates = parseSumMonthsKeys(type)
        .map((k) => monthFieldDates.get(k))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
      if (!dates.length) return 'Группа';
      return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])}–${fmt(dates[dates.length - 1])}`;
    }
    if (type.startsWith('sum:')) {
      const fieldKey = type.slice(4);
      const date = monthFieldDates.get(fieldKey);
      return date ? fmt(date) : analyticsFieldMap.get(fieldKey)?.label || fieldKey;
    }
    return '';
  };

  const describeCompareSide = (side: CompareSide): string => {
    if (side.label?.trim()) return side.label.trim();
    return describeMonthOperand(buildSumMonthsType(side.monthKeys)) || 'Группа';
  };
  const sumCompareSide = (side: CompareSide, sourceItems: Project[]): number =>
    sourceItems.reduce(
      (acc, item) =>
        acc + side.monthKeys.reduce((s, k) => s + (parseNumericLoose(getCustomFieldValue(item, k)) ?? 0), 0),
      0,
    );
  const makeCompareSide = (ordinal: number): CompareSide => ({
    id: `cs-${Date.now()}-${ordinal}`,
    monthKeys: [],
    color: V2_PALETTE[ordinal % V2_PALETTE.length],
  });

  const buildHeatmap = (sourceItems: Project[]) => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
    return days.map((day, dayIndex) => ({
      day,
      hours: hours.map((hour) => {
        const startHour = Number(hour);
        const value = sourceItems.filter((item) => {
          const date = getAnalyticsDate(item);
          if (!date) return false;
          const jsDay = date.getDay();
          const normalizedDay = jsDay === 0 ? 6 : jsDay - 1;
          return normalizedDay === dayIndex && date.getHours() >= startHour && date.getHours() < startHour + 3;
        }).length;
        return { hour, value };
      }),
    }));
  };

  const renderActiveDonut = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, cornerRadius } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={cornerRadius}
      />
    );
  };

  const mapCountryOptions = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([(i18n.language || 'ru').split('-')[0]], { type: 'region' });
    } catch {
      names = null;
    }
    return ALL_MAP_COUNTRIES.map((iso) => ({ iso, name: names?.of(iso) || iso })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
  }, [i18n.language, locale]);

  /** Геокодер для точек: публичная ссылка — свой, в CRM — только у таблиц рабочей области. */
  const mapGeocoder = useMemo<Geocoder | undefined>(() => {
    if (publicView?.geocode) return publicView.geocode;
    if (publicView || !workspaceObjectId) return undefined;
    return (queries, country) => geocodeWorkspaceValues(workspaceObjectId, queries, country);
  }, [publicView, workspaceObjectId]);

  /** Колонка для карты: страны — по доле распознанных названий; города — по названию колонки. */
  const pickMapDimension = (mode: 'countries' | 'points'): string | null => {
    if (mode === 'countries') {
      let best: { id: string; rate: number } | null = null;
      for (const option of chartOptions) {
        const labels = buildSeriesForWidget(String(option.id), filteredItems, 'count').map((row) => row.label);
        const rate = countryMatchRate(labels);
        if (!best || rate > best.rate) best = { id: String(option.id), rate };
      }
      return best && best.rate >= 0.5 ? best.id : null;
    }
    const cityRe = /(город|city|şehir|sehir|town|адрес|address|adres|ilçe|район|location|локац)/i;
    const hit = chartOptions.find((option) => cityRe.test(`${option.id} ${option.label}`));
    return hit ? String(hit.id) : null;
  };

  // Новая «Карта»: сразу берём колонку со странами, иначе — с городами.
  const prevDraftTypeRef = useRef<WidgetType>(draftType);
  useEffect(() => {
    const prev = prevDraftTypeRef.current;
    prevDraftTypeRef.current = draftType;
    if (draftType !== 'map' || prev === 'map' || editingWidgetId) return;
    const countryPick = pickMapDimension('countries');
    if (countryPick) {
      setDraftMapMode('countries');
      setDraftChart(countryPick as ChartKey);
      return;
    }
    const cityPick = mapGeocoder ? pickMapDimension('points') : null;
    if (cityPick) {
      setDraftMapMode('points');
      setDraftChart(cityPick as ChartKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftType]);

  /** Подписи оси Y: компактно («33,6 тыс.»), иначе большие суммы обрезались по ширине оси. */
  const formatAxisTick = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value) || 0);

  const fieldLabelOf = (key: string) =>
    analyticsFields.find((field) => field.key === key.replace(/^(field:|sum:|avg:|filled:)/, ''))?.label;
  /** Сохранённое значение блока всегда видно в списке, даже если колонка больше не подходит/удалена. */
  const optionsWithCurrent = (options: Array<{ id: string; label: string }>, value: string) => {
    if (!isWorkspaceMode || !value || options.some((opt) => opt.id === value) || !value.startsWith('field:')) return options;
    const label = fieldLabelOf(value);
    return [
      ...options,
      {
        id: value,
        label: label
          ? `${label} · ${t('crm.projects.analytics.fieldHint.notSuitable')}`
          : `${value.slice(6)} · ${t('crm.projects.analytics.fieldHint.deleted')}`,
      },
    ];
  };
  /** Подсказка под выбором колонки для группировки: сколько значений или почему не подходит. */
  const renderDimensionHint = (value: string) => {
    if (!isWorkspaceMode || !value.startsWith('field:')) return null;
    const profile = profileOf(value);
    if (!profile) {
      return <p className="mt-1 text-[11px] text-rose-600">{t('crm.projects.analytics.fieldHint.deletedLong')}</p>;
    }
    if (profile.kind === 'category') {
      return (
        <p className="mt-1 text-[11px] text-slate-400">
          {t('crm.projects.analytics.fieldHint.values', { count: profile.distinct })}
        </p>
      );
    }
    return (
      <p className="mt-1 text-[11px] text-amber-600">{t(`crm.projects.analytics.fieldHint.kind.${profile.kind}`)}</p>
    );
  };
  /** Колонки, на которые ссылается блок и которых больше нет в таблице (удалили/переименовали). */
  const missingFieldsOf = (w: WidgetConfig): string[] => {
    if (!isWorkspaceMode) return [];
    const refs: string[] = [];
    const add = (v?: string) => {
      if (!v) return;
      const g = /^(?:groupmax|groupmin):(.+)\|(count|sum:.+)$/.exec(v);
      if (g) {
        add(g[1]);
        if (g[2] !== 'count') add(g[2]);
        return;
      }
      const m = /^(field|sum|avg|filled):(.+)$/.exec(v);
      if (m) refs.push(m[2]);
    };
    add(w.chartKey);
    add(w.chartValueField);
    add(w.metricKey);
    add(w.tableKey);
    (w.tableDimensions || []).forEach(add);
    add(w.pivotRowKey);
    add(w.pivotColKey);
    (w.pivotMeasures || []).forEach((m) => add(m.valueField));
    if (w.type === 'formula') {
      add(w.formulaLeftType);
      add(w.formulaRightType);
    }
    const known = new Set(analyticsFields.map((field) => field.key));
    return Array.from(new Set(refs.filter((key) => key && !known.has(key) && !monthFieldDates.has(key))));
  };

  const operandSelectValue = (value: string) =>
    value.startsWith('groupmax:') ? 'groupmax' : value.startsWith('groupmin:') ? 'groupmin' : value;
  const operandFromSelect = (value: string, prev: string): string => {
    if (value !== 'groupmax' && value !== 'groupmin') return value;
    const m = /^(?:groupmax|groupmin):(.+)\|(count|sum:.+)$/.exec(prev);
    const dim = m?.[1] || groupDimOptions[0]?.id || '';
    const measure = m?.[2] || groupMeasureOptions[0]?.id || 'count';
    return `${value}:${dim}|${measure}`;
  };
  /** Под выбранным «Лучший/худший по группе…» — выбор группы и показателя. */
  const renderGroupOperandPicker = (value: string, onChange: (next: string) => void) => {
    const m = /^(groupmax|groupmin):(.+)\|(count|sum:.+)$/.exec(value);
    if (!m) return null;
    const [, kind, dim, measure] = m;
    const cls = 'w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none';
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('crm.projects.analytics.formula.group.dim')}</label>
          <select value={dim} onChange={(e) => onChange(`${kind}:${e.target.value}|${measure}`)} className={cls}>
            {groupDimOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">{t('crm.projects.analytics.formula.group.measure')}</label>
          <select value={measure} onChange={(e) => onChange(`${kind}:${dim}|${e.target.value}`)} className={cls}>
            {groupMeasureOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  const renderWidget = (w: WidgetConfig) => {
    const missing = missingFieldsOf(w);
    if (missing.length) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-4 text-center">
          <div className="text-sm font-medium text-amber-800">{t('crm.projects.analytics.fieldHint.brokenTitle')}</div>
          <div className="text-xs text-amber-700">
            {t('crm.projects.analytics.fieldHint.brokenText', { fields: missing.join(', ') })}
          </div>
        </div>
      );
    }
    const widgetHeight = w.height ?? getDefaultHeight(w.size, w.type);
    const widgetItems = applyWidgetFilters(filteredItems, w.formulaFilters);
    const widgetColor = resolveTheme(w.themeKey).primary;
    const metricSparkData = (() => {
      if (w.type !== 'metric' && w.type !== 'formula') return { values: [0, 0, 0], labels: [] as string[] };
      // «Широкая» таблица (колонка на месяц): у строк нет своей даты события (createdAt — дата
      // импорта), поэтому график суммы/среднего строим по месячным колонкам, а не по createdAt —
      // иначе всё падает в одну корзину и получается пик + нули.
      const isSumLike =
        w.type === 'metric'
          ? !!w.metricKey && (w.metricKey.startsWith('sum:') || w.metricKey.startsWith('avg:'))
          : w.formulaMode === 'sum';
      if (isWideMonthlyTable && isSumLike) {
        const sortedMonths = [...monthFieldDates.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
        const inPeriod = activePeriodRange
          ? sortedMonths.filter(([, date]) => monthOverlapsRange(date, activePeriodRange))
          : sortedMonths;
        const months = inPeriod.length >= 2 ? inPeriod : sortedMonths;
        const isAvg = w.type === 'metric' && !!w.metricKey?.startsWith('avg:');
        return {
          values: months.map(([key]) => {
            const total = widgetItems.reduce((sum, item) => sum + (parseNumericLoose(getCustomFieldValue(item, key)) ?? 0), 0);
            return isAvg ? (widgetItems.length ? total / widgetItems.length : 0) : total;
          }),
          labels: months.map(([, date]) => date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })),
        };
      }
      const dated = widgetItems
        .map((item) => ({ item, time: getAnalyticsDate(item)?.getTime() ?? NaN }))
        .filter((entry) => Number.isFinite(entry.time));
      if (!dated.length) {
        const flat = widgetItems.length || 0;
        return { values: [flat, flat, flat], labels: [] as string[] };
      }
      const min = dated.reduce((m, entry) => Math.min(m, entry.time), Infinity);
      const max = dated.reduce((m, entry) => Math.max(m, entry.time), -Infinity);
      const metricKey = w.metricKey;
      const isAverage = metricKey === 'avgAmount' || !!metricKey?.startsWith('avg:');
      const contribution = (item: Project): number => {
        if (metricKey === 'amount' || metricKey === 'avgAmount') return item.amount || 0;
        if (metricKey?.startsWith('sum:') || metricKey?.startsWith('avg:')) {
          return parseNumericLoose(getCustomFieldValue(item, metricKey.slice(4))) ?? 0;
        }
        return 1;
      };
      const aggregate = (list: Project[]) => {
        const total = list.reduce((sum, item) => sum + contribution(item), 0);
        return isAverage ? (list.length ? total / list.length : 0) : total;
      };
      // Все записи за один момент (типичный импорт) — динамики нет: ровная линия на итоговом
      // значении, а не пик в первой корзине и нули в остальных.
      if (max - min < 86_400_000) {
        const flat = aggregate(dated.map((entry) => entry.item));
        return { values: [flat, flat, flat], labels: [] as string[] };
      }
      const buckets = 8;
      const step = Math.max(1, (max - min) / buckets);
      const grouped: Project[][] = Array.from({ length: buckets }, () => []);
      dated.forEach(({ item, time }) => {
        grouped[Math.min(buckets - 1, Math.max(0, Math.floor((time - min) / step)))].push(item);
      });
      const values = grouped.map(aggregate);
      const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
      const labels = values.map((_, index) => {
        const from = new Date(min + index * step);
        const to = new Date(Math.min(max, min + (index + 1) * step));
        const a = dateFmt.format(from);
        const b = dateFmt.format(to);
        return a === b ? a : `${a} – ${b}`;
      });
      return { values, labels };
    })();
    const metricSpark = metricSparkData.values;

    if (w.type === 'pivot') {
      const rowKey = w.pivotRowKey || String(chartOptions[0]?.id || 'status');
      const colKey = w.pivotColKey || String(chartOptions[0]?.id || 'status');
      const measures =
        w.pivotMeasures?.length && w.pivotMeasures.length > 0
          ? w.pivotMeasures.slice(0, PIVOT_MAX_MEASURES)
          : [{ id: 'pv', mode: 'count' as ChartValueMode }];
      const theme = resolveTheme(w.themeKey);
      if (rowKey === colKey) {
        return (
          <div className="flex h-full items-center">
            <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {t('crm.projects.analytics.pivot.sameAxisHint')}
            </div>
          </div>
        );
      }
      const rowAxis = collectPivotAxisUnique(widgetItems, rowKey).slice(0, PIVOT_MAX_ROWS);
      const colAxis = collectPivotAxisUnique(widgetItems, colKey).slice(0, PIVOT_MAX_COLS);
      if (!rowAxis.length || !colAxis.length) {
        return (
          <div className="flex h-full items-center text-[12px] text-neutral-500">
            {t('crm.projects.analytics.pivot.noData')}
          </div>
        );
      }
      const rowDimLabel =
        chartOptions.find((c) => c.id === rowKey)?.label ||
        analyticsFieldMap.get(rowKey.replace('field:', ''))?.label ||
        rowKey;
      const colDimLabel =
        chartOptions.find((c) => c.id === colKey)?.label ||
        analyticsFieldMap.get(colKey.replace('field:', ''))?.label ||
        colKey;
      const pivotCurrency = reportCurrency;
      const formatPivotCell = (n: number, m: PivotMeasureConfig) => {
        if (m.mode === 'count') return n.toLocaleString(locale);
        if (m.mode === 'sum' && (m.valueField === 'amount' || !m.valueField || isMoneyValueField(m.valueField))) {
          const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
          return t('crm.projects.common.amountWithCurrency', {
            amount: formatted,
            currency: pivotCurrency,
          });
        }
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
      };
      const measureHeader = (m: PivotMeasureConfig) =>
        m.shortLabel?.trim() ||
        (m.mode === 'count'
          ? t('crm.projects.analytics.pivot.measure.count')
          : t('crm.projects.analytics.pivot.measure.sum'));
      return (
        <div className="space-y-3">
          <div className="flex justify-end text-[10px] text-neutral-400">
              {rowDimLabel} × {colDimLabel}
              {(rowAxis.length >= PIVOT_MAX_ROWS || colAxis.length >= PIVOT_MAX_COLS) && (
                <span className="text-amber-600"> · {t('crm.projects.analytics.pivot.truncated')}</span>
              )}
          </div>
          <div
            className="overflow-x-auto overflow-y-auto rounded-xl border border-slate-100"
            style={{ maxHeight: Math.max(widgetHeight - 72, 200) }}
          >
            <table className="min-w-full border-collapse text-[10px]">
              <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th
                    className="py-1.5 pr-2 pl-1 text-left font-normal sticky left-0 z-20 bg-white/95 min-w-[100px]"
                    rowSpan={2}
                  >
                    {rowDimLabel}
                  </th>
                  {colAxis.map((col) => (
                    <th
                      key={col.code}
                      className="py-1.5 px-1 text-center font-normal border-l border-slate-100"
                      colSpan={measures.length}
                    >
                      <span className="line-clamp-2">{col.label}</span>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 text-slate-400">
                  {colAxis.flatMap((col) =>
                    measures.map((m) => (
                      <th
                        key={`${col.code}-${m.id}`}
                        className="py-1 px-1 text-right font-normal border-l border-slate-50 whitespace-nowrap"
                        style={{ color: theme.primary }}
                      >
                        {measureHeader(m)}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {rowAxis.map((row) => (
                  <tr key={row.code} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 pl-1 text-slate-800 sticky left-0 bg-white/95 font-medium">
                      {row.label}
                    </td>
                    {colAxis.flatMap((col) =>
                      measures.map((m) => {
                        const cellItems = widgetItems.filter(
                          (item) =>
                            extractPivotBuckets(item, rowKey).some((b) => b.code === row.code) &&
                            extractPivotBuckets(item, colKey).some((b) => b.code === col.code),
                        );
                        const val = pivotMeasureAggregate(cellItems, m.mode, m.valueField);
                        return (
                          <td
                            key={`${row.code}-${col.code}-${m.id}`}
                            className="py-1.5 px-1 text-right text-slate-700 tabular-nums border-l border-slate-50"
                          >
                            {formatPivotCell(val, m)}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'metric') {
      const value = resolveMetricValue(w.metricKey, widgetItems, filteredItems);
      return (
        <MetricCard
          value={String(value)}
          caption={period === 'custom' ? t('crm.projects.analytics.period.custom') : periodLabels[period]}
          spark={metricSpark}
          sparkLabels={metricSparkData.labels}
          color={widgetColor}
          locale={locale}
        />
      );
    }

    if (w.type === 'formula') {
      const fn = w.formulaFn ?? 'sumif';
      const mode = w.formulaMode ?? 'count';
      const leftType = w.formulaLeftType ?? 'total';
      const rightType = w.formulaRightType ?? 'total';
      const leftKey = w.formulaLeftKey;
      const rightKey = w.formulaRightKey;
      const leftMeasure = w.formulaLeftMeasure || 'count';
      const rightMeasure = w.formulaRightMeasure || 'count';
      const filters = w.formulaFilters ?? [];

      /** «Лучший/худший по группе»: groupmax:field:мастер|sum:итого_try → {значение, какая группа}. */
      const resolveGroupOperand = (type: string, sourceItems: Project[] = widgetItems) => {
        const match = /^(groupmax|groupmin):(.+)\|(count|sum:.+)$/.exec(type);
        if (!match) return null;
        const [, kind, dim, measure] = match;
        const series = buildSeriesForWidget(
          dim,
          sourceItems,
          measure === 'count' ? 'count' : 'sum',
          measure === 'count' ? undefined : `field:${measure.slice(4)}`,
        ).filter((row) => String(row.label || '').trim());
        if (!series.length) return { value: 0, label: '—', measure };
        const pick = series.reduce((best, row) =>
          kind === 'groupmax' ? (row.count > best.count ? row : best) : row.count < best.count ? row : best,
        );
        return { value: pick.count, label: pick.label, measure };
      };

      const resolveOperand = (
        type: FormulaOperandType,
        key?: string,
        sourceItems: Project[] = widgetItems,
        measure?: string,
      ) => {
        const group = resolveGroupOperand(type, sourceItems);
        if (group) return group.value;
        if (type.startsWith('summonths:')) {
          const keys = parseSumMonthsKeys(type);
          return sourceItems.reduce(
            (acc, item) => acc + keys.reduce((s, k) => s + (parseNumericLoose(getCustomFieldValue(item, k)) ?? 0), 0),
            0,
          );
        }
        if (type.startsWith('sum:')) {
          const fieldKey = type.slice(4);
          return sourceItems.reduce((acc, item) => acc + getPeriodAwareFieldValue(item, fieldKey), 0);
        }
        if (type.startsWith('avg:')) {
          const fieldKey = type.slice(4);
          const values = sourceItems.map((item) => getPeriodAwareFieldValue(item, fieldKey));
          return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        }
        if (type.startsWith('filled:')) {
          const fieldKey = type.slice(7);
          return sourceItems.filter((item) => isFilled(getCustomFieldValue(item, fieldKey))).length;
        }
        if (type.startsWith('field:')) {
          const list = buildSeriesForWidget(type, sourceItems, 'count');
          const cnt = list.find((entry) => entry.code === key)?.count ?? 0;
          // «Источник = google» + «Клики (сумма)» → клики только по строкам google.
          const m = /^(sum|avg):(.+)$/.exec(measure || '');
          if (!m) return cnt;
          const sumList = buildSeriesForWidget(type, sourceItems, 'sum', `field:${m[2]}`);
          const sum = sumList.find((entry) => entry.code === key)?.count ?? 0;
          return m[1] === 'avg' ? (cnt > 0 ? sum / cnt : 0) : sum;
        }
        if (type === 'total') return sourceItems.length;
        if (type === 'amount') return sourceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        if (type === 'avgAmount') {
          if (!sourceItems.length) return 0;
          return Math.round(
            sourceItems.reduce((sum, item) => sum + (item.amount || 0), 0) / sourceItems.length,
          );
        }
        if (type === 'owners') {
          return new Set(sourceItems.map((item) => item.owner || t('crm.projects.analytics.unknownOwner'))).size;
        }
        if (type === 'categories') {
          return new Set(sourceItems.map((item) => item.category || t('crm.projects.analytics.noCategory'))).size;
        }
        if (type === 'tags') {
          return new Set(sourceItems.flatMap((item) => item.tags || [])).size;
        }
        if (type === 'status') {
          return statusChartData.find((s) => s.code === key)?.count ?? 0;
        }
        if (type === 'category') {
          return categoryChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'owner') {
          return owners.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'tag') {
          return tags.find((s) => s.label === key)?.count ?? 0;
        }
        return 0;
      };

      const matchingItems = widgetItems.filter((item) =>
        filters.every((filter) => filterRowMatches(item, filter as FormulaFilterRow)),
      );
      const filterValue = matchingItems.length;

      const leftValue = resolveOperand(leftType, leftKey, widgetItems, leftMeasure);
      const rightValue = resolveOperand(rightType, rightKey, widgetItems, rightMeasure);
      // База для «Доли»/«Количества»: если левая часть считает сумму поля (клики, расход) —
      // доля от ВСЕЙ суммы этого поля, а не от числа строк.
      const leftMeasureMatch = leftType.startsWith('field:') ? /^(sum|avg):(.+)$/.exec(leftMeasure) : null;
      const baseTotal =
        leftMeasureMatch && leftMeasureMatch[1] === 'sum'
          ? widgetItems.reduce((acc, item) => acc + getPeriodAwareFieldValue(item, leftMeasureMatch[2]), 0)
          : widgetItems.length;
      const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : 0);

      let primaryValue = leftValue;
      let secondaryValue: number | null = null;
      if (fn === 'count') {
        primaryValue = leftValue;
        secondaryValue = pct(leftValue, baseTotal);
      } else if (fn === 'percent') {
        primaryValue = pct(leftValue, baseTotal);
        secondaryValue = leftValue;
      } else if (fn === 'ratio') {
        // 2 знака: CTR 1,21% не должен превращаться в 1%.
        primaryValue = pct(leftValue, rightValue);
        secondaryValue = rightValue;
      } else if (fn === 'diff' && mode === 'percent') {
        // «% изменения»: (левая − правая) / правая. Раньше «процент» просто приписывал % к разнице.
        primaryValue = pct(leftValue - rightValue, rightValue);
        secondaryValue = leftValue - rightValue;
      } else if (fn === 'diff') {
        primaryValue = leftValue - rightValue;
        secondaryValue = rightValue;
      } else if (fn === 'sumif') {
        if (mode === 'sum') {
          const targetOperand =
            leftType && leftType !== 'total'
              ? leftType
              : numericFieldsForMetrics[0]
                ? `sum:${numericFieldsForMetrics[0].key}`
                : 'total';
          primaryValue = resolveOperand(targetOperand, leftKey, matchingItems);
          secondaryValue = null;
        } else {
          primaryValue = filterValue;
          secondaryValue = baseTotal > 0 ? Math.round((filterValue / baseTotal) * 100) : 0;
        }
      }

      if ((fn === 'count' || fn === 'sumif') && mode === 'percent') {
        const percentValue = secondaryValue ?? 0;
        secondaryValue = primaryValue;
        primaryValue = percentValue;
      }

      const leftGroup = resolveGroupOperand(leftType);
      const rightGroup = resolveGroupOperand(rightType);
      const measureMoney =
        (leftType.startsWith('field:') && leftMeasure !== 'count' && isMoneyValueField(leftMeasure)) ||
        (leftType.startsWith('sum:') && isMoneyValueField(leftType));
      const groupMoney =
        measureMoney ||
        [leftGroup, rightGroup].some((g) => g && g.measure !== 'count' && isMoneyValueField(g.measure));
      const formatGroupValue = (g: { value: number; measure: string }) =>
        g.measure !== 'count' && isMoneyValueField(g.measure)
          ? formatAmount(g.value)
          : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(g.value);
      const groupCaption =
        leftGroup || rightGroup
          ? [leftGroup, fn === 'diff' || fn === 'ratio' ? rightGroup : null]
              .filter((g): g is { value: number; label: string; measure: string } => Boolean(g))
              .map((g) => `${g.label} ${formatGroupValue(g)}`)
              .join(fn === 'ratio' ? ' ÷ ' : ' − ')
          : null;

      const primaryLabel =
        groupMoney && (fn === 'diff' || fn === 'count' || fn === 'sumif') && mode !== 'percent'
          ? formatAmount(primaryValue)
          : mode === 'sum'
          ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(primaryValue)
          : fn === 'percent' || fn === 'ratio' || mode === 'percent'
          ? `${primaryValue.toLocaleString(locale, { maximumFractionDigits: 2 })}%`
          : primaryValue.toLocaleString(locale, { maximumFractionDigits: 2 });
      const secondaryIsPercent = !(mode === 'percent' || fn === 'percent' || fn === 'ratio' || fn === 'diff');
      const secondaryLabel =
        secondaryValue === null
          ? null
          : secondaryIsPercent
            ? `${secondaryValue.toLocaleString(locale, { maximumFractionDigits: 2 })}%`
            : groupMoney
              ? formatAmount(secondaryValue)
              : secondaryValue.toLocaleString(locale, { maximumFractionDigits: 2 });

      // Обе части — суммы по месяцам ("широкая" таблица) — тогда, помимо числа, можно показать
      // сравнение как график/таблицу (настраивается в блоке), независимо от функции формулы:
      // leftValue/rightValue считаются для всех fn (sumif/count/percent/ratio/diff), не только diff/ratio.
      const canCompareVisually =
        isWideMonthlyTable && isMonthOperand(leftType) && isMonthOperand(rightType);
      const compareDisplay: CompareDisplay = canCompareVisually ? w.compareDisplay || 'bar' : 'number';
      const compareLeftLabel = describeMonthOperand(leftType);
      const compareRightLabel = describeMonthOperand(rightType);
      const compareData: Array<{ name: string; value: number; color: string }> = canCompareVisually
        ? Array.isArray(w.compareSides) && w.compareSides.length >= 2
          ? w.compareSides.map((side, idx) => ({
              name: describeCompareSide(side),
              value: sumCompareSide(side, widgetItems),
              color: side.color || V2_PALETTE[idx % V2_PALETTE.length],
            }))
          : [
              { name: compareLeftLabel, value: leftValue, color: widgetColor },
              { name: compareRightLabel, value: rightValue, color: V2_PALETTE[1] },
            ]
        : [];
      const showCompareVisual = canCompareVisually && compareDisplay !== 'number';
      const formatCompareValue = (value: number) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);

      const formulaCaption = (
        <span className="line-clamp-2">
          {groupCaption ? `${groupCaption} · ` : secondaryLabel ? `${secondaryLabel} · ` : ''}
          {canCompareVisually
            ? compareData.map((d) => d.name).join(' vs ')
            : period === 'custom'
              ? t('crm.projects.analytics.period.custom')
              : periodLabels[period]}
        </span>
      );
      // «Разница» / «Отношение»: вместо общей линии — две линии (левая и правая часть) по периодам,
      // с подсказкой по наведению: видно, где одна сторона обгоняла другую, а не только итог.
      const dual =
        !showCompareVisual && (fn === 'diff' || fn === 'ratio')
          ? (() => {
              const dated = widgetItems
                .map((item) => ({ item, date: getAnalyticsDate(item) }))
                .filter((e): e is { item: Project; date: Date } => Boolean(e.date));
              if (dated.length < 2) return null;
              const minT = dated.reduce((m, e) => Math.min(m, e.date.getTime()), Infinity);
              const maxT = dated.reduce((m, e) => Math.max(m, e.date.getTime()), -Infinity);
              const days = Math.max(1, Math.ceil((maxT - minT) / 86_400_000) + 1);
              if (days < 2) return null;
              const points = Math.max(2, Math.min(days, 12));
              const bucket = Math.max(1, Math.ceil(days / points));
              const rows = Array.from({ length: points }, (_, i) => {
                const start = new Date(minT);
                start.setDate(start.getDate() + i * bucket);
                const end = new Date(start);
                end.setDate(start.getDate() + bucket);
                const part = dated.filter((e) => e.date >= start && e.date < end).map((e) => e.item);
                return {
                  name: formatDateShort(start),
                  left: resolveOperand(leftType, leftKey, part, leftMeasure),
                  right: resolveOperand(rightType, rightKey, part, rightMeasure),
                };
              });
              const describeSide = (type: string, key: string | undefined, measure: string) => {
                const valueLabel = key
                  ? formulaValueItems[type]?.find((v) => v.id === key)?.label || key
                  : formulaOperandOptions.find((o) => o.id === type)?.label || type;
                const measureLabel =
                  type.startsWith('field:') && measure !== 'count'
                    ? formulaMeasureOptions.find((o) => o.id === measure)?.label
                    : null;
                return measureLabel ? `${valueLabel} · ${measureLabel}` : valueLabel;
              };
              return {
                rows,
                leftName: describeSide(leftType, leftKey, leftMeasure),
                rightName: describeSide(rightType, rightKey, rightMeasure),
              };
            })()
          : null;
      if (dual) {
        const fmtVal = (v: number) =>
          groupMoney ? formatAmount(v) : v.toLocaleString(locale, { maximumFractionDigits: 2 });
        const rightColor = widgetColor === V2_PALETTE[1] ? V2_PALETTE[0] : V2_PALETTE[1];
        return (
          <div className="flex h-full flex-col gap-2">
            <div className="flex min-w-0 flex-col justify-end gap-1" style={{ containerType: 'inline-size' }}>
              <div
                className="whitespace-nowrap font-semibold leading-none tracking-[-0.04em] text-[#222] tabular-nums"
                style={{ fontSize: `clamp(16px, calc(100cqw / ${(String(primaryLabel).length * 0.58).toFixed(2)}), 40px)` }}
              >
                {primaryLabel}
              </div>
              <div className="text-[11px] font-medium text-neutral-400">{formulaCaption}</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-3 rounded" style={{ background: widgetColor }} />
                  {dual.leftName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-3 rounded" style={{ background: rightColor }} />
                  {dual.rightName}
                </span>
              </div>
            </div>
            <div className="min-h-0 flex-1" style={{ minHeight: 70 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dual.rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 10 }} minTickGap={16} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 10 }} width={52} tickFormatter={formatAxisTick} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as { left: number; right: number } | undefined;
                      if (!row) return null;
                      const diff = row.left - row.right;
                      return (
                        <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                          <div className="mb-1 text-[11px] text-slate-400">{label}</div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: widgetColor }} />
                            <span className="text-slate-600">{dual.leftName}:</span>
                            <span className="font-semibold tabular-nums">{fmtVal(row.left)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: rightColor }} />
                            <span className="text-slate-600">{dual.rightName}:</span>
                            <span className="font-semibold tabular-nums">{fmtVal(row.right)}</span>
                          </div>
                          <div className="mt-1 border-t border-slate-100 pt-1 text-slate-500">
                            {fn === 'ratio'
                              ? `${t('crm.projects.analytics.formula.fn.ratio')}: ${(row.right > 0 ? (row.left / row.right) * 100 : 0).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
                              : `${t('crm.projects.analytics.formula.fn.diff')}: ${diff > 0 ? '+' : ''}${fmtVal(diff)}${
                                  row.right > 0
                                    ? ` (${diff > 0 ? '+' : ''}${((diff / row.right) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%)`
                                    : ''
                                }`}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="left" name={dual.leftName} stroke={widgetColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="right" name={dual.rightName} stroke={rightColor} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }
      if (!showCompareVisual) {
        return (
          <MetricCard
            value={String(primaryLabel)}
            caption={formulaCaption}
            spark={metricSpark}
            sparkLabels={metricSparkData.labels}
            color={widgetColor}
            locale={locale}
          />
        );
      }

      return (
        <div className="flex h-full flex-col gap-2">
          <div className="flex min-w-0 flex-col justify-end gap-1" style={{ containerType: 'inline-size' }}>
            <div
              className="whitespace-nowrap font-semibold leading-none tracking-[-0.04em] text-[#222] tabular-nums"
              style={{ fontSize: `clamp(16px, calc(100cqw / ${(String(primaryLabel).length * 0.58).toFixed(2)}), 40px)` }}
            >
              {primaryLabel}
            </div>
            <div className="text-[11px] font-medium text-neutral-400">{formulaCaption}</div>
          </div>
          {showCompareVisual && compareDisplay === 'bar' && (
            <div style={{ height: Math.max(90, widgetHeight - 130) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={56} tickFormatter={formatAxisTick} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                    formatter={(value: number) => [formatCompareValue(Number(value)), '']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {compareData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {showCompareVisual && compareDisplay === 'line' && (
            <div style={{ height: Math.max(90, widgetHeight - 130) }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={compareData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={56} tickFormatter={formatAxisTick} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                    formatter={(value: number) => [formatCompareValue(Number(value)), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={widgetColor}
                    strokeWidth={2.5}
                    fill="transparent"
                    isAnimationActive={false}
                    dot={(props: any) => {
                      const { cx, cy, index, key } = props;
                      const color = compareData[index]?.color || widgetColor;
                      return <circle key={key} cx={cx} cy={cy} r={5} strokeWidth={2} fill="#fff" stroke={color} />;
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {showCompareVisual && compareDisplay === 'donut' && (() => {
            // Пирог не умеет отрицательные сектора (leftValue/rightValue теоретически могут быть
            // < 0, если суммируемое поле само бывает отрицательным, например "прибыль/убыток") —
            // сектор размером по |value|, а подпись/тултип показывают настоящее (со знаком) число.
            const donutData = compareData.map((entry) => ({ ...entry, rawValue: entry.value, value: Math.abs(entry.value) }));
            const donutTotal = donutData.reduce((sum, row) => sum + row.value, 0);
            const donutTotalText = compactNumber(donutTotal);
            const donutTotalFontClass = donutCenterFontClass(donutTotalText, [
              [5, 'text-xl'],
              [7, 'text-lg'],
              [9, 'text-base'],
              [Infinity, 'text-sm'],
            ]);
            const activeIndex = activeDonut[w.id] ?? null;
            const activeProps =
              activeIndex === null ? {} : ({ activeIndex, activeShape: renderActiveDonut } as any);
            return (
            <div className="grid grid-cols-[minmax(100px,0.9fr)_1.1fr] items-center gap-3" style={{ height: Math.max(90, widgetHeight - 130) }}>
              <div className="relative h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={54}
                      paddingAngle={2}
                      stroke="#fff"
                      strokeWidth={2}
                      {...activeProps}
                      onMouseLeave={() => setActiveDonut((prev) => ({ ...prev, [w.id]: null }))}
                      onMouseEnter={(_, idx) => setActiveDonut((prev) => ({ ...prev, [w.id]: idx }))}
                    >
                      {donutData.map((entry, idx) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                          opacity={activeIndex === null || activeIndex === idx ? 1 : 0.3}
                          style={{ transition: 'opacity 180ms ease' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      wrapperStyle={{ zIndex: 20 }}
                      contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                      formatter={(_value: number, _n, p: any) => [formatCompareValue(p?.payload?.rawValue ?? 0), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
                  <span className={`${donutTotalFontClass} font-semibold leading-tight text-center`}>{donutTotalText}</span>
                  <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-400">всего</span>
                </div>
              </div>
              <div className="space-y-2">
                {donutData.map((entry, idx) => {
                  const isActive = activeIndex === idx;
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      onMouseEnter={() => setActiveDonut((prev) => ({ ...prev, [w.id]: idx }))}
                      onMouseLeave={() => setActiveDonut((prev) => ({ ...prev, [w.id]: null }))}
                      className={`grid w-full grid-cols-[10px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                        isActive ? 'bg-neutral-100 text-[#222]' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                      <span className="truncate text-left">{entry.name}</span>
                      <span className="font-mono text-[#222]">{formatCompareValue(entry.rawValue)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })()}
          {showCompareVisual && compareDisplay === 'table' && (
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {compareData.map((entry) => (
                  <tr key={entry.name} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2 pr-3 font-medium text-neutral-600">
                      <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: entry.color }} />
                      {entry.name}
                    </td>
                    <td className="py-2 text-right font-mono text-[#222]">{formatCompareValue(entry.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      );
    }

    if (w.type === 'line') {
      const trend = isWideMonthlyTable
        ? buildMonthTrend(widgetItems)
        : buildTrend(widgetItems, w.chartValueMode || 'count', w.chartValueField);
      const chartHeight = Math.max(widgetHeight - 90, 160);
      const areaId = `projects-area-${w.id}`;
      return (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center gap-4 px-1">
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span className="inline-block h-0.5 w-5 rounded-full" style={{ backgroundColor: widgetColor }} />
              {isWideMonthlyTable ? 'По месяцам' : 'Текущий период'}
            </span>
          </div>
          <div style={{ height: Math.max(120, chartHeight - 28) }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={widgetColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={widgetColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} domain={[0, (max: number) => Math.max(1, Number(max) || 0)]} allowDecimals={false} width={56} tickFormatter={formatAxisTick} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }} formatter={(value: number) => [compactNumber(Number(value)), 'Текущий']} />
                <Area type="monotone" dataKey="value" stroke={widgetColor} strokeWidth={2.5} fill={`url(#${areaId})`} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: widgetColor }} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="previous" stroke="#3b6cb6" strokeWidth={1.5} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (w.type === 'donut') {
      const donutData = buildSeriesForWidget(
        w.chartKey || (chartOptions[0]?.id ?? 'status'),
        widgetItems,
        w.chartValueMode || 'count',
        w.chartValueField,
      ).sort((a, b) => b.count - a.count);
      const palette = resolveTheme(w.themeKey).palette;
      const donutTotal = donutData.reduce((sum, row) => sum + row.count, 0);
      const donutTotalText = compactNumber(donutTotal);
      const donutTotalFontClass = donutCenterFontClass(donutTotalText, [
        [5, 'text-2xl'],
        [7, 'text-xl'],
        [9, 'text-lg'],
        [Infinity, 'text-base'],
      ]);
      const chartHeight = Math.max(widgetHeight - 96, 180);
      const activeIndex = activeDonut[w.id] ?? null;
      const activeProps =
        activeIndex === null ? {} : ({ activeIndex, activeShape: renderActiveDonut } as any);
      const showLabels = w.showLabels !== false;
      return (
        <div
          className={cx(
            'grid h-full min-h-[220px] items-start gap-4',
            showLabels ? 'grid-cols-1 md:grid-cols-[minmax(140px,0.9fr)_1.1fr]' : 'grid-cols-1',
          )}
        >
          {/* sticky: длинная легенда (много категорий) растягивает строку грида выше видимой
              карточки — без sticky центрированный по items-center пончик оказывался прижат к низу
              (реально по центру ВСЕЙ строки, но видна была только её верхняя часть). */}
          <div className="relative sticky top-0" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={54}
                    outerRadius={76}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                    {...activeProps}
                    onMouseLeave={() =>
                      setActiveDonut((prev) => ({ ...prev, [w.id]: null }))
                    }
                    onMouseEnter={(_, idx) =>
                      setActiveDonut((prev) => ({ ...prev, [w.id]: idx }))
                    }
                  >
                    {donutData.map((entry, idx) => (
                      <Cell
                        key={entry.code}
                        fill={palette[idx % palette.length]}
                        opacity={activeIndex === null || activeIndex === idx ? 1 : 0.3}
                        style={{ transition: 'opacity 180ms ease' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 20 }}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                    formatter={chartTooltipFormatter(w.chartValueMode, w.chartValueField) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
                <span className={`${donutTotalFontClass} font-semibold leading-tight text-center`}>{donutTotalText}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">всего</span>
              </div>
            </div>
            {showLabels && (
              <div className="space-y-2">
                {donutData.map((entry, idx) => {
                  const percent = donutTotal > 0 ? Math.round((entry.count / donutTotal) * 100) : 0;
                  const isActive = activeIndex === idx;
                  return (
                    <button
                      key={entry.code}
                      type="button"
                      onMouseEnter={() =>
                        setActiveDonut((prev) => ({ ...prev, [w.id]: idx }))
                      }
                      onMouseLeave={() =>
                        setActiveDonut((prev) => ({ ...prev, [w.id]: null }))
                      }
                      className={`grid w-full grid-cols-[10px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                        isActive
                          ? 'bg-neutral-100 text-[#222]'
                          : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: palette[idx % palette.length] }} />
                      <span className="truncate">{entry.label}</span>
                      <span className="font-mono text-[#222]">{compactNumber(entry.count)} <span className="text-neutral-400">· {percent}%</span></span>
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      );
    }

    if (w.type === 'bar') {
      const barData = buildSeriesForWidget(
        w.chartKey || (chartOptions[0]?.id ?? 'status'),
        widgetItems,
        w.chartValueMode || 'count',
        w.chartValueField,
      ).map((item) => ({
        label: item.label,
        count: item.count,
      }));
      const palette = resolveTheme(w.themeKey).palette;
      const chartHeight = Math.max(widgetHeight - 72, 180);
      return (
        <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={56} tickFormatter={formatAxisTick} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  formatter={chartTooltipFormatter(w.chartValueMode, w.chartValueField) as any}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {barData.map((_, idx) => (
                    <Cell key={idx} fill={palette[idx % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        </div>
      );
    }

    if (w.type === 'funnel') {
      const data = buildSeriesForWidget(
        w.chartKey || (chartOptions[0]?.id ?? 'status'),
        widgetItems,
        w.chartValueMode || 'count',
        w.chartValueField,
      );
      const ordered = [...data].sort((a, b) => b.count - a.count);
      const max = Math.max(1, ordered[0]?.count || widgetItems.length);
      const palette = resolveTheme(w.themeKey).palette;
      return (
        <div className="flex h-full flex-col justify-center">
          {ordered.map((item, index) => (
            <div key={item.code} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 border-b border-neutral-100 py-2 text-xs last:border-b-0">
              <span className="truncate font-medium text-[#222]">{item.label}</span>
              <span className="h-7 overflow-hidden rounded-md bg-neutral-100">
                <span className="flex h-full items-center rounded-md px-3 font-mono text-[11px] font-medium text-white" style={{ width: `${Math.max(8, percent(item.count, max))}%`, backgroundColor: palette[index % palette.length] }}>{compactNumber(item.count)}</span>
              </span>
              <span className="text-right font-mono text-neutral-500">{index === 0 ? '100%' : `${percent(item.count, max)}%`}</span>
            </div>
          ))}
        </div>
      );
    }

    if (w.type === 'map') {
      const mode = w.chartValueMode || 'count';
      const series = buildSeriesForWidget(
        w.chartKey || (chartOptions[0]?.id ?? 'status'),
        widgetItems,
        mode,
        w.chartValueField,
      );
      const isMoney = mode === 'sum' && (isMoneyValueField(w.chartValueField) || (!w.chartValueField && !isWorkspaceMode));
      const formatMapValue = (n: number) =>
        isMoney ? formatAmount(n) : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
      return (
        <AnalyticsGeoMap
          rows={series.map((row) => ({ label: row.label, value: row.count }))}
          scope={(w.mapScope || 'world') as MapScope}
          mode={w.mapMode === 'points' ? 'points' : 'countries'}
          geocode={mapGeocoder}
          height={Math.max(widgetHeight - 72, 260)}
          color={widgetColor}
          valueLabel={mode === 'sum' ? t('crm.projects.analytics.tooltip.sum') : t('crm.projects.analytics.tooltip.count')}
          formatValue={formatMapValue}
        />
      );
    }

    if (w.type === 'leaderboard') {
      const dimensionKey = w.chartKey || 'owner';
      const grouped = buildSeriesForWidget(dimensionKey, widgetItems, w.chartValueMode || 'count', w.chartValueField).slice(0, 8);
      const max = Math.max(1, ...grouped.map((row) => row.count));
      return (
        <div className="flex h-full flex-col justify-center">
          {grouped.map((row, index) => (
            <div key={row.code} className="grid grid-cols-[26px_1fr_100px_72px] items-center gap-3 border-b border-neutral-100 py-2 text-xs last:border-b-0">
              <span className="font-mono text-neutral-400">#{index + 1}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: widgetColor }}>
                  {row.label.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </span>
                <span className="truncate font-medium text-[#222]">{row.label}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <span className="block h-full rounded-full" style={{ width: `${percent(row.count, max)}%`, backgroundColor: widgetColor }} />
              </span>
              <span className="text-right font-mono text-[#222]">{compactNumber(row.count)}</span>
            </div>
          ))}
        </div>
      );
    }

    const tableAggMode = w.chartValueMode || 'count';
    const tableAggField = w.chartValueField;
    const formatTableAggCell = (n: number) => {
      if (tableAggMode === 'sum' && (tableAggField === 'amount' || !tableAggField || isMoneyValueField(tableAggField))) {
        return formatAmount(n);
      }
      if (tableAggMode === 'sum') {
        return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
      }
      return n.toLocaleString(locale);
    };

    if (w.type === 'table' && isWorkspaceMode && (w.tableKey || '').startsWith('field:')) {
      const dimKeysRaw =
        Array.isArray(w.tableDimensions) && w.tableDimensions.length > 0
          ? w.tableDimensions
              .map(String)
              .filter((id) => id.startsWith('field:'))
              .slice(0, TABLE_MAX_DIMENSIONS)
          : [String(w.tableKey)];
      const dimKeys = dimKeysRaw.length ? dimKeysRaw : [String(w.tableKey)];
      const dimLabels = dimKeys.map((id) => {
        const fk = id.replace('field:', '');
        return analyticsFieldMap.get(fk)?.label || fk;
      });
      const rows = buildMultiDimensionWorkspaceTableRows(
        dimKeys,
        widgetItems,
        tableAggMode,
        tableAggField,
      );
      const valueHeader =
        tableAggMode === 'sum'
          ? t('crm.projects.analytics.tableMetric.sum')
          : t('crm.projects.analytics.ownersTable.headers.projects');
      return (
        <div className="h-full">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 56, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
                <tr className="border-b border-neutral-200">
                  {dimLabels.map((label, i) => (
                    <th key={i} className="py-2 pr-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right font-medium">{valueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.key} className="border-b border-neutral-100 last:border-b-0">
                    {entry.cells.map((cell, i) => (
                      <td key={i} className="py-2.5 pr-3 font-medium text-[#222]">
                        {cell}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right font-mono text-[#222]">
                      {formatTableAggCell(entry.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && w.tableKey === 'owners') {
      const ownerSeries = buildSeriesForWidget('owner', widgetItems, tableAggMode, tableAggField);
      const ownersValueHeader =
        tableAggMode === 'sum'
          ? t('crm.projects.analytics.tableMetric.sum')
          : t('crm.projects.analytics.ownersTable.headers.projects');
      return (
        <div className="h-full">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 56, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
                <tr className="border-b border-neutral-200">
                  <th className="py-2 pr-3 text-left font-medium">
                    {t('crm.projects.analytics.ownersTable.headers.owner')}
                  </th>
                  <th className="py-2 px-3 text-right font-medium">{ownersValueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {ownerSeries.map((o) => (
                  <tr key={o.label} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2.5 pr-3 font-medium text-[#222]">{o.label}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#222]">
                      {formatTableAggCell(o.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && w.tableKey === 'categories') {
      const categorySeries = buildSeriesForWidget(
        'category',
        widgetItems,
        tableAggMode,
        tableAggField,
      );
      const categoriesValueHeader =
        tableAggMode === 'sum'
          ? t('crm.projects.analytics.tableMetric.sum')
          : t('crm.projects.analytics.categoriesTable.headers.projects');
      return (
        <div className="h-full">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 56, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
                <tr className="border-b border-neutral-200">
                  <th className="py-2 pr-3 text-left font-medium">
                    {t('crm.projects.analytics.categoriesTable.headers.category')}
                  </th>
                  <th className="py-2 px-3 text-right font-medium">{categoriesValueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {categorySeries.map((c) => (
                  <tr key={c.label} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2.5 pr-3 font-medium text-[#222]">{c.label}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-[#222]">
                      {formatTableAggCell(c.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && isWorkspaceMode) {
      // Для "широкой" помесячной таблицы первые 4 поля схемы — это всегда самые старые месяцы
      // (сентябрь/октябрь/ноябрь 2024 и т.п.), что превращало этот виджет в замороженный на
      // старых данных, не реагирующий на выбранный на странице период. Показываем колонки
      // месяцев, которые реально попадают в период (или последние месяцы, если период "всё время").
      const monthFieldsSorted = [...monthFieldDates.entries()].sort((a, b) => a[1].getTime() - b[1].getTime());
      let previewFields = analyticsFields.slice(0, 4);
      if (isWideMonthlyTable) {
        const nonMonthFields = analyticsFields.filter((f) => !monthFieldDates.has(f.key));
        const relevant = activePeriodRange
          ? monthFieldsSorted.filter(([, date]) => monthOverlapsRange(date, activePeriodRange))
          : monthFieldsSorted.slice(-3);
        const chosenKeys = (relevant.length ? relevant : monthFieldsSorted.slice(-3)).slice(0, 3).map(([key]) => key);
        const monthFieldMap = new Map(analyticsFields.map((f) => [f.key, f]));
        previewFields = [
          ...nonMonthFields.slice(0, 1),
          ...chosenKeys.map((key) => monthFieldMap.get(key)).filter((f): f is AnalyticsFieldMeta => !!f),
        ];
      }
      return (
        <div className="h-full">
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 56, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
                <tr className="border-b border-neutral-200">
                  <th className="py-2 pr-3 text-left font-medium">
                    {isWorkspaceMode ? (analyticsLabels?.record || 'Запись') : t('crm.projects.analytics.table.headers.project')}
                  </th>
                  {previewFields.map((field) => (
                    <th key={field.key} className="py-2 px-3 text-left font-medium">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {widgetItems.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-2.5 pr-3 font-medium text-[#222]">{p.name}</td>
                    {previewFields.map((field) => (
                      <td key={field.key} className="py-2.5 px-3 text-neutral-600">
                        {String(getCustomFieldValue(p, field.key) ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'heatmap') {
      const heatmap = buildHeatmap(widgetItems);
      const max = Math.max(1, ...heatmap.flatMap((row) => row.hours.map((hour) => hour.value)));
      return (
        <div className="flex h-full flex-col justify-center gap-2">
          <div className="grid grid-cols-[32px_repeat(8,1fr)] gap-1">
            <span />
            {heatmap[0]?.hours.map((hour) => <span key={hour.hour} className="text-center font-mono text-[10px] text-neutral-400">{hour.hour}</span>)}
            {heatmap.map((row) => (
              <React.Fragment key={row.day}>
                <span className="pr-1 text-right font-mono text-[10px] text-neutral-400">{row.day}</span>
                {row.hours.map((hour) => {
                  const intensity = Math.max(0.06, Math.min(1, hour.value / max));
                  return <span key={`${row.day}-${hour.hour}`} className="aspect-square rounded hover:scale-110 hover:ring-1 hover:ring-[#222]" title={`${row.day} ${hour.hour}:00 — ${hour.value}`} style={{ backgroundColor: widgetColor, opacity: intensity }} />;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }

    if (w.type === 'note' && w.noteText?.trim()) {
      return (
        <div className="h-full overflow-y-auto whitespace-pre-line text-sm leading-6 text-neutral-700">{w.noteText}</div>
      );
    }
    if (w.type === 'note') {
      const topStatus = buildSeriesForWidget(isWorkspaceMode ? chartOptions[0]?.id || '' : 'status', widgetItems, 'count')[0];
      const topOwner = !isWorkspaceMode ? buildSeriesForWidget('owner', widgetItems, 'count')[0] : null;
      return (
        <div className="text-sm leading-6 text-neutral-600">
          В выборке <strong className="text-[#222]">{compactNumber(widgetItems.length)}</strong> {isWorkspaceMode ? 'записей' : 'проектов'}.
          {topStatus && <> Главный сегмент — <strong className="text-[#222]">{topStatus.label}</strong>.</>}
          {topOwner && <> Ответственный с максимальной нагрузкой — <strong className="text-[#222]">{topOwner.label}</strong>.</>}
          {!isWorkspaceMode && <> Общая сумма — <strong className="text-[#222]">{formatAmount(totalAmount)}</strong>.</>}
        </div>
      );
    }

    return (
      <div className="h-full">
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: Math.max(widgetHeight - 56, 160) }}
        >
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-white/95 text-[10px] uppercase tracking-[0.16em] text-neutral-400 backdrop-blur">
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 text-left font-medium">
                  {t('crm.projects.analytics.table.headers.project')}
                </th>
                <th className="py-2 px-3 text-left font-medium">
                  {t('crm.projects.analytics.table.headers.status')}
                </th>
                <th className="py-2 px-3 text-left font-medium">
                  {t('crm.projects.analytics.table.headers.category')}
                </th>
                <th className="py-2 px-3 text-left font-medium">
                  {t('crm.projects.analytics.table.headers.owner')}
                </th>
                <th className="py-2 px-3 text-right font-medium">
                  {t('crm.projects.analytics.table.headers.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {widgetItems.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-b-0">
                  <td className="py-2.5 pr-3 font-medium text-[#222]">{p.name}</td>
                  <td className="py-2.5 px-3 text-neutral-600">
                    {statusLabels[p.status] ?? p.status}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600">
                    {p.category || t('crm.projects.analytics.noCategory')}
                  </td>
                  <td className="py-2.5 px-3 text-neutral-600">
                    {p.owner || t('crm.projects.analytics.unknownOwner')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#222]">
                    {formatAmount(p.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const searchBox = (
    <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm sm:w-52 sm:flex-none">
      <Icon name="search" size={14} />
      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Найти…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
  const publicExpiryLabel = (() => {
    if (!publicView) return '';
    if (!publicView.expiresAt) return t('crm.projects.analytics.share.headerNoExpiry');
    const until = new Date(publicView.expiresAt);
    const days = Math.max(0, Math.ceil((until.getTime() - Date.now()) / 86400000));
    return t('crm.projects.analytics.share.headerUntil', {
      date: until.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      days,
    });
  })();
  const publicHeader = publicView ? (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-3 md:px-6">
        <a href="/" className="group flex shrink-0 items-center gap-2" title="Lumiva CRM">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-black transition-transform duration-200 group-hover:scale-95">
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="hidden text-sm font-semibold uppercase tracking-[0.14em] text-black sm:inline">Lumiva CRM</span>
        </a>
        <span className="hidden h-5 w-px bg-neutral-200 md:block" />
        <div className="hidden min-w-0 items-center gap-2 text-sm text-neutral-500 md:flex">
          <span className="truncate">{publicView.companyName}</span>
          <span
            className={cx(
              'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
              publicView.expiresAt ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {publicExpiryLabel}
          </span>
        </div>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          {searchBox}
          <a
            href="/login"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black bg-black px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            {t('crm.projects.analytics.share.signIn')}
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
      <div className="border-t border-neutral-100 px-3 py-1.5 text-center text-[11px] text-neutral-500 md:hidden">
        {publicView.companyName} · {publicExpiryLabel}
      </div>
    </header>
  ) : null;

  if (embed) {
    const w = widgets[0];
    return (
      <EmbedBody>
        {(height) =>
          !w || loading ? (
            <div className="flex h-full items-center justify-center text-[11px] text-neutral-400">
              {t('crm.dashboard.loading')}
            </div>
          ) : (
            // Высота карточки на странице аналитики = тело + шапка блока (~64px): renderWidget
            // вычитает её сам, поэтому передаём «как будто» высоту целой карточки.
            renderWidget({ ...w, height: Math.max(height + BLOCK_CHROME_HEIGHT, 160) })
          )
        }
      </EmbedBody>
    );
  }

  const pageContent = (
    <>
      {!readOnly && <PageHelpButton topic="projectsAnalytics" />}
      <div className="min-h-screen pb-10 text-[#222]">
        {shareToast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-[#222] px-5 py-3 text-sm text-white shadow-lg">
            Ссылка скопирована в буфер обмена
          </div>
        )}

        {!readOnly && (
        <div className="sticky -top-4 z-20 -mx-3 -mt-4 border-b border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur md:-top-6 md:-mx-6 md:-mt-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm text-neutral-500">
              <span className="hidden sm:inline">
                {publicView?.companyName || pageRoot} <span className="mx-2 text-neutral-300">/</span>{' '}
              </span>
              <span className="font-semibold text-[#222]">Аналитика</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
              {searchBox}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleShare}
                title="Поделиться"
              >
                <Icon name="share" size={15} />
              </button>
            </div>
          </div>
        </div>
        )}

        <div className="space-y-5 py-6">
          <section className="border-b border-neutral-200 pb-6">
            <div className="mb-4">
              <div className="mb-2  text-xs uppercase tracking-[0.38em] text-neutral-500">
                ● {pageKicker} · {periodLabels[period]}
              </div>
              <h1 className="text-3xl font-semibold tracking-[-0.055em] text-[#222] sm:text-4xl md:text-5xl">
                {pageTitle}
              </h1>
              <p className="mt-2 hidden max-w-[760px] text-base leading-7 text-neutral-500 sm:mt-3 sm:block sm:text-lg">
                {pageSubtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangePicker
                value={{ from: activePeriodRange?.start ?? null, to: activePeriodRange?.end ?? null }}
                presetId={period === 'custom' ? null : period}
                presets={(['7d', '30d', '1y', 'all'] as PeriodId[]).map((id) => {
                  const to = new Date();
                  const from = new Date();
                  from.setHours(0, 0, 0, 0);
                  if (id === '7d') from.setDate(to.getDate() - 6);
                  if (id === '30d') from.setDate(to.getDate() - 29);
                  if (id === '1y') from.setFullYear(to.getFullYear() - 1);
                  return { id, label: periodLabels[id], range: id === 'all' ? { from: null, to: null } : { from, to } };
                })}
                onChange={(v) => {
                  if (v.presetId) return setPeriod(v.presetId as PeriodId);
                  setCustomFrom(v.from ? toIsoDate(v.from) : '');
                  setCustomTo(v.to ? toIsoDate(v.to) : '');
                  setPeriod(v.from ? 'custom' : 'all');
                }}
              />
              {needsDataCurrency && (
                <label
                  className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm"
                  title={t('crm.projects.analytics.dataCurrency.hint')}
                >
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-neutral-400">
                    {t('crm.projects.analytics.dataCurrency.label')}
                  </span>
                  <select
                    className="bg-transparent font-medium text-[#222] outline-none"
                    value={dataCurrency}
                    onChange={(event) => changeDataCurrency(event.target.value)}
                  >
                    {Array.from(
                      new Set([
                        dataCurrency,
                        ...(currencyPrefs.availableDisplayCurrencies?.length
                          ? currencyPrefs.availableDisplayCurrencies
                          : MARKETING_ALLOWED_CURRENCIES),
                      ]),
                    )
                      .sort()
                      .map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <AnalyticsCurrencyControl state={currencyPrefs} onStateChange={setCurrencyPrefs} />
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="hidden sm:inline-flex items-center gap-2 btn-secondary"
                    onClick={handleShare}
                  >
                    <Icon name="share" size={15} />
                    <span className="hidden md:inline">Поделиться</span>
                  </button>
                  {workspaceObjectId && (
                    <button
                      type="button"
                      className="hidden sm:inline-flex items-center gap-2 btn-secondary"
                      onClick={() => setReportOpen(true)}
                    >
                      <span aria-hidden>✉</span>
                      <span className="hidden md:inline">{t('crm.workspace.report.button')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="hidden sm:inline-flex items-center gap-2 btn-secondary"
                    onClick={() => exportCsv()}
                  >
                    <Icon name="download" size={15} />
                    <span className="hidden md:inline">Экспорт CSV</span>
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setEditMode((value) => !value)}
                  >
                    {editMode ? 'Готово' : 'Редактировать'}
                  </button>
                </>
              )}
            </div>
          </section>

          {toolbarSlot && (
            <nav className="border-b border-neutral-200 pb-3">
              <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">{toolbarSlot}</div>
            </nav>
          )}

          {beforeContentSlot}

          <nav className="border-b border-neutral-200">
            <div className="-mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:gap-2 md:mx-0 md:px-0">
              {tabs.map((tab) => {
                const active = tab.id === activeTab.id;
                const filterCount = (tab.filters ?? []).filter((f) => f.keys.length > 0).length;
                return (
                  <div key={tab.id} className="group flex shrink-0 items-center">
                    <button
                      type="button"
                      className={cx(
                        'whitespace-nowrap border-b-2 px-2 py-3 text-sm transition sm:px-3 sm:py-4 sm:text-base',
                        active
                          ? 'border-[#222] font-medium text-[#222]'
                          : 'border-transparent text-neutral-500 hover:text-[#222]',
                      )}
                      onClick={() => switchTab(tab.id)}
                      onDoubleClick={readOnly ? undefined : () => openRenameTab(tab)}
                      title={readOnly ? undefined : t('crm.projects.analytics.tabs.renameHint')}
                    >
                      {active && <span className="mr-1 sm:mr-2">•</span>}
                      {tabLabel(tab)}
                      {filterCount > 0 && (
                        <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                          {filterCount}
                        </span>
                      )}
                    </button>
                    {!readOnly && <button
                      type="button"
                      aria-label={t('crm.projects.analytics.tabs.menu')}
                      className={cx(
                        'rounded-md px-1.5 py-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-[#222]',
                        active || tabMenuId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
                      )}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setTabMenuPos({ left: rect.left, top: rect.bottom + 4 });
                        setTabMenuId((prev) => (prev === tab.id ? null : tab.id));
                      }}
                    >
                      ⋯
                    </button>}
                  </div>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  className="ml-1 shrink-0 whitespace-nowrap rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-[#222]"
                  onClick={openCreateTab}
                >
                  + {t('crm.projects.analytics.tabs.add')}
                </button>
              )}
            </div>
          </nav>
          {tabMenuId && tabMenuPos && (() => {
            const menuTab = tabs.find((tab) => tab.id === tabMenuId);
            if (!menuTab) return null;
            const index = tabs.indexOf(menuTab);
            const itemCls =
              'block w-full px-3 py-2 text-left text-sm text-[#222] hover:bg-neutral-50 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-transparent';
            return (
              <>
                <div className="fixed inset-0 z-[8400]" onClick={() => setTabMenuId(null)} />
                <div
                  className="fixed z-[8450] w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                  style={{ left: Math.min(tabMenuPos.left, window.innerWidth - 216), top: tabMenuPos.top }}
                >
                  <button type="button" className={itemCls} onClick={() => openRenameTab(menuTab)}>
                    {t('crm.projects.analytics.tabs.rename')}
                  </button>
                  <button type="button" className={itemCls} disabled={index <= 0} onClick={() => moveTab(menuTab.id, -1)}>
                    ← {t('crm.projects.analytics.tabs.moveLeft')}
                  </button>
                  <button
                    type="button"
                    className={itemCls}
                    disabled={index >= tabs.length - 1}
                    onClick={() => moveTab(menuTab.id, 1)}
                  >
                    {t('crm.projects.analytics.tabs.moveRight')} →
                  </button>
                  {menuTab.id !== MAIN_TAB_ID && (
                    <button
                      type="button"
                      className={cx(itemCls, 'border-t border-neutral-100 text-rose-600')}
                      onClick={() => {
                        setTabMenuId(null);
                        setTabModal({ mode: 'delete', id: menuTab.id });
                      }}
                    >
                      {t('crm.projects.analytics.tabs.delete')}
                    </button>
                  )}
                </div>
              </>
            );
          })()}

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {currencyRateMissing && (
          <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {t('crm.projects.analytics.dataCurrency.missingRate')}
          </div>
        )}

          {aiNote && !readOnly && (
            <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
              <span aria-hidden className="mt-0.5">✦</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t('crm.projects.analytics.aiBuild.noteTitle')}</div>
                <div className="mt-0.5 leading-6">{aiNote}</div>
              </div>
              <button type="button" className="text-violet-400 hover:text-violet-700" onClick={() => setAiNote(null)} aria-label="Close">
                ✕
              </button>
            </div>
          )}

          <section className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Фильтры</span>
              {globalFilters.map((filter) => (
                <div key={filter.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                  <select
                    className="bg-transparent text-neutral-500 outline-none"
                    value={filter.scope}
                    onChange={(event) =>
                      setGlobalFilters((prev) =>
                        prev.map((item) =>
                          item.id === filter.id ? { ...item, scope: event.target.value, keys: [] } : item,
                        ),
                      )
                    }
                  >
                    {dashboardFilterFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="max-w-[220px] bg-transparent font-medium outline-none"
                    value={filter.keys[0] || ''}
                    onChange={(event) =>
                      setGlobalFilters((prev) =>
                        prev.map((item) =>
                          item.id === filter.id
                            ? { ...item, keys: event.target.value ? [event.target.value] : [] }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Все</option>
                    {(dashboardValueOptionsByScope[filter.scope] || []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="text-neutral-400 hover:text-rose-600"
                    onClick={() => removeGlobalFilter(filter.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary border-dashed border-border-strong text-text-secondary"
                onClick={() => addGlobalFilter()}
              >
                + Фильтр
              </button>
              {search.trim() && (
                <span className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600">
                  Поиск: <span className="font-medium text-[#222]">{search.trim()}</span>
                  <button type="button" className="text-neutral-400 hover:text-rose-600" onClick={() => setSearch('')}>
                    ×
                  </button>
                </span>
              )}
              <div className="ml-auto hidden  text-xs uppercase tracking-[0.18em] text-neutral-400 sm:block">
                {filteredCountLabel}
              </div>
            </div>
          </section>

          {editMode && (
            <section className="flex flex-col gap-3 rounded-xl bg-[#222] px-4 py-3 text-white lg:flex-row lg:items-center">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">Режим редактирования</span>
              <span className="text-sm font-semibold">{visibleWidgets.length} блоков</span>
              <span className="font-mono text-[11px] tracking-[0.08em] text-white/45">
                перетаскивайте карточки · меняйте размер за края · настройки в карточке
              </span>
              <div className="flex-1" />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                onClick={() => setAddOpen(true)}
              >
                <Icon name="plus" size={13} />
                {t('crm.projects.analytics.addBlock')}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/20 disabled:opacity-50"
                onClick={() => setAiConfirmOpen(true)}
                disabled={aiBuilding}
              >
                {aiBuilding ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Icon name="download" size={13} />
                )}
                {aiBuilding ? 'Разбираю данные…' : 'Разобрать через АИ'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
                onClick={() => setResetOpen(true)}
              >
                {t('crm.projects.analytics.reset.button')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#222] hover:bg-white/90"
                onClick={() => setEditMode(false)}
              >
                Сохранить дашборд
              </button>
            </section>
          )}

          {visibleWidgets.length === 0 && readOnly ? (
            <div className="flex min-h-[180px] w-full items-center justify-center rounded-[18px] border border-dashed border-neutral-300 bg-white/50 text-sm text-neutral-500">
              {t('crm.projects.analytics.share.emptyTab')}
            </div>
          ) : visibleWidgets.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setEditMode(true);
                setAddOpen(true);
              }}
              className="flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-neutral-300 bg-white/50 text-sm text-neutral-500 transition hover:border-[#222] hover:bg-white hover:text-[#222]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current">
                <Icon name="plus" size={16} />
              </span>
              <span className="font-medium text-[#222]">{t('crm.projects.analytics.addBlock')}</span>
              <span className="text-xs text-neutral-500">{t('crm.projects.analytics.empty')}</span>
            </button>
          ) : (
            <div
              ref={gridRef}
              className={cx(
                'grid min-h-[600px] grid-cols-12 gap-3 rounded-xl sm:gap-4',
                editMode &&
                  'bg-[linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] bg-[length:8.333%_72px]',
              )}
            >
              {renderedWidgets.map((w) => {
                const isResizing = live?.id === w.id;
                const isDragging = dragId === w.id;
                const widgetHeight = isResizing ? live.height : w.height ?? getDefaultHeight(w.size, w.type);
                const currentSpan = isResizing ? live.span : widgetSpan(w);
                const startResize = (axis: 'x' | 'y' | 'both') => (e: React.PointerEvent<HTMLElement>) =>
                  beginResize(e, w.id, axis, {
                    span: widgetSpan(w),
                    height: w.height ?? getDefaultHeight(w.size, w.type),
                  });
                return (
                  <div
                    key={w.id}
                    data-block-id={w.id}
                    style={{
                      height: widgetHeight,
                      minHeight: Math.max(MIN_WIDGET_H, widgetHeight),
                      gridColumn: isMobile ? 'span 12' : `span ${currentSpan}`,
                    }}
                    className={cx(
                      'group relative isolate flex flex-col overflow-hidden rounded-[18px] border bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)]',
                      !isResizing && 'transition-[border-color]',
                      isDragging
                        ? 'border-2 border-dashed border-blue-400 bg-blue-50/60 shadow-none [&>*]:opacity-0'
                        : isResizing
                          ? 'border-[#222] ring-1 ring-[#222]'
                          : 'border-neutral-200 hover:border-neutral-300',
                      editMode && 'pt-7',
                    )}
                  >
                    {editMode && (
                      <button
                        type="button"
                        data-export-ignore
                        className="absolute left-0 right-0 top-0 flex h-6 cursor-grab touch-none items-center justify-center rounded-t-[18px] bg-gradient-to-b from-neutral-100 to-transparent text-neutral-400 active:cursor-grabbing"
                        onPointerDown={(event) => beginDrag(event, w.id)}
                        aria-label="Перетащить блок"
                      >
                        <Icon name="drag" size={13} />
                      </button>
                    )}
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#222]">
                          {w.title}
                        </div>
                      </div>
                      <div
                        data-export-ignore
                        className={cx(
                          'flex shrink-0 items-center gap-1 text-neutral-400 transition-opacity',
                          readOnly && 'hidden',
                          editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            requestAddDashboardPreset({
                              source: dashboardPresetSource,
                              slug: w.id,
                              widgetConfig: { ...w, nativeFilters: globalFilters },
                              sourceRef: dashboardPresetRef,
                            });
                            setAddedToHomeToast(true);
                            window.setTimeout(() => setAddedToHomeToast(false), 2800);
                          }}
                          className="btn-ghost px-2 py-1 text-[10px] font-semibold text-[#222]"
                          title={t('crm.dashboard.addToHomeFromAnalytics')}
                        >
                          На главную
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditWidget(w)}
                          className="btn-icon"
                          title={t('crm.projects.analytics.actions.edit')}
                        >
                          <Icon name="settings" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateWidget(w.id)}
                          className="btn-icon"
                          title="Дублировать"
                        >
                          <Icon name="copy" size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(w.id)}
                          className="btn-icon-danger"
                          title={t('crm.projects.analytics.actions.remove')}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">{renderWidget(w)}</div>

                    {isResizing && (
                      <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-md bg-[#222] px-2 py-1 font-mono text-[10px] text-white shadow">
                        {live.span}/12 · {Math.round(live.height)}px
                      </div>
                    )}

                    {editMode && !isMobile && (
                      <>
                        <div
                          onPointerDown={startResize('x')}
                          className="absolute -right-1.5 top-6 bottom-6 z-10 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                          title={t('crm.projects.analytics.resize.width')}
                        >
                          <div className="h-10 w-1.5 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <div
                          onPointerDown={startResize('y')}
                          className="absolute -bottom-1.5 left-6 right-6 z-10 flex h-3 cursor-ns-resize touch-none items-center justify-center"
                          title={t('crm.projects.analytics.resize.height')}
                        >
                          <div className="h-1.5 w-10 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <button
                          type="button"
                          className="absolute bottom-0 right-0 z-10 flex h-7 w-7 cursor-nwse-resize touch-none items-end justify-end p-1 text-neutral-300 hover:text-[#222]"
                          onPointerDown={startResize('both')}
                          title={t('crm.projects.analytics.resize.both')}
                        >
                          <Icon name="resize" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {editMode && (
                <button
                  type="button"
                  className="col-span-12 flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-neutral-300 bg-white/50 text-sm text-neutral-500 transition hover:border-[#222] hover:bg-white hover:text-[#222] md:col-span-6"
                  onClick={() => setAddOpen(true)}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current">
                    <Icon name="plus" size={16} />
                  </span>
                  <span className="font-medium text-[#222]">{t('crm.projects.analytics.addBlock')}</span>
                  <span className="text-xs text-neutral-500">KPI, графики, таблицы, формулы</span>
                </button>
              )}
            </div>
          )}
        </div>

        {(addOpen || editOpen) && (
          <div className="fixed inset-0 z-[8500] overflow-y-auto overscroll-y-contain bg-black/40 p-6 backdrop-blur-sm">
            <div className="flex min-h-full justify-center">
              <div
                role="dialog"
                aria-modal="true"
                className="my-auto flex max-h-[calc(100vh-64px)] w-[min(940px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                      {t('crm.projects.analytics.constructor.kicker')}
                    </div>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#222]">
                      {isEditing
                        ? t('crm.projects.analytics.modal.editTitle')
                        : t('crm.projects.analytics.modal.addTitle')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-icon p-2 rounded-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
                  <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {t('crm.projects.analytics.modal.type')}
                  </label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as WidgetType)}
                    className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                  >
                    {widgetTypeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {draftType === 'metric' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.modal.data')}
                    </label>
                    <select
                      value={draftMetric}
                      onChange={(e) => setDraftMetric(e.target.value as MetricKey)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      {metricOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isChartWidgetType(draftType) && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.modal.data')}
                      </label>
                      <select
                        value={draftChart}
                        onChange={(e) => setDraftChart(e.target.value as ChartKey)}
                        className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                      >
                        {optionsWithCurrent(chartOptions, String(draftChart)).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {renderDimensionHint(String(draftChart))}
                    </div>
                  </div>
                )}

                {draftType === 'note' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.noteText.label')}
                    </label>
                    <textarea
                      value={draftNoteText}
                      onChange={(e) => setDraftNoteText(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder={t('crm.projects.analytics.noteText.placeholder')}
                      className="w-full rounded-xl bg-slate-100 border border-slate-200 px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                )}

                {draftType === 'map' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.map.mode')}
                    </label>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {(['countries', 'points'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={mode === 'points' && !mapGeocoder}
                          onClick={() => {
                            setDraftMapMode(mode);
                            const pick = pickMapDimension(mode);
                            if (pick) setDraftChart(pick as ChartKey);
                          }}
                          className={cx(
                            'rounded-xl border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-40',
                            draftMapMode === mode ? 'border-[#222] bg-slate-50' : 'border-slate-200 hover:border-slate-300',
                          )}
                        >
                          <span className="block font-medium text-[#222]">{t(`crm.projects.analytics.map.modes.${mode}`)}</span>
                          <span className="block text-[11px] text-slate-500">{t(`crm.projects.analytics.map.modes.${mode}Hint`)}</span>
                        </button>
                      ))}
                    </div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.map.scope')}
                    </label>
                    <select
                      value={draftMapScope}
                      onChange={(e) => setDraftMapScope(e.target.value)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      <optgroup label={t('crm.projects.analytics.map.regions')}>
                        {REGION_SCOPES.map((scope) => (
                          <option key={scope} value={scope}>
                            {t(`crm.projects.analytics.map.scopes.${scope}`)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t('crm.projects.analytics.map.countries')}>
                        {mapCountryOptions.map((option) => (
                          <option key={option.iso} value={`country:${option.iso}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">
                      {draftMapMode === 'points' ? t('crm.projects.analytics.map.pointsHint') : t('crm.projects.analytics.map.hint')}
                    </p>
                  </div>
                )}

                {draftType === 'table' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.modal.data')}
                      </label>
                      <select
                        value={draftTable}
                        onChange={(e) => {
                          const v = e.target.value as TableKey;
                          setDraftTable(v);
                          if (v === 'projects') {
                            setDraftTableDimensions([]);
                          } else if (String(v).startsWith('field:')) {
                            setDraftTableDimensions((prev) =>
                              prev.length ? [v, ...prev.slice(1)] : [v],
                            );
                          }
                        }}
                        className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                      >
                        {optionsWithCurrent(tableOptions, String(draftTable)).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isWorkspaceMode && String(draftTable).startsWith('field:') && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                          {t('crm.projects.analytics.tableMulti.extraSection')}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          {t('crm.projects.analytics.tableMulti.extraHint')}
                        </p>
                        {draftTableDimensions.slice(1).map((dimId, j) => {
                          const colIndex = j + 2;
                          return (
                            <div key={`${dimId}-${j}`} className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] text-slate-500 shrink-0">
                                {t('crm.projects.analytics.tableMulti.columnN', { n: colIndex })}
                              </span>
                              <select
                                value={dimId}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setDraftTableDimensions((prev) => {
                                    const next = [...prev];
                                    next[colIndex - 1] = v;
                                    return next;
                                  });
                                }}
                                className="flex-1 min-w-[140px] h-9 rounded-xl bg-white border border-slate-200 px-2 text-[11px] outline-none"
                              >
                                {chartOptions.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftTableDimensions((prev) =>
                                    prev.filter((_, idx) => idx !== colIndex - 1),
                                  )
                                }
                                className="text-[10px] text-slate-400 hover:text-rose-500 shrink-0"
                              >
                                {t('crm.projects.analytics.tableMulti.removeColumn')}
                              </button>
                            </div>
                          );
                        })}
                        {draftTableDimensions.length < TABLE_MAX_DIMENSIONS && (
                          <button
                            type="button"
                            onClick={() =>
                              setDraftTableDimensions((prev) => {
                                const used = new Set(prev);
                                const pick =
                                  chartOptions.find((c) => !used.has(c.id))?.id ??
                                  chartOptions[0]?.id ??
                                  draftTable;
                                return [...prev, pick];
                              })
                            }
                            className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                          >
                            + {t('crm.projects.analytics.tableMulti.addColumn')}
                          </button>
                        )}
                        <p className="text-[10px] text-slate-400">
                          {t('crm.projects.analytics.tableMulti.maxColumnsHint', {
                            max: TABLE_MAX_DIMENSIONS,
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(isChartWidgetType(draftType) || (draftType === 'table' && draftTable !== 'projects')) && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.modal.valueMetric')}
                      </label>
                      <select
                        value={draftChartValueMode}
                        onChange={(e) => setDraftChartValueMode(e.target.value as ChartValueMode)}
                        className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                      >
                        <option value="count">{t('crm.projects.analytics.modal.valueMode.count')}</option>
                        <option value="sum">{t('crm.projects.analytics.modal.valueMode.sum')}</option>
                      </select>
                    </div>
                    {draftChartValueMode === 'sum' && (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          {t('crm.projects.analytics.modal.sumField')}
                        </label>
                        <select
                          value={draftChartValueField}
                          onChange={(e) => setDraftChartValueField(e.target.value)}
                          className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                        >
                          {!isWorkspaceMode && <option value="amount">{t('crm.projects.analytics.table.headers.amount')}</option>}
                          {(dynamicNumericFields.length
                            ? dynamicNumericFields
                            : isWorkspaceMode
                              ? analyticsFields
                              : inferredNumericCustomFields
                          ).map((field) => (
                            <option key={field.key} value={`field:${field.key}`}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {draftType === 'formula' && (
                  <div className="space-y-3">
                    {(() => {
                      const previewUsingCompareSides =
                        isWideMonthlyTable &&
                        (draftFormulaFn === 'diff' || draftFormulaFn === 'ratio') &&
                        draftCompareSides.length >= 2;
                      const previewHeight = 168;
                      const previewWidget: WidgetConfig = {
                        id: '__preview__',
                        type: 'formula',
                        title: draftTitle || t('crm.projects.analytics.widgets.defaultTitle'),
                        size: sizeFromSpan(draftSpan),
                        span: draftSpan,
                        height: previewHeight,
                        themeKey: draftTheme,
                        formulaFn: draftFormulaFn,
                        formulaLeftType: previewUsingCompareSides
                          ? buildSumMonthsType(draftCompareSides[0]?.monthKeys || [])
                          : draftFormulaLeftType,
                        formulaLeftKey: draftFormulaLeftKey,
                        formulaRightType: previewUsingCompareSides
                          ? buildSumMonthsType(draftCompareSides[1]?.monthKeys || [])
                          : draftFormulaRightType,
                        formulaRightKey: draftFormulaRightKey,
                        formulaLeftMeasure: draftFormulaLeftMeasure,
                        formulaRightMeasure: draftFormulaRightMeasure,
                        formulaMode: draftFormulaMode,
                        formulaFilters: draftFormulaFilters,
                        compareDisplay: draftCompareDisplay,
                        compareSides: previewUsingCompareSides ? draftCompareSides : undefined,
                      };
                      return (
                        <div className="rounded-2xl border border-slate-200 bg-white p-3" style={{ height: previewHeight }}>
                          <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                            Предпросмотр
                          </div>
                          <div className="min-h-0" style={{ height: previewHeight - 34 }}>
                            {renderWidget(previewWidget)}
                          </div>
                        </div>
                      );
                    })()}
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.formula.fn.label')}
                      </label>
                      <select
                        value={draftFormulaFn}
                        onChange={(e) => setDraftFormulaFn(e.target.value as FormulaFn)}
                        className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                      >
                        {formulaFunctionOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {draftFormulaFn === 'sumif' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {t('crm.projects.analytics.formula.block.sumif')}
                        </div>
                        {draftFormulaFilters.length === 0 ? (
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {t('crm.projects.analytics.blockConditions.emptyHintFormula')}
                          </p>
                        ) : null}
                        {draftFormulaFilters.map((filter, index) => (
                          <div
                            key={`${filter.scope}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {t('crm.projects.analytics.formula.condition.label')} {index + 1}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftFormulaFilters((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  )
                                }
                                className="text-[10px] text-slate-400 hover:text-rose-500"
                              >
                                {t('crm.projects.analytics.formula.condition.remove')}
                              </button>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                {t('crm.projects.analytics.formula.filter.scope')}
                              </label>
                              <select
                                value={filter.scope}
                                onChange={(e) => {
                                  const scope = e.target.value as FormulaScope;
                                  setDraftFormulaFilters((prev) => {
                                    const next = [...prev];
                                    next[index] = { scope, keys: [] };
                                    return next;
                                  });
                                }}
                                className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                              >
                                {formulaScopeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <AnalyticsFilterKeysPicker
                                list={
                                  (formulaValueItems[filter.scope]?.length
                                    ? formulaValueItems[filter.scope]
                                    : formulaValueFallback
                                  ) as FilterValueOption[]
                                }
                                keys={filter.keys || []}
                                onChange={(keys) =>
                                  setDraftFormulaFilters((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], keys };
                                    return next;
                                  })
                                }
                                allLabel={t('crm.projects.analytics.blockConditions.allValues')}
                                multiHint={t('crm.projects.analytics.blockConditions.multiHint')}
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftFormulaFilters((prev) => [...prev, { ...defaultFormulaFilterRow }])
                          }
                          className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                        >
                          + {t('crm.projects.analytics.formula.condition.add')}
                        </button>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            {t('crm.projects.analytics.formula.output.label')}
                          </label>
                          <select
                            value={draftFormulaMode}
                            onChange={(e) =>
                              setDraftFormulaMode(e.target.value as FormulaMode)
                            }
                            className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                          >
                            {formulaModeOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {draftFormulaMode === 'sum' && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Поле суммы
                            </label>
                            <select
                              value={draftFormulaLeftType}
                              onChange={(e) =>
                                setDraftFormulaLeftType(e.target.value as FormulaOperandType)
                              }
                              className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                            >
                              {(formulaOperandOptions.filter((opt) => opt.id.startsWith('sum:')).length
                                ? formulaOperandOptions.filter((opt) => opt.id.startsWith('sum:'))
                                : [{ id: 'total', label: t('crm.projects.analytics.kpis.total') }]
                              ).map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {isWideMonthlyTable && (
                          <>
                            {draftFormulaMode !== 'sum' && (
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  {t('crm.projects.analytics.formula.left.label')}
                                </label>
                                <select
                                  value={draftFormulaLeftType}
                                  onChange={(e) =>
                                    setDraftFormulaLeftType(e.target.value as FormulaOperandType)
                                  }
                                  className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                >
                                  {(monthOperandOptions.length
                                    ? monthOperandOptions
                                    : [{ id: 'total', label: t('crm.projects.analytics.kpis.total') }]
                                  ).map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <label className="block text-[11px] text-slate-500">
                                  {t('crm.projects.analytics.formula.right.label')}
                                </label>
                                <button
                                  type="button"
                                  onClick={swapFormulaLeftRight}
                                  title="Поменять местами левую и правую часть"
                                  className="text-[13px] leading-none text-slate-400 hover:text-slate-700"
                                >
                                  ⇄
                                </button>
                              </div>
                              <select
                                value={draftFormulaRightType}
                                onChange={(e) =>
                                  setDraftFormulaRightType(e.target.value as FormulaOperandType)
                                }
                                className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                              >
                                {(monthOperandOptions.length
                                  ? monthOperandOptions
                                  : [{ id: 'total', label: t('crm.projects.analytics.kpis.total') }]
                                ).map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {!monthOperandOptions.length && (
                                <p className="mt-1 text-[10px] text-amber-600">
                                  Нет месячных полей — график сравнения будет недоступен.
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                Как показать сравнение
                              </label>
                              <select
                                value={draftCompareDisplay}
                                onChange={(e) => {
                                  const next = e.target.value as CompareDisplay;
                                  setDraftCompareDisplay(next);
                                  if (
                                    next !== 'number' &&
                                    !(isMonthOperand(draftFormulaLeftType) && isMonthOperand(draftFormulaRightType))
                                  ) {
                                    const picked = pickTwoRecentMonthKeys();
                                    if (picked) {
                                      setDraftFormulaLeftType(picked[0]);
                                      setDraftFormulaRightType(picked[1]);
                                    }
                                  }
                                }}
                                className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                              >
                                <option value="number">Только число</option>
                                <option value="bar">Столбцы</option>
                                <option value="line">Линия</option>
                                <option value="donut">Пончик</option>
                                <option value="table">Таблица</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {draftFormulaFn !== 'sumif' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {t('crm.projects.analytics.formula.block.expression')}
                        </div>
                        {isWideMonthlyTable && (draftFormulaFn === 'diff' || draftFormulaFn === 'ratio') ? (
                          <div className="space-y-3">
                            <label className="block text-[11px] text-slate-500 mb-1">Стороны сравнения</label>
                            {draftCompareSides.map((side, idx) => (
                              <div key={side.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-slate-600">
                                    {COMPARE_SIDE_ORDINALS[idx] || `Сторона ${idx + 1}`}
                                  </span>
                                  {draftCompareSides.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraftCompareSides((prev) => prev.filter((s) => s.id !== side.id))
                                      }
                                      className="text-[11px] text-red-500 hover:underline"
                                    >
                                      Удалить
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  placeholder={describeCompareSide(side)}
                                  value={side.label || ''}
                                  onChange={(e) =>
                                    setDraftCompareSides((prev) =>
                                      prev.map((s) => (s.id === side.id ? { ...s, label: e.target.value } : s)),
                                    )
                                  }
                                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs outline-none"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                  {V2_PALETTE.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      onClick={() =>
                                        setDraftCompareSides((prev) =>
                                          prev.map((s) => (s.id === side.id ? { ...s, color } : s)),
                                        )
                                      }
                                      className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                                        side.color === color
                                          ? 'border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)]'
                                          : 'border-slate-200'
                                      }`}
                                    >
                                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
                                    </button>
                                  ))}
                                </div>
                                <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                                  {[...monthFieldDates.entries()]
                                    .sort((a, b) => a[1].getTime() - b[1].getTime())
                                    .map(([key]) => {
                                      const checked = side.monthKeys.includes(key);
                                      return (
                                        <label key={key} className="flex items-center gap-2 text-xs text-slate-600">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => {
                                              const next = e.target.checked
                                                ? [...side.monthKeys, key]
                                                : side.monthKeys.filter((k) => k !== key);
                                              setDraftCompareSides((prev) =>
                                                prev.map((s) => (s.id === side.id ? { ...s, monthKeys: next } : s)),
                                              );
                                            }}
                                          />
                                          {analyticsFieldMap.get(key)?.label || key}
                                        </label>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setDraftCompareSides((prev) => [...prev, makeCompareSide(prev.length)])
                              }
                              className="text-xs font-medium text-slate-600 hover:text-[#222]"
                            >
                              + Добавить сторону
                            </button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                {t('crm.projects.analytics.formula.left.label')}
                              </label>
                              <select
                                value={operandSelectValue(draftFormulaLeftType)}
                                onChange={(e) =>
                                  setDraftFormulaLeftType(
                                    operandFromSelect(e.target.value, draftFormulaLeftType) as FormulaOperandType,
                                  )
                                }
                                className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                              >
                                {formulaOperandOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {renderGroupOperandPicker(draftFormulaLeftType, (next) =>
                                setDraftFormulaLeftType(next as FormulaOperandType),
                              )}
                            </div>
                            {Boolean(formulaValueItems[draftFormulaLeftType]) && (
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  {t('crm.projects.analytics.formula.left.value')}
                                </label>
                                <select
                                  value={draftFormulaLeftKey}
                                  onChange={(e) => setDraftFormulaLeftKey(e.target.value)}
                                  className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                >
                                  {(formulaValueItems[
                                    draftFormulaLeftType as FormulaScope
                                  ].length
                                    ? formulaValueItems[
                                        draftFormulaLeftType as FormulaScope
                                      ]
                                    : formulaValueFallback
                                  ).map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {draftFormulaLeftType.startsWith('field:') && formulaMeasureOptions.length > 1 && (
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  {t('crm.projects.analytics.formula.measure.label', { defaultValue: 'Что считать' })}
                                </label>
                                <select
                                  value={draftFormulaLeftMeasure}
                                  onChange={(e) => setDraftFormulaLeftMeasure(e.target.value)}
                                  className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                >
                                  {formulaMeasureOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {(draftFormulaFn === 'ratio' ||
                              draftFormulaFn === 'diff' ||
                              draftFormulaFn === 'count' ||
                              draftFormulaFn === 'percent') && (
                              <>
                                <div>
                                  <div className="mb-1 flex items-center justify-between">
                                    <label className="block text-[11px] text-slate-500">
                                      {t('crm.projects.analytics.formula.right.label')}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={swapFormulaLeftRight}
                                      title="Поменять местами левую и правую часть"
                                      className="text-[13px] leading-none text-slate-400 hover:text-slate-700"
                                    >
                                      ⇄
                                    </button>
                                  </div>
                                  <select
                                    value={operandSelectValue(draftFormulaRightType)}
                                    onChange={(e) =>
                                      setDraftFormulaRightType(
                                        operandFromSelect(e.target.value, draftFormulaRightType) as FormulaOperandType,
                                      )
                                    }
                                    className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                  >
                                    {(draftFormulaFn === 'count' || draftFormulaFn === 'percent'
                                      ? monthOperandOptions
                                      : formulaOperandOptions
                                    ).map((opt) => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {(draftFormulaFn === 'count' || draftFormulaFn === 'percent') &&
                                    !monthOperandOptions.length && (
                                      <p className="mt-1 text-[10px] text-amber-600">
                                        Нет месячных полей — график сравнения будет недоступен.
                                      </p>
                                    )}
                                  {renderGroupOperandPicker(draftFormulaRightType, (next) =>
                                    setDraftFormulaRightType(next as FormulaOperandType),
                                  )}
                                </div>
                                {Boolean(formulaValueItems[draftFormulaRightType]) && (
                                  <div>
                                    <label className="block text-[11px] text-slate-500 mb-1">
                                      {t('crm.projects.analytics.formula.right.value')}
                                    </label>
                                    <select
                                      value={draftFormulaRightKey}
                                      onChange={(e) => setDraftFormulaRightKey(e.target.value)}
                                      className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                    >
                                      {(formulaValueItems[
                                        draftFormulaRightType as FormulaScope
                                      ].length
                                        ? formulaValueItems[
                                            draftFormulaRightType as FormulaScope
                                          ]
                                        : formulaValueFallback
                                      ).map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                {draftFormulaRightType.startsWith('field:') && formulaMeasureOptions.length > 1 && (
                                  <div>
                                    <label className="block text-[11px] text-slate-500 mb-1">
                                      {t('crm.projects.analytics.formula.measure.label', { defaultValue: 'Что считать' })}
                                    </label>
                                    <select
                                      value={draftFormulaRightMeasure}
                                      onChange={(e) => setDraftFormulaRightMeasure(e.target.value)}
                                      className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                                    >
                                      {formulaMeasureOptions.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                        {isWideMonthlyTable && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Как показать сравнение
                            </label>
                            <select
                              value={draftCompareDisplay}
                              onChange={(e) => {
                                const next = e.target.value as CompareDisplay;
                                setDraftCompareDisplay(next);
                                if (
                                  next !== 'number' &&
                                  !(isMonthOperand(draftFormulaLeftType) && isMonthOperand(draftFormulaRightType))
                                ) {
                                  const picked = pickTwoRecentMonthKeys();
                                  if (picked) {
                                    setDraftFormulaLeftType(picked[0]);
                                    setDraftFormulaRightType(picked[1]);
                                  }
                                }
                              }}
                              className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                            >
                              <option value="number">Только число</option>
                              <option value="bar">Столбцы</option>
                              <option value="line">Линия</option>
                              <option value="donut">Пончик</option>
                              <option value="table">Таблица</option>
                            </select>
                          </div>
                        )}
                        {(draftFormulaFn === 'count' || draftFormulaFn === 'diff') && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              {t('crm.projects.analytics.formula.output.label')}
                            </label>
                            <select
                              value={draftFormulaFn === 'diff' && draftFormulaMode === 'sum' ? 'count' : draftFormulaMode}
                              onChange={(e) =>
                                setDraftFormulaMode(e.target.value as FormulaMode)
                              }
                              className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                            >
                              {(draftFormulaFn === 'diff'
                                ? [
                                    { id: 'count', label: t('crm.projects.analytics.formula.diffOutput.value', { defaultValue: 'Разница (число)' }) },
                                    { id: 'percent', label: t('crm.projects.analytics.formula.diffOutput.percent', { defaultValue: '% изменения относительно правой части' }) },
                                  ]
                                : formulaModeOptions
                              ).map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {draftType === 'pivot' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {t('crm.projects.analytics.pivot.section')}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.pivot.rowDim')}
                      </label>
                      <select
                        value={draftPivotRowKey}
                        onChange={(e) => setDraftPivotRowKey(e.target.value)}
                        className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                      >
                        {optionsWithCurrent(chartOptions, draftPivotRowKey).map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.projects.analytics.pivot.colDim')}
                      </label>
                      <select
                        value={draftPivotColKey}
                        onChange={(e) => setDraftPivotColKey(e.target.value)}
                        className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                      >
                        {optionsWithCurrent(chartOptions, draftPivotColKey).map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        {t('crm.projects.analytics.pivot.measures')}
                      </div>
                      {draftPivotMeasures.map((m, mi) => (
                        <div
                          key={m.id}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center"
                        >
                          <select
                            value={m.mode}
                            onChange={(e) => {
                              const mode = e.target.value as ChartValueMode;
                              setDraftPivotMeasures((prev) => {
                                const next = [...prev];
                                next[mi] = {
                                  ...next[mi],
                                  mode,
                                  valueField: mode === 'sum' ? next[mi].valueField || 'amount' : undefined,
                                };
                                return next;
                              });
                            }}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-[11px] outline-none"
                          >
                            <option value="count">{t('crm.projects.analytics.modal.valueMode.count')}</option>
                            <option value="sum">{t('crm.projects.analytics.modal.valueMode.sum')}</option>
                          </select>
                          {m.mode === 'sum' && (
                            <select
                              value={m.valueField || 'amount'}
                              onChange={(e) => {
                                const valueField = e.target.value;
                                setDraftPivotMeasures((prev) => {
                                  const next = [...prev];
                                  next[mi] = { ...next[mi], valueField };
                                  return next;
                                });
                              }}
                              className="h-9 flex-1 min-w-[120px] rounded-lg border border-slate-200 px-2 text-[11px] outline-none"
                            >
                              {pivotMeasureFieldOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            value={m.shortLabel ?? ''}
                            placeholder={t('crm.projects.analytics.pivot.shortLabelPlaceholder')}
                            onChange={(e) => {
                              const shortLabel = e.target.value;
                              setDraftPivotMeasures((prev) => {
                                const next = [...prev];
                                next[mi] = { ...next[mi], shortLabel };
                                return next;
                              });
                            }}
                            className="h-9 flex-1 min-w-[100px] rounded-lg border border-slate-200 px-2 text-[11px] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDraftPivotMeasures((prev) =>
                                prev.length <= 1 ? prev : prev.filter((_, i) => i !== mi),
                              )
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-500 self-start sm:self-center"
                          >
                            {t('crm.projects.analytics.formula.condition.remove')}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        disabled={draftPivotMeasures.length >= PIVOT_MAX_MEASURES}
                        onClick={() =>
                          setDraftPivotMeasures((prev) => [
                            ...prev,
                            { id: `pv-${Date.now()}`, mode: 'count' },
                          ])
                        }
                        className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700 disabled:opacity-40"
                      >
                        + {t('crm.projects.analytics.pivot.addMeasure')}
                      </button>
                    </div>
                  </div>
                )}

                {draftType !== 'formula' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      {t('crm.projects.analytics.blockConditions.title')}
                    </div>
                    {draftFormulaFilters.length === 0 ? (
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {t('crm.projects.analytics.blockConditions.emptyHint')}
                      </p>
                    ) : null}
                    {draftFormulaFilters.map((filter, index) => (
                      <div
                        key={`${filter.scope}-${index}`}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                            {t('crm.projects.analytics.blockConditions.conditionLabel', {
                              n: index + 1,
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftFormulaFilters((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="text-[10px] text-slate-400 hover:text-rose-500"
                          >
                            {t('crm.projects.analytics.formula.condition.remove')}
                          </button>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            {t('crm.projects.analytics.formula.filter.scope')}
                          </label>
                          <select
                            value={filter.scope}
                            onChange={(e) => {
                              const scope = e.target.value as FormulaScope;
                              setDraftFormulaFilters((prev) => {
                                const next = [...prev];
                                next[index] = { scope, keys: [] };
                                return next;
                              });
                            }}
                            className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                          >
                            {formulaScopeOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <AnalyticsFilterKeysPicker
                          list={
                            (formulaValueItems[filter.scope]?.length
                              ? formulaValueItems[filter.scope]
                              : formulaValueFallback
                            ) as FilterValueOption[]
                          }
                          keys={filter.keys || []}
                          onChange={(keys) =>
                            setDraftFormulaFilters((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], keys };
                              return next;
                            })
                          }
                          allLabel={t('crm.projects.analytics.blockConditions.allValues')}
                          multiHint={t('crm.projects.analytics.blockConditions.multiHint')}
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setDraftFormulaFilters((prev) => [...prev, { ...defaultFormulaFilterRow }])
                      }
                      className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                    >
                      + {t('crm.projects.analytics.formula.condition.add')}
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {t('crm.projects.analytics.modal.theme')}
                  </label>
                  <div className="flex items-center gap-2">
                    {THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setDraftTheme(preset.key)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                          draftTheme === preset.key
                            ? 'border-slate-900 shadow-[0_0_0_2px_rgba(15,23,42,0.1)]'
                            : 'border-slate-200'
                        }`}
                        title={preset.label}
                      >
                        <span
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: preset.primary }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {draftType === 'donut' && (
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-[11px] text-slate-600">
                      {t('crm.projects.analytics.modal.showLabels')}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftShowLabels((prev) => !prev)}
                      className={`relative h-6 w-11 rounded-full transition ${
                        draftShowLabels ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                      aria-pressed={draftShowLabels}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                          draftShowLabels ? 'left-5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.modal.title')}
                    </label>
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Колонки
                    </label>
                    <select
                      value={draftSpan}
                      onChange={(e) => {
                        const span = Number(e.target.value);
                        setDraftSpan(span);
                        setDraftSize(sizeFromSpan(span));
                      }}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((span) => (
                        <option key={span} value={span}>
                          {span}/12
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 border-t border-neutral-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {isEditing && editingWidgetId && (
                      <button
                        type="button"
                        onClick={() => {
                          const w = widgets.find((x) => x.id === editingWidgetId);
                          if (w) {
                            requestAddDashboardPreset({
                              source: dashboardPresetSource,
                              slug: w.id,
                              widgetConfig: { ...w, nativeFilters: globalFilters },
                              sourceRef: dashboardPresetRef,
                            });
                            setAddedToHomeToast(true);
                            window.setTimeout(() => setAddedToHomeToast(false), 2800);
                          }
                          closeModal();
                        }}
                        className="btn-secondary"
                      >
                        {t('crm.dashboard.addToHomeFromAnalytics')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn-secondary"
                    >
                      {t('crm.projects.analytics.actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={saveWidget}
                      className="btn-primary"
                    >
                      {isEditing
                        ? t('crm.projects.analytics.actions.save')
                        : t('crm.projects.analytics.actions.add')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {reportOpen && workspaceObjectId && (
          <AnalyticsReportEmailModal
            objectId={workspaceObjectId}
            objectName={reportObjectName}
            blocks={visibleWidgets.map((w) => ({ id: w.id, title: w.title }))}
            getBlockElement={(id) =>
              (gridRef.current?.querySelector(`[data-block-id="${CSS.escape(id)}"]`) as HTMLElement | null) ?? null
            }
            tabName={tabLabel(activeTab)}
            periodLabel={periodRangeLabel}
            currency={reportCurrency}
            onClose={() => setReportOpen(false)}
          />
        )}
        {shareModalOpen && workspaceObjectId && (
          <WorkspaceShareModal objectId={workspaceObjectId} onClose={() => setShareModalOpen(false)} />
        )}
        {tabModal && (() => {
          const deletingTab = tabModal.mode === 'delete' ? tabs.find((tab) => tab.id === tabModal.id) : null;
          const sources: Array<{ id: NewTabSource; label: string; hint: string }> = [
            { id: 'empty', label: t('crm.projects.analytics.tabs.sourceEmpty'), hint: t('crm.projects.analytics.tabs.sourceEmptyHint') },
            { id: 'copy', label: t('crm.projects.analytics.tabs.sourceCopy'), hint: t('crm.projects.analytics.tabs.sourceCopyHint') },
            { id: 'default', label: t('crm.projects.analytics.tabs.sourceDefault'), hint: t('crm.projects.analytics.tabs.sourceDefaultHint') },
          ];
          return (
            <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
              <form
                className="w-full max-w-md rounded-2xl bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.18)]"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitTabModal();
                }}
              >
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#222]">
                  {tabModal.mode === 'create'
                    ? t('crm.projects.analytics.tabs.createTitle')
                    : tabModal.mode === 'rename'
                      ? t('crm.projects.analytics.tabs.renameTitle')
                      : t('crm.projects.analytics.tabs.deleteTitle')}
                </h3>
                {tabModal.mode === 'delete' ? (
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {t('crm.projects.analytics.tabs.deleteMessage', { name: deletingTab ? tabLabel(deletingTab) : '' })}
                  </p>
                ) : (
                  <>
                    <label className="mt-4 block text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
                      {t('crm.projects.analytics.tabs.name')}
                    </label>
                    <input
                      autoFocus
                      value={tabDraftName}
                      maxLength={60}
                      onChange={(event) => setTabDraftName(event.target.value)}
                      placeholder={t('crm.projects.analytics.tabs.namePlaceholder')}
                      className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
                    />
                    {tabModal.mode === 'create' && (
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
                          {t('crm.projects.analytics.tabs.source')}
                        </div>
                        {sources.map((source) => (
                          <label
                            key={source.id}
                            className={cx(
                              'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                              tabDraftSource === source.id ? 'border-[#222] bg-neutral-50' : 'border-neutral-200 hover:border-neutral-300',
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              checked={tabDraftSource === source.id}
                              onChange={() => setTabDraftSource(source.id)}
                            />
                            <span
                              aria-hidden
                              className={cx(
                                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition',
                                tabDraftSource === source.id ? 'border-[#222]' : 'border-neutral-300',
                              )}
                            >
                              {tabDraftSource === source.id && <span className="h-2 w-2 rounded-full bg-[#222]" />}
                            </span>
                            <span>
                              <span className="block text-sm font-medium text-[#222]">{source.label}</span>
                              <span className="block text-xs text-neutral-500">{source.hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setTabModal(null)} className="btn-secondary">
                    {t('crm.projects.analytics.tabs.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={tabModal.mode !== 'delete' && !tabDraftName.trim()}
                    className={cx('btn-primary', tabModal.mode === 'delete' && '!bg-rose-600 !border-rose-600')}
                  >
                    {tabModal.mode === 'create'
                      ? t('crm.projects.analytics.tabs.create')
                      : tabModal.mode === 'rename'
                        ? t('crm.projects.analytics.tabs.save')
                        : t('crm.projects.analytics.tabs.delete')}
                  </button>
                </div>
              </form>
            </div>
          );
        })()}
        {resetOpen && (
          <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#222]">
                {t('crm.projects.analytics.reset.title')}
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {t('crm.projects.analytics.reset.message')}
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="btn-secondary"
                >
                  {t('crm.projects.analytics.reset.cancel')}
                </button>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="btn-primary"
                >
                  {t('crm.projects.analytics.reset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
        <AiBuildDashboardModal
          open={aiConfirmOpen}
          busy={aiBuilding}
          error={aiError}
          currentBlocks={widgets.length}
          supportsMap
          replaceScope="tab"
          onClose={() => setAiConfirmOpen(false)}
          onSubmit={(input) => void buildWithAi(input)}
        />
      </div>
      {aiError && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-rose-600 px-5 py-3 text-sm text-white shadow-lg">
          {aiError}
          <button
            type="button"
            className="pointer-events-auto ml-3 underline"
            onClick={() => setAiError(null)}
          >
            Закрыть
          </button>
        </div>
      )}
      {addedToHomeToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-[#222] px-5 py-3 text-sm text-white shadow-lg">
          {t('crm.dashboard.widgets.addedToHome')}
        </div>
      )}
    </>
  );
  return readOnly ? (
    <PublicShell header={publicHeader}>{pageContent}</PublicShell>
  ) : (
    <MainLayout>{pageContent}</MainLayout>
  );
};
