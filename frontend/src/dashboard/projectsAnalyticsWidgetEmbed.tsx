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
const THEME_PRIMARY: Record<string, string> = {
  lumiva: '#0ea5e9',
  ocean: '#2563eb',
  sunset: '#f97316',
  forest: '#16a34a',
  red: '#dc2626',
};

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
): string {
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

function itemMatchesFilterEmbed(
  item: Project,
  scope: FormulaScope,
  key?: string,
  t: TFunction,
): boolean {
  if (!key) return true;
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
  themePrimary: string,
): React.ReactElement {
  const fn = w.formulaFn ?? 'sumif';
  const mode = w.formulaMode ?? 'count';
  const leftType = w.formulaLeftType ?? 'total';
  const rightType = w.formulaRightType ?? 'total';
  const leftKey = w.formulaLeftKey;
  const rightKey = w.formulaRightKey;
  const filters =
    w.formulaFilters && w.formulaFilters.length > 0
      ? w.formulaFilters
      : [{ scope: 'status', key: '' }];

  const matchingItems = widgetItems.filter((item) =>
    filters.every((filter) =>
      itemMatchesFilterEmbed(item, filter.scope as FormulaScope, filter.key, t),
    ),
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
      const targetOperand = leftType && leftType !== 'total' ? leftType : 'total';
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
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
      <div className="text-2xl font-semibold" style={{ color: themePrimary }}>
        {primaryLabel}
      </div>
      {secondaryLabel != null && (
        <div className="text-[11px] text-slate-500">
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
  const themePrimary = THEME_PRIMARY[w.themeKey || 'lumiva'] || THEME_PRIMARY.lumiva;
  const palette = CHART_COLORS;

  const widgetItems = useMemo(() => {
    const filters = w.formulaFilters;
    if (!filters?.length) return items;
    return items.filter((item) =>
      filters.every((filter) => {
        const scope = filter.scope;
        const key = filter.key;
        if (!key) return true;
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
      }),
    );
  }, [items, w.formulaFilters]);

  const isWorkspaceChart = !!(w.chartKey && w.chartKey.startsWith('field:'));
  const chartH = compact ? 140 : 220;
  const innerR = compact ? 32 : 56;
  const outerR = compact ? 48 : 80;

  if (w.type === 'metric') {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
        <div className="text-2xl font-semibold" style={{ color: themePrimary }}>
          {resolveMetricValue(w.metricKey, widgetItems, locale, t)}
        </div>
        <div className="text-[11px] text-slate-500">{t('crm.projects.analytics.period.all')}</div>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {w.showLabels !== false && (
            <div className="md:w-44 space-y-1 text-[10px] max-h-[140px] overflow-y-auto">
              {donutData.map((entry, idx) => {
                const percent = donutTotal > 0 ? Math.round((entry.count / donutTotal) * 100) : 0;
                return (
                  <div key={entry.code} className="flex justify-between gap-2 text-slate-600">
                    <span className="truncate" style={{ color: palette[idx % palette.length] }}>
                      {entry.label}
                    </span>
                    <span>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{w.title}</div>
        <div style={{ height: chartH + 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: compact ? 8 : 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} width={28} />
              <Tooltip />
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

  if (w.type === 'table' && w.tableKey === 'owners') {
    const ownerSeries = buildSeriesForWidget('owner', widgetItems, 'count', undefined, t, false);
    return (
      <div className="overflow-x-auto">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">{w.title}</div>
        <table className="w-full text-[10px]">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left font-normal py-1">
                {t('crm.projects.analytics.ownersTable.headers.owner')}
              </th>
              <th className="text-right font-normal py-1">
                {t('crm.projects.analytics.ownersTable.headers.projects')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ownerSeries.map((o) => (
              <tr key={o.label} className="border-b border-slate-100">
                <td className="py-1 text-slate-800">{o.label}</td>
                <td className="py-1 text-right">{o.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (w.type === 'table' && w.tableKey === 'categories') {
    const catSeries = buildSeriesForWidget('category', widgetItems, 'count', undefined, t, false);
    return (
      <div className="overflow-x-auto">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">{w.title}</div>
        <table className="w-full text-[10px]">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left font-normal py-1">
                {t('crm.projects.analytics.categoriesTable.headers.category')}
              </th>
              <th className="text-right font-normal py-1">
                {t('crm.projects.analytics.categoriesTable.headers.projects')}
              </th>
            </tr>
          </thead>
          <tbody>
            {catSeries.map((c) => (
              <tr key={c.label} className="border-b border-slate-100">
                <td className="py-1 text-slate-800">{c.label}</td>
                <td className="py-1 text-right">{c.count}</td>
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
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">{w.title}</div>
        <table className="w-full text-[10px] border-separate border-spacing-y-1">
          <thead className="text-slate-500">
            <tr>
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
              <tr key={p.id} className="bg-slate-50/80">
                <td className="px-1 py-1 text-slate-900 truncate max-w-[100px]">{p.name}</td>
                <td className="px-1 py-1 text-slate-600 whitespace-nowrap">
                  {translateProjectStatus(String(p.status), t)}
                </td>
                <td className="px-1 py-1 text-right text-slate-800">{formatAmount(p.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-[10px] text-slate-500 mt-1 text-right">
          {t('crm.projects.analytics.table.total', { count: widgetItems.length })}
        </div>
      </div>
    );
  }

  if (w.type === 'formula') {
    return evaluateFormulaWidgetEmbed(w, widgetItems, locale, t, themePrimary);
  }

  return (
    <div className="text-[11px] text-slate-500">
      {w.title} — {t('crm.dashboard.presets.embedFallback')}
    </div>
  );
};
