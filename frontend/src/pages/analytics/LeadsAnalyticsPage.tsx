// src/pages/analytics/LeadsAnalyticsPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  fetchLeadStats,
  type LeadStats,
} from '../../api/leads';

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
  Legend,
  Sector,
} from 'recharts';

// ------ Цвета / словари ------

const ANALYTICS_LAYOUT_VERSION = '2026-01-30-premium';

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
const THEME_PRESETS: Array<{
  key: ThemeKey;
  label: string;
  primary: string;
  palette: string[];
}> = [
  { key: 'lumiva', label: 'Lumiva', primary: '#0ea5e9', palette: PALETTES.lumiva },
  { key: 'ocean', label: 'Ocean', primary: '#2563eb', palette: PALETTES.ocean },
  { key: 'sunset', label: 'Sunset', primary: '#f97316', palette: PALETTES.sunset },
  { key: 'forest', label: 'Forest', primary: '#16a34a', palette: PALETTES.forest },
  { key: 'red', label: 'Red', primary: '#e11d48', palette: ['#e11d48', '#f43f5e', '#fb7185', '#f97316', '#fecaca'] },
];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

// локальное расширение LeadStats — чтобы не трогать тип в api/leads.ts
type ExtendedLeadStats = LeadStats & {
  totalToday?: number;
  totalThisWeek?: number;
  totalThisMonth?: number;
};

type StatusChartPoint = {
  code: string;
  label: string;
  count: number;
};

type PeriodId = '7d' | '30d' | '1y' | 'all' | 'custom';

type WidgetType = 'metric' | 'donut' | 'bar' | 'table' | 'formula';
type WidgetSize = 'sm' | 'md' | 'lg';
type ThemeKey = 'lumiva' | 'ocean' | 'sunset' | 'forest' | 'red';
type FormulaScope = 'status' | 'source' | 'manager' | 'country';
type FormulaMode = 'count' | 'percent';
type FormulaFn = 'count' | 'percent' | 'ratio' | 'diff' | 'sumif';
type FormulaOperandType =
  | 'total'
  | 'winRate'
  | 'won'
  | 'lost'
  | 'today'
  | 'week'
  | 'month'
  | 'sources'
  | 'managers'
  | 'countries'
  | 'status'
  | 'source'
  | 'manager'
  | 'country';
type MetricKey =
  | 'total'
  | 'won'
  | 'lost'
  | 'winRate'
  | 'today'
  | 'week'
  | 'month'
  | 'sources'
  | 'managers';
type ChartKey = 'status' | 'source';
type TableKey = 'managers' | 'countries';

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
  formulaFilters?: Array<{ scope: FormulaScope; key: string }>;
  metricKey?: MetricKey;
  chartKey?: ChartKey;
  tableKey?: TableKey;
};


export const LeadsAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [stats, setStats] = useState<ExtendedLeadStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');
  const periodLabels = useMemo<Record<PeriodId, string>>(
    () => ({
      '7d': t('crm.leads.analytics.period.days7'),
      '30d': t('crm.leads.analytics.period.days30'),
      '1y': t('crm.leads.analytics.period.year1'),
      all: t('crm.leads.analytics.period.all'),
      custom: t('crm.leads.analytics.period.custom'),
    }),
    [t],
  );
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [dragWidgetId, setDragWidgetId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<WidgetType>('metric');
  const [draftMetric, setDraftMetric] = useState<MetricKey>('total');
  const [draftChart, setDraftChart] = useState<ChartKey>('status');
  const [draftTable, setDraftTable] = useState<TableKey>('managers');
  const [draftFormulaFn, setDraftFormulaFn] =
    useState<FormulaFn>('sumif');
  const [draftFormulaMode, setDraftFormulaMode] =
    useState<FormulaMode>('count');
  const [draftFormulaLeftType, setDraftFormulaLeftType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaLeftKey, setDraftFormulaLeftKey] = useState<string>('won');
  const [draftFormulaRightType, setDraftFormulaRightType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaRightKey, setDraftFormulaRightKey] =
    useState<string>('lost');
  const [draftFormulaFilters, setDraftFormulaFilters] = useState<
    Array<{ scope: FormulaScope; key: string }>
  >([{ scope: 'status', key: 'won' }]);
  const [draftSize, setDraftSize] = useState<WidgetSize>('md');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState<ThemeKey>('lumiva');
  const [draftShowLabels, setDraftShowLabels] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState<Record<string, number | null>>(
    {},
  );
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startY: number;
    startSize: WidgetSize;
    startHeight: number;
    minHeight: number;
    axis: 'x' | 'y' | 'both';
  } | null>(null);

  // ------ загрузка с учётом периода ------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // предполагаем, что fetchLeadStats умеет принимать range,
        // если нет — просто проигнорирует аргумент
        const res = await (fetchLeadStats as any)(
          period === 'all' || period === 'custom' ? undefined : period,
        );
        if (cancelled) return;
        setStats(res as ExtendedLeadStats);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;
        setError(e.message || t('crm.leads.analytics.errors.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [period, t]);

  const totalLeads = stats?.total ?? 0;
  const totalWon =
    stats?.byStatus.find((s) => s.status === 'won')?.count ?? 0;
  const totalLost =
    stats?.byStatus.find((s) => s.status === 'lost')?.count ?? 0;
    

  const winRate =
    totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

  const totalSourceLeads =
  stats?.bySource.reduce((sum, s) => sum + s.count, 0) ?? 0;

  const sourcesCount = stats?.bySource.length ?? 0;
  const managersCount = stats?.byManager.length ?? 0;
  const countriesCount = stats?.byCountry.length ?? 0;

  const totalToday = stats?.totalToday ?? 0;
  const totalThisWeek = stats?.totalThisWeek ?? 0;
  const totalThisMonth = stats?.totalThisMonth ?? 0;

  const statusLabels = useMemo<Record<string, string>>(
    () => ({
      new: t('crm.leads.statuses.new'),
      in_progress: t('crm.leads.statuses.inProgress'),
      waiting: t('crm.leads.statuses.waiting'),
      won: t('crm.leads.statuses.won'),
      lost: t('crm.leads.statuses.lost'),
    }),
    [t],
  );

  const statusChartData: StatusChartPoint[] = useMemo(
    () =>
      stats?.byStatus.map((s) => ({
        code: s.status,
        label: statusLabels[s.status] ?? s.status,
        count: s.count,
      })) ?? [],
    [stats, statusLabels],
  );

  const metricOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.leads.analytics.kpis.total.title') },
      { id: 'won', label: t('crm.leads.analytics.kpis.won.title') },
      { id: 'lost', label: t('crm.leads.analytics.kpis.lost.title') },
      { id: 'winRate', label: t('crm.leads.analytics.kpis.conversion.title') },
      { id: 'today', label: t('crm.leads.analytics.summary.today.title') },
      { id: 'week', label: t('crm.leads.analytics.summary.week.title') },
      { id: 'month', label: t('crm.leads.analytics.summary.month.title') },
      { id: 'sources', label: t('crm.leads.analytics.kpis.sources') },
      { id: 'managers', label: t('crm.leads.analytics.kpis.managers') },
    ],
    [t],
  );

  const chartOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.leads.analytics.statuses.title') },
      { id: 'source', label: t('crm.leads.analytics.sources.title') },
    ],
    [t],
  );
  const widgetTypeOptions = useMemo(
    () => [
      { id: 'metric', label: t('crm.leads.analytics.widgets.type.metric') },
      { id: 'donut', label: t('crm.leads.analytics.widgets.type.donut') },
      { id: 'bar', label: t('crm.leads.analytics.widgets.type.bar') },
      { id: 'table', label: t('crm.leads.analytics.widgets.type.table') },
      { id: 'formula', label: t('crm.leads.analytics.widgets.type.formula') },
    ],
    [t],
  );

  const tableOptions = useMemo(
    () => [
      { id: 'managers', label: t('crm.leads.analytics.managers.title') },
      { id: 'countries', label: t('crm.leads.analytics.countries.title') },
    ],
    [t],
  );

  const formulaScopeOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.leads.analytics.formula.scope.status') },
      { id: 'source', label: t('crm.leads.analytics.formula.scope.source') },
      { id: 'manager', label: t('crm.leads.analytics.formula.scope.manager') },
      { id: 'country', label: t('crm.leads.analytics.formula.scope.country') },
    ],
    [t],
  );

  const formulaFunctionOptions = useMemo(
    () => [
      { id: 'sumif', label: t('crm.leads.analytics.formula.fn.sumif') },
      { id: 'count', label: t('crm.leads.analytics.formula.fn.count') },
      { id: 'percent', label: t('crm.leads.analytics.formula.fn.percent') },
      { id: 'ratio', label: t('crm.leads.analytics.formula.fn.ratio') },
      { id: 'diff', label: t('crm.leads.analytics.formula.fn.diff') },
    ],
    [t],
  );

  const formulaModeOptions = useMemo(
    () => [
      { id: 'count', label: t('crm.leads.analytics.formula.mode.count') },
      { id: 'percent', label: t('crm.leads.analytics.formula.mode.percent') },
    ],
    [t],
  );

  const formulaValueItems = useMemo(() => {
    return {
      status: Object.entries(statusLabels).map(([id, label]) => ({
        id,
        label,
      })),
      source: (stats?.bySource ?? []).map((s) => ({
        id: s.source || 'unknown',
        label: s.source || t('crm.leads.analytics.tooltips.unknown'),
      })),
      manager: (stats?.byManager ?? []).map((s) => ({
        id: s.manager || 'unknown',
        label: s.manager || t('crm.leads.analytics.tooltips.unknown'),
      })),
      country: (stats?.byCountry ?? []).map((s) => ({
        id: s.country || 'unknown',
        label: s.country || t('crm.leads.analytics.tooltips.unknown'),
      })),
    };
  }, [statusLabels, stats, t]);

  const formulaValueFallback = useMemo(
    () => [
      {
        id: 'unknown',
        label: t('crm.leads.analytics.tooltips.unknown'),
      },
    ],
    [t],
  );

  const formulaOperandOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.leads.analytics.kpis.total.title') },
      { id: 'winRate', label: t('crm.leads.analytics.kpis.conversion.title') },
      { id: 'won', label: t('crm.leads.analytics.kpis.won.title') },
      { id: 'lost', label: t('crm.leads.analytics.kpis.lost.title') },
      { id: 'today', label: t('crm.leads.analytics.summary.today.title') },
      { id: 'week', label: t('crm.leads.analytics.summary.week.title') },
      { id: 'month', label: t('crm.leads.analytics.summary.month.title') },
      { id: 'sources', label: t('crm.leads.analytics.kpis.sources') },
      { id: 'managers', label: t('crm.leads.analytics.kpis.managers') },
      { id: 'countries', label: t('crm.leads.analytics.countries.title') },
      { id: 'status', label: t('crm.leads.analytics.formula.scope.status') },
      { id: 'source', label: t('crm.leads.analytics.formula.scope.source') },
      { id: 'manager', label: t('crm.leads.analytics.formula.scope.manager') },
      { id: 'country', label: t('crm.leads.analytics.formula.scope.country') },
    ],
    [t],
  );

  const getDefaultHeight = (size: WidgetSize, type: WidgetType) => {
    if (type === 'table') {
      return size === 'lg' ? 420 : size === 'md' ? 360 : 300;
    }
    if (type === 'donut' || type === 'bar') {
      return size === 'lg' ? 380 : size === 'md' ? 320 : 260;
    }
    return size === 'lg' ? 280 : size === 'md' ? 240 : 200;
  };

  const defaultWidgets = useMemo<WidgetConfig[]>(
    () => [
      {
        id: 'metric-today',
        type: 'metric',
        title: t('crm.leads.analytics.summary.today.title'),
        metricKey: 'today',
        size: 'sm',
        height: getDefaultHeight('sm', 'metric'),
      },
      {
        id: 'metric-week',
        type: 'metric',
        title: t('crm.leads.analytics.summary.week.title'),
        metricKey: 'week',
        size: 'sm',
        height: getDefaultHeight('sm', 'metric'),
      },
      {
        id: 'metric-month',
        type: 'metric',
        title: t('crm.leads.analytics.summary.month.title'),
        metricKey: 'month',
        size: 'sm',
        height: getDefaultHeight('sm', 'metric'),
      },
      {
        id: 'metric-total',
        type: 'metric',
        title: t('crm.leads.analytics.kpis.total.title'),
        metricKey: 'total',
        size: 'md',
        height: getDefaultHeight('md', 'metric'),
      },
      {
        id: 'metric-won',
        type: 'metric',
        title: t('crm.leads.analytics.kpis.won.title'),
        metricKey: 'won',
        size: 'md',
        height: getDefaultHeight('md', 'metric'),
      },
      {
        id: 'metric-lost',
        type: 'metric',
        title: t('crm.leads.analytics.kpis.lost.title'),
        metricKey: 'lost',
        size: 'md',
        height: getDefaultHeight('md', 'metric'),
      },
      {
        id: 'metric-winrate',
        type: 'metric',
        title: t('crm.leads.analytics.kpis.conversion.title'),
        metricKey: 'winRate',
        size: 'md',
        height: getDefaultHeight('md', 'metric'),
      },
      {
        id: 'chart-status',
        type: 'donut',
        title: t('crm.leads.analytics.statuses.title'),
        chartKey: 'status',
        showLabels: true,
        size: 'lg',
        height: getDefaultHeight('lg', 'donut'),
      },
      {
        id: 'chart-sources',
        type: 'bar',
        title: t('crm.leads.analytics.sources.title'),
        chartKey: 'source',
        size: 'lg',
        height: getDefaultHeight('lg', 'bar'),
      },
      {
        id: 'table-managers',
        type: 'table',
        title: t('crm.leads.analytics.managers.title'),
        tableKey: 'managers',
        size: 'lg',
        height: getDefaultHeight('lg', 'table'),
      },
      {
        id: 'table-countries',
        type: 'table',
        title: t('crm.leads.analytics.countries.title'),
        tableKey: 'countries',
        size: 'md',
        height: getDefaultHeight('md', 'table'),
      },
    ],
    [t],
  );

  const hasData = !!stats && !loading && !error;
  const isEditing = editOpen;

  useEffect(() => {
    try {
      const version = localStorage.getItem('leads_analytics_version');
      const raw = localStorage.getItem('leads_analytics_widgets');
      if (version === ANALYTICS_LAYOUT_VERSION && raw) {
        const parsed = JSON.parse(raw) as WidgetConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setWidgets(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setWidgets(defaultWidgets);
    try {
      localStorage.setItem('leads_analytics_version', ANALYTICS_LAYOUT_VERSION);
    } catch {
      // ignore
    }
  }, [defaultWidgets]);

  useEffect(() => {
    try {
      if (widgets.length > 0) {
        localStorage.setItem(
          'leads_analytics_widgets',
          JSON.stringify(widgets),
        );
        localStorage.setItem('leads_analytics_version', ANALYTICS_LAYOUT_VERSION);
      }
    } catch {
      // ignore
    }
  }, [widgets]);

  useEffect(() => {
    if (draftType === 'metric') {
      const label = metricOptions.find((m) => m.id === draftMetric)?.label;
      if (label) setDraftTitle(label);
      return;
    }
    if (draftType === 'donut' || draftType === 'bar') {
      const label = chartOptions.find((c) => c.id === draftChart)?.label;
      if (label) setDraftTitle(label);
      return;
    }
    if (draftType === 'formula') {
      const fnLabel = formulaFunctionOptions.find(
        (s) => s.id === draftFormulaFn,
      )?.label;
      if (fnLabel) setDraftTitle(fnLabel);
      return;
    }
    if (draftType === 'table') {
      const label = tableOptions.find((c) => c.id === draftTable)?.label;
      if (label) setDraftTitle(label);
    }
  }, [
    draftType,
    draftMetric,
    draftChart,
    draftTable,
    draftFormulaFn,
    metricOptions,
    chartOptions,
    tableOptions,
    formulaFunctionOptions,
  ]);

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
          item.id === resizing.id
            ? { ...item, size: nextSize, height: nextHeight }
            : item,
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
    if (draftFormulaLeftType === 'status') {
      ensureKey('status', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'source') {
      ensureKey('source', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'manager') {
      ensureKey('manager', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'country') {
      ensureKey('country', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaRightType === 'status') {
      ensureKey('status', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'source') {
      ensureKey('source', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'manager') {
      ensureKey('manager', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'country') {
      ensureKey('country', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    draftFormulaFilters.forEach((filter, index) => {
      const items = formulaValueItems[filter.scope];
      const list = items.length ? items : formulaValueFallback;
      if (!list.find((item) => item.id === filter.key)) {
        const next = [...draftFormulaFilters];
        next[index] = { ...next[index], key: list[0].id };
        setDraftFormulaFilters(next);
      }
    });
  }, [
    draftFormulaLeftType,
    draftFormulaLeftKey,
    draftFormulaRightType,
    draftFormulaRightKey,
    draftFormulaFilters,
    formulaValueItems,
    formulaValueFallback,
  ]);

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
      title: draftTitle || 'Новый блок',
      size: draftSize,
      height: getDefaultHeight(draftSize, draftType),
      themeKey: draftTheme,
      showLabels: draftType === 'donut' ? draftShowLabels : undefined,
      formulaFn: draftType === 'formula' ? draftFormulaFn : undefined,
      formulaLeftType:
        draftType === 'formula' ? draftFormulaLeftType : undefined,
      formulaLeftKey: draftType === 'formula' ? draftFormulaLeftKey : undefined,
      formulaRightType:
        draftType === 'formula' ? draftFormulaRightType : undefined,
      formulaRightKey:
        draftType === 'formula' ? draftFormulaRightKey : undefined,
      formulaMode: draftType === 'formula' ? draftFormulaMode : undefined,
      formulaFilters:
        draftType === 'formula' ? draftFormulaFilters : undefined,
      metricKey: draftType === 'metric' ? draftMetric : undefined,
      chartKey:
        draftType === 'donut' || draftType === 'bar' ? draftChart : undefined,
      tableKey: draftType === 'table' ? draftTable : undefined,
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
    setDraftFormulaLeftKey(widget.formulaLeftKey ?? 'won');
    setDraftFormulaRightType(
      (widget.formulaRightType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaRightKey(widget.formulaRightKey ?? 'lost');
    setDraftFormulaMode((widget.formulaMode ?? 'count') as FormulaMode);
    setDraftFormulaFilters(
      widget.formulaFilters?.length
        ? widget.formulaFilters
        : [{ scope: 'status', key: 'won' }],
    );
    setDraftMetric((widget.metricKey ?? metricOptions[0].id) as MetricKey);
    setDraftChart((widget.chartKey ?? chartOptions[0].id) as ChartKey);
    setDraftTable((widget.tableKey ?? tableOptions[0].id) as TableKey);
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
                title: draftTitle || item.title || 'Новый блок',
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
                formulaFilters:
                  draftType === 'formula'
                    ? draftFormulaFilters
                    : undefined,
                metricKey: draftType === 'metric' ? draftMetric : undefined,
                chartKey:
                  draftType === 'donut' || draftType === 'bar'
                    ? draftChart
                    : undefined,
                tableKey: draftType === 'table' ? draftTable : undefined,
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
      localStorage.setItem(
        'leads_analytics_widgets',
        JSON.stringify(defaultWidgets),
      );
      localStorage.setItem('leads_analytics_version', ANALYTICS_LAYOUT_VERSION);
    } catch {
      // ignore
    }
    setResetOpen(false);
  };

  const renderActiveDonut = (props: any) => {
    const {
      cx,
      cy,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      cornerRadius,
    } = props;
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

  const resolveMetricValue = (key?: MetricKey) => {
    switch (key) {
      case 'total':
        return totalLeads.toLocaleString(locale);
      case 'won':
        return totalWon.toLocaleString(locale);
      case 'lost':
        return totalLost.toLocaleString(locale);
      case 'winRate':
        return `${winRate}%`;
      case 'today':
        return totalToday.toLocaleString(locale);
      case 'week':
        return totalThisWeek.toLocaleString(locale);
      case 'month':
        return totalThisMonth.toLocaleString(locale);
      case 'sources':
        return sourcesCount.toLocaleString(locale);
      case 'managers':
        return managersCount.toLocaleString(locale);
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
      type === 'table' ? 240 : type === 'donut' || type === 'bar' ? 220 : 160;
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

  const renderWidget = (w: WidgetConfig) => {
    const widgetHeight = w.height ?? getDefaultHeight(w.size, w.type);
    if (w.type === 'metric') {
      const theme = resolveTheme(w.themeKey);
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div
            className="text-2xl font-semibold"
            style={{ color: theme.primary }}
          >
            {resolveMetricValue(w.metricKey)}
          </div>
          <div className="text-[11px] text-slate-500">
            {period === 'custom'
              ? t('crm.leads.analytics.period.custom')
              : periodLabels[period]}
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
      const filters =
        w.formulaFilters && w.formulaFilters.length > 0
          ? w.formulaFilters
          : [{ scope: 'status', key: 'won' }];

      const resolveOperand = (type: FormulaOperandType, key?: string) => {
        if (type === 'total') return totalLeads;
        if (type === 'winRate') return winRate;
        if (type === 'won') return totalWon;
        if (type === 'lost') return totalLost;
        if (type === 'today') return totalToday;
        if (type === 'week') return totalThisWeek;
        if (type === 'month') return totalThisMonth;
        if (type === 'sources') return sourcesCount;
        if (type === 'managers') return managersCount;
        if (type === 'countries') return countriesCount;
        if (type === 'status') {
          return (
            statusChartData.find((s) => s.code === key)?.count ?? 0
          );
        }
        if (type === 'source') {
          return (stats?.bySource ?? []).find((s) => s.source === key)?.count ?? 0;
        }
        if (type === 'manager') {
          return (
            (stats?.byManager ?? []).find((s) => s.manager === key)?.total ?? 0
          );
        }
        if (type === 'country') {
          return (stats?.byCountry ?? []).find((s) => s.country === key)?.count ?? 0;
        }
        return 0;
      };

      const resolveTotal = (type: FormulaOperandType) => {
        if (type === 'winRate') return 100;
        if (type === 'source') return totalSourceLeads;
        return totalLeads;
      };

      const resolveFilterCount = (scope: FormulaScope, key?: string) => {
        if (scope === 'status') {
          return statusChartData.find((s) => s.code === key)?.count ?? 0;
        }
        if (scope === 'source') {
          return (stats?.bySource ?? []).find((s) => s.source === key)?.count ?? 0;
        }
        if (scope === 'manager') {
          return (stats?.byManager ?? []).find((s) => s.manager === key)?.total ?? 0;
        }
        return (stats?.byCountry ?? []).find((s) => s.country === key)?.count ?? 0;
      };

      const filterGroups = filters.reduce<
        Partial<Record<FormulaScope, string[]>>
      >((acc, filter) => {
        const scope = filter.scope as FormulaScope;
        if (!acc[scope]) acc[scope] = [];
        acc[scope]!.push(filter.key);
        return acc;
      }, {});
      const groupTotals = Object.entries(filterGroups).map(([scope, keys]) =>
        keys.reduce(
          (sum, key) => sum + resolveFilterCount(scope as FormulaScope, key),
          0,
        ),
      );
      const filterValue = groupTotals.length
        ? Math.min(...groupTotals)
        : 0;

      const leftValue = resolveOperand(leftType, leftKey);
      const rightValue = resolveOperand(rightType, rightKey);
      const baseTotal =
        fn === 'sumif'
          ? Object.keys(filterGroups).every((s) => s === 'source')
            ? totalSourceLeads
            : totalLeads
          : resolveTotal(leftType);

      let primaryValue = leftValue;
      let secondaryValue: number | null = null;
      if (fn === 'count') {
        primaryValue = leftValue;
        secondaryValue =
          baseTotal > 0 ? Math.round((leftValue / baseTotal) * 100) : 0;
      } else if (fn === 'percent') {
        primaryValue =
          baseTotal > 0 ? Math.round((leftValue / baseTotal) * 100) : 0;
        secondaryValue = leftValue;
      } else if (fn === 'ratio') {
        primaryValue = rightValue > 0 ? Math.round((leftValue / rightValue) * 100) : 0;
        secondaryValue = rightValue;
      } else if (fn === 'diff') {
        primaryValue = leftValue - rightValue;
        secondaryValue = rightValue;
      } else if (fn === 'sumif') {
        primaryValue = filterValue;
        secondaryValue =
          baseTotal > 0 ? Math.round((filterValue / baseTotal) * 100) : 0;
      }

      if ((fn === 'count' || fn === 'sumif') && mode === 'percent') {
        const percentValue = secondaryValue ?? 0;
        secondaryValue = primaryValue;
        primaryValue = percentValue;
      }

      const primaryLabel =
        fn === 'percent' || fn === 'ratio' || mode === 'percent'
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
          <div
            className="text-2xl font-semibold"
            style={{ color: theme.primary }}
          >
            {primaryLabel}
          </div>
          {secondaryLabel && (
            <div className="text-[11px] text-slate-500">
              {secondaryLabel} ·{' '}
              {period === 'custom'
                ? t('crm.leads.analytics.period.custom')
                : periodLabels[period]}
            </div>
          )}
        </div>
      );
    }

    if (w.type === 'donut') {
      const donutData =
        w.chartKey === 'source'
          ? (stats?.bySource ?? []).map((s) => ({
              code: s.source || 'unknown',
              label: s.source || t('crm.leads.analytics.tooltips.unknown'),
              count: s.count,
            }))
          : statusChartData;
      const theme = resolveTheme(w.themeKey);
      const palette = theme.palette || CHART_COLORS;
      const donutTotal =
        w.chartKey === 'source' ? totalSourceLeads : totalLeads;
      const chartHeight = Math.max(widgetHeight - 80, 220);
      const activeIndex = activeDonut[w.id] ?? null;
      const activeProps =
        activeIndex === null
          ? {}
          : ({ activeIndex, activeShape: renderActiveDonut } as any);
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
                        opacity={
                          activeIndex === null || activeIndex === idx ? 1 : 0.3
                        }
                        style={{ transition: 'opacity 180ms ease' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      w.chartKey === 'source' ? (
                        <SourceTooltip total={donutTotal} />
                      ) : (
                        <StatusTooltip total={donutTotal} />
                      )
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {showLabels && (
              <div className="md:w-52 space-y-2">
                {donutData.map((entry, idx) => {
                  const percent =
                    donutTotal > 0
                      ? Math.round((entry.count / donutTotal) * 100)
                      : 0;
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
                          style={{
                            backgroundColor: palette[idx % palette.length],
                          }}
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
      const barData =
        w.chartKey === 'status'
          ? statusChartData.map((s) => ({
              label: s.label,
              count: s.count,
            }))
          : stats?.bySource ?? [];
      const theme = resolveTheme(w.themeKey);
      const palette = theme.palette || CHART_COLORS;
      const xKey = w.chartKey === 'status' ? 'label' : 'source';
      const totalBar =
        w.chartKey === 'status' ? totalLeads : totalSourceLeads;
      const chartHeight = Math.max(widgetHeight - 80, 220);
      return (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 8, right: 8, left: -8, bottom: 24 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey={xKey}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
                <Tooltip
                  content={
                    w.chartKey === 'status' ? (
                      <StatusTooltip total={totalBar} />
                    ) : (
                      <SourceTooltip total={totalBar} />
                    )
                  }
                />
                <Bar dataKey="count" radius={[8, 8, 4, 4]} barSize={28}>
                  {barData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={palette[idx % palette.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && w.tableKey === 'managers') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {w.title}
            </div>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.analytics.managers.count')}{' '}
              <span className="text-lumiva-accent">{managersCount}</span>
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
                    {t('crm.leads.analytics.managers.table.manager')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.leads.analytics.managers.table.leads')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.leads.analytics.managers.table.won')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.leads.analytics.managers.table.lost')}
                  </th>
                  <th className="py-1.5 pl-3 text-right font-normal">
                    {t('crm.leads.analytics.managers.table.winRate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(stats?.byManager ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 text-center text-slate-500"
                    >
                      {t('crm.leads.analytics.managers.empty')}
                    </td>
                  </tr>
                )}
                {(stats?.byManager ?? []).map((m) => {
                  const wr = m.total > 0 ? Math.round((m.won / m.total) * 100) : 0;
                  return (
                    <tr
                      key={m.manager}
                      className="border-b border-slate-200 last:border-none hover:bg-slate-100 transition-colors"
                    >
                      <td className="py-1.5 pr-3 text-lumiva-accent">
                        {m.manager}
                      </td>
                      <td className="py-1.5 px-3 text-right text-lumiva-accent">
                        {m.total}
                      </td>
                      <td className="py-1.5 px-3 text-right text-emerald-600">
                        {m.won}
                      </td>
                      <td className="py-1.5 px-3 text-right text-rose-600">
                        {m.lost}
                      </td>
                      <td className="py-1.5 pl-3 text-right text-sky-600">
                        {wr}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && w.tableKey === 'countries') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              {w.title}
            </div>
            <div className="text-[11px] text-slate-500">
              {t('crm.leads.analytics.countries.count')}{' '}
              <span className="text-lumiva-accent">
                {stats?.byCountry.length ?? 0}
              </span>
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
                    {t('crm.leads.analytics.countries.table.country')}
                  </th>
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.leads.analytics.countries.table.leads')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(stats?.byCountry ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="py-3 text-center text-slate-500"
                    >
                      {t('crm.leads.analytics.countries.empty')}
                    </td>
                  </tr>
                )}
                {(stats?.byCountry ?? []).map((c) => (
                  <tr
                    key={`${c.country || 'unknown'}-${c.count}`}
                    className="border-b border-slate-200 last:border-none hover:bg-slate-100 transition-colors"
                  >
                    <td className="py-1.5 pr-3 text-lumiva-accent">
                      {c.country || t('crm.leads.analytics.countries.unknown')}
                    </td>
                    <td className="py-1.5 px-3 text-right text-lumiva-accent">
                      {c.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="text-[11px] text-slate-500">
        Нет данных для отображения
      </div>
    );
  };

  const StatusTooltip: React.FC<any & { total: number }> = ({
    active,
    payload,
    total,
  }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload as { label: string; count: number };
    const percent =
      total > 0
        ? ((item.count / total) * 100).toFixed(1).replace('.0', '')
        : '0';

    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="font-medium">{item.label}</div>
        <div className="mt-1 flex items-center gap-2 text-slate-300">
          <span className="font-mono">
            {item.count.toLocaleString(locale)} {t('crm.leads.analytics.tooltips.leads')}
          </span>
          <span className="text-slate-500">· {percent}%</span>
        </div>
      </div>
    );
  };

  const SourceTooltip: React.FC<any & { total: number }> = ({
    active,
    payload,
    label,
    total,
  }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0].payload as { source: string; count: number };
    const percent =
      total > 0
        ? ((item.count / total) * 100).toFixed(1).replace('.0', '')
        : '0';

    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl">
        <div className="font-medium">
          {label || item.source || t('crm.leads.analytics.tooltips.unknown')}
        </div>
        <div className="mt-1 flex items-center gap-2 text-slate-300">
          <span className="font-mono">
            {item.count.toLocaleString(locale)} {t('crm.leads.analytics.tooltips.leads')}
          </span>
          <span className="text-slate-500">· {percent}%</span>
        </div>
      </div>
    );
  };

  // ------ UI ------

  return (
    <MainLayout>
      <div className="pb-10 space-y-6 md:space-y-8">
        {/* HERO / TOP BAR */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <div className="relative z-10 flex flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-7 md:py-6">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.28em] text-slate-500">
                {t('crm.leads.analytics.hero.kicker')}
              </div>
              <h1 className="text-xl font-semibold text-lumiva-accent md:text-2xl">
                {t('crm.leads.analytics.hero.title')}
              </h1>
              <p className="mt-1 max-w-xl text-xs text-slate-600 md:text-[13px]">
                {t('crm.leads.analytics.hero.subtitle')}
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">
                  {t('crm.leads.analytics.hero.note')}
                </span>
              </div>

              {/* переключатель периодов */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  <span className="text-[11px] text-slate-600 pl-1">
                    {t('crm.leads.analytics.period.label')}
                  </span>
                  <div className="flex">
                    {(['7d', '30d', '1y', 'all', 'custom'] as PeriodId[]).map(
                      (p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            if (p === 'custom') {
                              // сейчас custom = all; дальше можно повесить date-picker
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
                      ),
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="px-3 py-1.5 rounded-2xl bg-black text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] hover:bg-slate-900"
                >
                  + Добавить блок
                </button>
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="px-3 py-1.5 rounded-2xl border border-slate-200 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  {t('crm.leads.analytics.reset.button')}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* LOADING / ERROR */}
        {loading && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 md:p-5"
              >
                <div className="mb-3 h-3 w-20 rounded-full bg-slate-800" />
                <div className="mb-2 h-7 w-16 rounded-full bg-slate-700" />
                <div className="h-3 w-32 rounded-full bg-slate-800" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* CONSTRUCTOR */}
        <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-6 md:py-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Конструктор аналитики
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  Соберите дашборд под себя: метрики, графики, таблицы.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-[11px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.25)] hover:bg-slate-800"
              >
                + Добавить блок
              </button>
            </div>
            {!hasData && (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                Данные ещё не загружены — блоки можно настраивать заранее.
              </div>
            )}

            {widgets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] text-slate-500">
                Пока нет блоков. Добавьте первый через кнопку выше.
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
                        const node = (e.currentTarget as HTMLElement).cloneNode(
                          true,
                        ) as HTMLElement;
                        node.style.width = `${e.currentTarget.clientWidth}px`;
                        node.style.height = `${e.currentTarget.clientHeight}px`;
                        node.style.position = 'absolute';
                        node.style.top = '-9999px';
                        node.style.left = '-9999px';
                        node.style.borderRadius = '28px';
                        node.style.overflow = 'hidden';
                        node.style.boxShadow =
                          '0 20px 60px rgba(15, 23, 42, 0.15)';
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
                      className={`relative overflow-hidden rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:px-5 md:py-5 ${sizeClass(
                        w.size,
                      )} ${isResizing ? 'ring-2 ring-slate-900/20' : ''}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="cursor-move">⋮⋮</span>
                          <span>{w.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => openEditWidget(w)}
                            className="text-slate-500 hover:text-slate-900"
                          >
                            Настроить
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWidget(w.id)}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                      {renderWidget(w)}

                      {isResizing && (
                        <div className="pointer-events-none absolute inset-0 rounded-[28px] border border-slate-900/20" />
                      )}
                      {isResizing && (
                        <div className="absolute -top-2 right-4 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {w.size.toUpperCase()} · {Math.round(widgetHeight)}px
                        </div>
                      )}

                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'y', e)}
                        className="absolute -top-1 left-4 right-4 h-2 cursor-ns-resize"
                        title="Тяните, чтобы изменить высоту"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'y', e)}
                        className="absolute -bottom-1 left-4 right-4 h-2 cursor-ns-resize"
                        title="Тяните, чтобы изменить высоту"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                        className="absolute -left-1 top-4 bottom-4 w-2 cursor-ew-resize"
                        title="Тяните, чтобы изменить ширину"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                        className="absolute -right-1 top-4 bottom-4 w-2 cursor-ew-resize"
                        title="Тяните, чтобы изменить ширину"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                        className="absolute -top-1 -left-1 h-3 w-3 cursor-nwse-resize"
                        title="Тяните, чтобы изменить размер"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                        className="absolute -top-1 -right-1 h-3 w-3 cursor-nesw-resize"
                        title="Тяните, чтобы изменить размер"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                        className="absolute -bottom-1 -left-1 h-3 w-3 cursor-nesw-resize"
                        title="Тяните, чтобы изменить размер"
                      />
                      <div
                        onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                        className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize"
                        title="Тяните, чтобы изменить размер"
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
                + Добавить блок
              </button>
            </div>
          </section>
        {(addOpen || editOpen) && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Конструктор
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {isEditing ? 'Настройки блока' : 'Новый блок аналитики'}
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

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Тип блока
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
                      Что показываем
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
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Что показываем
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
                )}

                {draftType === 'table' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Что показываем
                    </label>
                    <select
                      value={draftTable}
                      onChange={(e) => setDraftTable(e.target.value as TableKey)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      {tableOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {draftType === 'formula' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        {t('crm.leads.analytics.formula.fn.label')}
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
                          {t('crm.leads.analytics.formula.block.sumif')}
                        </div>
                        {draftFormulaFilters.map((filter, index) => (
                          <div
                            key={`${filter.scope}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {t('crm.leads.analytics.formula.condition.label')}{' '}
                                {index + 1}
                              </div>
                              {draftFormulaFilters.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDraftFormulaFilters((prev) =>
                                      prev.filter((_, i) => i !== index),
                                    )
                                  }
                                  className="text-[10px] text-slate-400 hover:text-rose-500"
                                >
                                  {t('crm.leads.analytics.formula.condition.remove')}
                                </button>
                              )}
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-500 mb-1">
                                {t('crm.leads.analytics.formula.filter.scope')}
                              </label>
                              <select
                                value={filter.scope}
                                onChange={(e) => {
                                  const scope = e.target.value as FormulaScope;
                                  setDraftFormulaFilters((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], scope };
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
                              <label className="block text-[11px] text-slate-500 mb-1">
                                {t('crm.leads.analytics.formula.filter.value')}
                              </label>
                              <select
                                value={filter.key}
                                onChange={(e) => {
                                  const key = e.target.value;
                                  setDraftFormulaFilters((prev) => {
                                    const next = [...prev];
                                    next[index] = { ...next[index], key };
                                    return next;
                                  });
                                }}
                                className="w-full h-9 rounded-xl bg-white border border-slate-200 px-2 outline-none"
                              >
                                {(formulaValueItems[filter.scope].length
                                  ? formulaValueItems[filter.scope]
                                  : formulaValueFallback
                                ).map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftFormulaFilters((prev) => [
                              ...prev,
                              { scope: 'status', key: 'won' },
                            ])
                          }
                          className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] text-slate-500 hover:border-slate-400 hover:text-slate-700"
                        >
                          + {t('crm.leads.analytics.formula.condition.add')}
                        </button>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            {t('crm.leads.analytics.formula.output.label')}
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
                      </div>
                    )}
                    {draftFormulaFn !== 'sumif' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {t('crm.leads.analytics.formula.block.expression')}
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            {t('crm.leads.analytics.formula.left.label')}
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
                        {(draftFormulaLeftType === 'status' ||
                          draftFormulaLeftType === 'source' ||
                          draftFormulaLeftType === 'manager' ||
                          draftFormulaLeftType === 'country') && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              {t('crm.leads.analytics.formula.left.value')}
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
                                {t('crm.leads.analytics.formula.right.label')}
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
                            {(draftFormulaRightType === 'status' ||
                              draftFormulaRightType === 'source' ||
                              draftFormulaRightType === 'manager' ||
                              draftFormulaRightType === 'country') && (
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  {t('crm.leads.analytics.formula.right.value')}
                                </label>
                                <select
                                  value={draftFormulaRightKey}
                                  onChange={(e) =>
                                    setDraftFormulaRightKey(e.target.value)
                                  }
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
                        {(draftFormulaFn === 'count' ||
                          draftFormulaFn === 'diff') && (
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              {t('crm.leads.analytics.formula.output.label')}
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

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Цветовая тема
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
                      Показывать метки
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
                      Название блока
                    </label>
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      Размер
                    </label>
                    <select
                      value={draftSize}
                      onChange={(e) => setDraftSize(e.target.value as WidgetSize)}
                      className="w-full h-9 rounded-xl bg-slate-100 border border-slate-200 px-2 outline-none"
                    >
                      <option value="sm">Компактный</option>
                      <option value="md">Средний</option>
                      <option value="lg">Широкий</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={saveWidget}
                  className="px-4 py-2 rounded-xl !bg-slate-900 !text-white text-xs font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.25)] hover:bg-slate-800"
                >
                  {isEditing ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        )}
        {resetOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
              <h3 className="text-sm font-semibold text-slate-900">
                {t('crm.leads.analytics.reset.title')}
              </h3>
              <p className="mt-2 text-xs text-slate-600">
                {t('crm.leads.analytics.reset.message')}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-100"
                >
                  {t('crm.leads.analytics.reset.cancel')}
                </button>
                <button
                  type="button"
                  onClick={resetLayout}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  {t('crm.leads.analytics.reset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};
