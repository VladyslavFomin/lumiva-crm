// src/pages/projects/ProjectsAnalyticsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { useTranslation } from 'react-i18next';
import { requestAddDashboardPreset } from '../../dashboard/dashboardLayout';
import { notifyAnalyticsWidgetsChanged } from '../../dashboard/analyticsStorage';
import { fetchProjects } from '../../api/projects';
import type { Project } from './projectTypes';
import { AnalyticsCurrencyControl } from '../../components/AnalyticsCurrencyControl';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import {
  convertMarketingAmount,
  normalizeMarketingDisplayCurrency,
} from '../marketing/marketingDisplayCurrencyStorage';
import {
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  Line,
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
type ViewId = 'overview' | 'statuses' | 'owners' | 'categories';

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'statuses', label: 'Статусы' },
  { id: 'owners', label: 'Ответственные' },
  { id: 'categories', label: 'Категории' },
];

type WidgetType = 'metric' | 'donut' | 'bar' | 'line' | 'funnel' | 'leaderboard' | 'table' | 'heatmap' | 'note' | 'formula' | 'pivot';
type WidgetSize = 'sm' | 'md' | 'lg';
type ThemeKey = typeof THEME_PRESETS[number]['key'];

type FormulaScope = string;
type FormulaMode = 'count' | 'percent' | 'sum';
type FormulaFn = 'count' | 'percent' | 'ratio' | 'diff' | 'sumif';
type FormulaOperandType = string;
type ChartValueMode = 'count' | 'sum';

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
  formulaMode?: FormulaMode;
  formulaFilters?: FormulaFilterRow[];
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
};

type StatusChartPoint = { code: string; label: string; count: number };

type ResizeState = {
  id: string;
  startX: number;
  startY: number;
  startSize: WidgetSize;
  startSpan: number;
  startHeight: number;
  minHeight: number;
  axis: 'x' | 'y' | 'both';
};

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts);
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

const V2_PALETTE = ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319', '#cc2f47', '#5a45a8'];

function compactNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function MiniSparkline({ data, color = '#222222' }: { data: number[]; color?: string }) {
  const chartData = (data.length ? data : [0, 0, 0]).map((value, index) => ({ index, value }));
  const gradientId = `projects-spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const ALLOWED_SPANS = [3, 4, 6, 8, 12];
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

function closestSpan(value: number) {
  return ALLOWED_SPANS.reduce((best, span) =>
    Math.abs(span - value) < Math.abs(best - value) ? span : best,
  ALLOWED_SPANS[0]);
}

function isChartWidgetType(type: WidgetType) {
  return type === 'donut' || type === 'bar' || type === 'line' || type === 'funnel' || type === 'leaderboard';
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
  dashboardPresetSource?: 'projects' | 'sales' | 'leads';
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
}

export const ProjectsAnalyticsPage: React.FC<ProjectsAnalyticsPageProps> = ({
  externalItems,
  storageNamespace = 'projects_analytics',
  toolbarSlot,
  analyticsFields = EMPTY_ANALYTICS_FIELDS,
  dashboardPresetSource = 'projects',
  header,
  analyticsLabels,
  defaultWidgetsOverride,
}) => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [globalFilters, setGlobalFilters] = useState<GlobalFilterRow[]>([]);
  const [editMode, setEditMode] = useState(false);
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
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [dragWidgetId, setDragWidgetId] = useState<string | null>(null);
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
  const [draftFormulaFilters, setDraftFormulaFilters] = useState<FormulaFilterRow[]>([]);
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
  const [resetOpen, setResetOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState<Record<string, number | null>>(
    {},
  );
  const [resizing, setResizing] = useState<ResizeState | null>(null);
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

  const currenciesPresent = useMemo(
    () => Array.from(new Set(items.map((p) => (p.currency || 'EUR').toUpperCase().slice(0, 8)))),
    [items],
  );
  const { state: currencyPrefs, setState: setCurrencyPrefs } = useMarketingDisplayCurrencyPrefs(currenciesPresent);
  const reportCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const convertedItemsResult = useMemo(() => {
    const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
    const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
    let missing = false;
    const converted = items.map((p) => {
      const sourceAmount = Number(p.amount) || 0;
      const sourceCurrency = String(p.currency || 'EUR').toUpperCase().slice(0, 8) || 'EUR';
      const result = convertMarketingAmount(sourceAmount, sourceCurrency, 'converted', displayCurrency, rates);
      if (result.missingRate) missing = true;
      return { ...p, amount: result.value, currency: result.currency };
    });
    return { items: converted, missing };
  }, [items, currencyPrefs]);
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

  const periodItems = useMemo(() => {
    if (period === 'all' || period === 'custom') return searchedItems;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === '7d') cutoff.setDate(now.getDate() - 6);
    if (period === '30d') cutoff.setDate(now.getDate() - 29);
    if (period === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    return searchedItems.filter((p) => {
      const created = parseDate(p.createdAt);
      if (!created) return true;
      return created >= cutoff && created <= now;
    });
  }, [searchedItems, period]);

  const isWorkspaceMode = analyticsFields.length > 0;
  const analyticsFieldMap = useMemo(
    () => new Map(analyticsFields.map((field) => [field.key, field])),
    [analyticsFields],
  );
  const getCustomFieldValue = (item: Project, key: string) => item.customFields?.[key];

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

  const dynamicDimensionOptions = useMemo(
    () =>
      analyticsFields.map((field) => ({
        id: `field:${field.key}`,
        label: field.label || field.key,
      })),
    [analyticsFields],
  );

  const dynamicFormulaScopeOptions = useMemo(
    () =>
      analyticsFields
        .filter((field) => {
          const type = String(field.type || '').toLowerCase();
          return type !== 'date' && type !== 'datetime';
        })
        .map((field) => ({
          id: `field:${field.key}`,
          label: field.label || field.key,
        })),
    [analyticsFields],
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
    () =>
      analyticsFields.filter((field) => {
        const type = String(field.type || '').toLowerCase();
        if (['text', 'select', 'date', 'datetime'].includes(type)) return false;
        if (type === 'number') return true;
        if (numericKeyLooksMonetary(field.key, field.label || '')) {
          return true;
        }
        return filteredItems.some((item) => {
          const raw = getCustomFieldValue(item, field.key);
          if (!isFilled(raw)) return false;
          return parseNumericLoose(raw) !== null;
        });
      }),
    [analyticsFields, filteredItems],
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
    const formatted = new Intl.NumberFormat(locale).format(amount);
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
          ...analyticsFields.map((field) => ({
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
          ...analyticsFields.map((field) => ({
            id: `filled:${field.key}`,
            label: `${field.label} (filled)`,
          })),
          ...dynamicDimensionOptions,
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
    ],
  );

  const getDefaultHeight = (size: WidgetSize, type: WidgetType) => {
    if (type === 'pivot') {
      return size === 'lg' ? 420 : size === 'md' ? 360 : 320;
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
    return size === 'lg' ? 240 : size === 'md' ? 200 : 160;
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

  useEffect(() => {
    try {
      const version = localStorage.getItem(`${storageNamespace}_version`);
      const raw = localStorage.getItem(`${storageNamespace}_widgets`);
      if (raw && version === ANALYTICS_LAYOUT_VERSION) {
        const parsed = JSON.parse(raw) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(
            parsed.map((w) => migrateWidgetFromStorage(w as Record<string, unknown>)),
          );
          return;
        }
      }
    } catch {
      // ignore
    }
    setWidgets(defaultWidgets);
  }, [defaultWidgets, storageNamespace]);

  useEffect(() => {
    try {
      if (widgets.length > 0) {
        localStorage.setItem(`${storageNamespace}_widgets`, JSON.stringify(widgets));
        localStorage.setItem(`${storageNamespace}_version`, ANALYTICS_LAYOUT_VERSION);
      }
    } catch {
      // ignore
    }
  }, [widgets, storageNamespace]);

  useEffect(() => {
    notifyAnalyticsWidgetsChanged(storageNamespace);
  }, [widgets, storageNamespace]);

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
      setDraftSpan(3);
      setDraftSize('sm');
      setDraftFormulaFilters([]);
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

  const handleWidgetDrop = (targetId: string) => {
    if (!editMode || !dragWidgetId || dragWidgetId === targetId) return;
    setWidgets((prev) => {
      const next = [...prev];
      const from = next.findIndex((w) => w.id === dragWidgetId);
      const to = next.findIndex((w) => w.id === targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragWidgetId(null);
  };

  const removeWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const addWidget = () => {
    const id = `${draftType}-${Date.now()}`;
    const next: WidgetConfig = {
      id,
      type: draftType,
      title: draftTitle || t('crm.projects.analytics.widgets.defaultTitle'),
      size: sizeFromSpan(draftSpan),
      span: draftSpan,
      height: getDefaultHeight(sizeFromSpan(draftSpan), draftType),
      themeKey: draftTheme,
      showLabels: draftType === 'donut' ? draftShowLabels : undefined,
      formulaFn: draftType === 'formula' ? draftFormulaFn : undefined,
      formulaLeftType: draftType === 'formula' ? draftFormulaLeftType : undefined,
      formulaLeftKey: draftType === 'formula' ? draftFormulaLeftKey : undefined,
      formulaRightType: draftType === 'formula' ? draftFormulaRightType : undefined,
      formulaRightKey: draftType === 'formula' ? draftFormulaRightKey : undefined,
      formulaMode: draftType === 'formula' ? draftFormulaMode : undefined,
      formulaFilters: draftFormulaFilters,
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
    setDraftFormulaFn((widget.formulaFn ?? 'sumif') as FormulaFn);
    setDraftFormulaLeftType(
      (widget.formulaLeftType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaLeftKey(widget.formulaLeftKey ?? '');
    setDraftFormulaRightType(
      (widget.formulaRightType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaRightKey(widget.formulaRightKey ?? '');
    setDraftFormulaMode((widget.formulaMode ?? 'count') as FormulaMode);
    setDraftFormulaFilters(
      (Array.isArray(widget.formulaFilters) ? widget.formulaFilters : []).map((f) =>
        migrateFormulaFilterRow(f as { scope?: string; key?: string; keys?: unknown }),
      ),
    );
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
                formulaFn: draftType === 'formula' ? draftFormulaFn : undefined,
                formulaLeftType:
                  draftType === 'formula' ? draftFormulaLeftType : undefined,
                formulaLeftKey:
                  draftType === 'formula' ? draftFormulaLeftKey : undefined,
                formulaRightType:
                  draftType === 'formula' ? draftFormulaRightType : undefined,
                formulaRightKey:
                  draftType === 'formula' ? draftFormulaRightKey : undefined,
                formulaMode:
                  draftType === 'formula' ? draftFormulaMode : undefined,
                formulaFilters: draftFormulaFilters,
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
      localStorage.setItem(`${storageNamespace}_widgets`, JSON.stringify(defaultWidgets));
      localStorage.setItem(`${storageNamespace}_version`, ANALYTICS_LAYOUT_VERSION);
    } catch {
      // ignore
    }
    setResetOpen(false);
  };

  const periodRangeLabel = useMemo(() => {
    if (period === 'all' || period === 'custom') return periodLabels[period];
    const now = new Date();
    const start = new Date(now);
    if (period === '7d') start.setDate(now.getDate() - 6);
    if (period === '30d') start.setDate(now.getDate() - 29);
    if (period === '1y') start.setFullYear(now.getFullYear() - 1);
    const format = (date: Date) =>
      date.toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    return `${format(start)} – ${format(now)}`;
  }, [locale, period, periodLabels]);

  const handleShare = () => {
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
    if (activeView === 'statuses') return 'status';
    if (activeView === 'owners') return 'owner';
    if (activeView === 'categories') return 'category';
    return 'status';
  };

  const addGlobalFilter = (scope = defaultGlobalFilterScope()) => {
    if (!scope || globalFilters.some((filter) => filter.scope === scope)) return;
    setGlobalFilters((prev) => [...prev, { id: `gf-${Date.now()}`, scope, keys: [] }]);
  };

  const removeGlobalFilter = (id: string) =>
    setGlobalFilters((prev) => prev.filter((filter) => filter.id !== id));

  const widgetSpan = (widget: WidgetConfig) => closestSpan(widget.span ?? spanFromSize(widget.size));

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

  const visibleWidgets = useMemo(() => {
    if (activeView === 'overview') return widgets;
    const next = widgets.filter((widget) => {
      if (activeView === 'statuses') {
        return widget.chartKey === 'status' || widget.pivotRowKey === 'status' || widget.pivotColKey === 'status' || widget.metricKey === 'statuses';
      }
      if (activeView === 'owners') {
        return widget.chartKey === 'owner' || widget.tableKey === 'owners' || widget.metricKey === 'owners';
      }
      if (activeView === 'categories') {
        return widget.chartKey === 'category' || widget.tableKey === 'categories' || widget.metricKey === 'categories';
      }
      return true;
    });
    return next.length ? next : widgets;
  }, [activeView, widgets]);

  const pageKicker = header?.kicker || 'Аналитика проектов';
  const pageTitle = header?.title || 'Проекты — обзор';
  const pageSubtitle =
    header?.subtitle ||
    'KPI, графики, сводные таблицы и собственные блоки по статусам, категориям, ответственным и полям проектов.';
  const pageRoot = isWorkspaceMode ? 'Workspace' : 'Проекты';
  const filteredCountLabel = loading
    ? 'Загрузка'
    : `${filteredItems.length} ${isWorkspaceMode ? 'записей' : 'проектов'} · обновлено только что`;

  useEffect(() => {
    if (!resizing) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor =
      resizing.axis === 'y'
        ? 'ns-resize'
        : resizing.axis === 'both'
          ? 'nwse-resize'
          : 'ew-resize';
    document.body.style.userSelect = 'none';
    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;
      let nextSize = resizing.startSize;
      let nextSpan = resizing.startSpan;
      if (resizing.axis === 'x' || resizing.axis === 'both') {
        nextSpan = closestSpan(resizing.startSpan + Math.round(deltaX / 120));
        nextSize = sizeFromSpan(nextSpan);
      }
      let nextHeight = resizing.startHeight;
      if (resizing.axis === 'y' || resizing.axis === 'both') {
        nextHeight = Math.min(
          MAX_WIDGET_H,
          Math.max(resizing.minHeight, resizing.startHeight + deltaY),
        );
      }
      setWidgets((prev) =>
        prev.map((item) =>
          item.id === resizing.id ? { ...item, size: nextSize, span: nextSpan, height: nextHeight } : item,
        ),
      );
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

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
      const sum = sourceItems.reduce((acc, item) => {
        const raw = getCustomFieldValue(item, fieldKey);
        const value = parseNumericLoose(raw);
        return acc + (value ?? 0);
      }, 0);
      const fieldLabel = analyticsFieldMap.get(fieldKey)?.label || fieldKey;
      const currencySuffix = /\bUSD\b/i.test(fieldLabel) || /usd/i.test(fieldKey)
        ? ' USD'
        : /\bEUR\b/i.test(fieldLabel) || /eur/i.test(fieldKey)
          ? ' EUR'
          : '';
      return `${new Intl.NumberFormat(locale).format(sum)}${currencySuffix}`;
    }
    if (key?.startsWith('avg:')) {
      const fieldKey = key.slice(4);
      const values = sourceItems
        .map((item) => parseNumericLoose(getCustomFieldValue(item, fieldKey)))
        .filter((value): value is number => value !== null);
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      return new Intl.NumberFormat(locale).format(avg);
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

  const beginResize = (
    id: string,
    axis: 'x' | 'y' | 'both',
    event: React.MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const current = widgets.find((w) => w.id === id);
    const size = current?.size || 'md';
    const startHeight = current?.height ?? getDefaultHeight(size, current?.type || 'metric');
    const startSpan = current ? widgetSpan(current) : spanFromSize(size);
    const type = current?.type ?? 'metric';
    const minHeight =
      type === 'pivot'
        ? 280
        : type === 'table'
          ? 240
          : type === 'donut' || type === 'bar' || type === 'line' || type === 'funnel' || type === 'leaderboard'
            ? 220
            : 160;
    setResizing({
      id,
      startX: event.clientX,
      startY: event.clientY,
      startSize: size,
      startSpan,
      startHeight,
      minHeight,
      axis,
    });
  };

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
      if (valueField.startsWith('sum:')) {
        const fieldKey = valueField.slice(4);
        return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
      }
      if (valueField.startsWith('field:')) {
        const fieldKey = valueField.slice(6);
        return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
      }
      if (valueField === 'amount') return item.amount || 0;
      return parseNumericLoose(getCustomFieldValue(item, valueField)) ?? 0;
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
      if (valueField.startsWith('sum:')) {
        const fieldKey = valueField.slice(4);
        return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
      }
      if (valueField.startsWith('field:')) {
        const fieldKey = valueField.slice(6);
        return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
      }
      if (valueField === 'amount') return item.amount || 0;
      return parseNumericLoose(getCustomFieldValue(item, valueField)) ?? 0;
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
    if (valueField.startsWith('sum:')) {
      const fieldKey = valueField.slice(4);
      return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
    }
    if (valueField.startsWith('field:')) {
      const fieldKey = valueField.slice(6);
      return parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0;
    }
    if (valueField === 'amount') return item.amount || 0;
    return parseNumericLoose(getCustomFieldValue(item, valueField)) ?? 0;
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
      .map((item) => ({ item, date: parseDate(item.createdAt) }))
      .filter((entry): entry is { item: Project; date: Date } => Boolean(entry.date));
    if (!dated.length) return [{ name: '—', value: 0, previous: 0 }];

    const minTime = Math.min(...dated.map((entry) => entry.date.getTime()));
    const maxTime = Math.max(...dated.map((entry) => entry.date.getTime()));
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

  const buildHeatmap = (sourceItems: Project[]) => {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
    return days.map((day, dayIndex) => ({
      day,
      hours: hours.map((hour) => {
        const startHour = Number(hour);
        const value = sourceItems.filter((item) => {
          const date = parseDate(item.createdAt);
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

  const renderWidget = (w: WidgetConfig) => {
    const widgetHeight = w.height ?? getDefaultHeight(w.size, w.type);
    const widgetItems = applyWidgetFilters(filteredItems, w.formulaFilters);
    const widgetColor = '#222222';
    const metricSpark = (() => {
      if (w.type !== 'metric' && w.type !== 'formula') return [0, 0, 0];
      const dated = widgetItems
        .map((item) => ({ item, time: parseDate(item.createdAt)?.getTime() ?? NaN }))
        .filter((entry) => Number.isFinite(entry.time));
      if (!dated.length) return [widgetItems.length || 0, widgetItems.length || 0, widgetItems.length || 0];
      const min = Math.min(...dated.map((entry) => entry.time));
      const max = Math.max(...dated.map((entry) => entry.time));
      const buckets = 8;
      const step = Math.max(1, (max - min || 1) / buckets);
      const values = Array.from({ length: buckets }, () => 0);
      dated.forEach(({ item, time }) => {
        const index = Math.min(buckets - 1, Math.max(0, Math.floor((time - min) / step)));
        if (w.metricKey === 'amount') values[index] += item.amount || 0;
        else if (w.metricKey === 'avgAmount') values[index] += item.amount || 0;
        else if (w.metricKey?.startsWith('sum:')) {
          values[index] += parseNumericLoose(getCustomFieldValue(item, w.metricKey.slice(4))) ?? 0;
        } else {
          values[index] += 1;
        }
      });
      return values;
    })();

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
        if (m.mode === 'sum' && (m.valueField === 'amount' || !m.valueField)) {
          const formatted = new Intl.NumberFormat(locale).format(n);
          return t('crm.projects.common.amountWithCurrency', {
            amount: formatted,
            currency: pivotCurrency,
          });
        }
        return new Intl.NumberFormat(locale).format(n);
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
        <div className="flex h-full items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex flex-wrap items-baseline gap-2 leading-none">
              <span className="text-[2.5rem] font-semibold tracking-[-0.04em] text-[#222]">
                {value}
              </span>
            </div>
            <div className="text-[11px] font-medium text-neutral-400">
              {period === 'custom' ? t('crm.projects.analytics.period.custom') : periodLabels[period]}
            </div>
          </div>
          <div className="w-20 shrink-0">
            <MiniSparkline data={metricSpark} color={widgetColor} />
          </div>
        </div>
      );
    }

    if (w.type === 'formula') {
      const fn = w.formulaFn ?? 'sumif';
      const mode = w.formulaMode ?? 'count';
      const leftType = w.formulaLeftType ?? 'total';
      const rightType = w.formulaRightType ?? 'total';
      const leftKey = w.formulaLeftKey;
      const rightKey = w.formulaRightKey;
      const filters = w.formulaFilters ?? [];

      const resolveOperand = (
        type: FormulaOperandType,
        key?: string,
        sourceItems: Project[] = widgetItems,
      ) => {
        if (type.startsWith('sum:')) {
          const fieldKey = type.slice(4);
          return sourceItems.reduce(
            (acc, item) => acc + (parseNumericLoose(getCustomFieldValue(item, fieldKey)) ?? 0),
            0,
          );
        }
        if (type.startsWith('avg:')) {
          const fieldKey = type.slice(4);
          const values = sourceItems
            .map((item) => parseNumericLoose(getCustomFieldValue(item, fieldKey)))
            .filter((value): value is number => value !== null);
          return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
        }
        if (type.startsWith('filled:')) {
          const fieldKey = type.slice(7);
          return sourceItems.filter((item) => isFilled(getCustomFieldValue(item, fieldKey))).length;
        }
        if (type.startsWith('field:')) {
          const list = buildSeriesForWidget(type, sourceItems, 'count');
          return list.find((entry) => entry.code === key)?.count ?? 0;
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

      const leftValue = resolveOperand(leftType, leftKey);
      const rightValue = resolveOperand(rightType, rightKey);
      const baseTotal = widgetItems.length;

      let primaryValue = leftValue;
      let secondaryValue: number | null = null;
      if (fn === 'count') {
        primaryValue = leftValue;
        secondaryValue = baseTotal > 0 ? Math.round((leftValue / baseTotal) * 100) : 0;
      } else if (fn === 'percent') {
        primaryValue = baseTotal > 0 ? Math.round((leftValue / baseTotal) * 100) : 0;
        secondaryValue = leftValue;
      } else if (fn === 'ratio') {
        primaryValue = rightValue > 0 ? Math.round((leftValue / rightValue) * 100) : 0;
        secondaryValue = rightValue;
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

      const primaryLabel =
        mode === 'sum'
          ? new Intl.NumberFormat(locale).format(primaryValue)
          : fn === 'percent' || fn === 'ratio' || mode === 'percent'
          ? `${primaryValue}%`
          : primaryValue.toLocaleString(locale);
      const secondaryLabel =
        secondaryValue === null
          ? null
          : mode === 'percent' || fn === 'percent' || fn === 'ratio'
            ? secondaryValue.toLocaleString(locale)
            : `${secondaryValue}%`;

      return (
        <div className="flex h-full items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="text-[2.5rem] font-semibold tracking-[-0.04em] text-[#222]">
              {primaryLabel}
            </div>
            <div className="line-clamp-2 text-[11px] font-medium text-neutral-400">
              {secondaryLabel ? `${secondaryLabel} · ` : ''}
              {period === 'custom'
                ? t('crm.projects.analytics.period.custom')
                : periodLabels[period]}
            </div>
          </div>
          <div className="w-20 shrink-0">
            <MiniSparkline data={metricSpark} color={widgetColor} />
          </div>
        </div>
      );
    }

    if (w.type === 'line') {
      const trend = buildTrend(widgetItems, w.chartValueMode || 'count', w.chartValueField);
      const chartHeight = Math.max(widgetHeight - 90, 160);
      const areaId = `projects-area-${w.id}`;
      return (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center gap-4 px-1">
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span className="inline-block h-0.5 w-5 rounded-full" style={{ backgroundColor: widgetColor }} />
              Текущий период
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
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} domain={[0, (max: number) => Math.max(1, Number(max) || 0)]} allowDecimals={false} width={36} />
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
      );
      const palette = V2_PALETTE;
      const donutTotal = donutData.reduce((sum, row) => sum + row.count, 0);
      const chartHeight = Math.max(widgetHeight - 96, 180);
      const activeIndex = activeDonut[w.id] ?? null;
      const activeProps =
        activeIndex === null ? {} : ({ activeIndex, activeShape: renderActiveDonut } as any);
      const showLabels = w.showLabels !== false;
      return (
        <div
          className={cx(
            'grid h-full min-h-[220px] items-center gap-4',
            showLabels ? 'grid-cols-1 md:grid-cols-[minmax(140px,0.9fr)_1.1fr]' : 'grid-cols-1',
          )}
        >
          <div className="relative" style={{ height: chartHeight }}>
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
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold">{compactNumber(donutTotal)}</span>
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
      const palette = V2_PALETTE;
      const chartHeight = Math.max(widgetHeight - 72, 180);
      return (
        <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 12, left: -8, bottom: 20 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={36} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
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
      return (
        <div className="flex h-full flex-col justify-center">
          {ordered.map((item, index) => (
            <div key={item.code} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 border-b border-neutral-100 py-2 text-xs last:border-b-0">
              <span className="truncate font-medium text-[#222]">{item.label}</span>
              <span className="h-7 overflow-hidden rounded-md bg-neutral-100">
                <span className="flex h-full items-center rounded-md px-3 font-mono text-[11px] font-medium text-white" style={{ width: `${Math.max(8, percent(item.count, max))}%`, backgroundColor: V2_PALETTE[index % V2_PALETTE.length] }}>{compactNumber(item.count)}</span>
              </span>
              <span className="text-right font-mono text-neutral-500">{index === 0 ? '100%' : `${percent(item.count, max)}%`}</span>
            </div>
          ))}
        </div>
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
      if (tableAggMode === 'sum' && (tableAggField === 'amount' || !tableAggField)) {
        return formatAmount(n);
      }
      if (tableAggMode === 'sum') {
        return new Intl.NumberFormat(locale).format(n);
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
      const previewFields = analyticsFields.slice(0, 4);
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
                  const lightness = 96 - Math.min(1, hour.value / max) * 68;
                  return <span key={`${row.day}-${hour.hour}`} className="aspect-square rounded hover:scale-110 hover:ring-1 hover:ring-[#222]" title={`${row.day} ${hour.hour}:00 — ${hour.value}`} style={{ background: `hsl(0 0% ${lightness}%)` }} />;
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
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

  return (
    <MainLayout>
      <PageHelpButton topic="projectsAnalytics" />
      <div className="min-h-screen pb-10 text-[#222]">
        {shareToast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-[#222] px-5 py-3 text-sm text-white shadow-lg">
            Ссылка скопирована в буфер обмена
          </div>
        )}

        <div className="sticky top-0 z-30 -mx-3 border-b border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm text-neutral-500">
              <span className="hidden sm:inline">
                {pageRoot} <span className="mx-2 text-neutral-300">/</span>{' '}
              </span>
              <span className="font-semibold text-[#222]">Аналитика</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm sm:w-52 sm:flex-none">
                <Icon name="search" size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Найти…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
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
              <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
                {(['30d', '7d', '1y', 'all', 'custom'] as PeriodId[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cx(
                      'rounded-lg px-3 py-1.5 text-xs transition sm:px-4 sm:py-2 sm:text-sm',
                      period === item ? 'bg-[#222] text-white shadow-sm' : 'text-neutral-500 hover:text-[#222]',
                    )}
                    onClick={() => setPeriod(item)}
                  >
                    {periodLabels[item]}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm sm:inline-flex">
                <Icon name="calendar" size={15} />
                <span className="text-xs uppercase tracking-[0.16em] text-neutral-400">Период</span>
                <span className="font-medium">{periodRangeLabel}</span>
              </div>
              <AnalyticsCurrencyControl state={currencyPrefs} onStateChange={setCurrencyPrefs} />
              <button
                type="button"
                className="hidden sm:inline-flex items-center gap-2 btn-secondary"
                onClick={handleShare}
              >
                <Icon name="share" size={15} />
                <span className="hidden md:inline">Поделиться</span>
              </button>
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
            </div>
          </section>

          {toolbarSlot && (
            <nav className="border-b border-neutral-200 pb-3">
              <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">{toolbarSlot}</div>
            </nav>
          )}

          <nav className="border-b border-neutral-200">
            <div className="-mx-3 flex items-center justify-between overflow-x-auto px-3 md:mx-0 md:px-0">
              <div className="flex shrink-0 gap-1 sm:gap-4">
                {VIEWS.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    className={cx(
                      'whitespace-nowrap border-b-2 px-2 py-3 text-sm transition sm:px-3 sm:py-4 sm:text-base',
                      activeView === view.id
                        ? 'border-[#222] font-medium text-[#222]'
                        : 'border-transparent text-neutral-500 hover:text-[#222]',
                    )}
                    onClick={() => setActiveView(view.id)}
                  >
                    {activeView === view.id && <span className="mr-1 sm:mr-2">•</span>}
                    {view.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hidden md:block btn-secondary border-dashed border-border-strong text-text-secondary"
                onClick={() => setEditMode(true)}
              >
                + Сохранить вид
              </button>
            </div>
          </nav>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {currencyRateMissing && (
          <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Не удалось получить курс для части проектов — их суммы показаны в исходной валюте и могут искажать общий итог.
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

          {visibleWidgets.length === 0 ? (
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
              className={cx(
                'grid min-h-[600px] grid-cols-12 gap-3 rounded-xl sm:gap-4',
                editMode &&
                  'bg-[linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] bg-[length:8.333%_72px]',
              )}
            >
              {visibleWidgets.map((w) => {
                const isResizing = resizing?.id === w.id;
                const widgetHeight = w.height ?? getDefaultHeight(w.size, w.type);
                const currentSpan = widgetSpan(w);
                return (
                  <div
                    key={w.id}
                    draggable={editMode}
                    onDragStart={(e) => {
                      if (!editMode) return;
                      setDragWidgetId(w.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', w.id);
                      const node = (e.currentTarget as HTMLElement).cloneNode(true) as HTMLElement;
                      node.style.width = `${e.currentTarget.clientWidth}px`;
                      node.style.height = `${e.currentTarget.clientHeight}px`;
                      node.style.position = 'absolute';
                      node.style.top = '-9999px';
                      node.style.left = '-9999px';
                      node.style.borderRadius = '18px';
                      node.style.overflow = 'hidden';
                      node.style.boxShadow = '0 20px 60px rgba(15, 23, 42, 0.15)';
                      document.body.appendChild(node);
                      e.dataTransfer.setDragImage(node, 20, 20);
                      setTimeout(() => {
                        if (node.parentNode) node.parentNode.removeChild(node);
                      }, 0);
                    }}
                    onDragEnd={() => setDragWidgetId(null)}
                    onDragOver={(e) => editMode && e.preventDefault()}
                    onDrop={() => editMode && handleWidgetDrop(w.id)}
                    style={{
                      height: widgetHeight,
                      minHeight: Math.max(MIN_WIDGET_H, widgetHeight),
                      gridColumn: isMobile ? 'span 12' : `span ${currentSpan}`,
                    }}
                    className={cx(
                      'group relative flex flex-col overflow-hidden rounded-[18px] border bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition',
                      isResizing ? 'border-[#222] ring-1 ring-[#222]' : 'border-neutral-200 hover:border-neutral-300',
                      editMode && 'pt-7',
                    )}
                  >
                    {editMode && (
                      <button
                        type="button"
                        className="absolute left-0 right-0 top-0 flex h-6 cursor-grab items-center justify-center rounded-t-[18px] bg-gradient-to-b from-neutral-100 to-transparent text-neutral-400 active:cursor-grabbing"
                        onMouseDown={(event) => event.stopPropagation()}
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
                        className={cx(
                          'flex shrink-0 items-center gap-1 text-neutral-400 transition-opacity',
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
                              widgetConfig: w,
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
                      <div className="pointer-events-none absolute inset-0 rounded-[18px] border border-slate-900/20" />
                    )}

                    {editMode && (
                      <>
                        <div
                          onMouseDown={(e) => beginResize(w.id, 'x', e)}
                          className="absolute -right-1.5 top-6 bottom-6 flex w-3 cursor-ew-resize items-center justify-center"
                          title={t('crm.projects.analytics.resize.width')}
                        >
                          <div className="h-10 w-1.5 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <div
                          onMouseDown={(e) => beginResize(w.id, 'y', e)}
                          className="absolute -bottom-1.5 left-6 right-6 flex h-3 cursor-ns-resize items-center justify-center"
                          title={t('crm.projects.analytics.resize.height')}
                        >
                          <div className="h-1.5 w-10 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
                        </div>
                        <button
                          type="button"
                          className="absolute bottom-0 right-0 flex h-7 w-7 cursor-nwse-resize items-end justify-end p-1 text-neutral-300 hover:text-[#222]"
                          onMouseDown={(e) => beginResize(w.id, 'both', e)}
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
                        {chartOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
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
                        {tableOptions.map((c) => (
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
                      </div>
                    )}
                    {draftFormulaFn !== 'sumif' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {t('crm.projects.analytics.formula.block.expression')}
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            {t('crm.projects.analytics.formula.left.label')}
                          </label>
                          <select
                            value={draftFormulaLeftType}
                            onChange={(e) =>
                              setDraftFormulaLeftType(
                                e.target.value as FormulaOperandType,
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
                        {(draftFormulaFn === 'ratio' || draftFormulaFn === 'diff') && (
                          <>
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                {t('crm.projects.analytics.formula.right.label')}
                              </label>
                              <select
                                value={draftFormulaRightType}
                                onChange={(e) =>
                                  setDraftFormulaRightType(
                                    e.target.value as FormulaOperandType,
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
                          </>
                        )}
                        {(draftFormulaFn === 'count' || draftFormulaFn === 'diff') && (
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
                        {chartOptions.map((opt) => (
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
                        {chartOptions.map((opt) => (
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
                      {ALLOWED_SPANS.map((span) => (
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
                              widgetConfig: w,
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
      </div>
      {addedToHomeToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-[#222] px-5 py-3 text-sm text-white shadow-lg">
          {t('crm.dashboard.widgets.addedToHome')}
        </div>
      )}
    </MainLayout>
  );
};
