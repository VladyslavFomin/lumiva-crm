// src/pages/projects/ProjectsAnalyticsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
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

type WidgetType = 'metric' | 'donut' | 'bar' | 'table' | 'formula';
type WidgetSize = 'sm' | 'md' | 'lg';
type ThemeKey = typeof THEME_PRESETS[number]['key'];

type FormulaScope = 'status' | 'category' | 'owner' | 'tag';
type FormulaMode = 'count' | 'percent';
type FormulaFn = 'count' | 'percent' | 'ratio' | 'diff' | 'sumif';
type FormulaOperandType =
  | 'total'
  | 'amount'
  | 'avgAmount'
  | 'owners'
  | 'categories'
  | 'tags'
  | 'status'
  | 'category'
  | 'owner'
  | 'tag';

type MetricKey =
  | 'total'
  | 'amount'
  | 'avgAmount'
  | 'owners'
  | 'categories'
  | 'tags'
  | 'statuses';
type ChartKey = 'status' | 'category' | 'owner' | 'tag';
type TableKey = 'projects' | 'owners' | 'categories';

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

export const ProjectsAnalyticsPage: React.FC = () => {
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
  const [draftType, setDraftType] = useState<WidgetType>('metric');
  const [draftMetric, setDraftMetric] = useState<MetricKey>('total');
  const [draftChart, setDraftChart] = useState<ChartKey>('status');
  const [draftTable, setDraftTable] = useState<TableKey>('projects');
  const [draftFormulaFn, setDraftFormulaFn] = useState<FormulaFn>('sumif');
  const [draftFormulaMode, setDraftFormulaMode] = useState<FormulaMode>('count');
  const [draftFormulaLeftType, setDraftFormulaLeftType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaLeftKey, setDraftFormulaLeftKey] = useState<string>('');
  const [draftFormulaRightType, setDraftFormulaRightType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaRightKey, setDraftFormulaRightKey] = useState<string>('');
  const [draftFormulaFilters, setDraftFormulaFilters] = useState<
    Array<{ scope: FormulaScope; key: string }>
  >([{ scope: 'status', key: '' }]);
  const [draftSize, setDraftSize] = useState<WidgetSize>('md');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState<ThemeKey>('lumiva');
  const [draftShowLabels, setDraftShowLabels] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [activeDonut, setActiveDonut] = useState<Record<string, number | null>>(
    {},
  );
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  useEffect(() => {
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
  }, [t]);

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

  const totalProjects = filteredItems.length;
  const totalAmount = useMemo(
    () => filteredItems.reduce((sum, p) => sum + (p.amount || 0), 0),
    [filteredItems],
  );
  const avgAmount = totalProjects > 0 ? Math.round(totalAmount / totalProjects) : 0;

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
      const raw = p.category || t('crm.projects.analytics.noCategory');
      const label = categoryLabels[raw] ?? raw;
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredItems, categoryLabels, t]);

  const currency = filteredItems[0]?.currency || 'EUR';
  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    return t('crm.projects.common.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };

  const metricOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.projects.analytics.kpis.total') },
      { id: 'amount', label: t('crm.projects.analytics.kpis.amount') },
      { id: 'avgAmount', label: t('crm.projects.analytics.kpis.avgAmount') },
      { id: 'owners', label: t('crm.projects.analytics.kpis.owners') },
      { id: 'categories', label: t('crm.projects.analytics.kpis.categories') },
      { id: 'tags', label: t('crm.projects.analytics.kpis.tags') },
      { id: 'statuses', label: t('crm.projects.analytics.kpis.statuses') },
    ],
    [t],
  );

  const chartOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.projects.analytics.statusChart.title') },
      { id: 'category', label: t('crm.projects.analytics.categoryChart.title') },
      { id: 'owner', label: t('crm.projects.analytics.ownerChart.title') },
      { id: 'tag', label: t('crm.projects.analytics.tagChart.title') },
    ],
    [t],
  );

  const widgetTypeOptions = useMemo(
    () => [
      { id: 'metric', label: t('crm.projects.analytics.widgets.type.metric') },
      { id: 'donut', label: t('crm.projects.analytics.widgets.type.donut') },
      { id: 'bar', label: t('crm.projects.analytics.widgets.type.bar') },
      { id: 'table', label: t('crm.projects.analytics.widgets.type.table') },
      { id: 'formula', label: t('crm.projects.analytics.widgets.type.formula') },
    ],
    [t],
  );

  const tableOptions = useMemo(
    () => [
      { id: 'projects', label: t('crm.projects.analytics.table.title') },
      { id: 'owners', label: t('crm.projects.analytics.ownersTable.title') },
      { id: 'categories', label: t('crm.projects.analytics.categoriesTable.title') },
    ],
    [t],
  );

  const formulaScopeOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.projects.analytics.formula.scope.status') },
      { id: 'category', label: t('crm.projects.analytics.formula.scope.category') },
      { id: 'owner', label: t('crm.projects.analytics.formula.scope.owner') },
      { id: 'tag', label: t('crm.projects.analytics.formula.scope.tag') },
    ],
    [t],
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
    ],
    [t],
  );

  const formulaValueItems = useMemo(
    () => ({
      status: Object.entries(statusLabels).map(([id, label]) => ({ id, label })),
      category: categoryChartData.map((c) => ({ id: c.label, label: c.label })),
      owner: owners.map((o) => ({ id: o.label, label: o.label })),
      tag: tags.map((t) => ({ id: t.label, label: t.label })),
    }),
    [statusLabels, categoryChartData, owners, tags],
  );

  const formulaValueFallback = useMemo(
    () => [{ id: 'unknown', label: t('crm.projects.analytics.tooltips.unknown') }],
    [t],
  );

  const formulaOperandOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.projects.analytics.kpis.total') },
      { id: 'amount', label: t('crm.projects.analytics.kpis.amount') },
      { id: 'avgAmount', label: t('crm.projects.analytics.kpis.avgAmount') },
      { id: 'owners', label: t('crm.projects.analytics.kpis.owners') },
      { id: 'categories', label: t('crm.projects.analytics.kpis.categories') },
      { id: 'tags', label: t('crm.projects.analytics.kpis.tags') },
      { id: 'status', label: t('crm.projects.analytics.formula.scope.status') },
      { id: 'category', label: t('crm.projects.analytics.formula.scope.category') },
      { id: 'owner', label: t('crm.projects.analytics.formula.scope.owner') },
      { id: 'tag', label: t('crm.projects.analytics.formula.scope.tag') },
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
    ],
    [t],
  );

  const hasData = !loading && !error;
  const isEditing = editOpen;

  useEffect(() => {
    try {
      const version = localStorage.getItem('projects_analytics_version');
      const raw = localStorage.getItem('projects_analytics_widgets');
      if (raw && version === ANALYTICS_LAYOUT_VERSION) {
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
  }, [defaultWidgets]);

  useEffect(() => {
    try {
      if (widgets.length > 0) {
        localStorage.setItem('projects_analytics_widgets', JSON.stringify(widgets));
        localStorage.setItem('projects_analytics_version', ANALYTICS_LAYOUT_VERSION);
      }
    } catch {
      // ignore
    }
  }, [widgets]);

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
      formulaFilters: draftType === 'formula' ? draftFormulaFilters : undefined,
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
    setDraftFormulaLeftKey(widget.formulaLeftKey ?? '');
    setDraftFormulaRightType(
      (widget.formulaRightType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaRightKey(widget.formulaRightKey ?? '');
    setDraftFormulaMode((widget.formulaMode ?? 'count') as FormulaMode);
    setDraftFormulaFilters(
      widget.formulaFilters?.length
        ? widget.formulaFilters
        : [{ scope: 'status', key: '' }],
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
                formulaFilters:
                  draftType === 'formula' ? draftFormulaFilters : undefined,
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
        'projects_analytics_widgets',
        JSON.stringify(defaultWidgets),
      );
      localStorage.setItem('projects_analytics_version', ANALYTICS_LAYOUT_VERSION);
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
    if (draftFormulaLeftType === 'status') {
      ensureKey('status', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'category') {
      ensureKey('category', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'owner') {
      ensureKey('owner', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaLeftType === 'tag') {
      ensureKey('tag', draftFormulaLeftKey, setDraftFormulaLeftKey);
    }
    if (draftFormulaRightType === 'status') {
      ensureKey('status', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'category') {
      ensureKey('category', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'owner') {
      ensureKey('owner', draftFormulaRightKey, setDraftFormulaRightKey);
    }
    if (draftFormulaRightType === 'tag') {
      ensureKey('tag', draftFormulaRightKey, setDraftFormulaRightKey);
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

  const resolveMetricValue = (key?: MetricKey) => {
    switch (key) {
      case 'total':
        return totalProjects.toLocaleString(locale);
      case 'amount':
        return formatAmount(totalAmount);
      case 'avgAmount':
        return formatAmount(avgAmount);
      case 'owners':
        return owners.length.toLocaleString(locale);
      case 'categories':
        return categoryChartData.length.toLocaleString(locale);
      case 'tags':
        return tags.length.toLocaleString(locale);
      case 'statuses':
        return statusChartData.length.toLocaleString(locale);
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
    if (w.type === 'metric') {
      const theme = resolveTheme(w.themeKey);
      return (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {w.title}
          </div>
          <div className="text-2xl font-semibold" style={{ color: theme.primary }}>
            {resolveMetricValue(w.metricKey)}
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
      const filters = w.formulaFilters && w.formulaFilters.length > 0
        ? w.formulaFilters
        : [{ scope: 'status', key: '' }];

      const resolveOperand = (type: FormulaOperandType, key?: string) => {
        if (type === 'total') return totalProjects;
        if (type === 'amount') return totalAmount;
        if (type === 'avgAmount') return avgAmount;
        if (type === 'owners') return owners.length;
        if (type === 'categories') return categoryChartData.length;
        if (type === 'tags') return tags.length;
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

      const resolveFilterCount = (scope: FormulaScope, key?: string) => {
        if (scope === 'status') {
          return statusChartData.find((s) => s.code === key)?.count ?? 0;
        }
        if (scope === 'category') {
          return categoryChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (scope === 'owner') {
          return owners.find((s) => s.label === key)?.count ?? 0;
        }
        return tags.find((s) => s.label === key)?.count ?? 0;
      };

      const filterGroups = filters.reduce<Partial<Record<FormulaScope, string[]>>>(
        (acc, filter) => {
          const scope = filter.scope as FormulaScope;
          if (!acc[scope]) acc[scope] = [];
          acc[scope]!.push(filter.key);
          return acc;
        },
        {},
      );

      const groupTotals = Object.entries(filterGroups).map(([scope, keys]) =>
        keys.reduce(
          (sum, key) => sum + resolveFilterCount(scope as FormulaScope, key),
          0,
        ),
      );

      const filterValue = groupTotals.length ? Math.min(...groupTotals) : 0;

      const leftValue = resolveOperand(leftType, leftKey);
      const rightValue = resolveOperand(rightType, rightKey);
      const baseTotal = totalProjects;

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
        primaryValue = filterValue;
        secondaryValue = baseTotal > 0 ? Math.round((filterValue / baseTotal) * 100) : 0;
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
      const donutData =
        w.chartKey === 'category'
          ? categoryChartData.map((c) => ({ code: c.label, label: c.label, count: c.count }))
          : w.chartKey === 'owner'
            ? owners.map((o) => ({ code: o.label, label: o.label, count: o.count }))
            : w.chartKey === 'tag'
              ? tags.map((t) => ({ code: t.label, label: t.label, count: t.count }))
              : statusChartData;
      const theme = resolveTheme(w.themeKey);
      const palette = theme.palette || CHART_COLORS;
      const donutTotal = totalProjects;
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
      const barData =
        w.chartKey === 'category'
          ? categoryChartData.map((c) => ({ label: c.label, count: c.count }))
          : w.chartKey === 'owner'
            ? owners.map((o) => ({ label: o.label, count: o.count }))
            : w.chartKey === 'tag'
              ? tags.map((t) => ({ label: t.label, count: t.count }))
              : statusChartData.map((s) => ({ label: s.label, count: s.count }));
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

    if (w.type === 'table' && w.tableKey === 'owners') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.ownersTable.total', { count: owners.length })}
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
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.projects.analytics.ownersTable.headers.projects')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.label} className="border-b border-slate-100 last:border-none">
                    <td className="py-1.5 pr-3 text-slate-700">{o.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">{o.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (w.type === 'table' && w.tableKey === 'categories') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
            <div className="text-[11px] text-slate-500">
              {t('crm.projects.analytics.categoriesTable.total', { count: categoryChartData.length })}
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
                  <th className="py-1.5 px-3 text-right font-normal">
                    {t('crm.projects.analytics.categoriesTable.headers.projects')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {categoryChartData.map((c) => (
                  <tr key={c.label} className="border-b border-slate-100 last:border-none">
                    <td className="py-1.5 pr-3 text-slate-700">{c.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">{c.count}</td>
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
            {t('crm.projects.analytics.table.total', { count: filteredItems.length })}
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
              {filteredItems.map((p) => (
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
                {t('crm.projects.analytics.kicker')}
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-900">
                {t('crm.projects.analytics.title')}
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl">
                {t('crm.projects.analytics.subtitle')}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">{t('crm.projects.analytics.hero.note')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-[11px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.25)] hover:bg-slate-800"
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
                      <div className="flex items-center gap-2 text-[11px]">
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
                    {isResizing && (
                      <div className="absolute -top-2 right-4 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {w.size.toUpperCase()} · {Math.round(widgetHeight)}px
                      </div>
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
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_25px_80px_rgba(15,23,42,0.35)]">
              <div className="mb-4 flex items-center justify-between">
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
                )}

                {draftType === 'table' && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">
                      {t('crm.projects.analytics.modal.data')}
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
                        {draftFormulaFilters.map((filter, index) => (
                          <div
                            key={`${filter.scope}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                                {t('crm.projects.analytics.formula.condition.label')} {index + 1}
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
                                  {t('crm.projects.analytics.formula.condition.remove')}
                                </button>
                              )}
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
                                {t('crm.projects.analytics.formula.filter.value')}
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
                              { scope: 'status', key: '' },
                            ])
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
                        {(draftFormulaLeftType === 'status' ||
                          draftFormulaLeftType === 'category' ||
                          draftFormulaLeftType === 'owner' ||
                          draftFormulaLeftType === 'tag') && (
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
                            {(draftFormulaRightType === 'status' ||
                              draftFormulaRightType === 'category' ||
                              draftFormulaRightType === 'owner' ||
                              draftFormulaRightType === 'tag') && (
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

              <div className="mt-4 flex items-center justify-end gap-2">
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
                  className="px-4 py-2 rounded-xl !bg-slate-900 !text-white text-xs font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.25)] hover:bg-slate-800"
                >
                  {isEditing
                    ? t('crm.projects.analytics.actions.save')
                    : t('crm.projects.analytics.actions.add')}
                </button>
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
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  {t('crm.projects.analytics.reset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
