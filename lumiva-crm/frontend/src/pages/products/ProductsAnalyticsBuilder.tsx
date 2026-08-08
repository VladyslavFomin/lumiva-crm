// src/pages/products/ProductsAnalyticsBuilder.tsx
//
// Drag/drop конструктор дашборда аналитики товаров — "как в Продажах" (SalesAnalyticsPageV2),
// тот же движок (ручной drag/resize на мыши, без библиотек — см. её реализацию), но:
//  - Персист через РЕАЛЬНЫЙ backend-пресет (GET/PATCH /products/analytics/preset), а не только
//    localStorage — в Продажах эти эндпоинты существуют, но реально не используются никаким UI;
//    здесь наоборот, это осознанное улучшение по тому же паттерну.
//  - Часть типов виджетов заменена на профильные для товаров вместо прямого копирования:
//    funnel → warehouse (разбивка остатка по складам), heatmap → margin (распределение маржи).
//    formula-виджет не реализован (см. роадмап §17).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsCurrencyControl } from '../../components/AnalyticsCurrencyControl';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import {
  convertMarketingAmount,
  normalizeMarketingDisplayCurrency,
  type MarketingDisplayCurrencyState,
} from '../marketing/marketingDisplayCurrencyStorage';
import {
  fetchProducts,
  fetchProductCategories,
  fetchProductStock,
  fetchProductFieldDefs,
  fetchProductsAnalyticsPreset,
  saveProductsAnalyticsPreset,
  type Product,
  type ProductCategory,
  type ProductStockRow,
  type ProductFieldDef,
} from '../../api/products';

/* ------------------------------------------------------------------------ types */

type BlockType = 'metric' | 'line' | 'bar' | 'donut' | 'table' | 'leaderboard' | 'warehouse' | 'margin' | 'note';
type ValueMode = 'count' | 'sum';
type MetricKey =
  | 'totalProducts'
  | 'activeProducts'
  | 'catalogValue'
  | 'costValue'
  | 'avgMargin'
  | 'stockUnits'
  | 'lowStockCount'
  | 'outOfStockCount'
  | 'categoriesCount'
  | `sum:${string}`
  | `avg:${string}`;

interface AnalyticsBlock {
  id: string;
  type: BlockType;
  title: string;
  subtitle?: string;
  span: number;
  height: number;
  metricKey?: MetricKey;
  dimensionKey?: string;
  valueMode?: ValueMode;
  valueField?: string;
  color?: string;
  noteText?: string;
  _dragging?: boolean;
  _resizing?: boolean;
}

interface CatalogTemplate {
  catalogKey: string;
  group: 'kpi' | 'charts' | 'tables' | 'presets';
  type: BlockType;
  span: number;
  height: number;
  metricKey?: MetricKey;
  dimensionKey?: string;
  valueMode?: ValueMode;
}

const MIN_BLOCK_H = 120;
const MAX_BLOCK_H = 900;
const CHART_COLORS = ['#222222', '#5a3a86', '#175c3d', '#7a4a09', '#214b8a', '#9a1f31', '#888888', '#c08319'];
const THEME_PALETTE = ['#222222', '#5a3a86', '#175c3d', '#7a4a09', '#214b8a', '#9a1f31', '#1f8a5e', '#c08319'];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------------ data model */

interface ProductAnalyticsItem {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  categoryId: string | null;
  categoryName: string;
  currency: string;
  price: number;
  costPrice: number | null;
  quantity: number;
  stockValue: number;
  marginPct: number | null;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  isOutOfStock: boolean;
  tags: string[];
  createdAt: string;
  customFields: Record<string, unknown>;
}

function mapProductToItem(
  p: Product,
  categoryById: Map<string, ProductCategory>,
  currencyPrefs: MarketingDisplayCurrencyState,
  noCategoryLabel: string,
): ProductAnalyticsItem {
  const display = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const priceConv = convertMarketingAmount(Number(p.price) || 0, p.currency, 'converted', display, currencyPrefs.rates);
  const costRaw = p.costPrice !== null ? Number(p.costPrice) : null;
  const costConv = costRaw !== null ? convertMarketingAmount(costRaw, p.currency, 'converted', display, currencyPrefs.rates) : null;
  const quantity = Number(p.quantity) || 0;
  const marginPct = costRaw !== null && Number(p.price) > 0 ? ((Number(p.price) - costRaw) / Number(p.price)) * 100 : null;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    status: p.status,
    categoryId: p.categoryId,
    categoryName: p.categoryId ? categoryById.get(p.categoryId)?.name || noCategoryLabel : noCategoryLabel,
    currency: display,
    price: priceConv.value,
    costPrice: costConv ? costConv.value : null,
    quantity,
    stockValue: priceConv.value * quantity,
    marginPct,
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.lowStockThreshold !== null && quantity > 0 && quantity <= p.lowStockThreshold,
    isOutOfStock: quantity <= 0,
    tags: p.tags || [],
    createdAt: p.createdAt,
    customFields: p.customFields || {},
  };
}

/* ------------------------------------------------------------------------ aggregation utils */

function getFieldValue(
  item: ProductAnalyticsItem,
  scope: string | undefined,
  dash: string,
  statusLabels: Record<string, string>,
): string[] {
  if (!scope) return [dash];
  const key = scope.replace(/^field:/, '');
  if (key === 'status') return [statusLabels[item.status] || item.status];
  if (key === 'categoryName') return [item.categoryName];
  if (key === 'currency') return [item.currency];
  if (key === 'tags') return item.tags.length ? item.tags : [dash];
  const raw = item.customFields[key];
  if (Array.isArray(raw)) return raw.length ? raw.map(String) : [dash];
  if (raw === undefined || raw === null || raw === '') return [dash];
  return [String(raw)];
}

function getNumericValue(item: ProductAnalyticsItem, field?: string): number {
  switch (field) {
    case 'costPrice':
      return item.costPrice ?? 0;
    case 'quantity':
      return item.quantity;
    case 'stockValue':
      return item.stockValue;
    case 'marginPct':
      return item.marginPct ?? 0;
    case undefined:
    case 'price':
      return item.price;
    default: {
      const n = Number(item.customFields[field]);
      return Number.isFinite(n) ? n : 0;
    }
  }
}

interface SeriesRow {
  code: string;
  label: string;
  value: number;
}

function buildGroupedSeries(
  items: ProductAnalyticsItem[],
  dimensionKey: string | undefined,
  mode: ValueMode,
  valueField: string | undefined,
  dash: string,
  statusLabels: Record<string, string>,
): SeriesRow[] {
  const grouped = new Map<string, SeriesRow>();
  for (const item of items) {
    const labels = getFieldValue(item, dimensionKey, dash, statusLabels);
    for (const label of labels) {
      const row = grouped.get(label) || { code: label, label, value: 0 };
      row.value += mode === 'sum' ? getNumericValue(item, valueField) : 1;
      grouped.set(label, row);
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.value - a.value);
}

interface MonthBucket {
  period: string;
  value: number;
}

function buildMonthlyTrend(items: ProductAnalyticsItem[], mode: ValueMode, valueField: string | undefined): MonthBucket[] {
  const buckets = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const inc = mode === 'sum' ? getNumericValue(item, valueField) : 1;
    buckets.set(period, (buckets.get(period) || 0) + inc);
  }
  return Array.from(buckets.entries())
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);
}

interface WarehouseRow {
  name: string;
  stockUnits: number;
  value: number;
}

function buildWarehouseSeries(stockRows: ProductStockRow[], itemById: Map<string, ProductAnalyticsItem>): WarehouseRow[] {
  const grouped = new Map<string, WarehouseRow>();
  for (const row of stockRows) {
    const item = itemById.get(row.productId);
    for (const loc of row.locations || []) {
      const bucket = grouped.get(loc.locationName) || { name: loc.locationName, stockUnits: 0, value: 0 };
      bucket.stockUnits += loc.quantity;
      bucket.value += item ? item.price * loc.quantity : 0;
      grouped.set(loc.locationName, bucket);
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.stockUnits - a.stockUnits);
}

const MARGIN_BUCKET_ORDER_KEYS = ['none', 'neg', 'b0_10', 'b10_25', 'b25_50', 'b50plus'] as const;

function buildMarginBuckets(items: ProductAnalyticsItem[], labels: Record<string, string>): SeriesRow[] {
  const counts: Record<string, number> = { none: 0, neg: 0, b0_10: 0, b10_25: 0, b25_50: 0, b50plus: 0 };
  for (const item of items) {
    if (item.marginPct === null) counts.none += 1;
    else if (item.marginPct < 0) counts.neg += 1;
    else if (item.marginPct < 10) counts.b0_10 += 1;
    else if (item.marginPct < 25) counts.b10_25 += 1;
    else if (item.marginPct < 50) counts.b25_50 += 1;
    else counts.b50plus += 1;
  }
  return MARGIN_BUCKET_ORDER_KEYS.map((key) => ({ code: key, label: labels[key] || key, value: counts[key] }));
}

function fmtMoney(n: number, currency: string): string {
  const abs = Math.abs(n);
  const short = abs >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : abs >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
  return `${short} ${currency}`;
}
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

function computeMetricValue(
  metricKey: MetricKey | undefined,
  items: ProductAnalyticsItem[],
  categoriesCount: number,
): { value: number; isMoney: boolean; isPct: boolean } {
  switch (metricKey) {
    case 'activeProducts':
      return { value: items.filter((i) => i.status === 'active').length, isMoney: false, isPct: false };
    case 'catalogValue':
      return { value: items.reduce((s, i) => s + i.stockValue, 0), isMoney: true, isPct: false };
    case 'costValue':
      return { value: items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0), isMoney: true, isPct: false };
    case 'avgMargin': {
      const withMargin = items.filter((i) => i.marginPct !== null);
      const avg = withMargin.length ? withMargin.reduce((s, i) => s + (i.marginPct || 0), 0) / withMargin.length : 0;
      return { value: avg, isMoney: false, isPct: true };
    }
    case 'stockUnits':
      return { value: items.reduce((s, i) => s + i.quantity, 0), isMoney: false, isPct: false };
    case 'lowStockCount':
      return { value: items.filter((i) => i.isLowStock).length, isMoney: false, isPct: false };
    case 'outOfStockCount':
      return { value: items.filter((i) => i.isOutOfStock).length, isMoney: false, isPct: false };
    case 'categoriesCount':
      return { value: categoriesCount, isMoney: false, isPct: false };
    case 'totalProducts':
    default: {
      if (metricKey?.startsWith('sum:')) {
        const field = metricKey.slice(4);
        return { value: items.reduce((s, i) => s + getNumericValue(i, field), 0), isMoney: false, isPct: false };
      }
      if (metricKey?.startsWith('avg:')) {
        const field = metricKey.slice(4);
        const vals = items.map((i) => getNumericValue(i, field)).filter((v) => Number.isFinite(v));
        const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        return { value: avg, isMoney: false, isPct: false };
      }
      return { value: items.length, isMoney: false, isPct: false };
    }
  }
}

/* ------------------------------------------------------------------------ catalog */

const CATALOG_TEMPLATES: CatalogTemplate[] = [
  { catalogKey: 'metric_total', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'totalProducts' },
  { catalogKey: 'metric_active', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'activeProducts' },
  { catalogKey: 'metric_value', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'catalogValue' },
  { catalogKey: 'metric_margin', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'avgMargin' },
  { catalogKey: 'metric_stock', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'stockUnits' },
  { catalogKey: 'metric_low', group: 'kpi', type: 'metric', span: 3, height: 150, metricKey: 'lowStockCount' },
  { catalogKey: 'line_growth', group: 'charts', type: 'line', span: 8, height: 300, valueMode: 'count' },
  { catalogKey: 'donut_status', group: 'charts', type: 'donut', span: 4, height: 300, dimensionKey: 'field:status' },
  { catalogKey: 'bar_category', group: 'charts', type: 'bar', span: 6, height: 300, dimensionKey: 'field:categoryName', valueMode: 'sum', },
  { catalogKey: 'bar_currency', group: 'charts', type: 'bar', span: 6, height: 300, dimensionKey: 'field:currency', valueMode: 'count' },
  { catalogKey: 'leaderboard_category', group: 'tables', type: 'leaderboard', span: 6, height: 320, dimensionKey: 'field:categoryName', valueMode: 'sum' },
  { catalogKey: 'table_status', group: 'tables', type: 'table', span: 6, height: 320, dimensionKey: 'field:status', valueMode: 'count' },
  { catalogKey: 'warehouse_breakdown', group: 'tables', type: 'warehouse', span: 6, height: 320 },
  { catalogKey: 'margin_distribution', group: 'tables', type: 'margin', span: 6, height: 320 },
  { catalogKey: 'note', group: 'presets', type: 'note', span: 4, height: 200 },
];

function defaultLayout(): AnalyticsBlock[] {
  return [
    CATALOG_TEMPLATES[0],
    CATALOG_TEMPLATES[1],
    CATALOG_TEMPLATES[2],
    CATALOG_TEMPLATES[3],
    CATALOG_TEMPLATES[6],
    CATALOG_TEMPLATES[7],
    CATALOG_TEMPLATES[8],
    CATALOG_TEMPLATES[12],
  ].map((tpl) => blockFromTemplate(tpl, ''));
}

function blockFromTemplate(tpl: CatalogTemplate, title: string): AnalyticsBlock {
  return {
    id: uid(),
    type: tpl.type,
    title,
    span: tpl.span,
    height: tpl.height,
    metricKey: tpl.metricKey,
    dimensionKey: tpl.dimensionKey,
    valueMode: tpl.valueMode,
    color: THEME_PALETTE[0],
    showLabels: true,
  } as AnalyticsBlock;
}

/* ------------------------------------------------------------------------ icons */

const I = {
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.04 1.56V21a2 2 0 01-4 0v-.09A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.56-1.04H3a2 2 0 010-4h.09A1.7 1.7 0 004.6 8a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 008 3.6a1.7 1.7 0 001.04-1.56V2a2 2 0 014 0v.09A1.7 1.7 0 0015.4 3.6a1.7 1.7 0 001.87.34l.06-.06a2 2 0 012.83 2.83l-.06.06A1.7 1.7 0 0019.4 8c.36.32.83.5 1.31.5H21a2 2 0 010 4h-.09a1.7 1.7 0 00-1.51 1.5z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
  drag: (
    <>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  resize: (
    <>
      <path d="M21 15v6h-6" />
      <path d="M9 9L3 3" />
      <path d="M21 21l-6-6" />
    </>
  ),
};
const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

/* ------------------------------------------------------------------------ RenderBlock */

const RenderBlock: React.FC<{
  block: AnalyticsBlock;
  items: ProductAnalyticsItem[];
  stockRows: ProductStockRow[];
  itemById: Map<string, ProductAnalyticsItem>;
  categoriesCount: number;
  currency: string;
  t: (key: string, opts?: any) => string;
}> = ({ block, items, stockRows, itemById, categoriesCount, currency, t }) => {
  const dash = t('crm.products.analyticsBuilder.dash');
  const color = block.color || THEME_PALETTE[0];
  const statusLabels: Record<string, string> = {
    active: t('crm.products.status.active'),
    draft: t('crm.products.status.draft'),
    archived: t('crm.products.status.archived'),
    out_of_stock: t('crm.products.status.out_of_stock'),
  };

  if (block.type === 'metric') {
    const { value, isMoney, isPct } = computeMetricValue(block.metricKey, items, categoriesCount);
    const spark = buildMonthlyTrend(items, 'count', undefined);
    return (
      <div>
        <div className="pxb-kpi-value">{isMoney ? fmtMoney(value, currency) : isPct ? `${value.toFixed(1)}%` : fmtCompact(value)}</div>
        <div className="pxb-kpi-delta">{t('crm.products.analyticsBuilder.asOfNow')}</div>
        {spark.length > 1 && (
          <div className="pxb-kpi-spark">
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={spark}>
                <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'line') {
    const trend = buildMonthlyTrend(items, block.valueMode || 'count', block.valueField);
    if (!trend.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ left: -10, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-3)" />
          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (block.type === 'bar') {
    const series = buildGroupedSeries(items, block.dimensionKey, block.valueMode || 'count', block.valueField, dash, statusLabels).slice(0, 12);
    if (!series.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line-3)" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (block.type === 'donut') {
    const series = buildGroupedSeries(items, block.dimensionKey, block.valueMode || 'count', block.valueField, dash, statusLabels).slice(0, 8);
    if (!series.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    return (
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', height: '100%' }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={series as any} dataKey="value" nameKey="label" innerRadius={34} outerRadius={58} paddingAngle={2}>
              {series.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', maxHeight: '100%' }}>
          {series.map((r, i) => (
            <div key={r.code} className="an-legend-row">
              <span className="an-legend-sw" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="nm">{r.label}</span>
              <span className="val">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === 'table') {
    const series = buildGroupedSeries(items, block.dimensionKey, block.valueMode || 'count', block.valueField, dash, statusLabels);
    if (!series.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    return (
      <div style={{ overflowY: 'auto', height: '100%' }}>
        <table className="px-table">
          <thead>
            <tr>
              <th>{t('crm.products.analyticsBuilder.column')}</th>
              <th className="r">{t('crm.products.analyticsBuilder.value')}</th>
            </tr>
          </thead>
          <tbody>
            {series.map((r) => (
              <tr key={r.code}>
                <td>{r.label}</td>
                <td className="r">{block.valueMode === 'sum' ? fmtMoney(r.value, currency) : r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'leaderboard') {
    const series = buildGroupedSeries(items, block.dimensionKey, block.valueMode || 'count', block.valueField, dash, statusLabels).slice(0, 10);
    if (!series.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    const max = Math.max(...series.map((r) => r.value), 1);
    return (
      <div style={{ overflowY: 'auto', height: '100%' }}>
        {series.map((r, i) => (
          <div key={r.code} className="an-legend-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{i + 1}. {r.label}</span>
              <span className="val">{block.valueMode === 'sum' ? fmtMoney(r.value, currency) : r.value}</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: 'var(--line-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(4, (r.value / max) * 100)}%`, background: color, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'warehouse') {
    const series = buildWarehouseSeries(stockRows, itemById);
    if (!series.length) return <div className="an-empty">{t('crm.products.analyticsBuilder.empty')}</div>;
    return (
      <div style={{ overflowY: 'auto', height: '100%' }}>
        {series.map((r) => (
          <div key={r.name} className="an-legend-row">
            <span className="nm">{r.name}</span>
            <span className="val">{r.stockUnits} {t('crm.products.analytics.units')} · {fmtMoney(r.value, currency)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'margin') {
    const labels: Record<string, string> = {
      none: t('crm.products.analyticsBuilder.marginBuckets.none'),
      neg: t('crm.products.analyticsBuilder.marginBuckets.neg'),
      b0_10: '0–10%',
      b10_25: '10–25%',
      b25_50: '25–50%',
      b50plus: '50%+',
    };
    const series = buildMarginBuckets(items, labels);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ left: -20, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-3)" />
          <XAxis dataKey="label" tick={{ fontSize: 9.5 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (block.type === 'note') {
    return (
      <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
        {block.noteText || t('crm.products.analyticsBuilder.notePlaceholder')}
      </div>
    );
  }

  return null;
};

/* ------------------------------------------------------------------------ AddBlockModal */

const AddBlockModal: React.FC<{ onAdd: (block: AnalyticsBlock) => void; onClose: () => void }> = ({ onAdd, onClose }) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'all' | CatalogTemplate['group']>('all');
  const groups: Array<{ key: 'all' | CatalogTemplate['group']; label: string }> = [
    { key: 'all', label: t('crm.products.analyticsBuilder.catalog.tabs.all') },
    { key: 'kpi', label: t('crm.products.analyticsBuilder.catalog.tabs.kpi') },
    { key: 'charts', label: t('crm.products.analyticsBuilder.catalog.tabs.charts') },
    { key: 'tables', label: t('crm.products.analyticsBuilder.catalog.tabs.tables') },
    { key: 'presets', label: t('crm.products.analyticsBuilder.catalog.tabs.presets') },
  ];
  const shown = tab === 'all' ? CATALOG_TEMPLATES : CATALOG_TEMPLATES.filter((c) => c.group === tab);

  return (
    <div className="pxb-modal-back" onClick={onClose}>
      <div className="pxb-catalog" onClick={(e) => e.stopPropagation()}>
        <div className="pxb-catalog-head">
          <h3>{t('crm.products.analyticsBuilder.catalog.title')}</h3>
          <div className="pxb-catalog-tabs">
            {groups.map((g) => (
              <button key={g.key} type="button" className={tab === g.key ? 'active' : undefined} onClick={() => setTab(g.key)}>
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pxb-catalog-body">
          {shown.map((tpl) => (
            <button
              key={tpl.catalogKey}
              type="button"
              className="pxb-catalog-card"
              onClick={() => {
                const title = t(`crm.products.analyticsBuilder.catalog.items.${tpl.catalogKey}.title`);
                onAdd(blockFromTemplate(tpl, title));
              }}
            >
              <div className="t">{t(`crm.products.analyticsBuilder.catalog.items.${tpl.catalogKey}.title`)}</div>
              <div className="d">{t(`crm.products.analyticsBuilder.catalog.items.${tpl.catalogKey}.subtitle`)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ ConfigDrawer */

const DIMENSION_OPTIONS_BASE = ['field:status', 'field:categoryName', 'field:currency', 'field:tags'];
const VALUE_FIELD_OPTIONS_BASE = ['price', 'costPrice', 'quantity', 'stockValue', 'marginPct'];

const ConfigDrawer: React.FC<{
  block: AnalyticsBlock;
  fieldDefs: ProductFieldDef[];
  onChange: (block: AnalyticsBlock) => void;
  onClose: () => void;
}> = ({ block, fieldDefs, onChange, onClose }) => {
  const { t } = useTranslation();
  const usesDimension = ['bar', 'donut', 'table', 'leaderboard'].includes(block.type);
  const usesValueMode = usesDimension || block.type === 'line';
  const usesMetric = block.type === 'metric';
  const usesColor = ['line', 'bar', 'donut', 'leaderboard', 'margin'].includes(block.type);
  const usesNote = block.type === 'note';

  const dimensionOptions = [
    ...DIMENSION_OPTIONS_BASE,
    ...fieldDefs.filter((f) => f.isActive).map((f) => `field:${f.key}`),
  ];
  const dimensionLabel = (scope: string) => {
    const key = scope.replace(/^field:/, '');
    const base: Record<string, string> = {
      status: t('crm.products.analyticsBuilder.fields.status'),
      categoryName: t('crm.products.analyticsBuilder.fields.categoryName'),
      currency: t('crm.products.analyticsBuilder.fields.currency'),
      tags: t('crm.products.analyticsBuilder.fields.tags'),
    };
    if (base[key]) return base[key];
    return fieldDefs.find((f) => f.key === key)?.label || key;
  };
  const valueFieldOptions = [...VALUE_FIELD_OPTIONS_BASE, ...fieldDefs.filter((f) => f.isActive && f.type === 'number').map((f) => f.key)];
  const valueFieldLabel = (key: string) => {
    const base: Record<string, string> = {
      price: t('crm.products.analyticsBuilder.fields.price'),
      costPrice: t('crm.products.analyticsBuilder.fields.costPrice'),
      quantity: t('crm.products.analyticsBuilder.fields.quantity'),
      stockValue: t('crm.products.analyticsBuilder.fields.stockValue'),
      marginPct: t('crm.products.analyticsBuilder.fields.marginPct'),
    };
    return base[key] || fieldDefs.find((f) => f.key === key)?.label || key;
  };

  const metricOptions: MetricKey[] = [
    'totalProducts', 'activeProducts', 'catalogValue', 'costValue', 'avgMargin',
    'stockUnits', 'lowStockCount', 'outOfStockCount', 'categoriesCount',
  ];
  for (const f of fieldDefs.filter((fd) => fd.isActive && fd.type === 'number')) {
    metricOptions.push(`sum:${f.key}` as MetricKey, `avg:${f.key}` as MetricKey);
  }
  const metricLabel = (key: MetricKey) => {
    if (key.startsWith('sum:')) return `${t('crm.products.analyticsBuilder.sumOf')} ${valueFieldLabel(key.slice(4))}`;
    if (key.startsWith('avg:')) return `${t('crm.products.analyticsBuilder.avgOf')} ${valueFieldLabel(key.slice(4))}`;
    return t(`crm.products.analyticsBuilder.metrics.${key}`);
  };

  return (
    <>
      <div className="pxb-drawer-back" onClick={onClose} />
      <div className="pxb-drawer">
        <div className="pxb-drawer-head">
          <h3>{t('crm.products.analyticsBuilder.drawer.title')}</h3>
          <button type="button" className="aib ghost sm" onClick={onClose}>{t('crm.products.fieldTypes.modal.cancel')}</button>
        </div>
        <div className="pxb-drawer-body">
          <div className="ai-field">
            <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.blockTitle')}</label>
            <input className="ai-input" value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} />
          </div>

          {usesMetric && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.metric')}</label>
              <select className="ai-select" value={block.metricKey || ''} onChange={(e) => onChange({ ...block, metricKey: e.target.value as MetricKey })}>
                {metricOptions.map((m) => (
                  <option key={m} value={m}>{metricLabel(m)}</option>
                ))}
              </select>
            </div>
          )}

          {usesDimension && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.dimension')}</label>
              <select className="ai-select" value={block.dimensionKey || ''} onChange={(e) => onChange({ ...block, dimensionKey: e.target.value })}>
                {dimensionOptions.map((d) => (
                  <option key={d} value={d}>{dimensionLabel(d)}</option>
                ))}
              </select>
            </div>
          )}

          {usesValueMode && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.valueMode')}</label>
              <select className="ai-select" value={block.valueMode || 'count'} onChange={(e) => onChange({ ...block, valueMode: e.target.value as ValueMode })}>
                <option value="count">{t('crm.products.analyticsBuilder.drawer.valueModeCount')}</option>
                <option value="sum">{t('crm.products.analyticsBuilder.drawer.valueModeSum')}</option>
              </select>
            </div>
          )}

          {usesValueMode && block.valueMode === 'sum' && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.valueField')}</label>
              <select className="ai-select" value={block.valueField || 'price'} onChange={(e) => onChange({ ...block, valueField: e.target.value })}>
                {valueFieldOptions.map((f) => (
                  <option key={f} value={f}>{valueFieldLabel(f)}</option>
                ))}
              </select>
            </div>
          )}

          {usesNote && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.noteText')}</label>
              <textarea
                className="ai-textarea"
                value={block.noteText || ''}
                onChange={(e) => onChange({ ...block, noteText: e.target.value })}
              />
            </div>
          )}

          {usesColor && (
            <div className="ai-field">
              <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.color')}</label>
              <div className="pxb-color-row">
                {THEME_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pxb-color-sw${block.color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => onChange({ ...block, color: c })}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="ai-field" style={{ marginBottom: 0 }}>
            <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.width')}</label>
            <div className="pxb-size-row">
              {[3, 4, 6, 8, 12].map((s) => (
                <button key={s} type="button" className={block.span === s ? 'active' : undefined} onClick={() => onChange({ ...block, span: s })}>
                  {s}/12
                </button>
              ))}
            </div>
          </div>
          <div className="ai-field" style={{ marginBottom: 0 }}>
            <label className="ai-label">{t('crm.products.analyticsBuilder.drawer.height')}</label>
            <div className="pxb-size-row">
              {[150, 240, 320, 420].map((h) => (
                <button key={h} type="button" className={block.height === h ? 'active' : undefined} onClick={() => onChange({ ...block, height: h })}>
                  {h}px
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------------ BlockShell (drag/resize chrome) */

const BlockShell: React.FC<{
  block: AnalyticsBlock;
  editing: boolean;
  selected: boolean;
  onSelect: () => void;
  onConfig: () => void;
  onDelete: () => void;
  onMoveStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, mode: 'r' | 'b' | 'br') => void;
  onMouseEnter: () => void;
  children: React.ReactNode;
}> = ({ block, editing, selected, onSelect, onConfig, onDelete, onMoveStart, onResizeStart, onMouseEnter, children }) => {
  const { t } = useTranslation();
  return (
    <div
      className="pxb-block-wrap"
      style={{ gridColumn: `span ${block.span}`, height: block.height }}
      onMouseEnter={onMouseEnter}
    >
      <div
        className={`pxb-block${editing ? ' editing' : ''}${selected ? ' selected' : ''}${block._dragging ? ' dragging' : ''}${block._resizing ? ' resizing' : ''}`}
        onClick={editing ? onSelect : undefined}
      >
        <div className="pxb-block-head">
          <span className="drag-handle" onMouseDown={onMoveStart}><Icon d={I.drag} size={13} /></span>
          <div className="pxb-block-titles">
            <div className="t">{block.title}</div>
          </div>
          <div className="pxb-block-actions">
            <button type="button" title={t('crm.products.analyticsBuilder.configure') || ''} onClick={(e) => { e.stopPropagation(); onConfig(); }}>
              <Icon d={I.gear} size={13} />
            </button>
            <button type="button" className="danger" title={t('crm.products.form.actions.delete') || ''} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Icon d={I.trash} size={13} />
            </button>
          </div>
        </div>
        <div className="pxb-block-body">{children}</div>
        <div className="pxb-resize r" onMouseDown={(e) => onResizeStart(e, 'r')} />
        <div className="pxb-resize b" onMouseDown={(e) => onResizeStart(e, 'b')} />
        <div className="pxb-resize br" onMouseDown={(e) => onResizeStart(e, 'br')}><Icon d={I.resize} size={10} /></div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------ main component */

export const ProductsAnalyticsBuilder: React.FC = () => {
  const { t } = useTranslation();
  const { state: currencyPrefs, setState: setCurrencyPrefs } = useMarketingDisplayCurrencyPrefs([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [stockRows, setStockRows] = useState<ProductStockRow[]>([]);
  const [fieldDefs, setFieldDefs] = useState<ProductFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [blocks, setBlocks] = useState<AnalyticsBlock[]>(defaultLayout);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [presetLoaded, setPresetLoaded] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; fromIdx: number; toIdx: number } | null>(null);
  const [resize, setResize] = useState<{
    id: string; mode: 'r' | 'b' | 'br'; startX: number; startY: number; startSpan: number; startHeight: number; colW: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const loadAllProducts = async () => {
      const pageSize = 200;
      let page = 1;
      let total = 0;
      const all: Product[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetchProducts({ page, limit: pageSize });
        all.push(...(res.items || []));
        total = res.total || all.length;
        if (!res.items?.length || all.length >= total) break;
        page += 1;
        if (page > 100) break;
      }
      return all;
    };
    Promise.all([
      loadAllProducts(),
      fetchProductCategories().catch(() => []),
      fetchProductStock().catch(() => []),
      fetchProductFieldDefs().catch(() => []),
      fetchProductsAnalyticsPreset().catch(() => null),
    ])
      .then(([prods, cats, stock, defs, preset]) => {
        if (!alive) return;
        setProducts(prods);
        setCategories(cats);
        setStockRows(stock);
        setFieldDefs(defs);
        if (preset && Array.isArray((preset as any).blocks) && (preset as any).blocks.length) {
          setBlocks((preset as any).blocks);
        }
        setPresetLoaded(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const noCategoryLabel = t('crm.products.analyticsBuilder.noCategory');
  const items = useMemo(
    () => products.map((p) => mapProductToItem(p, categoryById, currencyPrefs, noCategoryLabel)),
    [products, categoryById, currencyPrefs, noCategoryLabel],
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const reportCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);

  const updateBlocks = (updater: (prev: AnalyticsBlock[]) => AnalyticsBlock[]) => setBlocks((prev) => updater(prev));

  const visualBlocks = useMemo(() => {
    if (!drag || drag.fromIdx === drag.toIdx) return blocks;
    const next = [...blocks];
    const [moved] = next.splice(drag.fromIdx, 1);
    next.splice(drag.toIdx, 0, moved);
    return next.map((b) => (b.id === drag.id ? { ...b, _dragging: true } : b));
  }, [blocks, drag]);

  useEffect(() => {
    if (!drag) return;
    const onUp = () => {
      if (drag.fromIdx !== drag.toIdx) {
        updateBlocks((prev) => {
          const next = [...prev];
          const [moved] = next.splice(drag.fromIdx, 1);
          next.splice(drag.toIdx, 0, moved);
          return next;
        });
      }
      setDrag(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [drag]);

  useEffect(() => {
    if (!resize) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      let span = resize.startSpan;
      let height = resize.startHeight;
      if (resize.mode === 'br' || resize.mode === 'r') {
        span = Math.max(3, Math.min(12, Math.round(resize.startSpan + dx / (resize.colW + 12))));
      }
      if (resize.mode === 'br' || resize.mode === 'b') {
        height = Math.max(MIN_BLOCK_H, Math.min(MAX_BLOCK_H, resize.startHeight + dy));
      }
      updateBlocks((prev) => prev.map((b) => (b.id === resize.id ? { ...b, span, height, _resizing: true } : b)));
    };
    const onUp = () => {
      updateBlocks((prev) => prev.map((b) => ({ ...b, _resizing: false })));
      setResize(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resize]);

  const onMoveStart = (e: React.MouseEvent, id: string) => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const fromIdx = blocks.findIndex((b) => b.id === id);
    if (fromIdx >= 0) setDrag({ id, fromIdx, toIdx: fromIdx });
  };
  const onResizeStart = (e: React.MouseEvent, id: string, mode: 'r' | 'b' | 'br') => {
    if (!editing) return;
    e.preventDefault();
    e.stopPropagation();
    const block = blocks.find((b) => b.id === id);
    const rect = gridRef.current?.getBoundingClientRect();
    if (!block || !rect) return;
    setResize({ id, mode, startX: e.clientX, startY: e.clientY, startSpan: block.span, startHeight: block.height, colW: (rect.width - 11 * 12) / 12 });
  };

  const deleteBlock = (id: string) => {
    updateBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
    if (configId === id) setConfigId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProductsAnalyticsPreset({ blocks: blocks.map(({ _dragging, _resizing, ...rest }) => rest) });
      setEditing(false);
      setSelected(null);
      setConfigId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const next = defaultLayout();
    setBlocks(next);
    setSaving(true);
    try {
      await saveProductsAnalyticsPreset({ blocks: next });
    } finally {
      setSaving(false);
    }
  };

  const configBlock = blocks.find((b) => b.id === configId) || null;

  return (
    <div>
      <div className="pxb-toolbar">
        <div className="pxb-toolbar-left">
          <AnalyticsCurrencyControl state={currencyPrefs} onStateChange={setCurrencyPrefs} />
        </div>
        <div className="pxb-toolbar-right">
          {editing && (
            <>
              <button type="button" className="aib ghost sm" onClick={() => setShowAdd(true)}>
                <Icon d={I.plus} size={13} /> {t('crm.products.analyticsBuilder.addBlock')}
              </button>
              <button type="button" className="aib ghost sm" onClick={handleReset} disabled={saving}>
                {t('crm.products.analyticsBuilder.reset')}
              </button>
              <button type="button" className="aib sm" onClick={handleSave} disabled={saving}>
                {saving ? t('crm.products.analyticsBuilder.saving') : t('crm.products.analyticsBuilder.save')}
              </button>
            </>
          )}
          <button type="button" className="aib ghost sm" onClick={() => setEditing((v) => !v)}>
            {editing ? t('crm.products.analyticsBuilder.done') : t('crm.products.analyticsBuilder.edit')}
          </button>
        </div>
      </div>

      {loading || !presetLoaded ? (
        <div className="an-empty">{t('crm.common.loading')}</div>
      ) : (
        <div className="pxb-grid" ref={gridRef}>
          {visualBlocks.map((block) => (
            <BlockShell
              key={block.id}
              block={block}
              editing={editing}
              selected={selected === block.id}
              onSelect={() => setSelected(block.id)}
              onConfig={() => { setConfigId(block.id); setSelected(block.id); }}
              onDelete={() => deleteBlock(block.id)}
              onMoveStart={(e) => onMoveStart(e, block.id)}
              onResizeStart={(e, mode) => onResizeStart(e, block.id, mode)}
              onMouseEnter={() => {
                if (!drag) return;
                const toIdx = blocks.findIndex((b) => b.id === block.id);
                if (toIdx !== drag.toIdx && toIdx >= 0) setDrag((prev) => (prev ? { ...prev, toIdx } : prev));
              }}
            >
              <RenderBlock
                block={block}
                items={items}
                stockRows={stockRows}
                itemById={itemById}
                categoriesCount={categories.length}
                currency={reportCurrency}
                t={t}
              />
            </BlockShell>
          ))}
          {editing && (
            <div className="pxb-block-wrap" style={{ gridColumn: 'span 4', height: 150 }}>
              <button type="button" className="pxb-add-tile" style={{ width: '100%', height: '100%' }} onClick={() => setShowAdd(true)}>
                <Icon d={I.plus} size={20} />
                {t('crm.products.analyticsBuilder.addBlock')}
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddBlockModal
          onAdd={(block) => {
            updateBlocks((prev) => [...prev, block]);
            setSelected(block.id);
            setShowAdd(false);
            setEditing(true);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {configBlock && (
        <ConfigDrawer
          block={configBlock}
          fieldDefs={fieldDefs}
          onChange={(next) => updateBlocks((prev) => prev.map((b) => (b.id === next.id ? next : b)))}
          onClose={() => setConfigId(null)}
        />
      )}
    </div>
  );
};
