// src/pages/sales/SalesAnalyticsPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import { useTranslation } from 'react-i18next';
import {
  fetchSalesAnalytics,
  exportSalesAnalytics,
  fetchSalesAnalyticsPreset,
  saveSalesAnalyticsPreset,
  type Sale,
  type SalesAnalyticsResponse,
} from '../../api/sales';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
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
} from 'recharts';

const ANALYTICS_LAYOUT_VERSION = '2026-02-05-sales-premium';

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
type DateField = 'saleDate' | 'createdAt';
type CurrencyMode = 'native' | 'converted';
type ValueMode = 'count' | 'amount';

type FormulaScope = 'status' | 'channel' | 'product' | 'market' | 'manager' | 'currency' | 'custom';
type FormulaMode = 'count' | 'percent';
type FormulaFn = 'count' | 'percent' | 'ratio' | 'diff' | 'sumif';
type FormulaOperandType =
  | 'total'
  | 'amount'
  | 'avgAmount'
  | 'channels'
  | 'products'
  | 'markets'
  | 'managers'
  | 'statuses'
  | 'currencies'
  | 'status'
  | 'channel'
  | 'product'
  | 'market'
  | 'manager'
  | 'currency'
  | 'custom';

type MetricKey =
  | 'total'
  | 'amount'
  | 'avgAmount'
  | 'channels'
  | 'products'
  | 'markets'
  | 'managers'
  | 'statuses'
  | 'currencies';

type ChartKey =
  | 'status'
  | 'channel'
  | 'product'
  | 'market'
  | 'manager'
  | 'currency'
  | 'timeline'
  | `custom:${string}`;

type TableKey =
  | 'sales'
  | 'channels'
  | 'products'
  | 'markets'
  | 'managers'
  | `custom:${string}`;

type FormulaFilter = {
  scope: FormulaScope;
  key: string;
  fieldKey?: string;
};

type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  height?: number;
  themeKey?: ThemeKey;
  showLabels?: boolean;
  valueMode?: ValueMode;
  compareChannelIds?: string[];
  statusFilter?: string[];
  formulaFn?: FormulaFn;
  formulaLeftType?: FormulaOperandType;
  formulaLeftKey?: string;
  formulaRightType?: FormulaOperandType;
  formulaRightKey?: string;
  formulaMode?: FormulaMode;
  formulaFilters?: FormulaFilter[];
  metricKey?: MetricKey;
  chartKey?: ChartKey;
  tableKey?: TableKey;
  currencyMode?: CurrencyMode;
  displayCurrency?: string;
  currencyRates?: Record<string, number>;
};

type StatusChartPoint = { code: string; label: string; count: number; amount: number };

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

const formatIsoDate = (d: Date) => d.toISOString().slice(0, 10);

const getMonthKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const parseCustomOperand = (key?: string) => {
  if (!key) return { fieldKey: '', value: '' };
  const parts = key.split('::');
  const fieldKey = parts.shift() || '';
  const value = parts.join('::');
  return { fieldKey, value };
};


export const SalesAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  const [analytics, setAnalytics] = useState<SalesAnalyticsResponse | null>(null);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [dateField, setDateField] = useState<DateField>('saleDate');
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('converted');
  const [displayCurrency, setDisplayCurrency] = useState<string>('EUR');
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});

  const periodLabels = useMemo<Record<PeriodId, string>>(
    () => ({
      '7d': t('crm.sales.analytics.period.days7'),
      '30d': t('crm.sales.analytics.period.days30'),
      '1y': t('crm.sales.analytics.period.year1'),
      all: t('crm.sales.analytics.period.all'),
      custom: t('crm.sales.analytics.period.custom'),
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
  const [draftTable, setDraftTable] = useState<TableKey>('sales');
  const [draftFormulaFn, setDraftFormulaFn] = useState<FormulaFn>('sumif');
  const [draftFormulaMode, setDraftFormulaMode] = useState<FormulaMode>('count');
  const [draftFormulaLeftType, setDraftFormulaLeftType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaLeftKey, setDraftFormulaLeftKey] = useState<string>('');
  const [draftFormulaLeftCustomField, setDraftFormulaLeftCustomField] =
    useState<string>('');
  const [draftFormulaRightType, setDraftFormulaRightType] =
    useState<FormulaOperandType>('total');
  const [draftFormulaRightKey, setDraftFormulaRightKey] = useState<string>('');
  const [draftFormulaRightCustomField, setDraftFormulaRightCustomField] =
    useState<string>('');
  const [draftFormulaFilters, setDraftFormulaFilters] = useState<FormulaFilter[]>([
    { scope: 'status', key: '' },
  ]);
  const [draftSize, setDraftSize] = useState<WidgetSize>('md');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState<ThemeKey>('lumiva');
  const [draftShowLabels, setDraftShowLabels] = useState(true);
  const [draftValueMode, setDraftValueMode] = useState<ValueMode>('count');
  const [draftCompareChannels, setDraftCompareChannels] = useState<string[]>([]);
  const [draftStatusFilter, setDraftStatusFilter] = useState<string[]>([]);
  const [draftCurrencyMode, setDraftCurrencyMode] = useState<CurrencyMode>('converted');
  const [draftDisplayCurrency, setDraftDisplayCurrency] = useState<string>('EUR');
  const [draftCurrencyRates, setDraftCurrencyRates] = useState<Record<string, number>>({});
  const [resetOpen, setResetOpen] = useState(false);
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [exporting, setExporting] = useState(false);
  const [presetReady, setPresetReady] = useState(false);
  const [ratesOpen, setRatesOpen] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const statusLabels = useMemo(
    () => ({
      new: t('crm.sales.status.new'),
      pending: t('crm.sales.status.pending'),
      confirmed: t('crm.sales.status.confirmed'),
      cancelled: t('crm.sales.status.cancelled'),
      refunded: t('crm.sales.status.refunded'),
      other: t('crm.sales.status.other'),
    }),
    [t],
  );

  useEffect(() => {
    let alive = true;
    const loadMeta = async () => {
      try {
        const [salesChannels, saleFields] = await Promise.all([
          fetchSalesChannels(),
          fetchCustomFields('sale'),
        ]);
        if (!alive) return;
        setChannels(salesChannels);
        setCustomFields(saleFields);
      } catch (e) {
        console.error(e);
      }
    };
    loadMeta();
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    let alive = true;
    const loadPreset = async () => {
      try {
        const preset = await fetchSalesAnalyticsPreset();
        if (!alive) return;
        if (preset && preset.widgets) {
          if (preset.layoutVersion === ANALYTICS_LAYOUT_VERSION) {
            setWidgets(preset.widgets as WidgetConfig[]);
          }
          if (preset.settings) {
            const settings = preset.settings as Partial<{
              dateField: DateField;
              currencyMode: CurrencyMode;
              displayCurrency: string;
              rates: Record<string, number>;
            }>;
            if (settings.dateField) setDateField(settings.dateField);
            if (settings.currencyMode) setCurrencyMode(settings.currencyMode);
            if (settings.displayCurrency) setDisplayCurrency(settings.displayCurrency);
            if (settings.rates) setCurrencyRates(settings.rates);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setPresetReady(true);
      }
    };
    loadPreset();
    return () => {
      alive = false;
    };
  }, []);

  const resolveRange = () => {
    const now = new Date();
    if (period === 'custom') {
      return {
        from: customFrom || undefined,
        to: customTo || undefined,
      };
    }
    if (period === 'all') return { from: undefined, to: undefined };
    const cutoff = new Date(now);
    if (period === '7d') cutoff.setDate(now.getDate() - 6);
    if (period === '30d') cutoff.setDate(now.getDate() - 29);
    if (period === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    return { from: formatIsoDate(cutoff), to: formatIsoDate(now) };
  };

  const handleExport = async (format: 'csv' | 'xls') => {
    try {
      setExporting(true);
      const { from, to } = resolveRange();
      const blob = await exportSalesAnalytics({
        from,
        to,
        dateField,
        currencyMode,
        displayCurrency,
        rates: currencyRates,
        format,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-analytics-${formatIsoDate(new Date())}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = resolveRange();
        const res = await fetchSalesAnalytics({
          from,
          to,
          dateField,
          currencyMode,
          displayCurrency,
          rates: currencyRates,
          sampleLimit: 2000,
        });
        if (!alive) return;
        setAnalytics(res);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.sales.analytics.errors.loadFailed'));
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadAnalytics();
    return () => {
      alive = false;
    };
  }, [
    period,
    customFrom,
    customTo,
    dateField,
    currencyMode,
    displayCurrency,
    JSON.stringify(currencyRates),
    t,
  ]);

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.id, c])), [channels]);

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const sampleSales = useMemo(() => analytics?.sampleSales ?? [], [analytics]);

  const statusOptions = useMemo(
    () =>
      Object.entries(statusLabels).map(([key, label]) => ({
        id: key,
        label,
      })),
    [statusLabels],
  );

  const currencies = useMemo(() => {
    const base = ['EUR', 'USD', 'RUB'];
    const fromAnalytics =
      analytics?.byCurrency
        ?.map((row) => row.label)
        .filter(Boolean)
        .map((cur) => String(cur).toUpperCase()) ?? [];
    return Array.from(new Set([...base, ...fromAnalytics]));
  }, [analytics]);

  useEffect(() => {
    if (!currencies.length) return;
    if (!currencies.includes(displayCurrency)) {
      setDisplayCurrency(currencies[0]);
    }
    setCurrencyRates((prev) => {
      const next = { ...prev };
      currencies.forEach((cur) => {
        if (!next[cur]) next[cur] = cur === displayCurrency ? 1 : 0;
      });
      return next;
    });
  }, [currencies, displayCurrency]);

  useEffect(() => {
    if (currencyMode !== 'converted') {
      setRatesOpen(false);
    }
  }, [currencyMode]);

  const resolveCurrencyConfig = () => {
    return { mode: currencyMode, display: displayCurrency };
  };

  const resolveWidgetCurrencyConfig = (w?: WidgetConfig) => {
    const mode = w?.currencyMode ?? currencyMode;
    const display = w?.displayCurrency ?? displayCurrency;
    const rates =
      w?.currencyRates && Object.keys(w.currencyRates).length
        ? w.currencyRates
        : currencyRates;
    return { mode, display, rates };
  };

  const convertSaleAmount = (
    sale: Sale,
    config: ReturnType<typeof resolveWidgetCurrencyConfig>,
  ) => {
    if (config.mode === 'native') {
      return sale.currency === config.display ? sale.amount : 0;
    }
    const rate = config.rates[sale.currency] ?? (sale.currency === config.display ? 1 : 0);
    return rate ? sale.amount * rate : 0;
  };

  const resolveSampleDate = (sale: Sale) => {
    const primary = parseDate((sale as any)[dateField]);
    if (primary) return primary;
    const fallbackField = dateField === 'saleDate' ? 'createdAt' : 'saleDate';
    return parseDate((sale as any)[fallbackField]);
  };

  const getStatusKey = (sale: Sale) => sale.status || 'other';

  const getWidgetSales = (w?: WidgetConfig) => {
    if (!w?.statusFilter || w.statusFilter.length === 0) return sampleSales;
    const allowed = new Set(w.statusFilter);
    return sampleSales.filter((sale) => allowed.has(getStatusKey(sale)));
  };

  const buildAggregatesFromSales = (
    sales: Sale[],
    config: ReturnType<typeof resolveWidgetCurrencyConfig>,
  ) => {
    const statusMap = new Map<string, StatusChartPoint>();
    const channelMapAgg = new Map<string, { id: string; label: string; count: number; amount: number }>();
    const productMap = new Map<string, { label: string; count: number; amount: number }>();
    const marketMap = new Map<string, { label: string; count: number; amount: number }>();
    const managerMap = new Map<string, { label: string; count: number; amount: number }>();
    const currencyMap = new Map<string, { label: string; count: number; amount: number }>();

    const totalCount = sales.length;
    let totalAmount = 0;

    sales.forEach((sale) => {
      const amount = convertSaleAmount(sale, config);
      totalAmount += amount;

      const statusKey = getStatusKey(sale);
      const statusRow = statusMap.get(statusKey) ?? {
        code: statusKey,
        label: statusLabels[statusKey] ?? statusKey,
        count: 0,
        amount: 0,
      };
      statusRow.count += 1;
      statusRow.amount += amount;
      statusMap.set(statusKey, statusRow);

      const channelId = sale.channelId || 'unknown';
      const channelLabel =
        sale.channelId
          ? channelMap.get(sale.channelId)?.name || sale.channelId
          : '—';
      const channelRow = channelMapAgg.get(channelId) ?? {
        id: channelId,
        label: channelLabel,
        count: 0,
        amount: 0,
      };
      channelRow.count += 1;
      channelRow.amount += amount;
      channelMapAgg.set(channelId, channelRow);

      const productKey = sale.hotel || '—';
      const productRow = productMap.get(productKey) ?? {
        label: productKey,
        count: 0,
        amount: 0,
      };
      productRow.count += 1;
      productRow.amount += amount;
      productMap.set(productKey, productRow);

      const marketKey = sale.market || '—';
      const marketRow = marketMap.get(marketKey) ?? {
        label: marketKey,
        count: 0,
        amount: 0,
      };
      marketRow.count += 1;
      marketRow.amount += amount;
      marketMap.set(marketKey, marketRow);

      const managerKey = sale.managerName || sale.agentName || '—';
      const managerRow = managerMap.get(managerKey) ?? {
        label: managerKey,
        count: 0,
        amount: 0,
      };
      managerRow.count += 1;
      managerRow.amount += amount;
      managerMap.set(managerKey, managerRow);

      const currencyKey = sale.currency || '—';
      const currencyRow = currencyMap.get(currencyKey) ?? {
        label: currencyKey,
        count: 0,
        amount: 0,
      };
      currencyRow.count += 1;
      currencyRow.amount += sale.amount ?? 0;
      currencyMap.set(currencyKey, currencyRow);
    });

    const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;

    return {
      totalCount,
      totalAmount,
      avgAmount,
      status: Array.from(statusMap.values()),
      channel: Array.from(channelMapAgg.values()),
      product: Array.from(productMap.values()),
      market: Array.from(marketMap.values()),
      manager: Array.from(managerMap.values()),
      currency: Array.from(currencyMap.values()),
    };
  };

  const buildTimelineFromSales = (
    sales: Sale[],
    config: ReturnType<typeof resolveWidgetCurrencyConfig>,
  ) => {
    const timelineCountMap = new Map<string, Record<string, any>>();
    const timelineAmountMap = new Map<string, Record<string, any>>();

    sales.forEach((sale) => {
      const date = resolveSampleDate(sale);
      if (!date) return;
      const month = getMonthKey(date);
      const channelKey = sale.channelId || 'unknown';

      const countRow = timelineCountMap.get(month) ?? { month };
      countRow[channelKey] = (countRow[channelKey] || 0) + 1;
      timelineCountMap.set(month, countRow);

      const amountRow = timelineAmountMap.get(month) ?? { month };
      amountRow[channelKey] =
        (amountRow[channelKey] || 0) + convertSaleAmount(sale, config);
      timelineAmountMap.set(month, amountRow);
    });

    const timelineCount = Array.from(timelineCountMap.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );
    const timelineAmount = Array.from(timelineAmountMap.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );

    return { count: timelineCount, amount: timelineAmount };
  };

  const formatAmount = (amount: number, currency: string) => {
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount);
    return t('crm.sales.analytics.amountWithCurrency', {
      amount: formatted,
      currency,
    });
  };
  const totalSales = analytics?.totalCount ?? 0;
  const totalAmount = analytics?.totalAmount ?? 0;
  const avgAmount = analytics?.avgCheck ?? 0;

  const statusChartData: StatusChartPoint[] = useMemo(
    () =>
      (analytics?.byStatus ?? []).map((item) => ({
        code: item.status,
        label: statusLabels[item.status] ?? item.status,
        count: item.count,
        amount: item.amount,
      })),
    [analytics, statusLabels],
  );

  const channelChartData = useMemo(
    () =>
      (analytics?.byChannel ?? []).map((item) => ({
        id: item.channelId ?? 'unknown',
        label: item.label,
        count: item.count,
        amount: item.amount,
      })),
    [analytics],
  );

  const productChartData = useMemo(
    () => (analytics?.byProduct ?? []),
    [analytics],
  );

  const marketChartData = useMemo(
    () => (analytics?.byMarket ?? []),
    [analytics],
  );

  const managerChartData = useMemo(
    () => (analytics?.byManager ?? []),
    [analytics],
  );

  const currencyChartData = useMemo(
    () => (analytics?.byCurrency ?? []),
    [analytics],
  );

  const customFieldChartData = useMemo(
    () => analytics?.customFields ?? {},
    [analytics],
  );

  const customFieldValueCounts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    Object.values(customFieldChartData).forEach((field) => {
      const inner = new Map<string, number>();
      field.items.forEach((item) => inner.set(item.label, item.count));
      map.set(field.key, inner);
    });
    return map;
  }, [customFieldChartData]);

  const metricOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.sales.analytics.kpis.total') },
      { id: 'amount', label: t('crm.sales.analytics.kpis.amount') },
      { id: 'avgAmount', label: t('crm.sales.analytics.kpis.avgAmount') },
      { id: 'channels', label: t('crm.sales.analytics.kpis.channels') },
      { id: 'products', label: t('crm.sales.analytics.kpis.products') },
      { id: 'markets', label: t('crm.sales.analytics.kpis.markets') },
      { id: 'managers', label: t('crm.sales.analytics.kpis.managers') },
      { id: 'statuses', label: t('crm.sales.analytics.kpis.statuses') },
      { id: 'currencies', label: t('crm.sales.analytics.kpis.currencies') },
    ],
    [t],
  );

  const baseChartOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.sales.analytics.charts.status') },
      { id: 'channel', label: t('crm.sales.analytics.charts.channel') },
      { id: 'product', label: t('crm.sales.analytics.charts.product') },
      { id: 'market', label: t('crm.sales.analytics.charts.market') },
      { id: 'manager', label: t('crm.sales.analytics.charts.manager') },
      { id: 'currency', label: t('crm.sales.analytics.charts.currency') },
      { id: 'timeline', label: t('crm.sales.analytics.charts.timeline') },
    ],
    [t],
  );

  const customChartOptions = useMemo(
    () =>
      activeCustomFields.map((field) => ({
        id: `custom:${field.key}` as ChartKey,
        label: `${t('crm.sales.analytics.customField')} · ${field.label}`,
      })),
    [activeCustomFields, t],
  );

  const chartOptions = useMemo(
    () => [...baseChartOptions, ...customChartOptions],
    [baseChartOptions, customChartOptions],
  );

  const tableOptions = useMemo(
    () => [
      { id: 'sales', label: t('crm.sales.analytics.table.sales') },
      { id: 'channels', label: t('crm.sales.analytics.table.channels') },
      { id: 'products', label: t('crm.sales.analytics.table.products') },
      { id: 'markets', label: t('crm.sales.analytics.table.markets') },
      { id: 'managers', label: t('crm.sales.analytics.table.managers') },
      ...activeCustomFields.map((field) => ({
        id: `custom:${field.key}` as TableKey,
        label: `${t('crm.sales.analytics.table.customField')} · ${field.label}`,
      })),
    ],
    [t, activeCustomFields],
  );

  const widgetTypeOptions = useMemo(
    () => [
      { id: 'metric', label: t('crm.sales.analytics.widgets.type.metric') },
      { id: 'donut', label: t('crm.sales.analytics.widgets.type.donut') },
      { id: 'bar', label: t('crm.sales.analytics.widgets.type.bar') },
      { id: 'table', label: t('crm.sales.analytics.widgets.type.table') },
      { id: 'formula', label: t('crm.sales.analytics.widgets.type.formula') },
    ],
    [t],
  );

  const formulaScopeOptions = useMemo(
    () => [
      { id: 'status', label: t('crm.sales.analytics.formula.scope.status') },
      { id: 'channel', label: t('crm.sales.analytics.formula.scope.channel') },
      { id: 'product', label: t('crm.sales.analytics.formula.scope.product') },
      { id: 'market', label: t('crm.sales.analytics.formula.scope.market') },
      { id: 'manager', label: t('crm.sales.analytics.formula.scope.manager') },
      { id: 'currency', label: t('crm.sales.analytics.formula.scope.currency') },
      { id: 'custom', label: t('crm.sales.analytics.formula.scope.custom') },
    ],
    [t],
  );

  const formulaFunctionOptions = useMemo(
    () => [
      { id: 'sumif', label: t('crm.sales.analytics.formula.fn.sumif') },
      { id: 'count', label: t('crm.sales.analytics.formula.fn.count') },
      { id: 'percent', label: t('crm.sales.analytics.formula.fn.percent') },
      { id: 'ratio', label: t('crm.sales.analytics.formula.fn.ratio') },
      { id: 'diff', label: t('crm.sales.analytics.formula.fn.diff') },
    ],
    [t],
  );

  const formulaModeOptions = useMemo(
    () => [
      { id: 'count', label: t('crm.sales.analytics.formula.mode.count') },
      { id: 'percent', label: t('crm.sales.analytics.formula.mode.percent') },
    ],
    [t],
  );

  const formulaValueItems = useMemo(() => {
    const customValues: Record<string, Array<{ id: string; label: string }>> = {};
    activeCustomFields.forEach((field) => {
      const data = customFieldChartData[field.key]?.items ?? [];
      customValues[field.key] = data.map((item) => ({ id: item.label, label: item.label }));
    });

    return {
      status: statusChartData.map((item) => ({ id: item.code, label: item.label })),
      channel: channelChartData.map((item) => ({ id: item.id, label: item.label })),
      product: productChartData.map((item) => ({ id: item.label, label: item.label })),
      market: marketChartData.map((item) => ({ id: item.label, label: item.label })),
      manager: managerChartData.map((item) => ({ id: item.label, label: item.label })),
      currency: currencyChartData.map((item) => ({ id: item.label, label: item.label })),
      custom: customValues,
    } as const;
  }, [
    activeCustomFields,
    statusChartData,
    channelChartData,
    productChartData,
    marketChartData,
    managerChartData,
    currencyChartData,
    customFieldChartData,
  ]);

  const formulaValueFallback = useMemo(
    () => [{ id: 'unknown', label: t('crm.sales.analytics.tooltips.unknown') }],
    [t],
  );

  const formulaOperandOptions = useMemo(
    () => [
      { id: 'total', label: t('crm.sales.analytics.kpis.total') },
      { id: 'amount', label: t('crm.sales.analytics.kpis.amount') },
      { id: 'avgAmount', label: t('crm.sales.analytics.kpis.avgAmount') },
      { id: 'channels', label: t('crm.sales.analytics.kpis.channels') },
      { id: 'products', label: t('crm.sales.analytics.kpis.products') },
      { id: 'markets', label: t('crm.sales.analytics.kpis.markets') },
      { id: 'managers', label: t('crm.sales.analytics.kpis.managers') },
      { id: 'statuses', label: t('crm.sales.analytics.kpis.statuses') },
      { id: 'currencies', label: t('crm.sales.analytics.kpis.currencies') },
      { id: 'status', label: t('crm.sales.analytics.formula.scope.status') },
      { id: 'channel', label: t('crm.sales.analytics.formula.scope.channel') },
      { id: 'product', label: t('crm.sales.analytics.formula.scope.product') },
      { id: 'market', label: t('crm.sales.analytics.formula.scope.market') },
      { id: 'manager', label: t('crm.sales.analytics.formula.scope.manager') },
      { id: 'currency', label: t('crm.sales.analytics.formula.scope.currency') },
      { id: 'custom', label: t('crm.sales.analytics.formula.scope.custom') },
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
        title: t('crm.sales.analytics.kpis.total'),
        metricKey: 'total',
        size: 'sm',
        height: getDefaultHeight('sm', 'metric'),
      },
      {
        id: 'metric-amount',
        type: 'metric',
        title: t('crm.sales.analytics.kpis.amount'),
        metricKey: 'amount',
        size: 'md',
        height: getDefaultHeight('md', 'metric'),
      },
      {
        id: 'metric-channels',
        type: 'metric',
        title: t('crm.sales.analytics.kpis.channels'),
        metricKey: 'channels',
        size: 'sm',
        height: getDefaultHeight('sm', 'metric'),
      },
      {
        id: 'chart-status',
        type: 'donut',
        title: t('crm.sales.analytics.charts.status'),
        chartKey: 'status',
        size: 'lg',
        height: getDefaultHeight('lg', 'donut'),
        showLabels: true,
      },
      {
        id: 'chart-channel',
        type: 'bar',
        title: t('crm.sales.analytics.charts.channel'),
        chartKey: 'channel',
        size: 'lg',
        height: getDefaultHeight('lg', 'bar'),
      },
      {
        id: 'table-sales',
        type: 'table',
        title: t('crm.sales.analytics.table.sales'),
        tableKey: 'sales',
        size: 'lg',
        height: getDefaultHeight('lg', 'table'),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!presetReady) return;
    if (widgets.length === 0) {
      setWidgets(defaultWidgets);
    }
  }, [presetReady, widgets.length, defaultWidgets]);

  useEffect(() => {
    try {
      const version = localStorage.getItem('sales_analytics_version');
      const raw = localStorage.getItem('sales_analytics_widgets');
      if (raw && version === ANALYTICS_LAYOUT_VERSION) {
        const parsed = JSON.parse(raw) as WidgetConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!presetReady) {
            setWidgets(parsed);
          }
          return;
        }
      }
    } catch {
      // ignore
    }
    if (!presetReady) setWidgets(defaultWidgets);
  }, [defaultWidgets, presetReady]);

  useEffect(() => {
    try {
      if (widgets.length > 0) {
        localStorage.setItem('sales_analytics_widgets', JSON.stringify(widgets));
        localStorage.setItem('sales_analytics_version', ANALYTICS_LAYOUT_VERSION);
      }
    } catch {
      // ignore
    }
  }, [widgets]);

  useEffect(() => {
    if (!presetReady) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveSalesAnalyticsPreset({
        layoutVersion: ANALYTICS_LAYOUT_VERSION,
        widgets,
        settings: {
          dateField,
          currencyMode,
          displayCurrency,
          rates: currencyRates,
        },
        savedAt: new Date().toISOString(),
      }).catch((e) => {
        console.error(e);
      });
    }, 800);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [widgets, dateField, currencyMode, displayCurrency, JSON.stringify(currencyRates), presetReady]);

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
      title: draftTitle || t('crm.sales.analytics.widgets.defaultTitle'),
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
      valueMode: draftType === 'donut' || draftType === 'bar' ? draftValueMode : undefined,
      compareChannelIds:
        draftType === 'bar' || draftType === 'donut' ? draftCompareChannels : undefined,
      statusFilter:
        draftType === 'metric' || draftType === 'donut' || draftType === 'bar' || draftType === 'table'
          ? draftStatusFilter
          : undefined,
      currencyMode: draftCurrencyMode,
      displayCurrency: draftDisplayCurrency,
      currencyRates: draftCurrencyRates,
    };
    setWidgets((prev) => [next, ...prev]);
    setAddOpen(false);
  };

  const openEditWidget = (widget: WidgetConfig) => {
    const leftCustom = parseCustomOperand(widget.formulaLeftKey);
    const rightCustom = parseCustomOperand(widget.formulaRightKey);
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
    setDraftFormulaLeftCustomField(leftCustom.fieldKey);
    setDraftFormulaRightType(
      (widget.formulaRightType ?? 'total') as FormulaOperandType,
    );
    setDraftFormulaRightKey(widget.formulaRightKey ?? '');
    setDraftFormulaRightCustomField(rightCustom.fieldKey);
    setDraftFormulaMode((widget.formulaMode ?? 'count') as FormulaMode);
    setDraftFormulaFilters(
      widget.formulaFilters?.length
        ? widget.formulaFilters
        : [{ scope: 'status', key: '' }],
    );
    setDraftMetric((widget.metricKey ?? metricOptions[0].id) as MetricKey);
    setDraftChart((widget.chartKey ?? chartOptions[0].id) as ChartKey);
    setDraftTable((widget.tableKey ?? tableOptions[0].id) as TableKey);
    setDraftValueMode((widget.valueMode ?? 'count') as ValueMode);
    setDraftCompareChannels(widget.compareChannelIds ?? []);
    setDraftStatusFilter(widget.statusFilter ?? []);
    setDraftCurrencyMode(widget.currencyMode ?? currencyMode);
    setDraftDisplayCurrency(widget.displayCurrency ?? displayCurrency);
    setDraftCurrencyRates(widget.currencyRates ?? {});
    setEditingWidgetId(widget.id);
    setEditOpen(true);
  };

  const saveWidget = () => {
    if (!editingWidgetId) return;
    setWidgets((prev) =>
      prev.map((item) =>
        item.id === editingWidgetId
          ? {
              ...item,
              type: draftType,
              title: draftTitle || item.title || t('crm.sales.analytics.widgets.defaultTitle'),
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
                draftType === 'donut' || draftType === 'bar' ? draftChart : undefined,
              tableKey: draftType === 'table' ? draftTable : undefined,
              valueMode:
                draftType === 'donut' || draftType === 'bar' ? draftValueMode : undefined,
              compareChannelIds:
                draftType === 'bar' || draftType === 'donut' ? draftCompareChannels : undefined,
              statusFilter:
                draftType === 'metric' || draftType === 'donut' || draftType === 'bar' || draftType === 'table'
                  ? draftStatusFilter
                  : undefined,
              currencyMode: draftCurrencyMode,
              displayCurrency: draftDisplayCurrency,
              currencyRates: draftCurrencyRates,
            }
          : item,
      ),
    );
    setEditOpen(false);
    setEditingWidgetId(null);
  };

  const handleReset = () => {
    setWidgets(defaultWidgets);
    setResetOpen(false);
    try {
      localStorage.setItem(
        'sales_analytics_widgets',
        JSON.stringify(defaultWidgets),
      );
      localStorage.setItem('sales_analytics_version', ANALYTICS_LAYOUT_VERSION);
    } catch {
      // ignore
    }
  };

  const sizeClass = (size: WidgetSize) => {
    if (size === 'lg') return 'md:col-span-2 xl:col-span-3';
    if (size === 'md') return 'md:col-span-2 xl:col-span-2';
    return 'md:col-span-1 xl:col-span-1';
  };

  const resolveTheme = (key?: ThemeKey) =>
    THEME_PRESETS.find((preset) => preset.key === key) ?? THEME_PRESETS[0];

  const resolveMetricValue = (key?: MetricKey, w?: WidgetConfig) => {
    if (!key) return '—';
    const config = resolveWidgetCurrencyConfig(w);
    if (w?.statusFilter && w.statusFilter.length > 0) {
      const filtered = getWidgetSales(w);
      const agg = buildAggregatesFromSales(filtered, config);
      if (key === 'total') return agg.totalCount.toLocaleString(locale);
      if (key === 'amount') return formatAmount(agg.totalAmount, config.display);
      if (key === 'avgAmount') return formatAmount(agg.avgAmount, config.display);
      if (key === 'channels') return agg.channel.length.toLocaleString(locale);
      if (key === 'products') return agg.product.length.toLocaleString(locale);
      if (key === 'markets') return agg.market.length.toLocaleString(locale);
      if (key === 'managers') return agg.manager.length.toLocaleString(locale);
      if (key === 'statuses') return agg.status.length.toLocaleString(locale);
      if (key === 'currencies') return agg.currency.length.toLocaleString(locale);
    }

    const globalConfig = resolveCurrencyConfig();
    if (key === 'total') return totalSales.toLocaleString(locale);
    if (key === 'amount') {
      return formatAmount(totalAmount, globalConfig.display);
    }
    if (key === 'avgAmount') {
      return formatAmount(avgAmount, globalConfig.display);
    }
    if (key === 'channels') return channels.length.toLocaleString(locale);
    if (key === 'products') return productChartData.length.toLocaleString(locale);
    if (key === 'markets') return marketChartData.length.toLocaleString(locale);
    if (key === 'managers') return managerChartData.length.toLocaleString(locale);
    if (key === 'statuses') return statusChartData.length.toLocaleString(locale);
    if (key === 'currencies') return currencies.length.toLocaleString(locale);
    return '—';
  };

  const resolveChartData = (w: WidgetConfig, valueMode: ValueMode) => {
    const key = w.chartKey ?? 'status';
    const useFiltered = w.statusFilter && w.statusFilter.length > 0;
    const filteredSales = useFiltered ? getWidgetSales(w) : null;
    const filteredAgg = useFiltered
      ? buildAggregatesFromSales(filteredSales as Sale[], resolveWidgetCurrencyConfig(w))
      : null;
    if (key === 'status') {
      const base = filteredAgg ? filteredAgg.status : statusChartData;
      return base.map((item) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    if (key === 'channel') {
      const source = filteredAgg ? filteredAgg.channel : channelChartData;
      const base = source.map((item: any) => ({
        id: item.id,
        label: item.label,
        count: item.count,
        amount: item.amount,
        value: valueMode === 'amount' ? item.amount : item.count,
      }));
      if (w.compareChannelIds && w.compareChannelIds.length > 0) {
        return base.filter((item) => w.compareChannelIds?.includes(item.id));
      }
      return base;
    }
    if (key === 'product') {
      const base = filteredAgg ? filteredAgg.product : productChartData;
      return base.map((item: any) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    if (key === 'market') {
      const base = filteredAgg ? filteredAgg.market : marketChartData;
      return base.map((item: any) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    if (key === 'manager') {
      const base = filteredAgg ? filteredAgg.manager : managerChartData;
      return base.map((item: any) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    if (key === 'currency') {
      const base = filteredAgg ? filteredAgg.currency : currencyChartData;
      return base.map((item: any) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    if (key.startsWith('custom:')) {
      const fieldKey = key.replace('custom:', '');
      const field = customFieldChartData[fieldKey];
      if (!field) return [];
      return field.items.map((item) => ({
        label: item.label,
        value: valueMode === 'amount' ? item.amount : item.count,
        count: item.count,
        amount: item.amount,
      }));
    }
    return [];
  };

  const buildTimelineData = (valueMode: ValueMode) => {
    if (!analytics) return [];
    return valueMode === 'amount'
      ? analytics.timeline.amount
      : analytics.timeline.count;
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
            {resolveMetricValue(w.metricKey, w)}
          </div>
          <div className="text-[11px] text-slate-500">
            {period === 'custom' ? t('crm.sales.analytics.period.custom') : periodLabels[period]}
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
      const filters: FormulaFilter[] =
        w.formulaFilters && w.formulaFilters.length > 0
          ? w.formulaFilters
          : [{ scope: 'status', key: '' }];

      const resolveOperand = (type: FormulaOperandType, key?: string) => {
        if (type === 'total') return totalSales;
        if (type === 'amount') {
          return totalAmount;
        }
        if (type === 'avgAmount') {
          return totalSales > 0 ? Math.round(avgAmount) : 0;
        }
        if (type === 'channels') return channels.length;
        if (type === 'products') return productChartData.length;
        if (type === 'markets') return marketChartData.length;
        if (type === 'managers') return managerChartData.length;
        if (type === 'statuses') return statusChartData.length;
        if (type === 'currencies') return currencies.length;
        if (type === 'status') {
          return statusChartData.find((s) => s.code === key)?.count ?? 0;
        }
        if (type === 'channel') {
          return channelChartData.find((s) => s.id === key)?.count ?? 0;
        }
        if (type === 'product') {
          return productChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'market') {
          return marketChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'manager') {
          return managerChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'currency') {
          return currencyChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (type === 'custom') {
          const parsed = parseCustomOperand(key);
          if (!parsed.fieldKey || !parsed.value) return 0;
          return customFieldValueCounts.get(parsed.fieldKey)?.get(parsed.value) ?? 0;
        }
        return 0;
      };

      const resolveFilterCount = (scope: FormulaScope, key?: string, fieldKey?: string) => {
        if (scope === 'status') {
          return statusChartData.find((s) => s.code === key)?.count ?? 0;
        }
        if (scope === 'channel') {
          return channelChartData.find((s) => s.id === key)?.count ?? 0;
        }
        if (scope === 'product') {
          return productChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (scope === 'market') {
          return marketChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (scope === 'manager') {
          return managerChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (scope === 'currency') {
          return currencyChartData.find((s) => s.label === key)?.count ?? 0;
        }
        if (scope === 'custom') {
          if (!fieldKey || !key) return 0;
          return customFieldValueCounts.get(fieldKey)?.get(key) ?? 0;
        }
        return 0;
      };

      const filterGroups = filters.reduce<Partial<Record<FormulaScope, FormulaFilter[]>>>(
        (acc, filter) => {
          const scope = filter.scope as FormulaScope;
          if (!acc[scope]) acc[scope] = [];
          acc[scope]!.push(filter);
          return acc;
        },
        {},
      );

      const groupTotals = Object.entries(filterGroups).map(([scope, items]) =>
        (items || []).reduce(
          (sum, filter) => sum + resolveFilterCount(scope as FormulaScope, filter.key, filter.fieldKey),
          0,
        ),
      );

      const filterValue = groupTotals.length ? Math.min(...groupTotals) : 0;

      const leftValue = resolveOperand(leftType, leftKey);
      const rightValue = resolveOperand(rightType, rightKey);
      const baseTotal = totalSales;

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
              {t('crm.sales.analytics.formula.secondary')} {secondaryLabel}
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            {period === 'custom' ? t('crm.sales.analytics.period.custom') : periodLabels[period]}
          </div>
        </div>
      );
    }

    if (w.type === 'donut') {
      const theme = resolveTheme(w.themeKey);
      const config = resolveWidgetCurrencyConfig(w);
      const data = resolveChartData(w, w.valueMode ?? 'count');
      const donutTotal = data.reduce((sum, item) => sum + item.value, 0);
      const chartHeight = Math.max(widgetHeight - 80, 220);
      const showStatusTable = (w.chartKey ?? 'status') === 'status';
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{w.title}</span>
            <span>
              {w.valueMode === 'amount'
                ? formatAmount(donutTotal, config.display)
                : t('crm.sales.analytics.totalCount', { count: donutTotal })}
            </span>
          </div>
          <div className={`flex ${showStatusTable ? 'flex-col md:flex-row' : 'flex-col'} gap-4`}>
            <div style={{ height: chartHeight }} className={showStatusTable ? 'md:w-1/2' : ''}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="60%"
                    outerRadius="85%"
                    paddingAngle={3}
                    cornerRadius={8}
                  >
                    {data.map((entry, idx) => (
                      <Cell
                        key={`${entry.label}-${idx}`}
                        fill={theme.palette[idx % theme.palette.length]}
                        stroke="rgba(255,255,255,0.8)"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (w.valueMode === 'amount') {
                        return [formatAmount(Number(value), config.display), name];
                      }
                      return [value, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {showStatusTable ? (
              <div className="md:w-1/2">
                <div className="rounded-xl border border-slate-100">
                  <table className="min-w-full border-collapse text-[11px]">
                    <tbody>
                      {data.map((entry, idx) => {
                        const percent = donutTotal > 0 ? Math.round((entry.value / donutTotal) * 100) : 0;
                        return (
                          <tr
                            key={`${entry.label}-${idx}`}
                            className="border-t border-slate-100 first:border-t-0 transition hover:bg-slate-50"
                          >
                            <td className="py-2 px-3 text-slate-600">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: theme.palette[idx % theme.palette.length] }}
                                />
                                <span className="truncate">{entry.label}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right text-slate-700 whitespace-nowrap">
                              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                {w.valueMode === 'amount'
                                  ? formatAmount(Number(entry.value), config.display)
                                  : entry.value}
                                <span className="text-slate-400">·</span>
                                <span className="text-slate-500">{percent}%</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              w.showLabels && (
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  {data.map((entry, idx) => {
                    const percent = donutTotal > 0 ? Math.round((entry.value / donutTotal) * 100) : 0;
                    return (
                      <div key={`${entry.label}-${idx}`} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: theme.palette[idx % theme.palette.length] }}
                        />
                        <span className="truncate">{entry.label}</span>
                        <span className="ml-auto text-slate-400">{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      );
    }

    if (w.type === 'bar') {
      const theme = resolveTheme(w.themeKey);
      const config = resolveWidgetCurrencyConfig(w);
      if (w.chartKey === 'timeline') {
        const timelineData =
          w.statusFilter && w.statusFilter.length > 0
            ? buildTimelineFromSales(getWidgetSales(w), config)[
                w.valueMode === 'amount' ? 'amount' : 'count'
              ]
            : buildTimelineData(w.valueMode ?? 'count');
        const chartHeight = Math.max(widgetHeight - 80, 220);
        const channelIds = (w.compareChannelIds && w.compareChannelIds.length > 0)
          ? w.compareChannelIds
          : channels.map((ch) => ch.id);
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{w.title}</span>
              <span>{t('crm.sales.analytics.timeline')}</span>
            </div>
            <div style={{ height: chartHeight }}>
              <ResponsiveContainer>
                <BarChart data={timelineData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="rgba(100,116,139,0.6)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="rgba(100,116,139,0.6)" />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (w.valueMode === 'amount') {
                        return [formatAmount(Number(value), config.display), name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  {channelIds.map((channelId, idx) => (
                    <Bar
                      key={channelId}
                      dataKey={channelId}
                      name={channelMap.get(channelId)?.name || channelId}
                      fill={theme.palette[idx % theme.palette.length]}
                      radius={[6, 6, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      }

      const data = resolveChartData(w, w.valueMode ?? 'count');
      const chartHeight = Math.max(widgetHeight - 80, 220);
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{w.title}</span>
            <span>{w.valueMode === 'amount' ? config.display : t('crm.sales.analytics.count')}</span>
          </div>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="rgba(100,116,139,0.6)" />
                <YAxis tick={{ fontSize: 10 }} stroke="rgba(100,116,139,0.6)" />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (w.valueMode === 'amount') {
                      return [formatAmount(Number(value), config.display), name];
                    }
                    return [value, name];
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  fill={theme.primary}
                >
                  {data.map((entry, idx) => (
                    <Cell
                      key={`${entry.label}-${idx}`}
                      fill={theme.palette[idx % theme.palette.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (w.type === 'table') {
      const config = resolveWidgetCurrencyConfig(w);
      if (w.tableKey === 'sales') {
        const filteredSales = getWidgetSales(w);
        const sorted = [...filteredSales].sort((a, b) => {
          const da = resolveSampleDate(a)?.getTime() ?? 0;
          const db = resolveSampleDate(b)?.getTime() ?? 0;
          return db - da;
        });
        const totalCount = filteredSales.length;
        return (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              {t('crm.sales.analytics.table.total', { count: totalCount })}
            </div>
            <div
              className="overflow-auto rounded-xl border border-slate-100"
              style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
            >
              <table className="min-w-full border-collapse text-[11px]">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.date')}</th>
                    <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.channel')}</th>
                    <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.product')}</th>
                    <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.customer')}</th>
                    <th className="py-2 px-3 text-right">{t('crm.sales.analytics.table.headers.amount')}</th>
                    <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((sale) => (
                    <tr key={sale.id} className="border-t border-slate-100">
                      <td className="py-1.5 px-3 text-slate-600">
                        {resolveSampleDate(sale)?.toLocaleDateString(locale) || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {channelMap.get(sale.channelId || '')?.name || sale.channelId || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {sale.hotel || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {sale.guestName || '—'}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatAmount(convertSaleAmount(sale, config), config.display)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600">
                        {statusLabels[sale.status] ?? sale.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      const renderAggTable = (data: Array<{ label: string; count: number; amount: number }>) => (
        <div className="space-y-2">
          <div
            className="overflow-auto rounded-xl border border-slate-100"
            style={{ maxHeight: Math.max(widgetHeight - 80, 160) }}
          >
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="py-2 px-3 text-left">{t('crm.sales.analytics.table.headers.segment')}</th>
                  <th className="py-2 px-3 text-right">{t('crm.sales.analytics.table.headers.count')}</th>
                  <th className="py-2 px-3 text-right">{t('crm.sales.analytics.table.headers.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <td className="py-1.5 px-3 text-slate-600">{row.label}</td>
                    <td className="py-1.5 px-3 text-right text-slate-700">
                      {row.count.toLocaleString(locale)}
                    </td>
                    <td className="py-1.5 px-3 text-right text-slate-700">
                      {formatAmount(row.amount, config.display)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

      if (w.tableKey === 'channels') {
        const data =
          w.statusFilter && w.statusFilter.length > 0
            ? buildAggregatesFromSales(getWidgetSales(w), config).channel.map((row) => ({
                label: row.label,
                count: row.count,
                amount: row.amount,
              }))
            : channelChartData.map((row) => ({
                label: row.label,
                count: row.count,
                amount: row.amount,
              }));
        return renderAggTable(data);
      }
      if (w.tableKey === 'products') {
        const data =
          w.statusFilter && w.statusFilter.length > 0
            ? buildAggregatesFromSales(getWidgetSales(w), config).product
            : productChartData;
        return renderAggTable(data);
      }
      if (w.tableKey === 'markets') {
        const data =
          w.statusFilter && w.statusFilter.length > 0
            ? buildAggregatesFromSales(getWidgetSales(w), config).market
            : marketChartData;
        return renderAggTable(data);
      }
      if (w.tableKey === 'managers') {
        const data =
          w.statusFilter && w.statusFilter.length > 0
            ? buildAggregatesFromSales(getWidgetSales(w), config).manager
            : managerChartData;
        return renderAggTable(data);
      }
      if (w.tableKey && w.tableKey.startsWith('custom:')) {
        const fieldKey = w.tableKey.replace('custom:', '');
        const field = customFieldChartData[fieldKey];
        if (!field) return null;
        return renderAggTable(field.items);
      }
    }

    return null;
  };

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

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      setWidgets((prev) =>
        prev.map((item) => {
          if (item.id !== resizing.id) return item;
          const deltaX = e.clientX - resizing.startX;
          const deltaY = e.clientY - resizing.startY;
          let nextSize = resizing.startSize;
          if (resizing.axis === 'x' || resizing.axis === 'both') {
            if (deltaX > 80) nextSize = 'lg';
            if (deltaX < -80) nextSize = 'sm';
          }
          let nextHeight = resizing.startHeight;
          if (resizing.axis === 'y' || resizing.axis === 'both') {
            nextHeight = Math.max(resizing.minHeight, resizing.startHeight + deltaY);
          }
          return { ...item, size: nextSize, height: nextHeight };
        }),
      );
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  const hasData = !loading && !error;

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-6 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {t('crm.sales.analytics.kicker')}
              </div>
              <h1 className="text-lg md:text-xl font-semibold text-slate-900">
                {t('crm.sales.analytics.title')}
              </h1>
              <p className="text-xs text-slate-600 max-w-2xl">
                {t('crm.sales.analytics.subtitle')}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 text-xs md:items-end">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-100/70 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-700">{t('crm.sales.analytics.hero.note')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  <span className="text-[11px] text-slate-600 pl-1">
                    {t('crm.sales.analytics.period.label')}
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
                <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm text-[11px]">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExport('csv')}
                    className="px-2 py-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {t('crm.sales.analytics.export.csv')}
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => handleExport('xls')}
                    className="px-2 py-1 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {t('crm.sales.analytics.export.excel')}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="px-3 py-1.5 rounded-2xl bg-black text-[11px] font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] hover:bg-slate-900"
                >
                  + {t('crm.sales.analytics.addBlock')}
                </button>
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="px-3 py-1.5 rounded-2xl border border-slate-200 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  {t('crm.sales.analytics.reset.button')}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:px-6 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {t('crm.sales.analytics.settings.title')}
              </div>
              <div className="text-xs text-slate-600">
                {t('crm.sales.analytics.settings.subtitle')}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px]">
                <span className="text-slate-500">{t('crm.sales.analytics.settings.dateField')}</span>
                <select
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value as DateField)}
                  className="bg-transparent text-slate-700"
                >
                  <option value="saleDate">{t('crm.sales.analytics.settings.saleDate')}</option>
                  <option value="createdAt">{t('crm.sales.analytics.settings.createdAt')}</option>
                </select>
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px]">
                <span className="text-slate-500">{t('crm.sales.analytics.settings.currencyMode')}</span>
                <select
                  value={currencyMode}
                  onChange={(e) => setCurrencyMode(e.target.value as CurrencyMode)}
                  className="bg-transparent text-slate-700"
                >
                  <option value="native">{t('crm.sales.analytics.settings.currencyNative')}</option>
                  <option value="converted">{t('crm.sales.analytics.settings.currencyConverted')}</option>
                </select>
              </div>
              <div className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px]">
                <span className="text-slate-500">{t('crm.sales.analytics.settings.displayCurrency')}</span>
                <select
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  className="bg-transparent text-slate-700"
                >
                  {currencies.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setRatesOpen((prev) => !prev)}
                  disabled={currencyMode !== 'converted'}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 hover:text-slate-900 disabled:opacity-50"
                >
                  {t('crm.sales.analytics.settings.ratesButton')}
                </button>

                {currencyMode === 'converted' && ratesOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setRatesOpen(false)}
                    />
                    <div className="absolute right-0 top-10 z-50 w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_60px_rgba(15,23,42,0.15)]">
                      <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                        {currencies.map((cur) => (
                          <label key={cur} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="text-slate-600">
                              {t('crm.sales.analytics.settings.rateFor', { currency: cur })}
                            </span>
                            <input
                              type="number"
                              step="0.0001"
                              value={currencyRates[cur] ?? ''}
                              onChange={(e) =>
                                setCurrencyRates((prev) => ({
                                  ...prev,
                                  [cur]: Number(e.target.value),
                                }))
                              }
                              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {period === 'custom' && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-500">{t('crm.sales.analytics.period.range')}</span>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-1"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-xl border border-slate-200 px-2 py-1"
              />
            </div>
          )}

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
                {t('crm.sales.analytics.constructor.title')}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {t('crm.sales.analytics.constructor.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-2xl bg-slate-900 text-white text-[11px] font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.25)] hover:bg-slate-800"
            >
              + {t('crm.sales.analytics.addBlock')}
            </button>
          </div>

          {widgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-[11px] text-slate-500">
              {t('crm.sales.analytics.empty')}
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
                          {t('crm.sales.analytics.actions.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWidget(w.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-500"
                        >
                          {t('crm.sales.analytics.actions.remove')}
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
                      title={t('crm.sales.analytics.resize.height')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'y', e)}
                      className="absolute -bottom-1 left-4 right-4 h-2 cursor-ns-resize"
                      title={t('crm.sales.analytics.resize.height')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                      className="absolute -left-1 top-4 bottom-4 w-2 cursor-ew-resize"
                      title={t('crm.sales.analytics.resize.width')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'x', e)}
                      className="absolute -right-1 top-4 bottom-4 w-2 cursor-ew-resize"
                      title={t('crm.sales.analytics.resize.width')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -top-1 -left-1 h-3 w-3 cursor-nwse-resize"
                      title={t('crm.sales.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -top-1 -right-1 h-3 w-3 cursor-nesw-resize"
                      title={t('crm.sales.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -bottom-1 -left-1 h-3 w-3 cursor-nesw-resize"
                      title={t('crm.sales.analytics.resize.both')}
                    />
                    <div
                      onMouseDown={(e) => beginResize(w.id, w.size, 'both', e)}
                      className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize"
                      title={t('crm.sales.analytics.resize.both')}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {(addOpen || editOpen) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
            <div className="w-full max-w-3xl rounded-[32px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {addOpen
                      ? t('crm.sales.analytics.widgets.addTitle')
                      : t('crm.sales.analytics.widgets.editTitle')}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {t('crm.sales.analytics.widgets.modalTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setEditOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-700"
                >
                  {t('crm.sales.analytics.common.close')}
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                  {t('crm.sales.analytics.widgets.fields.type')}
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as WidgetType)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                  >
                    {widgetTypeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                  {t('crm.sales.analytics.widgets.fields.title')}
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    placeholder={t('crm.sales.analytics.widgets.defaultTitle')}
                  />
                </label>

                {(draftType === 'donut' || draftType === 'bar') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.chart')}
                    <select
                      value={draftChart}
                      onChange={(e) => setDraftChart(e.target.value as ChartKey)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {chartOptions
                        .filter((opt) => draftType === 'donut' ? opt.id !== 'timeline' : true)
                        .map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                {draftType === 'table' && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.table')}
                    <select
                      value={draftTable}
                      onChange={(e) => setDraftTable(e.target.value as TableKey)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {tableOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {(draftType === 'donut' || draftType === 'bar') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.valueMode')}
                    <select
                      value={draftValueMode}
                      onChange={(e) => setDraftValueMode(e.target.value as ValueMode)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="count">{t('crm.sales.analytics.widgets.value.count')}</option>
                      <option value="amount">{t('crm.sales.analytics.widgets.value.amount')}</option>
                    </select>
                  </label>
                )}

                {(draftType === 'donut' || draftType === 'bar') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.compareChannels')}
                    <select
                      multiple
                      value={draftCompareChannels}
                      onChange={(e) =>
                        setDraftCompareChannels(
                          Array.from(e.target.selectedOptions).map((o) => o.value),
                        )
                      }
                      className="h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400">
                      {t('crm.sales.analytics.widgets.fields.compareHint')}
                    </span>
                  </label>
                )}

                {draftType === 'metric' && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.metric')}
                    <select
                      value={draftMetric}
                      onChange={(e) => setDraftMetric(e.target.value as MetricKey)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {metricOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    {t('crm.sales.analytics.widgets.fields.theme')}
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

                {(draftType === 'metric' || draftType === 'donut' || draftType === 'bar' || draftType === 'table') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.statusFilter')}
                    <select
                      multiple
                      value={draftStatusFilter}
                      onChange={(e) =>
                        setDraftStatusFilter(
                          Array.from(e.target.selectedOptions).map((o) => o.value),
                        )
                      }
                      className="h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {(draftType === 'donut' || draftType === 'bar' || draftType === 'metric') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.currencyMode')}
                    <select
                      value={draftCurrencyMode}
                      onChange={(e) => setDraftCurrencyMode(e.target.value as CurrencyMode)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      <option value="native">{t('crm.sales.analytics.settings.currencyNative')}</option>
                      <option value="converted">{t('crm.sales.analytics.settings.currencyConverted')}</option>
                    </select>
                  </label>
                )}

                {(draftType === 'donut' || draftType === 'bar' || draftType === 'metric') && (
                  <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                    {t('crm.sales.analytics.widgets.fields.displayCurrency')}
                    <select
                      value={draftDisplayCurrency}
                      onChange={(e) => setDraftDisplayCurrency(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                    >
                      {currencies.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {draftType === 'formula' && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                      {t('crm.sales.analytics.formula.fn.label')}
                      <select
                        value={draftFormulaFn}
                        onChange={(e) => setDraftFormulaFn(e.target.value as FormulaFn)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                      >
                        {formulaFunctionOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                      {t('crm.sales.analytics.formula.mode.label')}
                      <select
                        value={draftFormulaMode}
                        onChange={(e) => setDraftFormulaMode(e.target.value as FormulaMode)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                      >
                        {formulaModeOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {draftFormulaFn === 'sumif' && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] text-slate-500">
                        {t('crm.sales.analytics.formula.block.sumif')}
                      </div>
                      <div className="mt-3 space-y-3">
                        {draftFormulaFilters.map((filter, index) => (
                          <div key={index} className="grid gap-2 md:grid-cols-3">
                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.filter.scope')}
                              <select
                                value={filter.scope}
                                onChange={(e) => {
                                  const scope = e.target.value as FormulaScope;
                                  const fieldKey =
                                    scope === 'custom' && activeCustomFields.length
                                      ? activeCustomFields[0].key
                                      : undefined;
                                  setDraftFormulaFilters((prev) =>
                                    prev.map((f, i) =>
                                      i === index
                                        ? { ...f, scope, key: '', fieldKey }
                                        : f,
                                    ),
                                  );
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                {formulaScopeOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {filter.scope === 'custom' && (
                              <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                                {t('crm.sales.analytics.formula.filter.customField')}
                                <select
                                  value={filter.fieldKey ?? ''}
                                  onChange={(e) => {
                                    const fieldKey = e.target.value;
                                    setDraftFormulaFilters((prev) =>
                                      prev.map((f, i) =>
                                        i === index ? { ...f, fieldKey, key: '' } : f,
                                      ),
                                    );
                                  }}
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                                >
                                  <option value="">—</option>
                                  {activeCustomFields.map((field) => (
                                    <option key={field.key} value={field.key}>
                                      {field.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}

                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.filter.value')}
                              <select
                                value={filter.key}
                                onChange={(e) => {
                                  const key = e.target.value;
                                  setDraftFormulaFilters((prev) =>
                                    prev.map((f, i) =>
                                      i === index ? { ...f, key } : f,
                                    ),
                                  );
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                {(filter.scope === 'custom'
                                  ? (formulaValueItems.custom[filter.fieldKey || ''] || formulaValueFallback)
                                  : (formulaValueItems[filter.scope] || formulaValueFallback)
                                ).map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
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
                          className="text-[11px] text-slate-600 hover:text-slate-900"
                        >
                          + {t('crm.sales.analytics.formula.condition.add')}
                        </button>
                      </div>
                    </div>
                  )}

                  {draftFormulaFn !== 'sumif' && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] text-slate-500">
                        {t('crm.sales.analytics.formula.block.expression')}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                          {t('crm.sales.analytics.formula.left.label')}
                          <select
                            value={draftFormulaLeftType}
                            onChange={(e) => setDraftFormulaLeftType(e.target.value as FormulaOperandType)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                          >
                            {formulaOperandOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {(draftFormulaLeftType === 'status' ||
                          draftFormulaLeftType === 'channel' ||
                          draftFormulaLeftType === 'product' ||
                          draftFormulaLeftType === 'market' ||
                          draftFormulaLeftType === 'manager' ||
                          draftFormulaLeftType === 'currency') && (
                          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                            {t('crm.sales.analytics.formula.left.value')}
                            <select
                              value={draftFormulaLeftKey}
                              onChange={(e) => setDraftFormulaLeftKey(e.target.value)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                            >
                              {(formulaValueItems[draftFormulaLeftType] || formulaValueFallback).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {draftFormulaLeftType === 'custom' && (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.filter.customField')}
                              <select
                                value={draftFormulaLeftCustomField}
                                onChange={(e) => {
                                  const fieldKey = e.target.value;
                                  setDraftFormulaLeftCustomField(fieldKey);
                                  setDraftFormulaLeftKey(`${fieldKey}::`);
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                <option value="">—</option>
                                {activeCustomFields.map((field) => (
                                  <option key={field.key} value={field.key}>
                                    {field.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.left.value')}
                              <select
                                value={parseCustomOperand(draftFormulaLeftKey).value}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  const fieldKey = draftFormulaLeftCustomField;
                                  setDraftFormulaLeftKey(`${fieldKey}::${nextValue}`);
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                {(formulaValueItems.custom[draftFormulaLeftCustomField] || formulaValueFallback).map((item) => (
                                  <option key={item.id} value={item.label}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}

                        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                          {t('crm.sales.analytics.formula.right.label')}
                          <select
                            value={draftFormulaRightType}
                            onChange={(e) => setDraftFormulaRightType(e.target.value as FormulaOperandType)}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                          >
                            {formulaOperandOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {(draftFormulaRightType === 'status' ||
                          draftFormulaRightType === 'channel' ||
                          draftFormulaRightType === 'product' ||
                          draftFormulaRightType === 'market' ||
                          draftFormulaRightType === 'manager' ||
                          draftFormulaRightType === 'currency') && (
                          <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                            {t('crm.sales.analytics.formula.right.value')}
                            <select
                              value={draftFormulaRightKey}
                              onChange={(e) => setDraftFormulaRightKey(e.target.value)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                            >
                              {(formulaValueItems[draftFormulaRightType] || formulaValueFallback).map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        {draftFormulaRightType === 'custom' && (
                          <div className="flex flex-col gap-2">
                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.filter.customField')}
                              <select
                                value={draftFormulaRightCustomField}
                                onChange={(e) => {
                                  const fieldKey = e.target.value;
                                  setDraftFormulaRightCustomField(fieldKey);
                                  setDraftFormulaRightKey(`${fieldKey}::`);
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                <option value="">—</option>
                                {activeCustomFields.map((field) => (
                                  <option key={field.key} value={field.key}>
                                    {field.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[11px] text-slate-500">
                              {t('crm.sales.analytics.formula.right.value')}
                              <select
                                value={parseCustomOperand(draftFormulaRightKey).value}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  const fieldKey = draftFormulaRightCustomField;
                                  setDraftFormulaRightKey(`${fieldKey}::${nextValue}`);
                                }}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                              >
                                {(formulaValueItems.custom[draftFormulaRightCustomField] || formulaValueFallback).map((item) => (
                                  <option key={item.id} value={item.label}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setEditOpen(false);
                  }}
                  className="px-4 py-2 rounded-2xl border border-slate-200 text-[11px] text-slate-600 hover:text-slate-900"
                >
                  {t('crm.sales.analytics.common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (addOpen) addWidget();
                    if (editOpen) saveWidget();
                  }}
                  className="px-4 py-2 rounded-2xl bg-black text-[11px] font-semibold text-white"
                >
                  {addOpen ? t('crm.sales.analytics.common.add') : t('crm.sales.analytics.common.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {resetOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
              <h3 className="text-base font-semibold text-slate-900">
                {t('crm.sales.analytics.reset.title')}
              </h3>
              <p className="mt-2 text-[12px] text-slate-600">
                {t('crm.sales.analytics.reset.subtitle')}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-200 text-[11px] text-slate-600"
                >
                  {t('crm.sales.analytics.common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 rounded-2xl bg-black text-[11px] font-semibold text-white"
                >
                  {t('crm.sales.analytics.reset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {!hasData && loading && (
          <div className="text-[12px] text-slate-500">
            {t('crm.sales.analytics.loading')}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
