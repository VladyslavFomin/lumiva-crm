/**
 * Рендер виджета в стиле «Аналитика проектов» по сохранённому widgetConfig + данным items.
 * Используется на главной и в превью модалки.
 */
import React, { useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
} from 'recharts';
import type { Project } from '../pages/projects/projectTypes';
import type { ProjectsAnalyticsWidgetConfig } from './analyticsStorage';

const CHART_COLORS = ['#38bdf8', '#e11d48', '#f97316', '#22c55e', '#2563eb', '#6366f1'];

const parseNumericLoose = (raw: any): number | null => {
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

const getCustomFieldValue = (item: Project, key: string) => item.customFields?.[key];

const numericKeyLooksMonetary = (key: string) => {
  const k = key.toLowerCase();
  return (
    k.includes('amount') ||
    k.includes('price') ||
    k.includes('sum') ||
    k.includes('value') ||
    k.includes('tutar') ||
    k.includes('miktar') ||
    k.includes('total') ||
    k.includes('cost') ||
    k.includes('budget')
  );
};

/** Первое кастомное поле для суммы в формуле (порядок ключей стабильный). */
function inferFirstNumericCustomFieldKey(sourceItems: Project[]): string | null {
  const seen = new Set<string>();
  for (const item of sourceItems) {
    const cf = item.customFields || {};
    for (const key of Object.keys(cf)) {
      if (seen.has(key)) continue;
      const raw = cf[key];
      if (parseNumericLoose(raw) !== null || numericKeyLooksMonetary(key)) {
        seen.add(key);
      }
    }
  }
  const keys = Array.from(seen).sort((a, b) => a.localeCompare(b));
  return keys[0] ?? null;
}

type ChartRow = { code: string; label: string; count: number };

function buildSeriesForWidget(
  chartKey: string,
  sourceItems: Project[],
  mode: 'count' | 'sum',
  valueField: string | undefined,
  t: TFunction,
  isWorkspaceMode: boolean,
): ChartRow[] {
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
    const grouped = new Map<string, ChartRow>();
    sourceItems.forEach((item) => {
      let code = '';
      let label = '';
      if (chartKey === 'category') {
        code = item.category || t('crm.projects.analytics.noCategory');
        label = code;
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
        label = String(item.status);
      }
      const row = grouped.get(code) || { code, label, count: 0 };
      row.count += mode === 'sum' ? getNumericValue(item) : 1;
      grouped.set(code, row);
    });
    return Array.from(grouped.values());
  }

  if (!chartKey.startsWith('field:')) return [];
  const fieldKey = chartKey.replace('field:', '');
  const grouped = new Map<string, ChartRow>();
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
}

function isWonProject(p: Project): boolean {
  const st = (p.status || '').toString().toLowerCase();
  return ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) => st.includes(x));
}

function resolveMetricValue(
  key: string | undefined,
  sourceItems: Project[],
  locale: string,
  t: TFunction,
  denominatorItems: Project[] = sourceItems,
): string {
  if (key === 'filteredPercent') {
    const d = denominatorItems.length;
    return d > 0 ? `${Math.round((sourceItems.length / d) * 100)}%` : '0%';
  }
  const sourceTotal = sourceItems.length;
  const sourceAmount = sourceItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  const sourceAvg = sourceTotal > 0 ? Math.round(sourceAmount / sourceTotal) : 0;
  const currency = sourceItems[0]?.currency || 'EUR';
  const formatAmount = (amount: number) => {
    const formatted = new Intl.NumberFormat(locale).format(amount);
    return t('crm.projects.common.amountWithCurrency', { amount: formatted, currency });
  };
  const sourceOwners = new Set(
    sourceItems.map((item) => item.owner || t('crm.projects.analytics.unknownOwner')),
  ).size;
  const sourceCategories = new Set(
    sourceItems.map((item) => item.category || t('crm.projects.analytics.noCategory')),
  ).size;
  const sourceTags = new Set(sourceItems.flatMap((item) => item.tags || [])).size;
  const sourceStatuses = new Set(sourceItems.map((item) => item.status)).size;

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
    case 'won':
      return sourceItems.filter(isWonProject).length.toLocaleString(locale);
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
}

type FormulaScope = string;

function itemMatchesOneKeyEmbed(
  item: Project,
  scope: FormulaScope,
  t: TFunction,
  key: string,
): boolean {
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
}

function itemMatchesFilterRowEmbed(
  item: Project,
  filter: { scope: string; keys?: string[]; key?: string },
  t: TFunction,
): boolean {
  const keys = Array.isArray(filter.keys) && filter.keys.length
    ? filter.keys
    : filter.key
      ? [String(filter.key)]
      : [];
  if (keys.length === 0) return true;
  return keys.some((k) => itemMatchesOneKeyEmbed(item, filter.scope as FormulaScope, t, k));
}

const EMBED_PIVOT_MAX_ROWS = 24;
const EMBED_PIVOT_MAX_COLS = 10;
const EMBED_TABLE_MULTI_MAX_ROWS = 300;

function cartesianBucketCombosEmbed(
  buckets: Array<Array<{ code: string; label: string }>>,
): Array<Array<{ code: string; label: string }>> {
  if (!buckets.length) return [];
  return buckets.reduce<Array<Array<{ code: string; label: string }>>>(
    (acc, curr) => acc.flatMap((prefix) => curr.map((el) => [...prefix, el])),
    [[]],
  );
}

function buildMultiDimFieldTableRowsEmbed(
  dimensions: string[],
  sourceItems: Project[],
  mode: 'count' | 'sum',
  valueField: string | undefined,
  t: TFunction,
) {
  const grouped = new Map<string, { cells: string[]; count: number }>();
  sourceItems.forEach((item) => {
    const perDim = dimensions.map((dim) => extractPivotBucketsEmbed(item, dim, t));
    if (perDim.some((b) => b.length === 0)) return;
    const combos = cartesianBucketCombosEmbed(perDim);
    for (const combo of combos) {
      const key = combo.map((b) => b.code).join('\x1e');
      const cells = combo.map((b) => b.label);
      const delta = mode === 'sum' ? pivotNumericValueEmbed(item, valueField, true) : 1;
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
  return rows.slice(0, EMBED_TABLE_MULTI_MAX_ROWS);
}

function extractPivotBucketsEmbed(
  item: Project,
  chartKey: string,
  t: TFunction,
): Array<{ code: string; label: string }> {
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
  if (chartKey === 'category') {
    const code = item.category || t('crm.projects.analytics.noCategory');
    return [{ code, label: code }];
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
  return [{ code, label: String(item.status) }];
}

function collectPivotAxisUniqueEmbed(
  sourceItems: Project[],
  chartKey: string,
  t: TFunction,
) {
  const map = new Map<string, string>();
  sourceItems.forEach((item) => {
    extractPivotBucketsEmbed(item, chartKey, t).forEach((b) => map.set(b.code, b.label));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, label]) => ({ code, label }));
}

function pivotNumericValueEmbed(item: Project, valueField?: string, isFieldChart?: boolean): number {
  if (!valueField) return isFieldChart ? 0 : item.amount || 0;
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
}

function pivotMeasureAggregateEmbed(
  cellItems: Project[],
  mode: 'count' | 'sum',
  valueField: string | undefined,
  isFieldChart: boolean,
): number {
  if (mode === 'count') return cellItems.length;
  return cellItems.reduce((acc, item) => acc + pivotNumericValueEmbed(item, valueField, isFieldChart), 0);
}

/** Локализация статуса проекта/лида для таблицы (англ. коды из API) */
function translateProjectStatus(status: string, t: TFunction): string {
  const raw = String(status ?? '').trim();
  if (!raw) return '—';
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  const toI18n: Record<string, string> = {
    new: 'new',
    won: 'won',
    lost: 'lost',
    in_progress: 'inProgress',
    inprogress: 'inProgress',
    review: 'review',
    paused: 'paused',
    confirmed: 'inProgress',
    cancelled: 'lost',
  };
  const k = toI18n[lower];
  if (k) {
    const tr = t(`crm.projects.statuses.${k}`, { defaultValue: '' });
    if (tr) return tr;
  }
  const leadKeyMap: Record<string, string> = {
    new: 'new',
    won: 'won',
    lost: 'lost',
    in_progress: 'inProgress',
    inprogress: 'inProgress',
    waiting: 'waiting',
  };
  const lk = leadKeyMap[lower];
  if (lk) {
    const tr = t(`crm.leads.statuses.${lk}`, { defaultValue: '' });
    if (tr) return tr;
  }
  return raw;
}

function formatEmbedTableAggCell(
  n: number,
  mode: 'count' | 'sum',
  valueField: string | undefined,
  locale: string,
  t: TFunction,
  currency: string,
): string {
  if (mode === 'sum' && (valueField === 'amount' || !valueField)) {
    const formatted = new Intl.NumberFormat(locale).format(n);
    return t('crm.projects.common.amountWithCurrency', { amount: formatted, currency });
  }
  if (mode === 'sum') {
    return new Intl.NumberFormat(locale).format(n);
  }
  return n.toLocaleString(locale);
}

function resolveOperandFormulaEmbed(
  type: string | undefined,
  key: string | undefined,
  sourceItems: Project[],
  t: TFunction,
): number {
  if (!type) return 0;
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
    const list = buildSeriesForWidget(type, sourceItems, 'count', undefined, t, true);
    return list.find((x) => x.code === key)?.count ?? 0;
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
    return new Set(sourceItems.map((item) => item.owner || t('crm.projects.analytics.unknownOwner')))
      .size;
  }
  if (type === 'categories') {
    return new Set(sourceItems.map((item) => item.category || t('crm.projects.analytics.noCategory')))
      .size;
  }
  if (type === 'tags') {
    return new Set(sourceItems.flatMap((item) => item.tags || [])).size;
  }
  if (type === 'status') {
    const series = buildSeriesForWidget('status', sourceItems, 'count', undefined, t, false);
    return series.find((s) => s.code === key)?.count ?? 0;
  }
  if (type === 'category') {
    const series = buildSeriesForWidget('category', sourceItems, 'count', undefined, t, false);
    return series.find((s) => s.code === key)?.count ?? 0;
  }
  if (type === 'owner') {
    const series = buildSeriesForWidget('owner', sourceItems, 'count', undefined, t, false);
    return series.find((s) => s.code === key)?.count ?? 0;
  }
  if (type === 'tag') {
    const series = buildSeriesForWidget('tag', sourceItems, 'count', undefined, t, false);
    return series.find((s) => s.code === key)?.count ?? 0;
  }
  return 0;
}

function evaluateFormulaWidgetEmbed(
  w: ProjectsAnalyticsWidgetConfig,
  widgetItems: Project[],
  locale: string,
  t: TFunction,
): React.ReactElement {
  const fn = w.formulaFn ?? 'sumif';
  const mode = w.formulaMode ?? 'count';
  const leftType = w.formulaLeftType ?? 'total';
  const rightType = w.formulaRightType ?? 'total';
  const leftKey = w.formulaLeftKey;
  const rightKey = w.formulaRightKey;
  const filters = w.formulaFilters ?? [];

  const matchingItems = widgetItems.filter((item) =>
    filters.every((filter) => itemMatchesFilterRowEmbed(item, filter, t)),
  );
  const baseTotal = widgetItems.length;

  const leftValue = resolveOperandFormulaEmbed(leftType, leftKey, widgetItems, t);
  const rightValue = resolveOperandFormulaEmbed(rightType, rightKey, widgetItems, t);
  const filterValue = matchingItems.length;

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
      const inferred = inferFirstNumericCustomFieldKey(matchingItems);
      const targetOperand =
        leftType && leftType !== 'total'
          ? leftType
          : inferred
            ? `sum:${inferred}`
            : 'total';
      primaryValue = resolveOperandFormulaEmbed(targetOperand, leftKey, matchingItems, t);
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
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
      <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">
        {primaryLabel}
      </div>
      {secondaryLabel != null && (
        <div className="text-[11px] text-neutral-500">
          {secondaryLabel} · {t('crm.projects.analytics.period.all')}
        </div>
      )}
    </div>
  );
}

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

export const ProjectsAnalyticsWidgetEmbed: React.FC<{
  widget: ProjectsAnalyticsWidgetConfig;
  items: Project[];
  locale: string;
  t: TFunction;
  compact?: boolean;
}> = ({ widget: w, items, locale, t, compact }) => {
  const [activeDonut, setActiveDonut] = useState<number | null>(null);
  const palette = CHART_COLORS;

  const widgetItems = useMemo(() => {
    const filters = w.formulaFilters;
    if (!filters?.length) return items;
    return items.filter((item) =>
      filters.every((filter) => itemMatchesFilterRowEmbed(item, filter, t)),
    );
  }, [items, w.formulaFilters, t]);

  const isWorkspaceChart = !!(w.chartKey && w.chartKey.startsWith('field:'));
  const chartH = compact ? 140 : 220;
  const innerR = compact ? 32 : 56;
  const outerR = compact ? 48 : 80;

  if (w.type === 'metric') {
    return (
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">
          {resolveMetricValue(w.metricKey, widgetItems, locale, t, items)}
        </div>
        <div className="text-[11px] text-neutral-500">{t('crm.projects.analytics.period.all')}</div>
      </div>
    );
  }

  if (w.type === 'donut') {
    const donutData = buildSeriesForWidget(
      w.chartKey || 'status',
      widgetItems,
      w.chartValueMode || 'count',
      w.chartValueField,
      t,
      isWorkspaceChart,
    );
    const donutTotal = donutData.reduce((sum, row) => sum + row.count, 0);
    const activeProps =
      activeDonut === null ? {} : ({ activeIndex: activeDonut, activeShape: renderActiveDonut } as any);
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div style={{ height: chartH }} className="md:flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={innerR}
                  outerRadius={outerR}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={2}
                  {...activeProps}
                  onMouseLeave={() => setActiveDonut(null)}
                  onMouseEnter={(_, idx) => setActiveDonut(idx)}
                >
                  {donutData.map((entry, idx) => (
                    <Cell
                      key={entry.code}
                      fill={palette[idx % palette.length]}
                      opacity={activeDonut === null || activeDonut === idx ? 1 : 0.35}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {w.showLabels !== false && (
            <div className="md:w-44 space-y-1 text-[10px] max-h-[140px] overflow-y-auto">
              {donutData.map((entry, idx) => {
                const percent = donutTotal > 0 ? Math.round((entry.count / donutTotal) * 100) : 0;
                return (
                  <div key={entry.code} className="flex justify-between gap-2 text-neutral-600">
                    <span className="truncate flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: palette[idx % palette.length] }} />
                      {entry.label}
                    </span>
                    <span className="font-mono tabular-nums text-[#222]">
                      {entry.count} · {percent}%
                    </span>
                  </div>
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
      w.chartKey || 'status',
      widgetItems,
      w.chartValueMode || 'count',
      w.chartValueField,
      t,
      isWorkspaceChart,
    ).map((item) => ({ label: item.label, count: item.count }));
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div style={{ height: chartH + 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: compact ? 8 : 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#888888' }} interval={0} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#b5b5b5' }} width={28} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={compact ? 18 : 28}>
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
  const tableCurrency = widgetItems[0]?.currency || items[0]?.currency || 'EUR';

  if (w.type === 'table' && w.tableKey && w.tableKey.startsWith('field:')) {
    const dimKeysRaw =
      Array.isArray(w.tableDimensions) && w.tableDimensions.length > 0
        ? w.tableDimensions
            .map(String)
            .filter((id) => id.startsWith('field:'))
            .slice(0, 4)
        : [String(w.tableKey)];
    const dimKeys = dimKeysRaw.length ? dimKeysRaw : [String(w.tableKey)];
    const dimLabels = dimKeys.map((id) => id.replace('field:', ''));
    const rows = buildMultiDimFieldTableRowsEmbed(
      dimKeys,
      widgetItems,
      tableAggMode,
      tableAggField,
      t,
    );
    const valueHeader =
      tableAggMode === 'sum'
        ? t('crm.projects.analytics.tableMetric.sum')
        : t('crm.projects.analytics.ownersTable.headers.projects');
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-2">{w.title}</div>
        <table className="w-full text-[10px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <tr className="border-b border-neutral-200">
              {dimLabels.map((label, i) => (
                <th key={i} className="text-left font-normal py-1 pr-2">
                  {label}
                </th>
              ))}
              <th className="text-right font-normal py-1">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-neutral-100">
                {row.cells.map((cell, i) => (
                  <td key={i} className="py-1 text-[#222] pr-2">
                    {cell}
                  </td>
                ))}
                <td className="py-1 text-right">
                  {formatEmbedTableAggCell(row.count, tableAggMode, tableAggField, locale, t, tableCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'table' && w.tableKey === 'owners') {
    const ownerSeries = buildSeriesForWidget(
      'owner',
      widgetItems,
      tableAggMode,
      tableAggField,
      t,
      false,
    );
    const ownersValueHeader =
      tableAggMode === 'sum'
        ? t('crm.projects.analytics.tableMetric.sum')
        : t('crm.projects.analytics.ownersTable.headers.projects');
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-2">{w.title}</div>
        <table className="w-full text-[10px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <tr className="border-b border-neutral-200">
              <th className="text-left font-normal py-1">
                {t('crm.projects.analytics.ownersTable.headers.owner')}
              </th>
              <th className="text-right font-normal py-1">{ownersValueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {ownerSeries.map((o) => (
              <tr key={o.label} className="border-b border-neutral-100">
                <td className="py-1 text-[#222]">{o.label}</td>
                <td className="py-1 text-right">
                  {formatEmbedTableAggCell(o.count, tableAggMode, tableAggField, locale, t, tableCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'table' && w.tableKey === 'categories') {
    const catSeries = buildSeriesForWidget(
      'category',
      widgetItems,
      tableAggMode,
      tableAggField,
      t,
      false,
    );
    const categoriesValueHeader =
      tableAggMode === 'sum'
        ? t('crm.projects.analytics.tableMetric.sum')
        : t('crm.projects.analytics.categoriesTable.headers.projects');
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-2">{w.title}</div>
        <table className="w-full text-[10px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <tr className="border-b border-neutral-200">
              <th className="text-left font-normal py-1">
                {t('crm.projects.analytics.categoriesTable.headers.category')}
              </th>
              <th className="text-right font-normal py-1">{categoriesValueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {catSeries.map((c) => (
              <tr key={c.label} className="border-b border-neutral-100">
                <td className="py-1 text-[#222]">{c.label}</td>
                <td className="py-1 text-right">
                  {formatEmbedTableAggCell(c.count, tableAggMode, tableAggField, locale, t, tableCurrency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'table' && w.tableKey === 'projects') {
    const rows = widgetItems.slice(0, compact ? 4 : 12);
    const currency = widgetItems[0]?.currency || 'EUR';
    const formatAmount = (amount: number) => {
      const formatted = new Intl.NumberFormat(locale).format(amount);
      return t('crm.projects.common.amountWithCurrency', { amount: formatted, currency });
    };
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-2">{w.title}</div>
        <table className="w-full text-[10px] border-separate border-spacing-y-1">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <tr className="border-b border-neutral-200">
              <th className="text-left font-normal px-1 py-1">
                {t('crm.projects.analytics.table.headers.project')}
              </th>
              <th className="text-left font-normal px-1 py-1">
                {t('crm.projects.analytics.table.headers.status')}
              </th>
              <th className="text-right font-normal px-1 py-1">
                {t('crm.projects.analytics.table.headers.amount')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="bg-neutral-50/90">
                <td className="px-1 py-1 text-[#222] truncate max-w-[100px]">{p.name}</td>
                <td className="px-1 py-1 text-neutral-600 whitespace-nowrap">
                  {translateProjectStatus(String(p.status), t)}
                </td>
                <td className="px-1 py-1 text-right text-[#222] font-mono tabular-nums">{formatAmount(p.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[10px] text-neutral-500 mt-1 text-right">
          {t('crm.projects.analytics.table.total', { count: widgetItems.length })}
        </div>
      </div>
    );
  }

  if (w.type === 'pivot') {
    const rowKey = String(w.pivotRowKey || 'category');
    const colKey = String(w.pivotColKey || 'status');
    const measures = (
      Array.isArray(w.pivotMeasures) && w.pivotMeasures.length
        ? w.pivotMeasures
        : [{ id: 'pv', mode: 'count' as const }]
    ).slice(0, 4);
    const isField = (k: string) => k.startsWith('field:');
    if (rowKey === colKey) {
      return (
        <div className="text-[10px] text-amber-700">
          {w.title}: {t('crm.projects.analytics.pivot.sameAxisHint')}
        </div>
      );
    }
    const rowAxis = collectPivotAxisUniqueEmbed(widgetItems, rowKey, t).slice(0, EMBED_PIVOT_MAX_ROWS);
    const colAxis = collectPivotAxisUniqueEmbed(widgetItems, colKey, t).slice(0, EMBED_PIVOT_MAX_COLS);
    if (!rowAxis.length || !colAxis.length) {
      return (
        <div className="text-[10px] text-neutral-500">
          {w.title}: {t('crm.projects.analytics.pivot.noData')}
        </div>
      );
    }
    const cur = widgetItems[0]?.currency || 'EUR';
    const fmtCell = (n: number, m: { mode: string; valueField?: string }) => {
      if (m.mode === 'count') return n.toLocaleString(locale);
      if (m.mode === 'sum' && (m.valueField === 'amount' || !m.valueField)) {
        const formatted = new Intl.NumberFormat(locale).format(n);
        return t('crm.projects.common.amountWithCurrency', { amount: formatted, currency: cur });
      }
      return new Intl.NumberFormat(locale).format(n);
    };
    const mLabel = (m: { mode: string; shortLabel?: string }) =>
      m.shortLabel?.trim() ||
      (m.mode === 'count'
        ? t('crm.projects.analytics.pivot.measure.count')
        : t('crm.projects.analytics.pivot.measure.sum'));
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{w.title}</div>
        <table className="w-full text-[9px] border-collapse">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400 border-b border-neutral-200">
              <th className="text-left font-normal py-0.5 pr-1 sticky left-0 bg-white" rowSpan={2} />
              {colAxis.map((col) => (
                <th
                  key={col.code}
                  className="text-center font-normal px-0.5 border-l border-neutral-100"
                  colSpan={measures.length}
                >
                  <span className="line-clamp-2">{col.label}</span>
                </th>
              ))}
            </tr>
            <tr className="font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-400">
              {colAxis.flatMap((col) =>
                measures.map((m) => (
                  <th key={`${col.code}-${m.id}`} className="text-right font-normal px-0.5 border-l border-neutral-100">
                    {mLabel(m)}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rowAxis.map((row) => (
              <tr key={row.code} className="border-b border-neutral-100">
                <td className="py-0.5 pr-1 text-[#222] sticky left-0 bg-white font-medium truncate max-w-[72px]">
                  {row.label}
                </td>
                {colAxis.flatMap((col) =>
                  measures.map((m) => {
                    const cellItems = widgetItems.filter(
                      (item) =>
                        extractPivotBucketsEmbed(item, rowKey, t).some((b) => b.code === row.code) &&
                        extractPivotBucketsEmbed(item, colKey, t).some((b) => b.code === col.code),
                    );
                    const val = pivotMeasureAggregateEmbed(
                      cellItems,
                      m.mode as 'count' | 'sum',
                      m.valueField,
                      isField(rowKey) || isField(colKey),
                    );
                    return (
                      <td
                        key={`${row.code}-${col.code}-${m.id}`}
                        className="py-0.5 px-0.5 text-right tabular-nums border-l border-neutral-100"
                      >
                        {fmtCell(val, m)}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'formula') {
    return evaluateFormulaWidgetEmbed(w, widgetItems, locale, t);
  }

  return (
    <div className="text-[11px] text-neutral-500">
      {w.title} — {t('crm.dashboard.presets.embedFallback')}
    </div>
  );
};
