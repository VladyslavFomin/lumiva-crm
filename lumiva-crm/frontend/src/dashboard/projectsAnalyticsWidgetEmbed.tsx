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
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Sector,
} from 'recharts';
import type { Project } from '../pages/projects/projectTypes';
import type { ProjectsAnalyticsWidgetConfig } from './analyticsStorage';

/** Та же палитровая система тем, что на странице аналитики (THEME_PRESETS/PALETTES в
 * ProjectsAnalyticsPage) — раньше этот файл рисовал донат/бар своим фиксированным набором цветов
 * (CHART_COLORS), никак не связанным с выбранной темой виджета (w.themeKey), поэтому блок на
 * главной был другого цвета, чем на самой странице аналитики. */
const EMBED_PALETTES: Record<string, string[]> = {
  lumiva: ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319'],
  ocean: ['#0ea5e9', '#22d3ee', '#38bdf8', '#2563eb', '#14b8a6', '#06b6d4'],
  sunset: ['#f97316', '#fb7185', '#f43f5e', '#f59e0b', '#fbbf24', '#fca5a5'],
  forest: ['#22c55e', '#16a34a', '#4ade80', '#10b981', '#34d399', '#86efac'],
  red: ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'],
};
const EMBED_THEME_PRESETS: Array<{ key: string; primary: string; palette: string[] }> = [
  { key: 'lumiva', primary: '#222222', palette: EMBED_PALETTES.lumiva },
  { key: 'ocean', primary: '#2563eb', palette: EMBED_PALETTES.ocean },
  { key: 'sunset', primary: '#f97316', palette: EMBED_PALETTES.sunset },
  { key: 'forest', primary: '#16a34a', palette: EMBED_PALETTES.forest },
  { key: 'red', primary: '#dc2626', palette: EMBED_PALETTES.red },
];
/** Отдельный от тем набор — на странице аналитики используется для «Сторон сравнения» формулы
 * (V2_PALETTE), независимо от выбранной темы виджета. */
const V2_PALETTE_EMBED = ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319', '#cc2f47', '#5a45a8'];

/** Статусы лидов/проектов хранятся как русский текст и на страницах аналитики окрашены по смыслу
 * (STATUS_COLORS в LeadsAnalyticsPageV2) — иначе один и тот же статус на главной был другого цвета,
 * чем на источнике (цвет брался по индексу из темы). */
const STATUS_COLORS_EMBED: Record<string, string> = {
  'Новый клиент': '#1769d1',
  'В работе': '#3b6cb6',
  'Ожидает ответа': '#c08319',
  'Закрыт (успех)': '#1f8a5e',
  'Закрыт (проигран)': '#cc2f47',
};
const sliceColorEmbed = (label: string, idx: number, palette: string[]) =>
  STATUS_COLORS_EMBED[label] ?? palette[idx % palette.length];

function resolveThemeEmbed(key?: string) {
  return EMBED_THEME_PRESETS.find((preset) => preset.key === key) || EMBED_THEME_PRESETS[0];
}

/** Совпадает с compactNumber на странице аналитики: округляет и форматирует ru-RU (пробел как
 * разделитель тысяч) независимо от языка интерфейса — так же, как на источнике. */
function compactNumberEmbed(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}

/** Совпадает с donutCenterFontClass на странице аналитики — фиксированный размер шрифта рано или
 * поздно вылезает за кольцо пончика (суммы денег могут быть сколь угодно длинными). */
function donutCenterFontClassEmbed(text: string, thresholds: Array<[number, string]>): string {
  for (const [maxLen, cls] of thresholds) {
    if (text.length <= maxLen) return cls;
  }
  return thresholds[thresholds.length - 1][1];
}

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
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
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
  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
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

/** "summonths:m_2025_08,m_2025_09" — операнд формулы = сумма НЕСКОЛЬКИХ месячных колонок разом
 * (см. buildSumMonthsType/parseSumMonthsKeys в ProjectsAnalyticsPage — тот же формат). Без этой
 * ветки виджет с "Сторонами сравнения" (Разница/Доля по месяцам) всегда считался как 0. */
function parseSumMonthsKeysEmbed(type: string): string[] {
  return type.startsWith('summonths:') ? type.slice(10).split(',').filter(Boolean) : [];
}

/** Дата месяца по ключу поля вида "m_2025_08" — тот же паттерн, что parseMonthFieldDate на
 * странице аналитики, но без доступа к CustomObjectField[] (здесь их нет) — работает только
 * по ключу, без запасного варианта через человекочитаемую подпись поля. */
function parseMonthFieldDateEmbed(fieldKey: string): Date | null {
  const keyMatch = /^m_(\d{4})_(\d{1,2})$/.exec(fieldKey) || /^(\d{4})-(\d{1,2})$/.exec(fieldKey);
  if (!keyMatch) return null;
  const year = Number(keyMatch[1]);
  const month = Number(keyMatch[2]);
  if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12) return new Date(year, month - 1, 1);
  return null;
}

function describeMonthOperandEmbed(type: string, locale: string): string {
  const fmt = (d: Date) => d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  if (type.startsWith('summonths:')) {
    const dates = parseSumMonthsKeysEmbed(type)
      .map((k) => parseMonthFieldDateEmbed(k))
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length) return 'Группа';
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])}–${fmt(dates[dates.length - 1])}`;
  }
  if (type.startsWith('sum:')) {
    const fieldKey = type.slice(4);
    const date = parseMonthFieldDateEmbed(fieldKey);
    return date ? fmt(date) : fieldKey;
  }
  return '';
}

function describeCompareSideEmbed(
  side: { id: string; label?: string; monthKeys: string[] },
  locale: string,
): string {
  if (side.label?.trim()) return side.label.trim();
  const keys = side.monthKeys.length ? `summonths:${side.monthKeys.join(',')}` : '';
  return (keys && describeMonthOperandEmbed(keys, locale)) || 'Группа';
}

function sumCompareSideEmbed(side: { monthKeys: string[] }, sourceItems: Project[]): number {
  return sourceItems.reduce(
    (acc, item) =>
      acc + side.monthKeys.reduce((s, k) => s + (parseNumericLoose(getCustomFieldValue(item, k)) ?? 0), 0),
    0,
  );
}

function resolveOperandFormulaEmbed(
  type: string | undefined,
  key: string | undefined,
  sourceItems: Project[],
  t: TFunction,
): number {
  if (!type) return 0;
  if (type.startsWith('summonths:')) {
    const keys = parseSumMonthsKeysEmbed(type);
    return sourceItems.reduce(
      (acc, item) => acc + keys.reduce((s, k) => s + (parseNumericLoose(getCustomFieldValue(item, k)) ?? 0), 0),
      0,
    );
  }
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
  compact: boolean | undefined,
  activeDonut: number | null,
  setActiveDonut: (value: number | null) => void,
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
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(primaryValue)
      : fn === 'percent' || fn === 'ratio' || mode === 'percent'
        ? `${primaryValue}%`
        : primaryValue.toLocaleString(locale, { maximumFractionDigits: 2 });
  const secondaryLabel =
    secondaryValue === null
      ? null
      : mode === 'percent' || fn === 'percent' || fn === 'ratio' || fn === 'diff'
        ? secondaryValue.toLocaleString(locale, { maximumFractionDigits: 2 })
        : `${secondaryValue}%`;

  // Перенос "как показать сравнение" (bar/line/donut/table) со страницы аналитики — раньше этот
  // компонент рисовал только голое число, даже если на источнике был выбран график. Операнды тут
  // уже валидировались при настройке виджета на странице аналитики, поэтому здесь просто доверяем
  // w.compareDisplay, а не пере-проверяем isMonthOperand (для этого нужны были бы CustomObjectField[],
  // которых у embed-компонента нет).
  const compareDisplay = w.compareDisplay ?? 'number';
  const showCompareVisual = compareDisplay !== 'number';
  const compareLeftLabel = describeMonthOperandEmbed(leftType, locale);
  const compareRightLabel = describeMonthOperandEmbed(rightType, locale);
  const compareData: Array<{ name: string; value: number; color: string }> = showCompareVisual
    ? Array.isArray(w.compareSides) && w.compareSides.length >= 2
      ? w.compareSides.map((side, idx) => ({
          name: describeCompareSideEmbed(side, locale),
          value: sumCompareSideEmbed(side, widgetItems),
          color: side.color || V2_PALETTE_EMBED[idx % V2_PALETTE_EMBED.length],
        }))
      : [
          { name: compareLeftLabel, value: leftValue, color: resolveThemeEmbed(w.themeKey).primary },
          { name: compareRightLabel, value: rightValue, color: V2_PALETTE_EMBED[1] },
        ]
    : [];
  const formatCompareValue = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
  const donutData = compareData.map((entry) => ({ ...entry, rawValue: entry.value, value: Math.abs(entry.value) }));

  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
      <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">
        {primaryLabel}
      </div>
      <div className="text-[11px] text-neutral-500">
        {secondaryLabel != null ? `${secondaryLabel} · ` : ''}
        {showCompareVisual ? compareData.map((d) => d.name).join(' vs ') : t('crm.projects.analytics.period.all')}
      </div>
      {showCompareVisual && compareDisplay === 'bar' && (
        <div style={{ height: compact ? 90 : 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
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
        <div style={{ height: compact ? 90 : 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={compareData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [formatCompareValue(Number(value)), '']}
              />
              <Area type="monotone" dataKey="value" stroke="#222222" strokeWidth={2.5} fill="transparent" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {showCompareVisual && compareDisplay === 'donut' && (() => {
        const donutTotal = donutData.reduce((sum, row) => sum + row.value, 0);
        const donutTotalText = compactNumberEmbed(donutTotal);
        const donutTotalFontClass = donutCenterFontClassEmbed(
          donutTotalText,
          compact
            ? [[5, 'text-sm'], [7, 'text-xs'], [9, 'text-[10px]'], [Infinity, 'text-[9px]']]
            : [[5, 'text-base'], [7, 'text-sm'], [9, 'text-xs'], [Infinity, 'text-[10px]']],
        );
        const activeProps =
          activeDonut === null ? {} : ({ activeIndex: activeDonut, activeShape: renderActiveDonut } as any);
        return (
          <div className="grid grid-cols-[minmax(80px,0.9fr)_1.1fr] items-center gap-3" style={{ height: compact ? 90 : 140 }}>
            <div className="relative h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={30}
                    outerRadius={44}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                    {...activeProps}
                    onMouseLeave={() => setActiveDonut(null)}
                    onMouseEnter={(_, idx) => setActiveDonut(idx)}
                  >
                    {donutData.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        opacity={activeDonut === null || activeDonut === idx ? 1 : 0.3}
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
                <span className={`${donutTotalFontClass} font-semibold leading-tight text-center`}>
                  {donutTotalText}
                </span>
                <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-400">всего</span>
              </div>
            </div>
            <div className="space-y-1">
              {donutData.map((entry, idx) => {
                const isActive = activeDonut === idx;
                return (
                  <button
                    key={entry.name}
                    type="button"
                    onMouseEnter={() => setActiveDonut(idx)}
                    onMouseLeave={() => setActiveDonut(null)}
                    className={`grid w-full grid-cols-[10px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1 text-[11px] transition ${
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

function parseDateEmbed(value?: string | null): Date | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts) : null;
}

/** Порт buildTrend со страницы аналитики (ProjectsAnalyticsPage): до 12 равных корзин по createdAt.
 * Вариант "широкой помесячной таблицы" (buildMonthTrend) не портирован — он завязан на состояние
 * страницы (monthFieldDates/activePeriodRange); для такого виджета тренд будет по createdAt. */
function buildTrendEmbed(
  sourceItems: Project[],
  mode: 'count' | 'sum',
  valueField: string | undefined,
  locale: string,
): Array<{ name: string; value: number; previous: number }> {
  const dated = sourceItems
    .map((item) => ({ item, date: parseDateEmbed(item.createdAt) }))
    .filter((entry): entry is { item: Project; date: Date } => Boolean(entry.date));
  if (!dated.length) return [{ name: '—', value: 0, previous: 0 }];
  const minTime = Math.min(...dated.map((e) => e.date.getTime()));
  const maxTime = Math.max(...dated.map((e) => e.date.getTime()));
  const from = new Date(minTime);
  const days = Math.max(1, Math.ceil((maxTime - minTime) / 86_400_000) + 1);
  const pointCount = Math.max(2, Math.min(days, 12));
  const bucketSize = Math.max(1, Math.ceil(days / pointCount));
  const aggregate = (rows: Project[]) =>
    mode === 'sum' ? rows.reduce((sum, item) => sum + pivotNumericValueEmbed(item, valueField), 0) : rows.length;
  return Array.from({ length: pointCount }, (_, index) => {
    const start = new Date(from);
    start.setDate(from.getDate() + index * bucketSize);
    const end = new Date(start);
    end.setDate(start.getDate() + bucketSize);
    const rows = dated.filter((e) => e.date >= start && e.date < end).map((e) => e.item);
    return {
      name: start.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      value: aggregate(rows),
      previous: 0,
    };
  });
}

function buildHeatmapEmbed(sourceItems: Project[]) {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
  return days.map((day, dayIndex) => ({
    day,
    hours: hours.map((hour) => {
      const startHour = Number(hour);
      const value = sourceItems.filter((item) => {
        const date = parseDateEmbed(item.createdAt);
        if (!date) return false;
        const jsDay = date.getDay();
        const normalizedDay = jsDay === 0 ? 6 : jsDay - 1;
        return normalizedDay === dayIndex && date.getHours() >= startHour && date.getHours() < startHour + 3;
      }).length;
      return { hour, value };
    }),
  }));
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
  /** Источник — таблица рабочей области / клиентский аккаунт (не Projects/Sales/Leads). Нужно,
   * чтобы для type=table без tableKey (или с tableKey, который не совпал ни с одной специальной
   * веткой) показать ту же "умную" превью-таблицу с месячными колонками, что и на источнике,
   * а не молча падать в ветку tableKey==='projects' с чужой структурой (имя/статус/сумма). */
  isWorkspaceMode?: boolean;
}> = ({ widget: w, items, locale, t, compact, isWorkspaceMode }) => {
  const [activeDonut, setActiveDonut] = useState<number | null>(null);
  const palette = resolveThemeEmbed(w.themeKey).palette;

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
    ).sort((a, b) => b.count - a.count);
    const donutTotal = donutData.reduce((sum, row) => sum + row.count, 0);
    const donutTotalText = compactNumberEmbed(donutTotal);
    const donutTotalFontClass = donutCenterFontClassEmbed(
      donutTotalText,
      compact
        ? [[5, 'text-base'], [7, 'text-sm'], [9, 'text-xs'], [Infinity, 'text-[10px]']]
        : [[5, 'text-2xl'], [7, 'text-xl'], [9, 'text-lg'], [Infinity, 'text-base']],
    );
    const activeProps =
      activeDonut === null ? {} : ({ activeIndex: activeDonut, activeShape: renderActiveDonut } as any);
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          {/* sticky: длинная легенда (много категорий) растягивает карточку выше видимой области —
              без sticky пончик оказывался прижат к низу видимой части. */}
          <div className="relative md:flex-1 w-full md:sticky md:top-0" style={{ height: chartH }}>
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
                      fill={sliceColorEmbed(entry.label, idx, palette)}
                      opacity={activeDonut === null || activeDonut === idx ? 1 : 0.35}
                    />
                  ))}
                </Pie>
                <Tooltip wrapperStyle={{ zIndex: 20 }} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
              <span className={`${donutTotalFontClass} font-semibold leading-tight text-center`}>
                {donutTotalText}
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-400">всего</span>
            </div>
          </div>
          {w.showLabels !== false && (
            <div className="md:w-44 space-y-1">
              {donutData.map((entry, idx) => {
                const percent = donutTotal > 0 ? Math.round((entry.count / donutTotal) * 100) : 0;
                const isActive = activeDonut === idx;
                return (
                  <button
                    key={entry.code}
                    type="button"
                    onMouseEnter={() => setActiveDonut(idx)}
                    onMouseLeave={() => setActiveDonut(null)}
                    className={`grid w-full grid-cols-[10px_1fr_auto] items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                      isActive ? 'bg-neutral-100 text-[#222]' : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: sliceColorEmbed(entry.label, idx, palette) }} />
                    <span className="truncate text-left">{entry.label}</span>
                    <span className="font-mono text-[#222]">
                      {compactNumberEmbed(entry.count)} <span className="text-neutral-400">· {percent}%</span>
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
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={compact ? 18 : 28}>
                {barData.map((row, idx) => (
                  <Cell key={idx} fill={sliceColorEmbed(row.label, idx, palette)} />
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

  if (w.type === 'table' && isWorkspaceMode) {
    // На источнике (ProjectsAnalyticsPage) этот же случай — generic-превью таблицы рабочей области
    // без tableKey — показывает запись + до 3 последних месячных колонок, а не имя/статус/сумму.
    // Без этой ветки виджет молча попадал в tableKey==='projects' ниже (чужая структура + чужие
    // цифры, ноль почти везде — вот и была "разница" с источником, о которой сообщил пользователь).
    // Полностью повторить "умный" выбор месяцев источника (зависящий от выбранного на странице
    // периода) здесь нельзя — у главной нет своего периода, поэтому берём последние 3 месяца.
    const allKeys = new Set<string>();
    widgetItems.forEach((item) => Object.keys(item.customFields || {}).forEach((k) => allKeys.add(k)));
    const monthKeysSorted = [...allKeys]
      .map((key) => ({ key, date: parseMonthFieldDateEmbed(key) }))
      .filter((entry): entry is { key: string; date: Date } => !!entry.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => entry.key);
    const previewMonthKeys = monthKeysSorted.slice(-3);
    const dimensionKey = [...allKeys].find((key) => !monthKeysSorted.includes(key));
    const previewColumns = [
      ...(dimensionKey ? [dimensionKey] : []),
      ...previewMonthKeys,
    ];
    const rows = widgetItems.slice(0, compact ? 4 : 12);
    return (
      <div className="overflow-x-auto">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-2">{w.title}</div>
        <table className="w-full text-[10px] border-separate border-spacing-y-1">
          <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            <tr className="border-b border-neutral-200">
              <th className="text-left font-normal px-1 py-1">{t('crm.projects.analytics.table.headers.project')}</th>
              {previewColumns.map((key) => {
                const date = parseMonthFieldDateEmbed(key);
                return (
                  <th key={key} className="text-left font-normal px-1 py-1">
                    {date ? date.toLocaleDateString(locale, { month: 'short', year: 'numeric' }) : key}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="bg-neutral-50/90">
                <td className="px-1 py-1 text-[#222] truncate max-w-[100px]">{p.name}</td>
                {previewColumns.map((key) => (
                  <td key={key} className="px-1 py-1 text-neutral-600 whitespace-nowrap">
                    {String(p.customFields?.[key] ?? '—')}
                  </td>
                ))}
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
    return evaluateFormulaWidgetEmbed(w, widgetItems, locale, t, compact, activeDonut, setActiveDonut);
  }

  const widgetColor = resolveThemeEmbed(w.themeKey).primary;
  const seriesFor = () =>
    buildSeriesForWidget(
      w.chartKey || 'status',
      widgetItems,
      w.chartValueMode || 'count',
      w.chartValueField,
      t,
      isWorkspaceChart,
    );
  const pct = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0);

  if (w.type === 'line') {
    const trend = buildTrendEmbed(widgetItems, w.chartValueMode === 'sum' ? 'sum' : 'count', w.chartValueField, locale);
    const areaId = `embed-area-${w.id}`;
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div style={{ height: chartH + 40 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={widgetColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={widgetColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 10 }} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#b5b5b5', fontSize: 10 }}
                domain={[0, (max: number) => Math.max(1, Number(max) || 0)]}
                allowDecimals={false}
                width={36}
              />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                formatter={(value: number) => [compactNumberEmbed(Number(value)), '']}
              />
              <Area type="monotone" dataKey="value" stroke={widgetColor} strokeWidth={2.5} fill={`url(#${areaId})`} dot={{ r: 3, strokeWidth: 2, fill: '#fff', stroke: widgetColor }} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="previous" stroke="#3b6cb6" strokeWidth={1.5} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (w.type === 'funnel') {
    const statusOrder = Object.keys(STATUS_COLORS_EMBED);
    const series = seriesFor();
    // Воронка по статусам идёт в порядке этапов (как на странице лидов), а не по убыванию.
    const byStage = series.length > 0 && series.every((row) => statusOrder.includes(row.label));
    const ordered = [...series].sort((a, b) =>
      byStage ? statusOrder.indexOf(a.label) - statusOrder.indexOf(b.label) : b.count - a.count,
    );
    const max = Math.max(1, ...ordered.map((row) => row.count), 1);
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="flex flex-col justify-center">
          {ordered.map((item, index) => (
            <div key={item.code} className="grid grid-cols-[110px_1fr_52px] items-center gap-3 border-b border-neutral-100 py-1.5 text-xs last:border-b-0">
              <span className="truncate font-medium text-[#222]">{item.label}</span>
              <span className="h-6 overflow-hidden rounded-md bg-neutral-100">
                <span
                  className="flex h-full items-center rounded-md px-2 font-mono text-[10px] font-medium text-white"
                  style={{ width: `${Math.max(8, pct(item.count, max))}%`, backgroundColor: sliceColorEmbed(item.label, index, palette) }}
                >
                  {compactNumberEmbed(item.count)}
                </span>
              </span>
              <span className="text-right font-mono text-neutral-500">{index === 0 ? '100%' : `${pct(item.count, max)}%`}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (w.type === 'leaderboard') {
    const grouped = buildSeriesForWidget(
      w.chartKey || 'owner',
      widgetItems,
      w.chartValueMode || 'count',
      w.chartValueField,
      t,
      isWorkspaceChart,
    ).slice(0, compact ? 4 : 8);
    const max = Math.max(1, ...grouped.map((row) => row.count));
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="flex flex-col justify-center">
          {grouped.map((row, index) => (
            <div key={row.code} className="grid grid-cols-[26px_1fr_80px_60px] items-center gap-3 border-b border-neutral-100 py-1.5 text-xs last:border-b-0">
              <span className="font-mono text-neutral-400">#{index + 1}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: widgetColor }}>
                  {row.label.split(' ').map((part) => part[0]).join('').slice(0, 2)}
                </span>
                <span className="truncate font-medium text-[#222]">{row.label}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <span className="block h-full rounded-full" style={{ width: `${pct(row.count, max)}%`, backgroundColor: widgetColor }} />
              </span>
              <span className="text-right font-mono text-[#222]">{compactNumberEmbed(row.count)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (w.type === 'heatmap') {
    const heatmap = buildHeatmapEmbed(widgetItems);
    const max = Math.max(1, ...heatmap.flatMap((row) => row.hours.map((hour) => hour.value)));
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="grid grid-cols-[32px_repeat(8,1fr)] gap-1">
          <span />
          {heatmap[0]?.hours.map((hour) => (
            <span key={hour.hour} className="text-center font-mono text-[10px] text-neutral-400">{hour.hour}</span>
          ))}
          {heatmap.map((row) => (
            <React.Fragment key={row.day}>
              <span className="pr-1 text-right font-mono text-[10px] text-neutral-400">{row.day}</span>
              {row.hours.map((hour) => (
                <span
                  key={`${row.day}-${hour.hour}`}
                  className="aspect-square rounded"
                  title={`${row.day} ${hour.hour}:00 — ${hour.value}`}
                  style={{ backgroundColor: widgetColor, opacity: Math.max(0.06, Math.min(1, hour.value / max)) }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (w.type === 'note') {
    const topStatus = buildSeriesForWidget(
      isWorkspaceMode ? w.chartKey || '' : 'status',
      widgetItems,
      'count',
      undefined,
      t,
      isWorkspaceChart,
    )[0];
    const topOwner = !isWorkspaceMode
      ? buildSeriesForWidget('owner', widgetItems, 'count', undefined, t, false)[0]
      : null;
    const totalAmount = widgetItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const currency = widgetItems[0]?.currency || items[0]?.currency || 'EUR';
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{w.title}</div>
        <div className="text-sm leading-6 text-neutral-600">
          В выборке <strong className="text-[#222]">{compactNumberEmbed(widgetItems.length)}</strong>{' '}
          {isWorkspaceMode ? 'записей' : 'проектов'}.
          {topStatus && <> Главный сегмент — <strong className="text-[#222]">{topStatus.label}</strong>.</>}
          {topOwner && <> Ответственный с максимальной нагрузкой — <strong className="text-[#222]">{topOwner.label}</strong>.</>}
          {!isWorkspaceMode && <> Общая сумма — <strong className="text-[#222]">{compactNumberEmbed(totalAmount)} {currency}</strong>.</>}
        </div>
      </div>
    );
  }

  return (
    <div className="text-[11px] text-neutral-500">
      {w.title} — {t('crm.dashboard.presets.embedFallback')}
    </div>
  );
};
