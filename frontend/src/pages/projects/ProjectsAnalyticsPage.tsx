// src/pages/projects/ProjectsAnalyticsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import { requestAddDashboardPreset } from '../../dashboard/dashboardLayout';
import { notifyAnalyticsWidgetsChanged } from '../../dashboard/analyticsStorage';
import { fetchProjects } from '../../api/projects';
import type { Project } from './projectTypes';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
} from 'recharts';

const ANALYTICS_LAYOUT_VERSION = '2026-01-30-projects-premium';

const CHART_COLORS = [
  '#38bdf8',
  '#e11d48',
  '#f97316',
  '#22c55e',
  '#2563eb',
  '#6366f1',
];
const PALETTES: Record<string, string[]> = {
  lumiva: CHART_COLORS,
  ocean: ['#0ea5e9', '#22d3ee', '#38bdf8', '#2563eb', '#14b8a6', '#06b6d4'],
  sunset: ['#f97316', '#fb7185', '#f43f5e', '#f59e0b', '#fbbf24', '#fca5a5'],
  forest: ['#22c55e', '#16a34a', '#4ade80', '#10b981', '#34d399', '#86efac'],
};
const THEME_PRESETS = [
  { key: 'lumiva', label: 'Lumiva', primary: '#0ea5e9', palette: PALETTES.lumiva },
  { key: 'ocean', label: 'Ocean', primary: '#2563eb', palette: PALETTES.ocean },
  { key: 'sunset', label: 'Sunset', primary: '#f97316', palette: PALETTES.sunset },
  { key: 'forest', label: 'Forest', primary: '#16a34a', palette: PALETTES.forest },
  { key: 'red', label: 'Red', primary: '#dc2626', palette: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'] },
] as const;

type PeriodId = '7d' | '30d' | '1y' | 'all' | 'custom';

type WidgetType = 'metric' | 'donut' | 'bar' | 'table' | 'formula' | 'pivot';
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
}

export const ProjectsAnalyticsPage: React.FC<ProjectsAnalyticsPageProps> = ({
  externalItems,
  storageNamespace = 'projects_analytics',
  toolbarSlot,
  analyticsFields = EMPTY_ANALYTICS_FIELDS,
  dashboardPresetSource = 'projects',
  header,
}) => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');
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
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState<ThemeKey>('lumiva');
  const [draftShowLabels, setDraftShowLabels] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState<Record<string, number | null>>(
    {},
  );
  const [resizing, setResizing] = useState<ResizeState | null>(null);
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

  const filteredItems = useMemo(() => {
    if (period === 'all' || period === 'custom') return items;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === '7d') cutoff.setDate(now.getDate() - 6);
    if (period === '30d') cutoff.setDate(now.getDate() - 29);
    if (period === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    return items.filter((p) => {
      const created = parseDate(p.createdAt);
      if (!created) return true;
      return created >= cutoff && created <= now;
    });
  }, [items, period]);

  const isWorkspaceMode = analyticsFields.length > 0;
  const analyticsFieldMap = useMemo(
    () => new Map(analyticsFields.map((field) => [field.key, field])),
    [analyticsFields],
  );
  const getCustomFieldValue = (item: Project, key: string) => item.customFields?.[key];

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

  const currency = filteredItems[0]?.currency || 'EUR';
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
      { id: 'table', label: t('crm.projects.analytics.widgets.type.table') },
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
      return size === 'lg' ? 480 : size === 'md' ? 400 : 320;
    }
    if (type === 'table') {
      return size === 'lg' ? 420 : size === 'md' ? 360 : 300;
    }
    if (type === 'donut' || type === 'bar') {
      return size === 'lg' ? 380 : size === 'md' ? 320 : 260;
    }
    return size === 'lg' ? 280 : size === 'md' ? 240 : 200;
  };

  const defaultWidgets = useMemo<WidgetConfig[]>(
    () => {
      if (isWorkspaceMode) {
        const firstDimension = dynamicFormulaScopeOptions[0] || dynamicDimensionOptions[0];
        const firstNumeric = dynamicNumericFields[0];
        return [
          {
            id: 'metric-total',
            type: 'metric',
            title: t('crm.projects.analytics.kpis.total'),
            metricKey: 'total',
            size: 'sm',
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'metric-filled',
            type: 'metric',
            title: firstDimension ? `${firstDimension.label} (filled)` : t('crm.projects.analytics.kpis.total'),
            metricKey: firstDimension ? `filled:${firstDimension.id.replace('field:', '')}` : 'total',
            size: 'sm',
            height: getDefaultHeight('sm', 'metric'),
          },
          {
            id: 'metric-sum',
            type: 'metric',
            title: firstNumeric ? `${firstNumeric.label} (sum)` : t('crm.projects.analytics.kpis.total'),
            metricKey: firstNumeric ? `sum:${firstNumeric.key}` : 'total',
            size: 'md',
            height: getDefaultHeight('md', 'metric'),
          },
          {
            id: 'chart-dimension-donut',
            type: 'donut',
            title: firstDimension?.label || t('crm.projects.analytics.statusChart.title'),
            chartKey: firstDimension?.id || 'projects',
            size: 'lg',
            height: getDefaultHeight('lg', 'donut'),
            showLabels: true,
          },
          {
            id: 'chart-dimension-bar',
            type: 'bar',
            title: firstDimension?.label || t('crm.projects.analytics.categoryChart.title'),
            chartKey: firstDimension?.id || 'projects',
            size: 'lg',
            height: getDefaultHeight('lg', 'bar'),
          },
          {
            id: 'table-records',
            type: 'table',
            title: t('crm.projects.analytics.table.title'),
            tableKey: 'projects',
            size: 'lg',
            height: getDefaultHeight('lg', 'table'),
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
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'metric-amount',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.amount'),
          metricKey: 'amount',
          size: 'md',
          height: getDefaultHeight('md', 'metric'),
        },
        {
          id: 'metric-owners',
          type: 'metric',
          title: t('crm.projects.analytics.kpis.owners'),
          metricKey: 'owners',
          size: 'sm',
          height: getDefaultHeight('sm', 'metric'),
        },
        {
          id: 'chart-status',
          type: 'donut',
          title: t('crm.projects.analytics.statusChart.title'),
          chartKey: 'status',
          size: 'lg',
          height: getDefaultHeight('lg', 'donut'),
          showLabels: true,
        },
        {
          id: 'chart-categories',
          type: 'bar',
          title: t('crm.projects.analytics.categoryChart.title'),
          chartKey: 'category',
          size: 'lg',
          height: getDefaultHeight('lg', 'bar'),
        },
        {
          id: 'table-projects',
          type: 'table',
          title: t('crm.projects.analytics.table.title'),
          tableKey: 'projects',
          size: 'lg',
          height: getDefaultHeight('lg', 'table'),
        },
      ];
    },
    [t, isWorkspaceMode, dynamicDimensionOptions, dynamicFormulaScopeOptions, dynamicNumericFields],
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

  /** Новый блок: при открытии модалки «Добавить» — без условий (весь период). */
  useEffect(() => {
    const opened = addOpen && !prevAddOpenRef.current;
    prevAddOpenRef.current = addOpen;
    if (opened && !editOpen && editingWidgetId === null) {
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
    if (!dragWidgetId || dragWidgetId === targetId) return;
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
      size: draftSize,
      height: getDefaultHeight(draftSize, draftType),
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
        draftType === 'donut' || draftType === 'bar' ? draftChart : undefined,
      chartValueMode:
        draftType === 'donut' ||
        draftType === 'bar' ||
        (draftType === 'table' && draftTable !== 'projects')
          ? draftChartValueMode
          : undefined,
      chartValueField:
        draftType === 'donut' ||
        draftType === 'bar' ||
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
    setDraftType(widget.type);
    setDraftTitle(widget.title);
    setDraftSize(widget.size);
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
                size: draftSize,
                height: item.height ?? getDefaultHeight(draftSize, draftType),
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
                  draftType === 'donut' || draftType === 'bar'
                    ? draftChart
                    : undefined,
                chartValueMode:
                  draftType === 'donut' ||
                  draftType === 'bar' ||
                  (draftType === 'table' && draftTable !== 'projects')
                    ? draftChartValueMode
                    : undefined,
                chartValueField:
                  draftType === 'donut' ||
                  draftType === 'bar' ||
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
      if (resizing.axis === 'x' || resizing.axis === 'both') {
        if (deltaX > 140) nextSize = 'lg';
        if (deltaX < -140) nextSize = 'sm';
        if (deltaX >= -140 && deltaX <= 140) nextSize = 'md';
      }
      let nextHeight = resizing.startHeight;
      if (resizing.axis === 'y' || resizing.axis === 'both') {
        nextHeight = Math.min(
          640,
          Math.max(resizing.minHeight, resizing.startHeight + deltaY),
        );
      }
      setWidgets((prev) =>
        prev.map((item) =>
          item.id === resizing.id ? { ...item, size: nextSize, height: nextHeight } : item,
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
      return new Intl.NumberFormat(locale).format(sum);
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

  const sizeClass = (size: WidgetSize) => {
    if (size === 'lg') return 'md:col-span-2 xl:col-span-3';
    if (size === 'md') return 'md:col-span-2 xl:col-span-2';
    return 'md:col-span-1 xl:col-span-1';
  };

  const resolveTheme = (key?: ThemeKey) =>
    THEME_PRESETS.find((preset) => preset.key === key) || THEME_PRESETS[0];

  const beginResize = (
    id: string,
    size: WidgetSize,
    axis: 'x' | 'y' | 'both',
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const current = widgets.find((w) => w.id === id);
    const startHeight = current?.height ?? getDefaultHeight(size, current?.type || 'metric');
    const type = current?.type ?? 'metric';
    const minHeight =
      type === 'pivot'
        ? 280
        : type === 'table'
          ? 240
          : type === 'donut' || type === 'bar'
            ? 220
            : 160;
    setResizing({
      id,
      startX: event.clientX,
      startY: event.clientY,
      startSize: size,
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
      return Array.from(grouped.values());
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
    return Array.from(grouped.values());
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
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
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
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[12px] text-slate-500">{t('crm.projects.analytics.pivot.noData')}</div>
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
      const pivotCurrency = widgetItems[0]?.currency || 'EUR';
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
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[10px] text-slate-400">
              {rowDimLabel} × {colDimLabel}
              {(rowAxis.length >= PIVOT_MAX_ROWS || colAxis.length >= PIVOT_MAX_COLS) && (
                <span className="text-amber-600"> · {t('crm.projects.analytics.pivot.truncated')}</span>
              )}
            </div>
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
      const theme = resolveTheme(w.themeKey);
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div className="text-2xl font-semibold" style={{ color: theme.primary }}>
            {resolveMetricValue(w.metricKey, widgetItems, filteredItems)}
          </div>
          <div className="text-[11px] text-slate-500">
            {period === 'custom' ? t('crm.projects.analytics.period.custom') : periodLabels[period]}
          </div>
        </div>
      );
    }

    if (w.type === 'formula') {
      const theme = resolveTheme(w.themeKey);
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
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div className="text-2xl font-semibold" style={{ color: theme.primary }}>
            {primaryLabel}
          </div>
          {secondaryLabel && (
            <div className="text-[11px] text-slate-500">
              {secondaryLabel} ·{' '}
              {period === 'custom'
                ? t('crm.projects.analytics.period.custom')
                : periodLabels[period]}
            </div>
          )}
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
      const theme = resolveTheme(w.themeKey);
      const palette = theme.palette || CHART_COLORS;
      const donutTotal = donutData.reduce((sum, row) => sum + row.count, 0);
      const chartHeight = Math.max(widgetHeight - 80, 220);
      const activeIndex = activeDonut[w.id] ?? null;
      const activeProps =
        activeIndex === null ? {} : ({ activeIndex, activeShape: renderActiveDonut } as any);
      const showLabels = w.showLabels !== false;
      return (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div style={{ height: chartHeight }} className="md:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={56}
                    outerRadius={80}
                    paddingAngle={3}
                    cornerRadius={6}
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
            </div>
            {showLabels && (
              <div className="md:w-52 space-y-2">
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
                      className={`flex w-full items-center justify-between rounded-xl px-2 py-1 text-[11px] transition ${
                        isActive
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: palette[idx % palette.length] }}
                        />
                        <span className="truncate">{entry.label}</span>
                      </span>
                      <span className="text-slate-500">
                        {entry.count} · {percent}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
      const theme = resolveTheme(w.themeKey);
      const palette = theme.palette || CHART_COLORS;
      const chartHeight = Math.max(widgetHeight - 80, 220);
      return (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 4, 4]} barSize={28}>
                  {barData.map((_, idx) => (
                    <Cell key={idx} fill={palette[idx % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
      const headerKicker = dimLabels.join(' · ');
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 line-clamp-2">
              {headerKicker}
            </div>
            <div className="text-[11px] text-slate-500 shrink-0">{rows.length}</div>
          </div>
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-slate-500">
                  {dimLabels.map((label, i) => (
                    <th key={i} className="py-1.5 pr-3 text-left font-normal">
                      {label}
                    </th>
                  ))}
                  <th className="py-1.5 px-3 text-right font-normal">{valueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.key} className="border-b border-slate-100 last:border-none">
                    {entry.cells.map((cell, i) => (
                      <td key={i} className="py-1.5 pr-3 text-slate-700">
                        {cell}
                      </td>
                    ))}
                    <td className="py-1.5 px-3 text-right text-slate-700">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.ownersTable.total', { count: ownerSeries.length })}
            </div>
          </div>
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-3 text-left font-normal">
                    {t('crm.projects.analytics.ownersTable.headers.owner')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">{ownersValueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {ownerSeries.map((o) => (
                  <tr key={o.label} className="border-b border-slate-100 last:border-none">
                    <td className="py-1.5 pr-3 text-slate-700">{o.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.categoriesTable.total', { count: categorySeries.length })}
            </div>
          </div>
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-3 text-left font-normal">
                    {t('crm.projects.analytics.categoriesTable.headers.category')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">{categoriesValueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {categorySeries.map((c) => (
                  <tr key={c.label} className="border-b border-slate-100 last:border-none">
                    <td className="py-1.5 pr-3 text-slate-700">{c.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">
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

    if (isWorkspaceMode) {
      const previewFields = analyticsFields.slice(0, 4);
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.table.total', { count: widgetItems.length })}
            </div>
          </div>
          <div
            className="overflow-x-auto overflow-y-auto"
            style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-white/95 backdrop-blur">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-3 text-left font-normal">
                    {t('crm.projects.analytics.table.headers.project')}
                  </th>
                  {previewFields.map((field) => (
                    <th key={field.key} className="py-1.5 px-3 text-left font-normal">
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {widgetItems.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-none">
                    <td className="py-1.5 pr-3 text-slate-700">{p.name}</td>
                    {previewFields.map((field) => (
                      <td key={field.key} className="py-1.5 px-3 text-slate-600">
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

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
          <div className="text-[11px] text-slate-500">
            {t('crm.projects.analytics.table.total', { count: widgetItems.length })}
          </div>
        </div>
        <div
          className="overflow-x-auto overflow-y-auto"
          style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
        >
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="sticky top-0 bg-white/95 backdrop-blur">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-3 text-left font-normal">
                  {t('crm.projects.analytics.table.headers.project')}
                </th>
                <th className="py-1.5 px-3 text-left font-normal">
                  {t('crm.projects.analytics.table.headers.status')}
                </th>
                <th className="py-1.5 px-3 text-left font-normal">
                  {t('crm.projects.analytics.table.headers.category')}
                </th>
                <th className="py-1.5 px-3 text-left font-normal">
                  {t('crm.projects.analytics.table.headers.owner')}
                </th>
                <th className="py-1.5 px-3 text-right font-normal">
                  {t('crm.projects.analytics.table.headers.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {widgetItems.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-none">
                  <td className="py-1.5 pr-3 text-slate-700">{p.name}</td>
                  <td className="py-1.5 px-3 text-slate-600">
                    {statusLabels[p.status] ?? p.status}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600">
                    {p.category || t('crm.projects.analytics.noCategory')}
                  </td>
                  <td className="py-1.5 px-3 text-slate-600">
                    {p.owner || t('crm.projects.analytics.unknownOwner')}
                  </td>
                  <td className="py-1.5 px-3 text-right text-slate-700">
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
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-6 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {header?.kicker || t('crm.projects.analytics.kicker')}
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-900">
                {header?.title || t('crm.projects.analytics.title')}
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl">
                {header?.subtitle || t('crm.projects.analytics.subtitle')}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">{t('crm.projects.analytics.hero.note')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {toolbarSlot}
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  <span className="text-[11px] text-slate-600 pl-1">
                    {t('crm.projects.analytics.period.label')}
                  </span>
                  <div className="flex">
                    {(['7d', '30d', '1y', 'all', 'custom'] as PeriodId[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (p === 'custom') {
                            setPeriod('custom');
                            return;
                          }
                          setPeriod(p);
                        }}
                        className={
                          'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                          (period === p
                            ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                        }
                      >
                        {periodLabels[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="px-3 py-1.5 rounded-2xl bg-black text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] hover:bg-slate-900"
                >
                  + {t('crm.projects.analytics.addBlock')}
                </button>
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="px-3 py-1.5 rounded-2xl border border-slate-200 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  {t('crm.projects.analytics.reset.button')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-6 md:py-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {t('crm.projects.analytics.constructor.title')}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {t('crm.projects.analytics.constructor.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-2xl bg-lumiva-accent text-white text-[11px] font-semibold border border-lumiva-accent shadow-[0_10px_24px_rgba(34,34,34,0.12)] hover:opacity-90"
            >
              + {t('crm.projects.analytics.addBlock')}
            </button>
          </div>

          {widgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] text-slate-500">
              {t('crm.projects.analytics.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {widgets.map((w) => {
                const isResizing = resizing?.id === w.id;
                const widgetHeight = w.height ?? getDefaultHeight(w.size, w.type);
                return (
                  <div
                    key={w.id}
                    draggable
                    onDragStart={(e) => {
                      setDragWidgetId(w.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', w.id);
                      const node = (e.currentTarget as HTMLElement).cloneNode(true) as HTMLElement;
                      node.style.width = `${e.currentTarget.clientWidth}px`;
                      node.style.height = `${e.currentTarget.clientHeight}px`;
                      node.style.position = 'absolute';
                      node.style.top = '-9999px';
                      node.style.left = '-9999px';
                      node.style.borderRadius = '28px';
                      node.style.overflow = 'hidden';
                      node.style.boxShadow = '0 20px 60px rgba(15, 23, 42, 0.15)';
                      document.body.appendChild(node);
                      e.dataTransfer.setDragImage(node, 20, 20);
                      setTimeout(() => {
                        if (node.parentNode) node.parentNode.removeChild(node);
                      }, 0);
                    }}
                    onDragEnd={() => setDragWidgetId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleWidgetDrop(w.id)}
                    style={{ height: widgetHeight, minHeight: widgetHeight }}
                    className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:px-5 md:py-5 ${sizeClass(w.size)} ${
                      isResizing ? 'ring-2 ring-slate-900/20' : ''
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="cursor-move">⋮⋮</span>
                        <span>{w.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] flex-wrap justify-end">
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
                          className="text-lumiva-accent font-semibold hover:underline"
                        >
                          {t('crm.dashboard.addToHomeFromAnalytics')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditWidget(w)}
                          className="text-slate-500 hover:text-slate-900"
                        >
                          {t('crm.projects.analytics.actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(w.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-500"
                        >
                          {t('crm.projects.analytics.actions.remove')}
                        </button>
                      </div>
                    </div>
                    {renderWidget(w)}

                    {isResizing && (
                      <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-slate-900/20" />
                    )}

                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'y', e)}
                      className="absolute -top-1 left-4 right-4 h-2 cursor-ns-resize"
                      title={t('crm.projects.analytics.resize.height')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'y', e)}
                      className="absolute -bottom-1 left-4 right-4 h-2 cursor-ns-resize"
                      title={t('crm.projects.analytics.resize.height')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                      className="absolute -left-1 top-4 bottom-4 w-2 cursor-ew-resize"
                      title={t('crm.projects.analytics.resize.width')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                      className="absolute -right-1 top-4 bottom-4 w-2 cursor-ew-resize"
                      title={t('crm.projects.analytics.resize.width')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -top-1 -left-1 h-3 w-3 cursor-nwse-resize"
                      title={t('crm.projects.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -top-1 -right-1 h-3 w-3 cursor-nesw-resize"
                      title={t('crm.projects.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -bottom-1 -left-1 h-3 w-3 cursor-nesw-resize"
                      title={t('crm.projects.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize"
                      title={t('crm.projects.analytics.resize.both')}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-2xl bg-black px-4 py-2 text-[11px] font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.2)] hover:bg-slate-900"
            >
              + {t('crm.projects.analytics.addBlock')}
            </button>
          </div>
        </section>

        {(addOpen || editOpen) && (
          <div className="fixed inset-0 z-50 overflow-y-auto overscroll-y-contain bg-black/60 backdrop-blur-sm">
            <div className="flex min-h-full justify-center px-4 py-6 sm:py-10">
              <div
                role="dialog"
                aria-modal="true"
                className="my-auto flex w-full max-w-lg max-h-[min(92vh,calc(100dvh-3rem))] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_25px_80px_rgba(15,23,42,0.35)]"
              >
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {t('crm.projects.analytics.constructor.kicker')}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {isEditing
                        ? t('crm.projects.analytics.modal.editTitle')
                        : t('crm.projects.analytics.modal.addTitle')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
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

                {(draftType === 'donut' || draftType === 'bar') && (
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

                {(draftType === 'donut' ||
                  draftType === 'bar' ||
                  (draftType === 'table' && draftTable !== 'projects')) && (
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
                      {t('crm.projects.analytics.modal.size')}
                    </label>
                    <select
                      value={draftSize}
                      onChange={(e) => setDraftSize(e.target.value as WidgetSize)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      <option value="sm">{t('crm.projects.analytics.sizes.sm')}</option>
                      <option value="md">{t('crm.projects.analytics.sizes.md')}</option>
                      <option value="lg">{t('crm.projects.analytics.sizes.lg')}</option>
                    </select>
                  </div>
                </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
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
                        className="px-3 py-2 rounded-xl border border-slate-900/15 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        {t('crm.dashboard.addToHomeFromAnalytics')}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      {t('crm.projects.analytics.actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={saveWidget}
                      className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold border border-lumiva-accent shadow-[0_10px_24px_rgba(34,34,34,0.12)] hover:opacity-90"
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
              <h3 className="text-sm font-semibold text-slate-900">
                {t('crm.projects.analytics.reset.title')}
              </h3>
              <p className="mt-2 text-xs text-slate-600">
                {t('crm.projects.analytics.reset.message')}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                >
                  {t('crm.projects.analytics.reset.cancel')}
                </button>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="px-4 py-2 rounded-xl bg-lumiva-accent text-white text-xs font-semibold border border-lumiva-accent hover:opacity-90"
                >
                  {t('crm.projects.analytics.reset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {addedToHomeToast && (
        <div className="fixed bottom-6 left-1/2 z-[100] max-w-[min(90vw,24rem)] -translate-x-1/2 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-2.5 text-center text-[11px] text-slate-800 shadow-lg ring-1 ring-slate-900/[0.06]">
          {t('crm.dashboard.widgets.addedToHome')}
        </div>
      )}
    </MainLayout>
  );
};
