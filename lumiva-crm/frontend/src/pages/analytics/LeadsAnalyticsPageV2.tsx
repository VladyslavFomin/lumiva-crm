import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchLeads,
  fetchLeadRoi,
  isLeadOmittedFromAnalytics,
  type Lead,
  type LeadsRoiStats,
} from '../../api/leads';
import { fetchProjects, type Project } from '../../api/projects';
import { fetchCustomFields, type CustomField } from '../../api/custom-fields';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { requestAddDashboardPreset } from '../../dashboard/dashboardLayout';
import { notifyAnalyticsWidgetsChanged } from '../../dashboard/analyticsStorage';
import { AnalyticsCurrencyControl } from '../../components/AnalyticsCurrencyControl';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import {
  convertMarketingAmount,
  normalizeMarketingDisplayCurrency,
  type MarketingDisplayCurrencyState,
} from '../marketing/marketingDisplayCurrencyStorage';

type PeriodId = '30d' | '7d' | 'quarter' | 'ytd' | 'all';
type ViewId = 'overview' | 'sources' | 'managers' | 'funnel';
type BlockType = 'metric' | 'formula' | 'line' | 'donut' | 'bar' | 'funnel' | 'leaderboard' | 'table' | 'heatmap' | 'note';
type ValueMode = 'count' | 'sum';
type FormulaFn = 'sumif' | 'count' | 'percent' | 'ratio' | 'diff';
type FormulaMode = 'count' | 'percent' | 'sum';
type FormulaDisplay = 'metric' | 'donut' | 'bar' | 'table';
type MetricKey = 'total' | 'conversion' | 'revenue' | 'avgRevenue' | 'won' | 'lost' | 'response' | `sum:${string}` | `avg:${string}` | `filled:${string}`;
type CatalogGroup = 'kpi' | 'charts' | 'tables' | 'ready';

type FieldMeta = {
  key: string;
  label: string;
  type?: string;
};

type FilterRow = {
  id: string;
  scope: string;
  keys: string[];
};

type AnalyticsBlock = {
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
  formulaFn?: FormulaFn;
  formulaMode?: FormulaMode;
  formulaLeftType?: string;
  formulaLeftKey?: string;
  formulaRightType?: string;
  formulaRightKey?: string;
  formulaDisplay?: FormulaDisplay;
  tableColumns?: string[];
  color?: string;
  showLabels?: boolean;
  filters?: FilterRow[];
  _dragging?: boolean;
  _resizing?: boolean;
};

type CatalogItem = {
  type: BlockType;
  title: string;
  subtitle: string;
  group: CatalogGroup;
  span: number;
  height: number;
  metricKey?: MetricKey;
  dimensionKey?: string;
  valueMode?: ValueMode;
};

type LeadRevenue = {
  revenue: number;
  dealsCount: number;
  currency: string;
  sourceCurrencies: string[];
  firstDealAt: string | null;
  lastDealAt: string | null;
};

type LeadAnalyticsItem = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  manager: string;
  country: string;
  amount: number;
  currency: string;
  sourceCurrencies: string[];
  reportCurrency: string;
  currencyRateMissing: boolean;
  dealsCount: number;
  projectCount: number;
  projectAmount: number;
  projectStatuses: string[];
  projectCategories: string[];
  projectOwners: string[];
  projectTags: string[];
  aiScore: number | null;
  aiPriority: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  customFields: Record<string, unknown>;
};

const LAYOUT_STORAGE_KEY = 'leads_analytics_v2_design_layout';
const LAYOUT_VERSION_KEY = 'leads_analytics_v2_design_version';
const LAYOUT_VERSION = '2026-05-03-free-height-resize';
const WIDGET_STORAGE_KEY = 'leads_analytics_v2_widgets';
const WIDGET_VERSION_KEY = 'leads_analytics_v2_version';
const GRID_ROW = 72;
const MIN_BLOCK_H = 100;
const MAX_BLOCK_H = 1400;

function getPeriodLabels(t: TFunction): Record<PeriodId, string> {
  return {
    '30d': t('crm.leadsAnalytics.periods.d30'),
    '7d': t('crm.leadsAnalytics.periods.d7'),
    quarter: t('crm.leadsAnalytics.periods.quarter'),
    ytd: t('crm.leadsAnalytics.periods.ytd'),
    all: t('crm.leadsAnalytics.periods.all'),
  };
}

function getViews(t: TFunction): Array<{ id: ViewId; label: string }> {
  return [
    { id: 'overview', label: t('crm.leadsAnalytics.views.overview') },
    { id: 'sources', label: t('crm.leadsAnalytics.views.sources') },
    { id: 'managers', label: t('crm.leadsAnalytics.views.managers') },
    { id: 'funnel', label: t('crm.leadsAnalytics.views.funnel') },
  ];
}

const PALETTE = ['#222222', '#1769d1', '#3b6cb6', '#214b8a', '#1f8a5e', '#c08319', '#cc2f47', '#5a45a8'];
const THEME_PALETTE = ['#0ea5e9', '#2563eb', '#f97316', '#16a34a', '#dc2626', '#222222', '#7c3aed', '#c026d3'];

function getBlockTypeOptions(t: TFunction): Array<{ id: BlockType; label: string; subtitle: string }> {
  return [
    { id: 'metric', label: t('crm.leadsAnalytics.blockTypes.metric.label'), subtitle: t('crm.leadsAnalytics.blockTypes.metric.subtitle') },
    { id: 'formula', label: t('crm.leadsAnalytics.blockTypes.formula.label'), subtitle: t('crm.leadsAnalytics.blockTypes.formula.subtitle') },
    { id: 'donut', label: t('crm.leadsAnalytics.blockTypes.donut.label'), subtitle: t('crm.leadsAnalytics.blockTypes.donut.subtitle') },
    { id: 'bar', label: t('crm.leadsAnalytics.blockTypes.bar.label'), subtitle: t('crm.leadsAnalytics.blockTypes.bar.subtitle') },
    { id: 'line', label: t('crm.leadsAnalytics.blockTypes.line.label'), subtitle: t('crm.leadsAnalytics.blockTypes.line.subtitle') },
    { id: 'funnel', label: t('crm.leadsAnalytics.blockTypes.funnel.label'), subtitle: t('crm.leadsAnalytics.blockTypes.funnel.subtitle') },
    { id: 'leaderboard', label: t('crm.leadsAnalytics.blockTypes.leaderboard.label'), subtitle: t('crm.leadsAnalytics.blockTypes.leaderboard.subtitle') },
    { id: 'table', label: t('crm.leadsAnalytics.blockTypes.table.label'), subtitle: t('crm.leadsAnalytics.blockTypes.table.subtitle') },
    { id: 'heatmap', label: t('crm.leadsAnalytics.blockTypes.heatmap.label'), subtitle: t('crm.leadsAnalytics.blockTypes.heatmap.subtitle') },
    { id: 'note', label: t('crm.leadsAnalytics.blockTypes.note.label'), subtitle: t('crm.leadsAnalytics.blockTypes.note.subtitle') },
  ];
}

// Lead status values are stored verbatim on the Lead entity as Russian text (not an enum) and
// matched literally throughout the leads module — kept untranslated here to stay consistent with
// that persisted data, unlike the surrounding UI chrome.
const STATUS_ORDER = ['Новый клиент', 'В работе', 'Ожидает ответа', 'Закрыт (успех)', 'Закрыт (проигран)'];
const STATUS_COLORS: Record<string, string> = {
  'Новый клиент': '#1769d1',
  'В работе': '#3b6cb6',
  'Ожидает ответа': '#c08319',
  'Закрыт (успех)': '#1f8a5e',
  'Закрыт (проигран)': '#cc2f47',
};

function getCatalog(t: TFunction): CatalogItem[] {
  const g = (key: string) => t(`crm.leadsAnalytics.catalogItems.${key}.title`);
  const s = (key: string) => t(`crm.leadsAnalytics.catalogItems.${key}.subtitle`);
  return [
    { group: 'kpi', type: 'metric', title: g('total'), subtitle: s('total'), span: 3, height: 160, metricKey: 'total' },
    { group: 'kpi', type: 'metric', title: g('conversion'), subtitle: s('conversion'), span: 3, height: 160, metricKey: 'conversion' },
    { group: 'kpi', type: 'metric', title: g('revenue'), subtitle: s('revenue'), span: 3, height: 160, metricKey: 'revenue' },
    { group: 'kpi', type: 'metric', title: g('response'), subtitle: s('response'), span: 3, height: 160, metricKey: 'response' },
    { group: 'kpi', type: 'formula', title: g('formula'), subtitle: s('formula'), span: 4, height: 240, valueMode: 'count', dimensionKey: 'field:status' },
    { group: 'charts', type: 'line', title: g('trend'), subtitle: s('trend'), span: 8, height: 320 },
    { group: 'charts', type: 'donut', title: g('statusDonut'), subtitle: s('statusDonut'), span: 4, height: 320, dimensionKey: 'field:status' },
    { group: 'charts', type: 'bar', title: g('sourceBar'), subtitle: s('sourceBar'), span: 6, height: 320, dimensionKey: 'field:source' },
    { group: 'charts', type: 'heatmap', title: g('heatmap'), subtitle: s('heatmap'), span: 8, height: 240 },
    { group: 'tables', type: 'funnel', title: g('funnelChart'), subtitle: s('funnelChart'), span: 6, height: 320, dimensionKey: 'field:status' },
    { group: 'tables', type: 'leaderboard', title: g('managerLeaderboard'), subtitle: s('managerLeaderboard'), span: 6, height: 320, dimensionKey: 'field:manager' },
    { group: 'tables', type: 'table', title: g('summaryTable'), subtitle: s('summaryTable'), span: 6, height: 320, dimensionKey: 'field:manager' },
    { group: 'ready', type: 'note', title: g('insight'), subtitle: s('insight'), span: 4, height: 240 },
  ];
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function uid(prefix = 'b') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function isFilled(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function parseNumericLoose(raw: unknown) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const normalized = String(raw)
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.\-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitMulti(raw: unknown) {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '')
    .split(/[,;/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateShort(date: Date, locale = 'ru-RU') {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function periodRange(period: PeriodId) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  if (period === 'all') return { from: null as Date | null, to: now };
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (period === '7d') from.setDate(now.getDate() - 6);
  if (period === '30d') from.setDate(now.getDate() - 29);
  if (period === 'quarter') from.setDate(now.getDate() - 89);
  if (period === 'ytd') {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to: now };
}

function previousRange(period: PeriodId) {
  const current = periodRange(period);
  if (!current.from) return { from: null as Date | null, to: null as Date | null };
  const days = Math.max(1, Math.ceil((current.to.getTime() - current.from.getTime()) / 86_400_000));
  const to = new Date(current.from);
  to.setMilliseconds(-1);
  const from = new Date(to);
  from.setDate(to.getDate() - days + 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function inRange(value: string, range: { from: Date | null; to: Date | null }) {
  if (!range.from && !range.to) return true;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function compactNumber(value: number, locale = 'ru-RU') {
  return new Intl.NumberFormat(locale).format(Math.round(value));
}

function compactMoney(value: number, currency = 'EUR', locale = 'ru-RU', millionAbbr = 'млн', thousandAbbr = 'тыс') {
  const rounded = Math.round(value);
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'RUB' ? '₽' : '€';
  if (Math.abs(rounded) >= 1_000_000) return `${(rounded / 1_000_000).toFixed(2)} ${millionAbbr} ${symbol}`;
  if (Math.abs(rounded) >= 1_000) return `${Math.round(rounded / 1_000)} ${thousandAbbr} ${symbol}`;
  return `${compactNumber(rounded, locale)} ${symbol}`;
}

function reportCurrencyFromPrefs(currencyPrefs: MarketingDisplayCurrencyState) {
  return normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
}

function reportRates(currencyPrefs: MarketingDisplayCurrencyState) {
  const displayCurrency = reportCurrencyFromPrefs(currencyPrefs);
  return { ...currencyPrefs.rates, [displayCurrency]: 1 };
}

function convertReportAmount(
  amount: number,
  currency: string,
  currencyPrefs: MarketingDisplayCurrencyState,
) {
  return convertMarketingAmount(
    amount,
    currency,
    'converted',
    reportCurrencyFromPrefs(currencyPrefs),
    reportRates(currencyPrefs),
  );
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function normalizeCustomFieldType(type?: string) {
  if (!type) return 'text';
  if (type === 'number') return 'number';
  if (type === 'select') return 'select';
  if (type === 'multiselect') return 'multiselect';
  if (type === 'date' || type === 'datetime') return 'date';
  return 'text';
}

function guessFieldType(values: unknown[]) {
  if (values.some((value) => Array.isArray(value))) return 'multiselect';
  const meaningful = values.filter(isFilled);
  if (!meaningful.length) return 'text';
  const numericCount = meaningful.filter((value) => parseNumericLoose(value) !== null).length;
  return numericCount >= Math.max(1, Math.floor(meaningful.length * 0.6)) ? 'number' : 'text';
}

function detectLeadAmount(lead: Lead) {
  const fields = (lead.customFields || {}) as Record<string, unknown>;
  const key = Object.keys(fields).find((fieldKey) => {
    const lower = fieldKey.toLowerCase();
    return ['amount', 'price', 'sum', 'value', 'total', 'budget', 'cost', 'tutar', 'miktar'].some((part) => lower.includes(part));
  });
  return parseNumericLoose(key ? fields[key] : null) ?? 0;
}

function detectLeadCurrency(lead: Lead) {
  const fields = (lead.customFields || {}) as Record<string, unknown>;
  const key = Object.keys(fields).find((fieldKey) => fieldKey.toLowerCase().includes('currency'));
  return key ? String(fields[key] || 'EUR') : 'EUR';
}

function uniqueFilled(values: unknown[]) {
  return Array.from(new Set(values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(String);
    return splitMulti(value);
  }).map((value) => value.trim()).filter(Boolean)));
}

function buildProjectsByLeadId(projects: Project[]) {
  const map = new Map<string, Project[]>();
  projects
    .filter((project) => project.leadId && !project.isArchived && !project.isDeleted)
    .forEach((project) => {
      const leadId = project.leadId as string;
      map.set(leadId, [...(map.get(leadId) || []), project]);
    });
  return map;
}

function aggregateProjects(projects: Project[], currencyPrefs: MarketingDisplayCurrencyState) {
  const active = projects.filter((project) => !project.isArchived && !project.isDeleted);
  const converted = active.map((project) =>
    convertReportAmount(Number(project.amount) || 0, project.currency || 'EUR', currencyPrefs),
  );
  const amount = converted.reduce((sum, row) => sum + row.value, 0);
  const sourceCurrencies = Array.from(
    new Set(active.map((project) => String(project.currency || 'EUR').toUpperCase().slice(0, 8) || 'EUR')),
  );
  return {
    count: active.length,
    amount,
    currency: reportCurrencyFromPrefs(currencyPrefs),
    sourceCurrencies,
    currencyRateMissing: converted.some((row) => row.missingRate),
    statuses: uniqueFilled(active.map((project) => project.status)),
    categories: uniqueFilled(active.map((project) => project.category)),
    owners: uniqueFilled(active.map((project) => project.owner)),
    tags: uniqueFilled(active.flatMap((project) => project.tags || [])),
    names: uniqueFilled(active.map((project) => project.name)),
  };
}

function readCachedAiScore(lead: Lead) {
  const fields = (lead.customFields || {}) as Record<string, unknown>;
  const scoreKeys = ['aiScore', 'AI Score', 'ai_score', 'leadScore', 'score', 'rating'];
  const priorityKeys = ['aiPriority', 'AI Priority', 'ai_priority', 'priority'];
  let score = scoreKeys.map((key) => parseNumericLoose(fields[key])).find((value): value is number => value !== null) ?? null;
  let priority: unknown = priorityKeys.map((key) => fields[key]).find(isFilled);
  let label: unknown = fields.aiLabel || fields.ai_label || '';

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`ai_lead_score_${lead.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { score?: unknown; priority?: unknown; label?: unknown };
        const cachedScore = parseNumericLoose(parsed.score);
        if (cachedScore !== null) score = cachedScore;
        if (isFilled(parsed.priority)) priority = parsed.priority;
        if (isFilled(parsed.label)) label = parsed.label;
      }
    } catch {
      // ignore cache errors
    }
  }

  return {
    score,
    priority: String(priority || ''),
    label: String(label || ''),
  };
}

function buildRevenueMap(stats: Array<LeadsRoiStats | null>) {
  const map = new Map<string, LeadRevenue>();
  stats.forEach((stat) => {
    stat?.items?.forEach((row) => {
      const current = map.get(row.leadId) || {
        revenue: 0,
        dealsCount: 0,
        currency: row.currency || stat.currency || 'EUR',
        sourceCurrencies: [],
        firstDealAt: null,
        lastDealAt: null,
      };
      current.revenue += Number(row.totalRevenue) || 0;
      current.dealsCount += Number(row.dealsCount) || 0;
      current.currency = row.currency || current.currency;
      current.sourceCurrencies = Array.from(new Set([
        ...current.sourceCurrencies,
        ...(row.sourceCurrencies?.length ? row.sourceCurrencies : [row.currency || stat.currency || 'EUR']),
      ].filter(Boolean)));
      current.firstDealAt = !current.firstDealAt || (row.firstDealAt && row.firstDealAt < current.firstDealAt) ? row.firstDealAt : current.firstDealAt;
      current.lastDealAt = !current.lastDealAt || (row.lastDealAt && row.lastDealAt > current.lastDealAt) ? row.lastDealAt : current.lastDealAt;
      map.set(row.leadId, current);
    });
  });
  return map;
}

function mapLeadToItem(
  lead: Lead,
  revenueMap: Map<string, LeadRevenue>,
  projects: Project[] = [],
  currencyPrefs: MarketingDisplayCurrencyState,
): LeadAnalyticsItem {
  const revenue = revenueMap.get(lead.id);
  const projectAgg = aggregateProjects(projects, currencyPrefs);
  const ai = readCachedAiScore(lead);
  const source = lead.source || lead.channel || lead.utmSource || 'Не указано';
  const managers = lead.assignedToList?.length
    ? lead.assignedToList
    : lead.assignedTo
      ? lead.assignedTo.split(/[,;/]+/).map((value) => value.trim()).filter(Boolean)
      : [];
  const manager = managers.join(', ') || lead.assignedTo || 'Без ответственного';
  const nativeLeadAmount = detectLeadAmount(lead);
  const leadCurrency = detectLeadCurrency(lead);
  const leadAmountConverted = convertReportAmount(nativeLeadAmount, leadCurrency, currencyPrefs);
  const leadAmount = leadAmountConverted.value;
  const amount = revenue?.revenue || projectAgg.amount || leadAmount || 0;
  const currency = revenue?.currency || projectAgg.currency || reportCurrencyFromPrefs(currencyPrefs);
  const sourceCurrencies = Array.from(new Set([
    ...(revenue?.sourceCurrencies || []),
    ...projectAgg.sourceCurrencies,
    leadCurrency,
  ].filter(Boolean).map((value) => String(value))));
  const currencyRateMissing = projectAgg.currencyRateMissing || leadAmountConverted.missingRate;
  const customFields = {
    ...(lead.customFields || {}),
    status: lead.status,
    source,
    channel: lead.channel || source,
    country: lead.country || '',
    manager,
    assignedTo: manager,
    assignedUserId: lead.assignedUserId || '',
    assignedUserIds: lead.assignedUserIds || [],
    contactId: lead.contactId || '',
    companyId: lead.companyId || '',
    revenue: amount,
    amount,
    reportCurrency: currency,
    displayCurrency: currency,
    sourceCurrencies,
    currencyRateMissing: currencyRateMissing ? 'yes' : '',
    leadAmount,
    leadAmountOriginal: nativeLeadAmount,
    leadCurrency,
    salesRevenue: revenue?.revenue || 0,
    roiRevenue: revenue?.revenue || 0,
    dealsCount: revenue?.dealsCount || 0,
    projectCount: projectAgg.count,
    projectAmount: projectAgg.amount,
    projectStatus: projectAgg.statuses,
    projectCategory: projectAgg.categories,
    projectOwner: projectAgg.owners,
    projectTags: projectAgg.tags,
    projectName: projectAgg.names,
    projects: projectAgg.names,
    aiScore: ai.score,
    aiPriority: ai.priority,
    aiLabel: ai.label,
    utmSource: lead.utmSource || '',
    utmMedium: lead.utmMedium || '',
    utmCampaign: lead.utmCampaign || '',
    utmContent: lead.utmContent || '',
    utmTerm: lead.utmTerm || '',
    phone: lead.phone || '',
    email: lead.email || '',
    createdDate: lead.createdAt,
    updatedDate: lead.updatedAt,
    firstDealAt: revenue?.firstDealAt || '',
    lastDealAt: revenue?.lastDealAt || '',
  };

  return {
    id: lead.id,
    name: lead.name || lead.phone || lead.email || `Lead ${lead.id.slice(0, 6)}`,
    phone: lead.phone || '',
    email: lead.email || '',
    status: lead.status || 'Новый клиент',
    source,
    channel: lead.channel || source,
    manager,
    country: lead.country || '',
    amount,
    currency,
    sourceCurrencies,
    reportCurrency: currency,
    currencyRateMissing,
    dealsCount: revenue?.dealsCount || 0,
    projectCount: projectAgg.count,
    projectAmount: projectAgg.amount,
    projectStatuses: projectAgg.statuses,
    projectCategories: projectAgg.categories,
    projectOwners: projectAgg.owners,
    projectTags: projectAgg.tags,
    aiScore: ai.score,
    aiPriority: ai.priority,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    tags: Array.from(new Set([
      lead.channel,
      lead.utmSource,
      lead.utmMedium,
      lead.utmCampaign,
      lead.country,
      ...projectAgg.tags,
      ...projectAgg.categories,
    ].filter(Boolean).map(String))),
    customFields,
  };
}

function getFieldValue(item: LeadAnalyticsItem, scope: string) {
  const key = scope.startsWith('field:') ? scope.slice(6) : scope;
  if (key === 'status') return item.status;
  if (key === 'source') return item.source;
  if (key === 'channel') return item.channel;
  if (key === 'manager' || key === 'assignedTo') return item.manager;
  if (key === 'country') return item.country;
  if (key === 'amount' || key === 'revenue') return item.amount;
  if (key === 'currency' || key === 'reportCurrency' || key === 'displayCurrency') return item.reportCurrency;
  if (key === 'sourceCurrencies' || key === 'sourceCurrency') return item.sourceCurrencies;
  if (key === 'currencyRateMissing') return item.currencyRateMissing ? 'yes' : '';
  if (key === 'dealsCount') return item.dealsCount;
  if (key === 'projectCount') return item.projectCount;
  if (key === 'projectAmount') return item.projectAmount;
  if (key === 'projectStatus') return item.projectStatuses;
  if (key === 'projectCategory') return item.projectCategories;
  if (key === 'projectOwner') return item.projectOwners;
  if (key === 'projectTags' || key === 'tags') return key === 'tags' ? item.tags : item.projectTags;
  if (key === 'aiScore') return item.aiScore;
  if (key === 'aiPriority') return item.aiPriority;
  if (key === 'createdDate' || key === 'createdAt') return item.createdAt;
  if (key === 'updatedDate' || key === 'updatedAt') return item.updatedAt;
  if (key === 'phone') return item.phone;
  if (key === 'email') return item.email;
  return item.customFields[key];
}

function itemMatchesFilter(item: LeadAnalyticsItem, filter: FilterRow) {
  if (!filter.keys.length) return true;
  const raw = getFieldValue(item, filter.scope);
  if (!isFilled(raw)) return false;
  if (Array.isArray(raw)) return raw.map(String).some((value) => filter.keys.includes(value));
  const values = splitMulti(raw);
  if (values.length > 1) return values.some((value) => filter.keys.includes(value));
  return filter.keys.includes(String(raw));
}

function applyFilterRows(items: LeadAnalyticsItem[], filters?: FilterRow[]) {
  if (!filters?.length) return items;
  return items.filter((item) => filters.every((filter) => itemMatchesFilter(item, filter)));
}

function getNumericValue(item: LeadAnalyticsItem, field?: string) {
  if (!field) return item.amount || 0;
  if (field === 'amount' || field === 'revenue') return item.amount || 0;
  if (field === 'dealsCount') return item.dealsCount || 0;
  const key = field.startsWith('field:') ? field.slice(6) : field;
  return parseNumericLoose(getFieldValue(item, key)) ?? 0;
}

type SeriesRow = { code: string; label: string; value: number; color: string };
type GroupedSeriesRow = SeriesRow & { items: LeadAnalyticsItem[] };

function buildGroupedSeries(items: LeadAnalyticsItem[], dimensionKey = 'field:status', mode: ValueMode = 'count', valueField?: string) {
  const grouped = new Map<string, GroupedSeriesRow>();
  items.forEach((item) => {
    const raw = getFieldValue(item, dimensionKey);
    const values = Array.isArray(raw) ? raw.map(String).filter(Boolean) : splitMulti(raw);
    const buckets = values.length ? values : ['Не указано'];
    buckets.forEach((label) => {
      const row = grouped.get(label) || {
        code: label,
        label,
        value: 0,
        color: STATUS_COLORS[label] || PALETTE[grouped.size % PALETTE.length],
        items: [],
      };
      row.value += mode === 'sum' ? getNumericValue(item, valueField) : 1;
      row.items.push(item);
      grouped.set(label, row);
    });
  });
  return Array.from(grouped.values()).sort((a, b) => b.value - a.value);
}

function buildSeries(items: LeadAnalyticsItem[], dimensionKey = 'field:status', mode: ValueMode = 'count', valueField?: string): SeriesRow[] {
  return buildGroupedSeries(items, dimensionKey, mode, valueField).map(({ items: _items, ...row }) => row);
}

function buildTrend(items: LeadAnalyticsItem[], period: PeriodId, mode: ValueMode = 'count', valueField?: string, locale = 'ru-RU') {
  const range = periodRange(period);
  const previous = previousRange(period);
  const validTimes = items.map((item) => new Date(item.createdAt).getTime()).filter(Number.isFinite);
  const from = range.from || new Date(validTimes.length ? Math.min(...validTimes) : Date.now());
  const to = range.to;
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  const pointCount = Math.max(2, Math.min(days, 12));
  const bucketSize = Math.max(1, Math.ceil(days / pointCount));

  return Array.from({ length: pointCount }, (_, index) => {
    const start = new Date(from);
    start.setDate(from.getDate() + index * bucketSize);
    const end = new Date(start);
    end.setDate(start.getDate() + bucketSize);
    const currentItems = items.filter((item) => {
      const created = new Date(item.createdAt);
      return created >= start && created < end;
    });
    const prevStart = previous.from ? new Date(previous.from) : null;
    const prevItems = prevStart
      ? items.filter((item) => {
          const shifted = new Date(prevStart);
          shifted.setDate(prevStart.getDate() + index * bucketSize);
          const shiftedEnd = new Date(shifted);
          shiftedEnd.setDate(shifted.getDate() + bucketSize);
          const created = new Date(item.createdAt);
          return created >= shifted && created < shiftedEnd;
        })
      : [];
    const aggregate = (rows: LeadAnalyticsItem[]) =>
      mode === 'sum' ? rows.reduce((sum, item) => sum + getNumericValue(item, valueField), 0) : rows.length;
    return {
      name: formatDateShort(start, locale),
      value: aggregate(currentItems),
      previous: aggregate(prevItems),
    };
  });
}

function fieldLabel(fields: FieldMeta[], key?: string) {
  if (!key) return '';
  const normalized = key.startsWith('field:') ? key.slice(6) : key;
  return fields.find((field) => field.key === normalized)?.label || normalized;
}

function formatTableExtraValue(rows: LeadAnalyticsItem[], field: FieldMeta, locale = 'ru-RU') {
  const values = rows.map((item) => getFieldValue(item, field.key)).filter(isFilled);
  if (field.type === 'number') {
    const sum = rows.reduce((acc, item) => acc + getNumericValue(item, field.key), 0);
    return compactNumber(sum, locale);
  }
  if (field.type === 'date') {
    const latest = values
      .map((value) => new Date(String(value)))
      .filter((date) => Number.isFinite(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return latest ? formatDateShort(latest, locale) : '—';
  }
  const counts = new Map<string, number>();
  values.flatMap((value) => Array.isArray(value) ? value.map(String) : splitMulti(value)).forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([value]) => value);
  return top.length ? top.join(', ') : '—';
}

function resolveFormulaOperand(type: string | undefined, key: string | undefined, items: LeadAnalyticsItem[]) {
  if (!type || type === 'total') return items.length;
  if (type === 'revenue' || type === 'amount') return items.reduce((sum, item) => sum + item.amount, 0);
  if (type === 'avgRevenue') return items.length ? items.reduce((sum, item) => sum + item.amount, 0) / items.length : 0;
  if (type === 'conversion') {
    const won = items.filter((item) => item.status === 'Закрыт (успех)').length;
    return items.length ? (won / items.length) * 100 : 0;
  }
  if (type === 'won') return items.filter((item) => item.status === 'Закрыт (успех)').length;
  if (type === 'lost') return items.filter((item) => item.status === 'Закрыт (проигран)').length;
  if (type.startsWith('sum:')) return items.reduce((sum, item) => sum + getNumericValue(item, type.slice(4)), 0);
  if (type.startsWith('avg:')) {
    const values = items.map((item) => getNumericValue(item, type.slice(4))).filter((value) => value !== 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }
  if (type.startsWith('filled:')) return items.filter((item) => isFilled(getFieldValue(item, type.slice(7)))).length;
  if (type.startsWith('field:')) {
    const series = buildSeries(items, type, 'count');
    return key ? series.find((row) => row.code === key)?.value || 0 : series.reduce((sum, row) => sum + row.value, 0);
  }
  return 0;
}

function evaluateFormula(block: AnalyticsBlock, matchingItems: LeadAnalyticsItem[], baseItems: LeadAnalyticsItem[], t: TFunction, locale = 'ru-RU') {
  const fn = block.formulaFn || 'sumif';
  const mode = block.formulaMode || (block.valueMode === 'sum' ? 'sum' : 'count');
  const valueField = block.valueField || 'amount';
  const baseTotal = baseItems.length;
  const matchingTotal = matchingItems.length;
  const sumMatching = matchingItems.reduce((sum, item) => sum + getNumericValue(item, valueField), 0);
  const left = resolveFormulaOperand(block.formulaLeftType || 'total', block.formulaLeftKey, baseItems);
  const right = resolveFormulaOperand(block.formulaRightType || 'total', block.formulaRightKey, baseItems);
  const n = (v: number) => compactNumber(v, locale);

  if (fn === 'count') return { value: matchingTotal, suffix: '', detail: t('crm.leadsAnalytics.renderBlock.percentOfSample', { pct: percent(matchingTotal, baseTotal) }) };
  if (fn === 'percent') return { value: percent(matchingTotal, baseTotal), suffix: '%', detail: t('crm.leadsAnalytics.renderBlock.ofSample', { matching: n(matchingTotal), base: n(baseTotal) }) };
  if (fn === 'ratio') return { value: right ? Math.round((left / right) * 1000) / 10 : 0, suffix: '%', detail: `${n(left)} / ${n(right)}` };
  if (fn === 'diff') return { value: left - right, suffix: '', detail: `${n(left)} − ${n(right)}` };
  if (mode === 'percent') return { value: percent(matchingTotal, baseTotal), suffix: '%', detail: t('crm.leadsAnalytics.renderBlock.ofSample', { matching: n(matchingTotal), base: n(baseTotal) }) };
  if (mode === 'sum') return { value: sumMatching, suffix: '', detail: t('crm.leadsAnalytics.renderBlock.sumOfField', { field: valueField }) };
  return { value: matchingTotal, suffix: '', detail: t('crm.leadsAnalytics.renderBlock.percentOfSample', { pct: percent(matchingTotal, baseTotal) }) };
}

const HEATMAP_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function buildHeatmap(items: LeadAnalyticsItem[]) {
  const hours = ['00', '03', '06', '09', '12', '15', '18', '21'];
  return HEATMAP_DAY_KEYS.map((dayKey, dayIndex) => ({
    dayKey,
    hours: hours.map((hour) => {
      const startHour = Number(hour);
      const value = items.filter((item) => {
        const date = new Date(item.createdAt);
        const jsDay = date.getDay();
        const normalizedDay = jsDay === 0 ? 6 : jsDay - 1;
        return normalizedDay === dayIndex && date.getHours() >= startHour && date.getHours() < startHour + 3;
      }).length;
      return { hour, value };
    }),
  }));
}

function fieldOptions(fields: FieldMeta[]) {
  return fields.map((field) => ({ id: `field:${field.key}`, label: field.label || field.key, type: field.type }));
}

function defaultBlockFor(item: CatalogItem, view: ViewId): AnalyticsBlock {
  const dimensionKey =
    item.dimensionKey ||
    (view === 'managers' ? 'field:manager' : view === 'sources' ? 'field:source' : view === 'funnel' ? 'field:status' : 'field:status');
  return {
    id: uid(),
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    span: item.span,
    height: item.height,
    metricKey: item.metricKey || (item.type === 'metric' ? 'total' : undefined),
    dimensionKey,
    valueMode: item.valueMode || 'count',
    valueField: item.valueMode === 'sum' ? 'amount' : undefined,
    formulaFn: item.type === 'formula' ? 'sumif' : undefined,
    formulaMode: item.type === 'formula' ? 'count' : undefined,
    formulaLeftType: item.type === 'formula' ? 'total' : undefined,
    formulaRightType: item.type === 'formula' ? 'total' : undefined,
    formulaDisplay: item.type === 'formula' ? 'metric' : undefined,
    tableColumns: item.type === 'table' ? ['amount', 'projectAmount'] : undefined,
    color: PALETTE[0],
    showLabels: true,
    filters: [],
  };
}

function defaultBlocks(view: ViewId, t: TFunction): AnalyticsBlock[] {
  const k = (view: string, key: string, field: 'title' | 'subtitle') => t(`crm.leadsAnalytics.defaultBlocks.${view}.${key}.${field}`);
  if (view === 'sources') {
    return [
      { id: 's1', type: 'bar', title: k('sources', 'bar', 'title'), subtitle: k('sources', 'bar', 'subtitle'), span: 8, height: 400, dimensionKey: 'field:source', valueMode: 'count', color: '#222222', filters: [] },
      { id: 's2', type: 'table', title: k('sources', 'table', 'title'), subtitle: k('sources', 'table', 'subtitle'), span: 4, height: 400, dimensionKey: 'field:source', valueMode: 'count', color: '#1769d1', filters: [] },
      { id: 's3', type: 'line', title: k('sources', 'trend', 'title'), subtitle: k('sources', 'trend', 'subtitle'), span: 8, height: 320, dimensionKey: 'field:source', valueMode: 'count', color: '#222222', filters: [] },
      { id: 's4', type: 'note', title: k('sources', 'note', 'title'), subtitle: k('sources', 'note', 'subtitle'), span: 4, height: 320, filters: [] },
    ];
  }
  if (view === 'managers') {
    return [
      { id: 'm1', type: 'metric', title: k('managers', 'total', 'title'), subtitle: k('managers', 'total', 'subtitle'), span: 3, height: 160, metricKey: 'total', color: '#222222', filters: [] },
      { id: 'm2', type: 'metric', title: k('managers', 'conversion', 'title'), subtitle: k('managers', 'conversion', 'subtitle'), span: 3, height: 160, metricKey: 'conversion', color: '#1f8a5e', filters: [] },
      { id: 'm3', type: 'leaderboard', title: k('managers', 'leaderboard', 'title'), subtitle: k('managers', 'leaderboard', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:manager', color: '#222222', filters: [] },
      { id: 'm4', type: 'table', title: k('managers', 'table', 'title'), subtitle: k('managers', 'table', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:manager', color: '#1769d1', filters: [] },
      { id: 'm5', type: 'heatmap', title: k('managers', 'heatmap', 'title'), subtitle: k('managers', 'heatmap', 'subtitle'), span: 6, height: 320, filters: [] },
    ];
  }
  if (view === 'funnel') {
    return [
      { id: 'f1', type: 'funnel', title: k('funnel', 'funnelChart', 'title'), subtitle: k('funnel', 'funnelChart', 'subtitle'), span: 8, height: 400, dimensionKey: 'field:status', color: '#222222', filters: [] },
      { id: 'f2', type: 'donut', title: k('funnel', 'donut', 'title'), subtitle: k('funnel', 'donut', 'subtitle'), span: 4, height: 400, dimensionKey: 'field:status', color: '#1769d1', filters: [] },
      { id: 'f3', type: 'line', title: k('funnel', 'trend', 'title'), subtitle: k('funnel', 'trend', 'subtitle'), span: 8, height: 320, dimensionKey: 'field:status', color: '#222222', filters: [] },
      { id: 'f4', type: 'metric', title: k('funnel', 'conversion', 'title'), subtitle: k('funnel', 'conversion', 'subtitle'), span: 4, height: 160, metricKey: 'conversion', color: '#1f8a5e', filters: [] },
      { id: 'f5', type: 'note', title: k('funnel', 'note', 'title'), subtitle: k('funnel', 'note', 'subtitle'), span: 4, height: 160, filters: [] },
    ];
  }
  return [
    { id: 'b1', type: 'metric', title: k('overview', 'total', 'title'), subtitle: k('overview', 'total', 'subtitle'), span: 3, height: 160, metricKey: 'total', color: '#222222', filters: [] },
    { id: 'b2', type: 'metric', title: k('overview', 'conversion', 'title'), subtitle: k('overview', 'conversion', 'subtitle'), span: 3, height: 160, metricKey: 'conversion', color: '#1f8a5e', filters: [] },
    { id: 'b3', type: 'metric', title: k('overview', 'revenue', 'title'), subtitle: k('overview', 'revenue', 'subtitle'), span: 3, height: 160, metricKey: 'revenue', color: '#214b8a', filters: [] },
    { id: 'b4', type: 'metric', title: k('overview', 'response', 'title'), subtitle: k('overview', 'response', 'subtitle'), span: 3, height: 160, metricKey: 'response', color: '#cc2f47', filters: [] },
    { id: 'b5', type: 'line', title: k('overview', 'trend', 'title'), subtitle: k('overview', 'trend', 'subtitle'), span: 8, height: 320, color: '#222222', filters: [] },
    { id: 'b6', type: 'donut', title: k('overview', 'statusDonut', 'title'), subtitle: k('overview', 'statusDonut', 'subtitle'), span: 4, height: 320, dimensionKey: 'field:status', color: '#1769d1', filters: [] },
    { id: 'b7', type: 'bar', title: k('overview', 'sourceBar', 'title'), subtitle: k('overview', 'sourceBar', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:source', color: '#222222', filters: [] },
    { id: 'b8', type: 'funnel', title: k('overview', 'funnelChart', 'title'), subtitle: k('overview', 'funnelChart', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:status', color: '#222222', filters: [] },
    { id: 'b9', type: 'leaderboard', title: k('overview', 'managerLeaderboard', 'title'), subtitle: k('overview', 'managerLeaderboard', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:manager', color: '#222222', filters: [] },
    { id: 'b10', type: 'table', title: k('overview', 'table', 'title'), subtitle: k('overview', 'table', 'subtitle'), span: 6, height: 320, dimensionKey: 'field:manager', color: '#1769d1', filters: [] },
    { id: 'b11', type: 'heatmap', title: k('overview', 'heatmap', 'title'), subtitle: k('overview', 'heatmap', 'subtitle'), span: 8, height: 240, filters: [] },
    { id: 'b12', type: 'note', title: k('overview', 'note', 'title'), subtitle: k('overview', 'note', 'subtitle'), span: 4, height: 240, filters: [] },
  ];
}

function defaultLayout(t: TFunction): Record<ViewId, AnalyticsBlock[]> {
  return {
    overview: defaultBlocks('overview', t),
    sources: defaultBlocks('sources', t),
    managers: defaultBlocks('managers', t),
    funnel: defaultBlocks('funnel', t),
  };
}

function blockToDashboardWidgetConfig(block: AnalyticsBlock) {
  const size = block.span <= 4 ? 'sm' : block.span <= 8 ? 'md' : 'lg';
  const formulaFilters = (block.filters || []).map((filter) => ({
    scope: filter.scope,
    keys: filter.keys || [],
  }));
  if (block.type === 'metric') {
    const metricKey =
      block.metricKey === 'revenue'
        ? 'amount'
        : block.metricKey === 'avgRevenue'
          ? 'avgAmount'
          : block.metricKey === 'won'
            ? 'filled:lastDealAt'
            : block.metricKey === 'lost'
              ? 'total'
              : block.metricKey?.startsWith('sum:') || block.metricKey?.startsWith('avg:') || block.metricKey?.startsWith('filled:')
                ? block.metricKey
                : 'total';
    return {
      id: block.id,
      type: 'metric',
      title: block.title,
      size,
      height: Math.max(160, block.height),
      metricKey,
      formulaFilters,
      themeKey: 'lumiva',
    };
  }
  if (block.type === 'formula') {
    return {
      id: block.id,
      type: 'formula',
      title: block.title,
      size,
      height: Math.max(180, block.height),
      formulaFn: block.formulaFn || 'sumif',
      formulaLeftType: block.formulaLeftType || 'total',
      formulaLeftKey: block.formulaLeftKey,
      formulaRightType: block.formulaRightType || 'total',
      formulaRightKey: block.formulaRightKey,
      formulaMode: block.formulaMode || 'count',
      formulaFilters,
      chartKey: block.dimensionKey || 'field:status',
      chartValueMode: block.valueMode || 'count',
      chartValueField: block.valueField,
      formulaDisplay: block.formulaDisplay || 'metric',
      themeKey: 'lumiva',
      showLabels: block.showLabels !== false,
    };
  }
  if (block.type === 'donut' || block.type === 'funnel') {
    return {
      id: block.id,
      type: 'donut',
      title: block.title,
      size,
      height: Math.max(180, block.height),
      chartKey: block.dimensionKey || 'field:status',
      chartValueMode: block.valueMode || 'count',
      chartValueField: block.valueField,
      formulaFilters,
      themeKey: 'lumiva',
      showLabels: block.showLabels !== false,
    };
  }
  if (block.type === 'bar' || block.type === 'line') {
    return {
      id: block.id,
      type: 'bar',
      title: block.title,
      size,
      height: Math.max(180, block.height),
      chartKey: block.dimensionKey || 'field:source',
      chartValueMode: block.valueMode || 'count',
      chartValueField: block.valueField,
      formulaFilters,
      themeKey: 'lumiva',
    };
  }
  return {
    id: block.id,
    type: 'table',
    title: block.title,
    size,
    height: Math.max(180, block.height),
    tableKey: block.dimensionKey || 'field:manager',
    tableColumns: block.tableColumns || [],
    chartValueMode: block.valueMode || 'count',
    chartValueField: block.valueField,
    formulaFilters,
    themeKey: 'lumiva',
    showLabels: block.showLabels !== false,
  };
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
    chart: <><path d="M5 19V8" /><path d="M11 19v-6" /><path d="M17 19V5" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M3 10h18" /><path d="M3 16h18" /><path d="M9 4v16" /></>,
  };
  return <svg {...common}>{paths[name] || paths.chart}</svg>;
}

function FilterKeysPicker({
  options,
  keys,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  keys: string[];
  onChange: (keys: string[]) => void;
}) {
  const { t } = useTranslation();
  const allSelected = keys.length === 0;
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-3 text-base text-[#34435a]">
        <input type="checkbox" className="h-5 w-5 rounded border-[#cbd7e6] accent-[#1769d1]" checked={allSelected} onChange={(event) => event.target.checked && onChange([])} />
        {t('crm.leadsAnalytics.filterKeysPicker.allValuesLabel')}
      </label>
      <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-[#dbe4f0] bg-white px-3 py-3">
        {options.map((option) => {
          const checked = allSelected || keys.includes(option.id);
          return (
            <label key={option.id} className="flex cursor-pointer items-center gap-3 text-base text-[#34435a]">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-[#cbd7e6] accent-[#1769d1]"
                checked={checked}
                onChange={() => {
                  if (allSelected) {
                    onChange([option.id]);
                    return;
                  }
                  onChange(keys.includes(option.id) ? keys.filter((key) => key !== option.id) : [...keys, option.id]);
                }}
              />
              <span className="truncate">{option.label}</span>
            </label>
          );
        })}
        {!options.length && <div className="px-1 py-2 text-sm text-[#8ea0bb]">{t('crm.leadsAnalytics.filterKeysPicker.noValuesLabel')}</div>}
      </div>
    </div>
  );
}

function MiniSparkline({ data, color = '#222222' }: { data: number[]; color?: string }) {
  const chartData = data.map((value, index) => ({ index, value }));
  const gId = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AddBlockModal({
  activeView,
  onAdd,
  onClose,
}: {
  activeView: ViewId;
  onAdd: (block: AnalyticsBlock) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const catalog = useMemo(() => getCatalog(t), [t]);
  const catalogGroups: Array<{ id: 'all' | CatalogGroup; label: string }> = useMemo(() => [
    { id: 'all', label: t('crm.leadsAnalytics.addBlockModal.allTab') },
    { id: 'kpi', label: t('crm.leadsAnalytics.catalogGroups.kpi') },
    { id: 'charts', label: t('crm.leadsAnalytics.catalogGroups.charts') },
    { id: 'tables', label: t('crm.leadsAnalytics.catalogGroups.tables') },
    { id: 'ready', label: t('crm.leadsAnalytics.catalogGroups.ready') },
  ], [t]);
  const [tab, setTab] = useState<'all' | CatalogGroup>('all');
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = catalog.filter((item) => {
    const matchesTab = tab === 'all' || item.group === tab;
    const search = `${item.title} ${item.subtitle} ${item.group}`.toLowerCase();
    return matchesTab && search.includes(query.trim().toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[8500] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[calc(100vh-64px)] w-[min(940px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{t('crm.leadsAnalytics.addBlockModal.kicker')}</div>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#222]">{t('crm.leadsAnalytics.addBlockModal.title')}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t('crm.leadsAnalytics.addBlockModal.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon p-2 rounded-xl" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="flex gap-1 border-b border-neutral-200 bg-neutral-50 px-6">
          {catalogGroups.map((item) => (
            <button key={item.id} type="button" className={cx('border-b-2 px-3 py-3 text-sm transition', tab === item.id ? 'border-[#222] font-medium text-[#222]' : 'border-transparent text-neutral-500 hover:text-[#222]')} onClick={() => setTab(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-b border-neutral-200 px-6 py-3">
          <Icon name="search" size={15} />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('crm.leadsAnalytics.addBlockModal.searchPlaceholder')} className="w-full bg-transparent text-sm outline-none" />
          <span className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] uppercase text-neutral-400">{t('crm.leadsAnalytics.addBlockModal.escBadge')}</span>
        </div>
        <div className="grid max-h-[calc(100vh-330px)] grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <button key={`${item.group}-${item.title}`} type="button" className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#222] hover:shadow-md" onClick={() => onAdd(defaultBlockFor(item, activeView))}>
              <div className="flex h-16 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 text-neutral-500">
                <Icon name={item.group === 'tables' ? 'table' : 'chart'} size={28} />
              </div>
              <div className="text-sm font-semibold text-[#222]">{item.title}</div>
              <div className="text-xs leading-5 text-neutral-500">{item.subtitle}</div>
              <div className="mt-auto flex justify-between text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                <span>{t(`crm.leadsAnalytics.catalogGroups.${item.group}`)}</span>
                <span>{t('crm.leadsAnalytics.addBlockModal.spanHeightFormat', { span: item.span, height: item.height })}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfigDrawer({
  block,
  fields,
  metricOptions,
  valueFieldOptions,
  valueOptionsByScope,
  onChange,
  onAddHome,
  onClose,
  onDelete,
}: {
  block: AnalyticsBlock | null;
  fields: FieldMeta[];
  metricOptions: Array<{ id: MetricKey; label: string }>;
  valueFieldOptions: Array<{ id: string; label: string }>;
  valueOptionsByScope: Record<string, Array<{ id: string; label: string }>>;
  onChange: (block: AnalyticsBlock) => void;
  onAddHome: () => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const cd = (key: string) => t(`crm.leadsAnalytics.configDrawer.${key}`);
  const blockTypeOptions = useMemo(() => getBlockTypeOptions(t), [t]);
  if (!block) return null;
  const dimensions = fieldOptions(fields);
  const formulaOperandOptions = [
    ...metricOptions.map((option) => ({ id: option.id, label: option.label })),
    ...dimensions.map((option) => ({ id: option.id, label: `${option.label}${cd('operandValueSuffix')}` })),
  ];
  const selectedTableColumns = block.tableColumns || [];
  const blockType = blockTypeOptions.find((option) => option.id === block.type);
  const usesDimension = block.type !== 'metric' && block.type !== 'formula' && block.type !== 'heatmap' && block.type !== 'note' && block.type !== 'line';
  const usesValueMode = block.type === 'bar' || block.type === 'donut' || block.type === 'table' || block.type === 'funnel' || block.type === 'leaderboard' || block.type === 'line';
  const changeType = (type: BlockType) => {
    const next: AnalyticsBlock = {
      ...block,
      type,
      metricKey: type === 'metric' ? block.metricKey || 'total' : undefined,
      dimensionKey: type === 'metric' || type === 'heatmap' || type === 'note' ? undefined : block.dimensionKey || 'field:status',
      valueMode: type === 'metric' || type === 'heatmap' || type === 'note' ? undefined : block.valueMode || 'count',
      valueField: block.valueMode === 'sum' ? block.valueField || valueFieldOptions[0]?.id || 'amount' : block.valueField,
      formulaFn: type === 'formula' ? block.formulaFn || 'sumif' : undefined,
      formulaMode: type === 'formula' ? block.formulaMode || 'count' : undefined,
      formulaLeftType: type === 'formula' ? block.formulaLeftType || 'total' : undefined,
      formulaRightType: type === 'formula' ? block.formulaRightType || 'total' : undefined,
      formulaDisplay: type === 'formula' ? block.formulaDisplay || 'metric' : undefined,
      tableColumns: type === 'table' ? block.tableColumns || ['amount', 'projectAmount'] : undefined,
      span: type === 'metric' ? Math.min(block.span, 4) : block.span < 4 ? 6 : block.span,
      height: type === 'metric' ? Math.max(MIN_BLOCK_H, Math.min(block.height, 240)) : Math.max(block.height, 280),
      showLabels: block.showLabels !== false,
    };
    onChange(next);
  };
  const updateFilters = (filters: FilterRow[]) => onChange({ ...block, filters });
  const addFilter = () => updateFilters([...(block.filters || []), { id: uid('f'), scope: dimensions[0]?.id || 'field:status', keys: [] }]);
  const updateFilter = (id: string, patch: Partial<FilterRow>) =>
    updateFilters((block.filters || []).map((filter) => filter.id === id ? { ...filter, ...patch } : filter));

  return (
    <aside className="fixed right-0 top-0 z-[70] flex h-[100dvh] w-[min(760px,calc(100vw-24px))] flex-col border-l border-[#dbe4f0] bg-white shadow-[-18px_0_46px_rgba(15,23,42,0.12)]">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e6edf5] px-5 py-4 sm:px-7 sm:py-6">
        <div>
          <div className="text-sm uppercase tracking-[0.32em] text-[#8ea0bb] sm:text-lg">{cd('kicker')}</div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-2xl">{cd('title')}</h3>
          <div className="mt-1 text-xs text-[#6b7d99] sm:mt-2 sm:text-sm">{t('crm.leadsAnalytics.configDrawer.subheadingFormat', { title: block.title, type: blockType?.label || block.type, span: block.span })}</div>
        </div>
        <button type="button" className="btn-icon p-2" onClick={onClose}><Icon name="x" size={26} /></button>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
        <label className="block">
          <span className="text-sm text-[#64748b]">{cd('titleFieldLabel')}</span>
          <input className="mt-2 w-full rounded-2xl border border-[#dbe4f0] px-4 py-4 text-lg outline-none focus:border-[#222]" value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm text-[#64748b]">{cd('subtitleFieldLabel')}</span>
          <input className="mt-2 w-full rounded-2xl border border-[#dbe4f0] px-4 py-4 text-lg outline-none focus:border-[#222]" value={block.subtitle || ''} onChange={(event) => onChange({ ...block, subtitle: event.target.value })} />
        </label>

        <section>
          <div className="mb-4 text-sm uppercase tracking-[0.24em] text-[#8ea0bb]">{cd('dataSectionLabel')}</div>
          <div className="grid grid-cols-2 gap-4">
            <label className="col-span-2 block">
              <span className="text-sm text-[#64748b]">{cd('blockTypeLabel')}</span>
              <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none focus:border-[#222]" value={block.type} onChange={(event) => changeType(event.target.value as BlockType)}>
                {blockTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label} — {option.subtitle}</option>)}
              </select>
            </label>
            {block.type === 'metric' && (
              <label className="col-span-2 block">
                <span className="text-sm text-[#64748b]">{cd('whatToShowLabel')}</span>
                <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none focus:border-[#222]" value={block.metricKey || 'total'} onChange={(event) => onChange({ ...block, metricKey: event.target.value as MetricKey })}>
                  {metricOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            {usesDimension && (
              <label className="col-span-2 block">
                <span className="text-sm text-[#64748b]">{cd('whatToShowLabel')}</span>
                <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none focus:border-[#222]" value={block.dimensionKey || 'field:status'} onChange={(event) => onChange({ ...block, dimensionKey: event.target.value })}>
                  {dimensions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            )}
            {usesValueMode && (
              <>
                <label className="block">
                  <span className="text-sm text-[#64748b]">{cd('valueMetricLabel')}</span>
                  <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none focus:border-[#222]" value={block.valueMode || 'count'} onChange={(event) => {
                    const valueMode = event.target.value as ValueMode;
                    onChange({ ...block, valueMode, valueField: valueMode === 'sum' ? block.valueField || valueFieldOptions[0]?.id || 'amount' : block.valueField });
                  }}>
                    <option value="count">{cd('countOption')}</option>
                    <option value="sum">{cd('sumOption')}</option>
                  </select>
                </label>
                {block.valueMode === 'sum' && (
                  <label className="block">
                    <span className="text-sm text-[#64748b]">{cd('sumFieldLabel')}</span>
                    <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none focus:border-[#222]" value={block.valueField || valueFieldOptions[0]?.id || 'amount'} onChange={(event) => onChange({ ...block, valueField: event.target.value })}>
                      {valueFieldOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
        </section>

        {block.type === 'formula' && (
          <section>
            <div className="mb-4 text-sm uppercase tracking-[0.24em] text-[#8ea0bb]">{cd('formulaSectionLabel')}</div>
            <div className="grid grid-cols-2 gap-4">
              <label className="col-span-2 block">
                <span className="text-sm text-[#64748b]">{cd('formulaLabel')}</span>
                <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.formulaFn || 'sumif'} onChange={(event) => onChange({ ...block, formulaFn: event.target.value as FormulaFn })}>
                  <option value="sumif">{t('crm.leadsAnalytics.configDrawer.formulaFnOptions.sumif')}</option>
                  <option value="count">{t('crm.leadsAnalytics.configDrawer.formulaFnOptions.count')}</option>
                  <option value="percent">{t('crm.leadsAnalytics.configDrawer.formulaFnOptions.percent')}</option>
                  <option value="ratio">{t('crm.leadsAnalytics.configDrawer.formulaFnOptions.ratio')}</option>
                  <option value="diff">{t('crm.leadsAnalytics.configDrawer.formulaFnOptions.diff')}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#64748b]">{cd('formatLabel')}</span>
                <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.formulaMode || 'count'} onChange={(event) => {
                  const formulaMode = event.target.value as FormulaMode;
                  onChange({
                    ...block,
                    formulaMode,
                    valueMode: formulaMode === 'sum' ? 'sum' : 'count',
                    valueField: formulaMode === 'sum' ? block.valueField || valueFieldOptions[0]?.id || 'amount' : block.valueField,
                  });
                }}>
                  <option value="count">{t('crm.leadsAnalytics.configDrawer.formulaModeOptions.count')}</option>
                  <option value="percent">{t('crm.leadsAnalytics.configDrawer.formulaModeOptions.percent')}</option>
                  <option value="sum">{t('crm.leadsAnalytics.configDrawer.formulaModeOptions.sum')}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#64748b]">{cd('displayLabel')}</span>
                <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.formulaDisplay || 'metric'} onChange={(event) => onChange({ ...block, formulaDisplay: event.target.value as FormulaDisplay })}>
                  <option value="metric">{t('crm.leadsAnalytics.configDrawer.displayOptions.metric')}</option>
                  <option value="donut">{t('crm.leadsAnalytics.configDrawer.displayOptions.donut')}</option>
                  <option value="bar">{t('crm.leadsAnalytics.configDrawer.displayOptions.bar')}</option>
                  <option value="table">{t('crm.leadsAnalytics.configDrawer.displayOptions.table')}</option>
                </select>
              </label>
              {(block.formulaMode === 'sum' || block.valueMode === 'sum') && (
                <label className="col-span-2 block">
                  <span className="text-sm text-[#64748b]">{cd('sumFieldLabel')}</span>
                  <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.valueField || valueFieldOptions[0]?.id || 'amount'} onChange={(event) => onChange({ ...block, valueField: event.target.value })}>
                    {valueFieldOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              )}
              {(block.formulaDisplay || 'metric') !== 'metric' && (
                <label className="col-span-2 block">
                  <span className="text-sm text-[#64748b]">{cd('whatToShowLabel')}</span>
                  <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.dimensionKey || 'field:status'} onChange={(event) => onChange({ ...block, dimensionKey: event.target.value })}>
                    {dimensions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              )}
              {(block.formulaFn === 'ratio' || block.formulaFn === 'diff') && (
                <>
                  <label className="block">
                    <span className="text-sm text-[#64748b]">{cd('leftValueLabel')}</span>
                    <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.formulaLeftType || 'total'} onChange={(event) => onChange({ ...block, formulaLeftType: event.target.value, formulaLeftKey: '' })}>
                      {formulaOperandOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    {Boolean(valueOptionsByScope[block.formulaLeftType || '']?.length) && (
                      <select className="mt-2 w-full rounded-xl border border-[#dbe4f0] bg-white px-3 py-3 text-sm text-[#222] outline-none" value={block.formulaLeftKey || ''} onChange={(event) => onChange({ ...block, formulaLeftKey: event.target.value })}>
                        <option value="">{cd('allValuesOption')}</option>
                        {(valueOptionsByScope[block.formulaLeftType || ''] || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    )}
                  </label>
                  <label className="block">
                    <span className="text-sm text-[#64748b]">{cd('rightValueLabel')}</span>
                    <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-[#f3f6fa] px-4 py-4 text-lg text-[#222] outline-none" value={block.formulaRightType || 'total'} onChange={(event) => onChange({ ...block, formulaRightType: event.target.value, formulaRightKey: '' })}>
                      {formulaOperandOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    {Boolean(valueOptionsByScope[block.formulaRightType || '']?.length) && (
                      <select className="mt-2 w-full rounded-xl border border-[#dbe4f0] bg-white px-3 py-3 text-sm text-[#222] outline-none" value={block.formulaRightKey || ''} onChange={(event) => onChange({ ...block, formulaRightKey: event.target.value })}>
                        <option value="">{cd('allValuesOption')}</option>
                        {(valueOptionsByScope[block.formulaRightType || ''] || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    )}
                  </label>
                </>
              )}
            </div>
          </section>
        )}

        {block.type === 'table' && (
          <section>
            <div className="mb-4 text-sm uppercase tracking-[0.24em] text-[#8ea0bb]">{cd('tableColumnsLabel')}</div>
            <div className="space-y-3 rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] p-4">
              <select className="w-full rounded-2xl border border-[#dbe4f0] bg-white px-4 py-3 text-base text-[#222] outline-none" value="" onChange={(event) => {
                const key = event.target.value;
                if (!key) return;
                onChange({ ...block, tableColumns: [...selectedTableColumns, key] });
              }}>
                <option value="">{cd('addColumnOption')}</option>
                {fields
                  .filter((field) => field.key !== (block.dimensionKey || 'field:manager').replace('field:', '') && !selectedTableColumns.includes(field.key))
                  .map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
              </select>
              <div className="space-y-2">
                {selectedTableColumns.map((key) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm">
                    <span className="truncate text-[#34435a]">{fieldLabel(fields, key)}</span>
                    <button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-2.5 py-1 text-[11px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors" onClick={() => onChange({ ...block, tableColumns: selectedTableColumns.filter((item) => item !== key) })}>{cd('removeBtn')}</button>
                  </div>
                ))}
                {!selectedTableColumns.length && <div className="text-sm text-[#8ea0bb]">{cd('noColumnsText')}</div>}
              </div>
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] p-4">
            <div className="text-sm uppercase tracking-[0.24em] text-[#8ea0bb]">{cd('conditionsTitle')}</div>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">{cd('conditionsDesc')}</p>
          </div>
          <div className="space-y-3">
            {(block.filters || []).map((filter, index) => (
              <div key={filter.id} className="rounded-2xl border border-[#dbe4f0] bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm uppercase tracking-[0.2em] text-[#8ea0bb]">{t('crm.leadsAnalytics.configDrawer.conditionLabel', { n: index + 1 })}</span>
                  <button type="button" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#f0c8cf] bg-white px-2.5 py-1 text-[12px] font-medium text-[#9a1f31] hover:bg-[#fbecef] hover:border-[#e8b4bb] transition-colors" onClick={() => updateFilters((block.filters || []).filter((item) => item.id !== filter.id))}>{cd('removeBtn')}</button>
                </div>
                <label className="block">
                  <span className="text-sm text-[#64748b]">{cd('conditionScopeLabel')}</span>
                  <select className="mt-2 w-full rounded-2xl border border-[#dbe4f0] bg-white px-4 py-4 text-lg text-[#222] outline-none" value={filter.scope} onChange={(event) => updateFilter(filter.id, { scope: event.target.value, keys: [] })}>
                    {dimensions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
                <div className="mt-3">
                  <FilterKeysPicker options={valueOptionsByScope[filter.scope] || []} keys={filter.keys || []} onChange={(keys) => updateFilter(filter.id, { keys })} />
                </div>
              </div>
            ))}
            <button type="button" className="w-full rounded-2xl border border-dashed border-[#b8c7dc] px-4 py-4 text-base text-[#64748b] hover:border-[#222] hover:text-[#222]" onClick={addFilter}>
              {cd('addConditionBtn')}
            </button>
          </div>
        </section>

        <section>
          <div className="mb-4 text-sm text-[#64748b]">{cd('colorThemeLabel')}</div>
          <div className="flex flex-wrap gap-3">
            {THEME_PALETTE.map((color) => (
              <button key={color} type="button" className={cx('flex h-11 w-11 items-center justify-center rounded-full border-2 transition hover:scale-105', (block.color || '#222222') === color ? 'border-[#d7dee9] bg-white shadow-[0_0_0_4px_rgba(15,23,42,0.08)]' : 'border-[#dbe4f0] bg-white')} onClick={() => onChange({ ...block, color })} aria-label={t('crm.leadsAnalytics.configDrawer.colorAriaLabel', { color })}>
                <span className="h-7 w-7 rounded-full" style={{ backgroundColor: color }} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <label className="flex items-center justify-between rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-4">
            <span className="text-base text-[#34435a]">{cd('showLabelsLabel')}</span>
            <button
              type="button"
              className={cx('flex h-8 w-14 items-center rounded-full p-1 transition', block.showLabels === false ? 'bg-[#dbe4f0]' : 'bg-[#10b981]')}
              onClick={(event) => {
                event.preventDefault();
                onChange({ ...block, showLabels: block.showLabels === false });
              }}
              aria-pressed={block.showLabels !== false}
            >
              <span className={cx('h-6 w-6 rounded-full bg-white shadow transition', block.showLabels === false ? 'translate-x-0' : 'translate-x-6')} />
            </button>
          </label>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-neutral-400"><span>{cd('sizeSectionLabel')}</span><span className="h-px flex-1 bg-neutral-100" /></div>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-neutral-500">{cd('columnsLabel')}</span>
              <div className="mt-2 flex gap-1 rounded-lg bg-neutral-100 p-1">
                {[3, 4, 6, 8, 12].map((span) => <button key={span} type="button" className={cx('flex-1 rounded-md px-2 py-1.5 text-xs', block.span === span ? 'bg-white font-semibold text-[#222] shadow-sm' : 'text-neutral-500')} onClick={() => onChange({ ...block, span })}>{span}</button>)}
              </div>
            </div>
            <div>
              <span className="text-xs text-neutral-500">{cd('heightLabel')}</span>
              <div className="mt-2 flex gap-1 rounded-lg bg-neutral-100 p-1">
                {[160, 240, 320, 400, 480, 560].map((h) => <button key={h} type="button" className={cx('flex-1 rounded-md px-1 py-1.5 text-xs', Math.abs(block.height - h) < 20 ? 'bg-white font-semibold text-[#222] shadow-sm' : 'text-neutral-500')} onClick={() => onChange({ ...block, height: h })}>{h}</button>)}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input type="range" min={MIN_BLOCK_H} max={MAX_BLOCK_H} step={8} value={block.height} className="flex-1 accent-[#222]" onChange={(e) => onChange({ ...block, height: Number(e.target.value) })} />
                <span className="w-14 text-right font-mono text-xs text-[#222]">{block.height}px</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className="flex justify-between gap-2 border-t border-neutral-200 px-6 py-4">
        <button type="button" className="btn-secondary" onClick={onAddHome}>{cd('addHomeBtn')}</button>
        <div className="flex gap-2">
          <button type="button" className="btn-danger" onClick={onDelete}>{cd('deleteBtn')}</button>
          <button type="button" className="btn-primary" onClick={onClose}>{cd('doneBtn')}</button>
        </div>
      </footer>
    </aside>
  );
}

function BlockShell({
  block,
  editing,
  selected,
  children,
  onSelect,
  onConfig,
  onAddHome,
  onDuplicate,
  onDelete,
  onMoveStart,
  onResizeStart,
}: {
  block: AnalyticsBlock;
  editing: boolean;
  selected: boolean;
  children: React.ReactNode;
  onSelect: () => void;
  onConfig: () => void;
  onAddHome: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveStart: (event: React.MouseEvent) => void;
  onResizeStart: (event: React.MouseEvent, mode: 'br' | 'r' | 'b') => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-[18px] border bg-white p-4 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition',
        block._dragging
          ? 'border-2 border-dashed border-blue-400 bg-blue-50/60 opacity-60 shadow-none'
          : selected ? 'border-[#222] ring-1 ring-[#222]' : 'border-neutral-200 hover:border-neutral-300',
        editing && !block._dragging && 'pt-7',
        block._dragging && 'pt-4',
      )}
      style={{ height: block.height, minHeight: MIN_BLOCK_H }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {editing && (
        <button type="button" className="absolute left-0 right-0 top-0 flex h-6 cursor-grab items-center justify-center rounded-t-[18px] bg-gradient-to-b from-neutral-100 to-transparent text-neutral-400 active:cursor-grabbing" onMouseDown={onMoveStart} aria-label={t('crm.leadsAnalytics.blockShell.dragAria')}>
          <Icon name="drag" size={13} />
        </button>
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#222]">{block.title}</div>
          {block.subtitle && <div className="mt-1 truncate text-[10px] uppercase tracking-[0.16em] text-neutral-400">{block.subtitle}</div>}
        </div>
        <div className={cx('flex shrink-0 items-center gap-1 text-neutral-400 transition-opacity', editing || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn-icon" onClick={onConfig} title={t('crm.leadsAnalytics.blockShell.configureTitle')}><Icon name="settings" size={13} /></button>
          <button type="button" className="btn-ghost px-2 py-1 text-[10px] font-semibold text-[#222]" onClick={onAddHome} title={t('crm.leadsAnalytics.blockShell.addHomeTitle')}>{t('crm.leadsAnalytics.blockShell.addHomeLabel')}</button>
          <button type="button" className="btn-icon" onClick={onDuplicate} title={t('crm.leadsAnalytics.blockShell.duplicateTitle')}><Icon name="copy" size={13} /></button>
          <button type="button" className="btn-icon-danger" onClick={onDelete} title={t('crm.leadsAnalytics.blockShell.deleteTitle')}><Icon name="trash" size={13} /></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {editing && (
        <>
          {/* right edge */}
          <div className="absolute -right-1.5 top-6 bottom-6 flex w-3 cursor-ew-resize items-center justify-center" onMouseDown={(event) => onResizeStart(event, 'r')} aria-label={t('crm.leadsAnalytics.blockShell.widthAria')}>
            <div className="h-10 w-1.5 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
          </div>
          {/* bottom edge */}
          <div className="absolute -bottom-1.5 left-6 right-6 flex h-3 cursor-ns-resize items-center justify-center" onMouseDown={(event) => onResizeStart(event, 'b')} aria-label={t('crm.leadsAnalytics.blockShell.heightAria')}>
            <div className="h-1.5 w-10 rounded-full bg-neutral-300 opacity-0 transition group-hover:opacity-100" />
          </div>
          {/* bottom-right corner */}
          <button type="button" className="absolute bottom-0 right-0 flex h-7 w-7 cursor-nwse-resize items-end justify-end p-1 text-neutral-300 hover:text-[#222]" onMouseDown={(event) => onResizeStart(event, 'br')} aria-label={t('crm.leadsAnalytics.blockShell.resizeAria')}>
            <Icon name="resize" size={14} />
          </button>
        </>
      )}
    </section>
  );
}

function RenderBlock({
  block,
  items,
  trendItems,
  baseItems,
  fields,
  period,
  reportCurrency,
}: {
  block: AnalyticsBlock;
  items: LeadAnalyticsItem[];
  trendItems: LeadAnalyticsItem[];
  baseItems: LeadAnalyticsItem[];
  fields: FieldMeta[];
  period: PeriodId;
  reportCurrency: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const millionAbbr = t('crm.leadsAnalytics.compact.million');
  const thousandAbbr = t('crm.leadsAnalytics.compact.thousand');
  const n = (v: number) => compactNumber(v, locale);
  const money = (v: number, cur = reportCurrency) => compactMoney(v, cur, locale, millionAbbr, thousandAbbr);
  const rb = (key: string, opts?: Record<string, unknown>): string => t(`crm.leadsAnalytics.renderBlock.${key}`, opts as any) as string;

  const color = block.color || '#222222';
  const currency = reportCurrency;
  const chartHeight = Math.max(150, block.height - 90);
  const won = items.filter((item) => item.status === 'Закрыт (успех)');
  const lost = items.filter((item) => item.status === 'Закрыт (проигран)');
  const revenue = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const conversion = items.length ? (won.length / items.length) * 100 : 0;
  const prevItems = trendItems.filter((item) => inRange(item.createdAt, previousRange(period)));
  const trend = buildTrend(trendItems, period, block.valueMode || 'count', block.valueField, locale);

  const metricSpark = (() => {
    const key = block.metricKey || 'total';
    const range = periodRange(period);
    const validTimes = trendItems.map((i) => new Date(i.createdAt).getTime()).filter(Number.isFinite);
    const from = range.from || new Date(validTimes.length ? Math.min(...validTimes) : Date.now());
    const to = range.to;
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
    const pts = Math.max(2, Math.min(days, 12));
    const bs = Math.max(1, Math.ceil(days / pts));
    return Array.from({ length: pts }, (_, idx) => {
      const s = new Date(from); s.setDate(from.getDate() + idx * bs);
      const e = new Date(s); e.setDate(s.getDate() + bs);
      const bkt = trendItems.filter((i) => { const d = new Date(i.createdAt); return d >= s && d < e; });
      if (!bkt.length) return 0;
      if (key === 'total') return bkt.length;
      if (key === 'conversion') return (bkt.filter((i) => i.status === 'Закрыт (успех)').length / bkt.length) * 100;
      if (key === 'revenue') return bkt.reduce((acc, i) => acc + i.amount, 0);
      if (key === 'avgRevenue') return bkt.reduce((acc, i) => acc + i.amount, 0) / bkt.length;
      if (key === 'won') return bkt.filter((i) => i.status === 'Закрыт (успех)').length;
      if (key === 'lost') return bkt.filter((i) => i.status === 'Закрыт (проигран)').length;
      if (key === 'response') {
        const rfs = ['responseMinutes', 'firstResponseMinutes', 'reactionMinutes', 'responseTime'];
        const vals = bkt.flatMap((i) => rfs.map((f) => parseNumericLoose(i.customFields[f])).filter((v): v is number => v !== null));
        return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
      }
      if (key.startsWith('sum:')) return bkt.reduce((acc, i) => acc + getNumericValue(i, key.slice(4)), 0);
      if (key.startsWith('avg:')) {
        const vals = bkt.map((i) => getNumericValue(i, key.slice(4))).filter((v) => v !== 0);
        return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : 0;
      }
      if (key.startsWith('filled:')) return bkt.filter((i) => isFilled(getFieldValue(i, key.slice(7)))).length;
      return bkt.length;
    });
  })();

  const spark = block.type === 'metric' ? metricSpark : trend.map((point) => point.value);

  const metricValue = () => {
    const key = block.metricKey || 'total';
    const signedPct = (curr: number, prev: number) => {
      if (!prev) return { text: '—', dir: 0 as -1 | 0 | 1 };
      const d = Math.round(((curr - prev) / prev) * 1000) / 10;
      return { text: rb('vsPreviousPeriod', { pct: `${d > 0 ? '+' : ''}${d}` }), dir: (d > 0 ? 1 : d < 0 ? -1 : 0) as -1 | 0 | 1 };
    };
    if (key === 'total') {
      const { text, dir } = signedPct(items.length, prevItems.length);
      return { primary: n(items.length), suffix: rb('leadsSuffix'), delta: text, dir };
    }
    if (key === 'conversion') {
      const prevWon = prevItems.filter((i) => i.status === 'Закрыт (успех)').length;
      const prevConv = prevItems.length ? (prevWon / prevItems.length) * 100 : 0;
      const diff = Math.round((conversion - prevConv) * 10) / 10;
      const diffText = prevItems.length ? rb('diffConversionSuffix', { diff: `${diff > 0 ? '+' : ''}${diff}` }) : rb('wonOfTotal', { won: won.length, total: items.length });
      return { primary: conversion.toFixed(1), suffix: '%', delta: diffText, dir: (diff > 0 ? 1 : diff < 0 ? -1 : 0) as -1 | 0 | 1 };
    }
    if (key === 'revenue') {
      const prevRevenue = prevItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      const { text, dir } = signedPct(revenue, prevRevenue);
      return { primary: money(revenue), suffix: '', delta: prevItems.length ? rb('revenueFromWonSuffix', { pct: text }) : rb('wonLeadsCount', { count: won.length }), dir };
    }
    if (key === 'avgRevenue') {
      const avg = items.length ? revenue / items.length : 0;
      const prevAvg = prevItems.length ? prevItems.reduce((s, i) => s + i.amount, 0) / prevItems.length : 0;
      const { text, dir } = signedPct(avg, prevAvg);
      return { primary: money(avg), suffix: '', delta: prevItems.length ? text : rb('avgRevenuePerLead'), dir };
    }
    if (key === 'won') {
      const { text, dir } = signedPct(won.length, prevItems.filter((i) => i.status === 'Закрыт (успех)').length);
      return { primary: n(won.length), suffix: rb('wonSuffix'), delta: prevItems.length ? text : rb('percentOfLeadsSuffix', { pct: percent(won.length, items.length) }), dir };
    }
    if (key === 'lost') {
      const { text, dir } = signedPct(lost.length, prevItems.filter((i) => i.status === 'Закрыт (проигран)').length);
      return { primary: n(lost.length), suffix: rb('lostSuffix'), delta: prevItems.length ? text : rb('percentOfLeadsSuffix', { pct: percent(lost.length, items.length) }), dir };
    }
    if (key === 'response') {
      const responseFields = ['responseMinutes', 'firstResponseMinutes', 'reactionMinutes', 'responseTime'];
      const values = items.flatMap((item) => responseFields.map((field) => parseNumericLoose(item.customFields[field])).filter((value): value is number => value !== null));
      if (!values.length) return { primary: '—', suffix: '', delta: rb('noResponseField'), dir: 0 as -1 | 0 | 1 };
      const avg = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      const prevVals = prevItems.flatMap((item) => responseFields.map((field) => parseNumericLoose(item.customFields[field])).filter((v): v is number => v !== null));
      const prevAvg = prevVals.length ? Math.round(prevVals.reduce((s, v) => s + v, 0) / prevVals.length) : 0;
      const { text, dir } = signedPct(avg, prevAvg);
      return { primary: `${avg}`, suffix: rb('minSuffix'), delta: prevVals.length ? rb('avgResponseTimeSuffix', { pct: text }) : rb('avgResponseTime'), dir };
    }
    if (key.startsWith('sum:')) {
      const field = key.slice(4);
      const value = items.reduce((sum, item) => sum + getNumericValue(item, field), 0);
      const prevValue = prevItems.reduce((sum, item) => sum + getNumericValue(item, field), 0);
      const { text, dir } = signedPct(value, prevValue);
      return { primary: n(value), suffix: '', delta: prevItems.length ? text : rb('sumOfField', { field }), dir };
    }
    if (key.startsWith('avg:')) {
      const field = key.slice(4);
      const values = items.map((item) => getNumericValue(item, field)).filter((value) => value !== 0);
      const value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
      return { primary: n(value), suffix: '', delta: rb('avgOfField', { field }), dir: 0 as -1 | 0 | 1 };
    }
    if (key.startsWith('filled:')) {
      const field = key.slice(7);
      const cnt = items.filter((item) => isFilled(getFieldValue(item, field))).length;
      const { text, dir } = signedPct(cnt, prevItems.filter((item) => isFilled(getFieldValue(item, field))).length);
      return { primary: n(cnt), suffix: '', delta: prevItems.length ? text : rb('filledOfField', { field }), dir };
    }
    return { primary: '—', suffix: '', delta: '', dir: 0 as -1 | 0 | 1 };
  };

  if (block.type === 'metric') {
    const metric = metricValue();
    const up = metric.dir === 1;
    const down = metric.dir === -1;
    const deltaColor = up ? 'text-emerald-600' : down ? 'text-rose-500' : 'text-neutral-400';
    return (
      <div className="flex h-full items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col justify-end gap-1">
          <div className="flex flex-wrap items-baseline gap-2 leading-none">
            <span className="text-[2.5rem] font-semibold tracking-[-0.04em] text-[#222]">{metric.primary}</span>
            {metric.suffix && <span className="text-[1.1rem] font-medium text-neutral-400">{metric.suffix}</span>}
          </div>
          {metric.delta && (
            <div className={cx('flex items-center gap-1 text-[11px] font-medium', deltaColor)}>
              {up && <span className="text-[10px]">▲</span>}
              {down && <span className="text-[10px]">▼</span>}
              <span className="line-clamp-2">{metric.delta}</span>
            </div>
          )}
        </div>
        <div className="w-20 shrink-0">
          <MiniSparkline data={spark.length ? spark : [0, 0, 0]} color={color} />
        </div>
      </div>
    );
  }

  if (block.type === 'formula') {
    const formula = evaluateFormula(block, items, baseItems, t, locale);
    const display = block.formulaDisplay || 'metric';
    const valueLabel = formula.suffix === '%' ? `${formula.value}${formula.suffix}` : n(formula.value);

    if (display === 'metric') {
      return (
        <div className="flex h-full items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col justify-end gap-1">
            <div className="flex flex-wrap items-baseline gap-2 leading-none">
              <span className="text-[2.5rem] font-semibold tracking-[-0.04em] text-[#222]">{valueLabel}</span>
            </div>
            <div className="line-clamp-2 text-[11px] font-medium text-neutral-400">{formula.detail}</div>
          </div>
          <div className="w-20 shrink-0">
            <MiniSparkline data={spark.length ? spark : [0, 0, 0]} color={color} />
          </div>
        </div>
      );
    }

    if (display === 'donut') {
      const data = buildSeries(items, block.dimensionKey || 'field:status', block.formulaMode === 'sum' ? 'sum' : 'count', block.valueField).slice(0, 8);
      const total = data.reduce((sum, row) => sum + row.value, 0);
      return (
        <div className={cx('grid h-full items-center gap-4', block.showLabels === false ? 'grid-cols-1' : 'grid-cols-[minmax(140px,0.9fr)_1.1fr]')} style={{ minHeight: chartHeight }}>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="label" innerRadius={54} outerRadius={76} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {data.map((entry, index) => <Cell key={entry.code} fill={entry.color || PALETTE[index % PALETTE.length]} />)}
                </Pie>
                <Tooltip wrapperStyle={{ zIndex: 20 }} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold">{n(total)}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{rb('allLabel')}</span>
            </div>
          </div>
          {block.showLabels !== false && (
            <div className="space-y-2">
              {data.map((entry, index) => (
                <div key={entry.code} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color || PALETTE[index % PALETTE.length] }} />
                  <span className="truncate text-neutral-600">{entry.label}</span>
                  <span className="font-mono text-[#222]">{n(entry.value)} <span className="text-neutral-400">· {percent(entry.value, total)}%</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (display === 'bar') {
      const data = buildSeries(items, block.dimensionKey || 'field:status', block.formulaMode === 'sum' ? 'sum' : 'count', block.valueField).slice(0, 12);
      return (
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => <Cell key={entry.code} fill={entry.color || PALETTE[index % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    const data = buildGroupedSeries(items, block.dimensionKey || 'field:status', block.formulaMode === 'sum' ? 'sum' : 'count', block.valueField).slice(0, 30);
    const total = data.reduce((sum, row) => sum + row.value, 0);
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-[0.16em] text-neutral-400">
            <tr>
              <th className="border-b border-neutral-200 py-2 font-medium">{rb('valueColumnLabel')}</th>
              <th className="border-b border-neutral-200 py-2 text-right font-medium">{block.formulaMode === 'sum' ? t('crm.leadsAnalytics.configDrawer.sumOption') : rb('countColumnHeader')}</th>
              <th className="border-b border-neutral-200 py-2 text-right font-medium">{rb('shareColumnLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.code} className="border-b border-neutral-100 last:border-b-0">
                <td className="py-2.5 font-medium text-[#222]">{row.label}</td>
                <td className="py-2.5 text-right font-mono">{n(row.value)}</td>
                <td className="py-2.5 text-right font-mono">{percent(row.value, total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'line') {
    const hasPrev = trend.some((p) => p.previous > 0);
    const areaId = `area-${block.id}`;
    return (
      <div className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-4 px-1">
          <span className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className="inline-block h-0.5 w-5 rounded-full" style={{ backgroundColor: color }} />
            {rb('currentPeriodLabel')}
          </span>
          {hasPrev && (
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <svg width="20" height="4" viewBox="0 0 20 4"><line x1="0" y1="2" x2="20" y2="2" stroke="#3b6cb6" strokeWidth="2" strokeDasharray="6 4" /></svg>
              {rb('previousPeriodLabel')}
            </span>
          )}
        </div>
        <div style={{ height: Math.max(120, chartHeight - 28) }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9a9a9a', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} domain={[0, (max: number) => Math.max(1, Number(max) || 0)]} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12 }}
                formatter={(value: number, name: string) => [value, name === 'value' ? rb('tooltipCurrentName') : rb('tooltipPreviousName')]}
              />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${areaId})`} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: color }} connectNulls isAnimationActive={false} />
              {hasPrev && <Line type="monotone" dataKey="previous" stroke="#3b6cb6" strokeWidth={1.5} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (block.type === 'bar') {
    const data = buildSeries(items, block.dimensionKey || 'field:source', block.valueMode || 'count', block.valueField).slice(0, 12);
    const barColor = (code: string) => STATUS_COLORS[code] ?? color;
    return (
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b5b5b5', fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry) => <Cell key={entry.code} fill={barColor(entry.code)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (block.type === 'donut') {
    const data = buildSeries(items, block.dimensionKey || 'field:status', block.valueMode || 'count', block.valueField).slice(0, 8);
    const total = data.reduce((sum, row) => sum + row.value, 0);
    const donutPalette = [color, ...THEME_PALETTE.filter((c) => c !== color)];
    const sliceColor = (code: string, idx: number) => STATUS_COLORS[code] ?? donutPalette[idx % donutPalette.length];
    return (
      <div className={cx('grid h-full min-h-[220px] items-center gap-4', block.showLabels === false ? 'grid-cols-1' : 'grid-cols-[minmax(140px,0.9fr)_1.1fr]')}>
        <div className="relative h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={54} outerRadius={76} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                {data.map((entry, index) => <Cell key={entry.code} fill={sliceColor(entry.code, index)} />)}
              </Pie>
              <Tooltip wrapperStyle={{ zIndex: 20 }} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold">{n(total)}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{rb('allLabel')}</span>
          </div>
        </div>
        {block.showLabels !== false && (
          <div className="space-y-2">
            {data.map((entry, index) => (
              <div key={entry.code} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: sliceColor(entry.code, index) }} />
                <span className="truncate text-neutral-600">{entry.label}</span>
                <span className="font-mono text-[#222]">{n(entry.value)} <span className="text-neutral-400">· {percent(entry.value, total)}%</span></span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'funnel') {
    const data = buildSeries(items, block.dimensionKey || 'field:status', block.valueMode || 'count', block.valueField);
    const ordered = [
      ...STATUS_ORDER.map((status) => data.find((row) => row.code === status)).filter((row): row is NonNullable<typeof row> => Boolean(row)),
      ...data.filter((row) => !STATUS_ORDER.includes(row.code)),
    ];
    const max = Math.max(1, ordered[0]?.value || items.length);
    const funnelColor = (code: string) => STATUS_COLORS[code] ?? color;
    return (
      <div className="flex h-full flex-col justify-center">
        {ordered.map((item, index) => (
          <div key={item.code} className="grid grid-cols-[130px_1fr_64px] items-center gap-3 border-b border-neutral-100 py-2 text-xs last:border-b-0">
            <span className="truncate font-medium text-[#222]">{item.label}</span>
            <span className="h-7 overflow-hidden rounded-md bg-neutral-100">
              <span className="flex h-full items-center rounded-md px-3 font-mono text-[11px] font-medium text-white" style={{ width: `${Math.max(8, percent(item.value, max))}%`, backgroundColor: funnelColor(item.code) }}>{n(item.value)}</span>
            </span>
            <span className="text-right font-mono text-neutral-500">{index === 0 ? '100%' : `${percent(item.value, max)}%`}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'leaderboard') {
    const dimensionKey = block.dimensionKey || 'field:manager';
    const grouped = buildSeries(items, dimensionKey, block.valueMode || 'count', block.valueField).slice(0, 8);
    const max = Math.max(1, ...grouped.map((row) => row.value));
    return (
      <div className="flex h-full flex-col justify-center">
        {grouped.map((row, index) => {
          const managerItems = items.filter((item) => {
            const raw = getFieldValue(item, dimensionKey);
            const values = Array.isArray(raw) ? raw.map(String) : splitMulti(raw);
            return values.includes(row.code);
          });
          const managerWon = managerItems.filter((item) => item.status === 'Закрыт (успех)').length;
          const managerRevenue = managerItems.reduce((sum, item) => sum + item.amount, 0);
          return (
            <div key={row.code} className="grid grid-cols-[26px_1fr_100px_72px] items-center gap-3 border-b border-neutral-100 py-2 text-xs last:border-b-0">
              <span className="font-mono text-neutral-400">#{index + 1}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>{row.label.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                <span className="truncate font-medium text-[#222]">{row.label}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full" style={{ width: `${percent(row.value, max)}%`, backgroundColor: color }} /></span>
              <span className="text-right font-mono text-[#222]">{row.value}<span className="text-neutral-400"> · {managerWon}</span><span className="block text-[10px] text-neutral-400">{money(managerRevenue, currency)}</span></span>
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === 'table') {
    const data = buildGroupedSeries(items, block.dimensionKey || 'field:manager', block.valueMode || 'count', block.valueField).slice(0, 30);
    const total = data.reduce((sum, row) => sum + row.value, 0);
    const valueTitle = block.valueMode === 'sum' ? rb('sumColumnHeaderWithCurrency', { currency: reportCurrency }) : rb('leadsCountLabel');
    const extraColumns = (block.tableColumns || [])
      .map((key) => fields.find((field) => field.key === key))
      .filter((field): field is FieldMeta => Boolean(field));
    return (
      <div className="h-full overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-[0.16em] text-neutral-400">
            <tr>
              <th className="border-b border-neutral-200 py-2 font-medium">{rb('valueColumnLabel')}</th>
              {extraColumns.map((field) => (
                <th key={field.key} className="border-b border-neutral-200 px-3 py-2 text-left font-medium">{field.label}</th>
              ))}
              <th className="border-b border-neutral-200 py-2 text-right font-medium">{valueTitle}</th>
              <th className="border-b border-neutral-200 py-2 text-right font-medium">{rb('shareColumnLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.code} className="border-b border-neutral-100 last:border-b-0">
                <td className="py-2.5 font-medium text-[#222]">{row.label}</td>
                {extraColumns.map((field) => (
                  <td key={field.key} className="max-w-[180px] truncate px-3 py-2.5 text-neutral-600" title={formatTableExtraValue(row.items, field, locale)}>{formatTableExtraValue(row.items, field, locale)}</td>
                ))}
                <td className="py-2.5 text-right font-mono">{n(row.value)}</td>
                <td className="py-2.5 text-right font-mono">{percent(row.value, total)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'heatmap') {
    const heatmap = buildHeatmap(items);
    const max = Math.max(1, ...heatmap.flatMap((row) => row.hours.map((hour) => hour.value)));
    return (
      <div className="flex h-full flex-col justify-center gap-2">
        <div className="grid grid-cols-[32px_repeat(8,1fr)] gap-1">
          <span />
          {heatmap[0]?.hours.map((hour) => <span key={hour.hour} className="text-center font-mono text-[10px] text-neutral-400">{hour.hour}</span>)}
          {heatmap.map((row) => {
            const dayLabel = t(`crm.leadsAnalytics.heatmapDays.${row.dayKey}`);
            return (
              <React.Fragment key={row.dayKey}>
                <span className="pr-1 text-right font-mono text-[10px] text-neutral-400">{dayLabel}</span>
                {row.hours.map((hour) => {
                  const lightness = 96 - Math.min(1, hour.value / max) * 68;
                  return <span key={`${row.dayKey}-${hour.hour}`} className="aspect-square rounded hover:scale-110 hover:ring-1 hover:ring-[#222]" title={rb('heatmapTooltip', { day: dayLabel, hour: hour.hour, value: hour.value })} style={{ background: `hsl(0 0% ${lightness}%)` }} />;
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  const bestSource = buildSeries(items, 'field:source')[0];
  return (
    <div className="text-sm leading-6 text-neutral-600">
      {t('crm.leadsAnalytics.renderBlock.insightSentence', {
        leadsCount: n(items.length),
        source: bestSource?.label || rb('noDataFallback'),
        pct: conversion.toFixed(1),
      })}
    </div>
  );
}

function exportCsv(items: LeadAnalyticsItem[], period: PeriodId, t: TFunction) {
  const headers = [
    t('crm.leadsAnalytics.csvHeaders.name'), t('crm.leadsAnalytics.csvHeaders.status'), t('crm.leadsAnalytics.csvHeaders.source'),
    t('crm.leadsAnalytics.csvHeaders.channel'), t('crm.leadsAnalytics.csvHeaders.manager'), t('crm.leadsAnalytics.csvHeaders.country'),
    t('crm.leadsAnalytics.csvHeaders.amount'), t('crm.leadsAnalytics.csvHeaders.currency'), t('crm.leadsAnalytics.csvHeaders.sourceCurrencies'),
    t('crm.leadsAnalytics.csvHeaders.deals'), t('crm.leadsAnalytics.csvHeaders.createdAt'),
  ];
  const rows = items.map((item) => [
    item.name,
    item.status,
    item.source,
    item.channel,
    item.manager,
    item.country,
    item.amount.toString(),
    item.reportCurrency,
    item.sourceCurrencies.join(', '),
    item.dealsCount.toString(),
    item.createdAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const LeadsAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('tr') ? 'tr-TR' : i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
  const periodLabels = useMemo(() => getPeriodLabels(t), [t]);
  const views = useMemo(() => getViews(t), [t]);
  const [rawLeads, setRawLeads] = useState<Lead[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [revenueMap, setRevenueMap] = useState<Map<string, LeadRevenue>>(() => new Map());
  const [projectsByLeadId, setProjectsByLeadId] = useState<Map<string, Project[]>>(() => new Map());
  const [projectsRoiByLeadId, setProjectsRoiByLeadId] = useState<Map<string, number>>(() => new Map());
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodId>('30d');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [editing, setEditing] = useState(false);
  const [layouts, setLayouts] = useState<Record<ViewId, AnalyticsBlock[]>>(() => {
    if (typeof window === 'undefined') return defaultLayout(t);
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      const version = localStorage.getItem(LAYOUT_VERSION_KEY);
      if (raw && version === LAYOUT_VERSION) {
        const parsed = JSON.parse(raw) as Record<ViewId, AnalyticsBlock[]>;
        if (parsed?.overview) return parsed;
      }
    } catch {
      // ignore invalid layout
    }
    return defaultLayout(t);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [globalFilters, setGlobalFilters] = useState<FilterRow[]>([]);
  const [shareToast, setShareToast] = useState(false);
  const [drag, setDrag] = useState<{ id: string; fromIdx: number; toIdx: number } | null>(null);
  const [resize, setResize] = useState<{
    id: string;
    mode: 'br' | 'r' | 'b';
    startX: number;
    startY: number;
    startSpan: number;
    startHeight: number;
    colW: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const currenciesPresent = useMemo(
    () =>
      Array.from(
        new Set([
          ...Array.from(revenueMap.values()).flatMap((row) => row.sourceCurrencies),
          ...Array.from(projectsByLeadId.values()).flatMap((projects) =>
            projects.map((project) => project.currency || 'EUR'),
          ),
        ]),
      ),
    [revenueMap, projectsByLeadId],
  );
  const { state: currencyPrefs, setState: setCurrencyPrefs } =
    useMarketingDisplayCurrencyPrefs(currenciesPresent);
  const reportCurrency = reportCurrencyFromPrefs(currencyPrefs);

  useEffect(() => {
    if (currencyPrefs.currencyMode === 'converted') return;
    setCurrencyPrefs({
      ...currencyPrefs,
      currencyMode: 'converted',
      rates: reportRates(currencyPrefs),
    });
  }, [currencyPrefs, setCurrencyPrefs]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
	    Promise.all([
	      fetchLeads(),
	      fetchCustomFields('lead').catch(() => [] as CustomField[]),
	      fetchLeadRoi({
	        mode: 'sales',
	        currencyMode: 'converted',
	        displayCurrency: reportCurrency,
	        rates: reportRates(currencyPrefs),
	      }).catch(() => null),
	      fetchLeadRoi({
	        mode: 'projects',
	        currencyMode: 'converted',
	        displayCurrency: reportCurrency,
	        rates: reportRates(currencyPrefs),
	      }).catch(() => null),
	      fetchProjects().catch(() => ({ total: 0, items: [] as Project[] })),
	    ])
      .then(([leads, fields, salesRoi, projectsRoi, projectsRes]) => {
        if (!alive) return;
        setRawLeads((leads || []).filter((lead) => !isLeadOmittedFromAnalytics(lead)));
        setCustomFields(fields.filter((field) => field.entityType === 'lead'));
        setRevenueMap(buildRevenueMap([salesRoi, projectsRoi]));
        setProjectsByLeadId(buildProjectsByLeadId(projectsRes.items || []));
        const projRoiMap = new Map<string, number>();
        projectsRoi?.items?.forEach((row) => {
          projRoiMap.set(row.leadId, (projRoiMap.get(row.leadId) || 0) + (Number(row.totalRevenue) || 0));
        });
        setProjectsRoiByLeadId(projRoiMap);
      })
      .catch(() => {
        if (!alive) return;
        setRawLeads([]);
        setCustomFields([]);
        setRevenueMap(new Map());
        setProjectsByLeadId(new Map());
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
	  }, [reportCurrency, JSON.stringify(currencyPrefs.rates)]);

  const allItems = useMemo(
    () =>
      rawLeads.map((lead) => {
        const item = mapLeadToItem(lead, revenueMap, projectsByLeadId.get(lead.id) || [], currencyPrefs);
        // projectsRoi from the backend is already aggregated per-lead and currency-converted,
        // so it's more reliable than summing fetched project objects (which may be paginated or lack leadId)
        const roiProjectAmount = projectsRoiByLeadId.get(lead.id);
        if (roiProjectAmount !== undefined) {
          return {
            ...item,
            projectAmount: roiProjectAmount,
            customFields: { ...item.customFields, projectAmount: roiProjectAmount },
          };
        }
        return item;
      }),
    [rawLeads, revenueMap, projectsByLeadId, projectsRoiByLeadId, currencyPrefs],
  );
  const range = useMemo(() => periodRange(period), [period]);
  const periodItems = useMemo(() => allItems.filter((item) => inRange(item.createdAt, range)), [allItems, range]);

  const fields = useMemo<FieldMeta[]>(() => {
    const base: FieldMeta[] = [
      { key: 'status', label: t('crm.leadsAnalytics.fields.status'), type: 'status' },
      { key: 'source', label: t('crm.leadsAnalytics.fields.source'), type: 'text' },
      { key: 'channel', label: t('crm.leadsAnalytics.fields.channel'), type: 'text' },
      { key: 'manager', label: t('crm.leadsAnalytics.fields.manager'), type: 'text' },
	      { key: 'country', label: t('crm.leadsAnalytics.fields.country'), type: 'text' },
	      { key: 'amount', label: t('crm.leadsAnalytics.fields.amount'), type: 'number' },
	      { key: 'currency', label: t('crm.leadsAnalytics.fields.currency'), type: 'text' },
	      { key: 'sourceCurrencies', label: t('crm.leadsAnalytics.fields.sourceCurrencies'), type: 'multiselect' },
	      { key: 'leadAmount', label: t('crm.leadsAnalytics.fields.leadAmount'), type: 'number' },
      { key: 'salesRevenue', label: t('crm.leadsAnalytics.fields.salesRevenue'), type: 'number' },
      { key: 'dealsCount', label: t('crm.leadsAnalytics.fields.dealsCount'), type: 'number' },
      { key: 'projectCount', label: t('crm.leadsAnalytics.fields.projectCount'), type: 'number' },
      { key: 'projectAmount', label: t('crm.leadsAnalytics.fields.projectAmount'), type: 'number' },
      { key: 'projectStatus', label: t('crm.leadsAnalytics.fields.projectStatus'), type: 'multiselect' },
      { key: 'projectCategory', label: t('crm.leadsAnalytics.fields.projectCategory'), type: 'multiselect' },
      { key: 'projectOwner', label: t('crm.leadsAnalytics.fields.projectOwner'), type: 'multiselect' },
      { key: 'projectTags', label: t('crm.leadsAnalytics.fields.projectTags'), type: 'multiselect' },
      { key: 'projectName', label: t('crm.leadsAnalytics.fields.projectName'), type: 'multiselect' },
      { key: 'aiScore', label: 'AI Score', type: 'number' },
      { key: 'aiPriority', label: 'AI Priority', type: 'text' },
      { key: 'utmSource', label: 'UTM source', type: 'text' },
      { key: 'utmMedium', label: 'UTM medium', type: 'text' },
      { key: 'utmCampaign', label: 'UTM campaign', type: 'text' },
      { key: 'utmContent', label: 'UTM content', type: 'text' },
      { key: 'utmTerm', label: 'UTM term', type: 'text' },
      { key: 'phone', label: t('crm.leadsAnalytics.fields.phone'), type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'createdDate', label: t('crm.leadsAnalytics.fields.createdDate'), type: 'date' },
      { key: 'updatedDate', label: t('crm.leadsAnalytics.fields.updatedDate'), type: 'date' },
    ];
    const existing = new Set(base.map((field) => field.key));
    const schemaByKey = new Map(customFields.map((field) => [field.key, field]));
    const customKeys = Array.from(new Set([
      ...customFields.filter((field) => field.isActive).map((field) => field.key),
      ...rawLeads.flatMap((lead) => Object.keys((lead.customFields || {}) as Record<string, unknown>)),
    ])).filter((key) => !existing.has(key));
    const custom = customKeys.map((key) => {
      const schema = schemaByKey.get(key);
      if (schema) return { key, label: schema.label || key, type: normalizeCustomFieldType(schema.type) };
      return { key, label: key, type: guessFieldType(rawLeads.map((lead) => (lead.customFields || {})[key])) };
    });
    return [...base, ...custom];
  }, [customFields, rawLeads, t]);

  const valueOptionsByScope = useMemo(() => {
    const out: Record<string, Array<{ id: string; label: string }>> = {};
    fields.forEach((field) => {
      const scope = `field:${field.key}`;
      const values = new Map<string, number>();
      periodItems.forEach((item) => {
        const raw = getFieldValue(item, scope);
        const list = Array.isArray(raw) ? raw.map(String) : splitMulti(raw);
        list.filter(Boolean).forEach((value) => values.set(value, (values.get(value) || 0) + 1));
      });
      out[scope] = Array.from(values.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 80)
        .map(([id, count]) => ({ id, label: `${id} · ${count}` }));
    });
    return out;
  }, [fields, periodItems]);

  const metricOptions = useMemo<Array<{ id: MetricKey; label: string }>>(() => {
    const numeric = fields.filter((field) => field.type === 'number');
    return [
      { id: 'total', label: t('crm.leadsAnalytics.metricOptions.total') },
      { id: 'conversion', label: t('crm.leadsAnalytics.metricOptions.conversion') },
      { id: 'revenue', label: t('crm.leadsAnalytics.metricOptions.revenue') },
      { id: 'avgRevenue', label: t('crm.leadsAnalytics.metricOptions.avgRevenue') },
      { id: 'won', label: t('crm.leadsAnalytics.metricOptions.won') },
      { id: 'lost', label: t('crm.leadsAnalytics.metricOptions.lost') },
      { id: 'response', label: t('crm.leadsAnalytics.metricOptions.response') },
      ...numeric.flatMap((field) => [
        { id: `sum:${field.key}` as MetricKey, label: t('crm.leadsAnalytics.metricOptions.sumSuffix', { field: field.label }) },
        { id: `avg:${field.key}` as MetricKey, label: t('crm.leadsAnalytics.metricOptions.avgSuffix', { field: field.label }) },
      ]),
      ...fields.map((field) => ({ id: `filled:${field.key}` as MetricKey, label: t('crm.leadsAnalytics.metricOptions.filledSuffix', { field: field.label }) })),
    ];
  }, [fields, t]);

  const valueFieldOptions = useMemo(
    () => fields.filter((field) => field.type === 'number').map((field) => ({ id: field.key, label: field.label })),
    [fields],
  );

  const searchedAllItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) =>
      `${item.name} ${item.phone} ${item.email} ${item.source} ${item.manager} ${item.country} ${item.projectCategories.join(' ')} ${item.projectTags.join(' ')}`.toLowerCase().includes(q),
    );
  }, [allItems, search]);

  const filteredAllItems = useMemo(() => applyFilterRows(searchedAllItems, globalFilters), [searchedAllItems, globalFilters]);
  const filteredItems = useMemo(() => filteredAllItems.filter((item) => inRange(item.createdAt, range)), [filteredAllItems, range]);
  const blocks = layouts[activeView] || [];
  const configBlock = blocks.find((block) => block.id === configId) || null;

  const updateBlocks = useCallback((updater: (prev: AnalyticsBlock[]) => AnalyticsBlock[]) => {
    setLayouts((prev) => ({ ...prev, [activeView]: updater(prev[activeView] || []) }));
  }, [activeView]);

  const visualBlocks = useMemo(() => {
    if (!drag || drag.fromIdx === drag.toIdx) return blocks;
    const next = [...blocks];
    const [moved] = next.splice(drag.fromIdx, 1);
    next.splice(drag.toIdx, 0, moved);
    return next.map((block) => block.id === drag.id ? { ...block, _dragging: true } : block);
  }, [blocks, drag]);

  const saveLayout = () => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
    localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
    const widgets = Object.values(layouts).flat().map(blockToDashboardWidgetConfig);
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgets));
    localStorage.setItem(WIDGET_VERSION_KEY, LAYOUT_VERSION);
    notifyAnalyticsWidgetsChanged('leads_analytics_v2');
    setEditing(false);
    setSelected(null);
    setConfigId(null);
  };

  const resetLayout = () => {
    const next = defaultLayout(t);
    setLayouts(next);
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(LAYOUT_VERSION_KEY, LAYOUT_VERSION);
    const widgets = Object.values(next).flat().map(blockToDashboardWidgetConfig);
    localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(widgets));
    localStorage.setItem(WIDGET_VERSION_KEY, LAYOUT_VERSION);
    notifyAnalyticsWidgetsChanged('leads_analytics_v2');
    setSelected(null);
    setConfigId(null);
  };

  const updateBlock = (nextBlock: AnalyticsBlock) => {
    updateBlocks((prev) => prev.map((block) => block.id === nextBlock.id ? nextBlock : block));
    setConfigId(nextBlock.id);
  };

  const deleteBlock = (id: string) => {
    updateBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selected === id) setSelected(null);
    if (configId === id) setConfigId(null);
  };

  const duplicateBlock = (id: string) => {
    updateBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === id);
      if (index < 0) return prev;
      const copy = { ...prev[index], id: uid(), title: `${prev[index].title} copy` };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      setSelected(copy.id);
      return next;
    });
    setEditing(true);
  };

  const addHome = (block: AnalyticsBlock) => {
    requestAddDashboardPreset({
      source: 'leads',
      slug: block.id,
      widgetConfig: blockToDashboardWidgetConfig(block),
    });
  };

  const onMoveStart = (event: React.MouseEvent, id: string) => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const fromIdx = blocks.findIndex((block) => block.id === id);
    if (fromIdx >= 0) setDrag({ id, fromIdx, toIdx: fromIdx });
  };

  const onResizeStart = (event: React.MouseEvent, id: string, mode: 'br' | 'r' | 'b') => {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const block = blocks.find((item) => item.id === id);
    const rect = gridRef.current?.getBoundingClientRect();
    if (!block || !rect) return;
    setResize({
      id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startSpan: block.span,
      startHeight: block.height,
      colW: (rect.width - 11 * 12) / 12,
    });
  };

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
  }, [drag, updateBlocks]);

  useEffect(() => {
    if (!resize) return;
    const onMove = (event: MouseEvent) => {
      const dx = event.clientX - resize.startX;
      const dy = event.clientY - resize.startY;
      let span = resize.startSpan;
      let height = resize.startHeight;
      if (resize.mode === 'br' || resize.mode === 'r') {
        span = Math.max(3, Math.min(12, Math.round(resize.startSpan + dx / (resize.colW + 12))));
      }
      if (resize.mode === 'br' || resize.mode === 'b') {
        height = Math.max(MIN_BLOCK_H, Math.min(MAX_BLOCK_H, resize.startHeight + dy));
      }
      updateBlocks((prev) => prev.map((block) => block.id === resize.id ? { ...block, span, height, _resizing: true } : block));
    };
    const onUp = () => {
      updateBlocks((prev) => prev.map((block) => ({ ...block, _resizing: false })));
      setResize(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resize, updateBlocks]);

  const addGlobalFilter = (scope: string) => {
    if (globalFilters.some((filter) => filter.scope === scope)) return;
    setGlobalFilters((prev) => [...prev, { id: uid('gf'), scope, keys: [] }]);
  };

  const removeGlobalFilter = (id: string) => setGlobalFilters((prev) => prev.filter((filter) => filter.id !== id));

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('period', period);
    url.searchParams.set('view', activeView);
    navigator.clipboard.writeText(url.toString()).catch(() => {
      prompt(t('crm.leadsAnalytics.page.sharePromptFallback'), url.toString());
    });
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  return (
    <MainLayout>
      <PageHelpButton topic="leadsAnalytics" />
      <div className="min-h-screen pb-10 text-[#222]">
        {shareToast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-[#222] px-5 py-3 text-sm text-white shadow-lg">
            {t('crm.leadsAnalytics.page.shareToastText')}
          </div>
        )}
        <div className="sticky top-0 z-30 -mx-3 border-b border-neutral-200 bg-white/95 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-neutral-500">
              <span className="hidden sm:inline">{t('crm.leadsAnalytics.page.breadcrumbLeads')} <span className="mx-2 text-neutral-300">/</span> </span><span className="font-semibold text-[#222]">{t('crm.leadsAnalytics.page.breadcrumbAnalytics')}</span>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm sm:w-52 sm:flex-none">
                <Icon name="search" size={14} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('crm.leadsAnalytics.page.searchPlaceholder')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </div>
              <button type="button" className="btn-secondary" onClick={handleShare} title={t('crm.leadsAnalytics.page.shareTitle')}><Icon name="share" size={15} /></button>
            </div>
          </div>
        </div>

        <div className="space-y-5 py-6">
          <section className="border-b border-neutral-200 pb-6">
            <div className="mb-4">
              <div className="mb-2  text-xs uppercase tracking-[0.38em] text-neutral-500">{t('crm.leadsAnalytics.page.kicker', { period: periodLabels[period] })}</div>
              <h1 className="text-3xl font-semibold tracking-[-0.055em] text-[#222] sm:text-4xl md:text-5xl">{t('crm.leadsAnalytics.page.title')}</h1>
              <p className="mt-2 hidden max-w-[760px] text-base leading-7 text-neutral-500 sm:mt-3 sm:block sm:text-lg">{t('crm.leadsAnalytics.page.subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
                {(['30d', '7d', 'quarter', 'ytd', 'all'] as PeriodId[]).map((item) => (
                  <button key={item} type="button" className={cx('rounded-lg px-3 py-1.5 text-xs transition sm:px-4 sm:py-2 sm:text-sm', period === item ? 'bg-[#222] text-white shadow-sm' : 'text-neutral-500 hover:text-[#222]')} onClick={() => setPeriod(item)}>{periodLabels[item]}</button>
                ))}
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm sm:inline-flex">
                <Icon name="calendar" size={15} />
                <span className="text-xs uppercase tracking-[0.16em] text-neutral-400">{t('crm.leadsAnalytics.page.periodLabel')}</span>
                <span className="font-medium">{range.from ? `${formatDateInput(range.from)} – ${formatDateInput(range.to)}` : t('crm.leadsAnalytics.page.allTimeLabel')}</span>
              </div>
              <button type="button" className="hidden sm:inline-flex items-center gap-2 btn-secondary" onClick={handleShare}><Icon name="share" size={15} /><span className="hidden md:inline">{t('crm.leadsAnalytics.page.shareBtn')}</span></button>
              <button type="button" className="hidden sm:inline-flex items-center gap-2 btn-secondary" onClick={() => exportCsv(filteredItems, period, t)}><Icon name="download" size={15} /><span className="hidden md:inline">{t('crm.leadsAnalytics.page.exportCsvBtn')}</span></button>
              <button type="button" className="btn-primary" onClick={() => setEditing((value) => !value)}>{editing ? t('crm.leadsAnalytics.page.doneBtn') : t('crm.leadsAnalytics.page.editBtn')}</button>
            </div>
          </section>

          <nav className="border-b border-neutral-200">
            <div className="-mx-3 flex items-center justify-between overflow-x-auto px-3 md:mx-0 md:px-0">
              <div className="flex shrink-0 gap-1 sm:gap-4">
                {views.map((view) => (
                  <button key={view.id} type="button" className={cx('whitespace-nowrap border-b-2 px-2 py-3 text-sm transition sm:px-3 sm:py-4 sm:text-base', activeView === view.id ? 'border-[#222] font-medium text-[#222]' : 'border-transparent text-neutral-500 hover:text-[#222]')} onClick={() => setActiveView(view.id)}>
                    {activeView === view.id && <span className="mr-1 sm:mr-2">•</span>}{view.label}
                  </button>
                ))}
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <AnalyticsCurrencyControl state={currencyPrefs} onStateChange={setCurrencyPrefs} />
                <button type="button" className="hidden md:block btn-secondary border-dashed border-border-strong text-text-secondary">{t('crm.leadsAnalytics.page.saveViewBtn')}</button>
              </div>
            </div>
          </nav>

          <section className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">{t('crm.leadsAnalytics.page.filtersLabel')}</span>
              {globalFilters.map((filter) => (
                <div key={filter.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                  <select className="bg-transparent text-neutral-500 outline-none" value={filter.scope} onChange={(event) => setGlobalFilters((prev) => prev.map((item) => item.id === filter.id ? { ...item, scope: event.target.value, keys: [] } : item))}>
                    {fieldOptions(fields).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                  </select>
                  <select className="max-w-[220px] bg-transparent font-medium outline-none" value={filter.keys[0] || ''} onChange={(event) => setGlobalFilters((prev) => prev.map((item) => item.id === filter.id ? { ...item, keys: event.target.value ? [event.target.value] : [] } : item))}>
                    <option value="">{t('crm.leadsAnalytics.page.allOption')}</option>
                    {(valueOptionsByScope[filter.scope] || []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <button type="button" className="text-neutral-400 hover:text-rose-600" onClick={() => removeGlobalFilter(filter.id)}>×</button>
                </div>
              ))}
              <button type="button" className="btn-secondary border-dashed border-border-strong text-text-secondary" onClick={() => addGlobalFilter(activeView === 'sources' ? 'field:source' : activeView === 'managers' ? 'field:manager' : 'field:status')}>{t('crm.leadsAnalytics.page.addFilterBtn')}</button>
              <div className="ml-auto hidden  text-xs uppercase tracking-[0.18em] text-neutral-400 sm:block">{loading ? t('crm.leadsAnalytics.page.loadingLabel') : t('crm.leadsAnalytics.page.countLabel', { count: filteredItems.length })}</div>
            </div>
          </section>

          {editing && (
            <section className="flex flex-col gap-3 rounded-xl bg-[#222] px-4 py-3 text-white lg:flex-row lg:items-center">
              <span className="text-[11px] uppercase tracking-[0.16em] text-white/60">{t('crm.leadsAnalytics.page.editModeLabel')}</span>
              <span className="text-sm font-semibold">{t('crm.leadsAnalytics.page.blocksCountLabel', { count: blocks.length })}</span>
              <span className="font-mono text-[11px] tracking-[0.08em] text-white/45">{t('crm.leadsAnalytics.page.editHint')}</span>
              <div className="flex-1" />
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/20" onClick={() => setShowAdd(true)}><Icon name="plus" size={13} />{t('crm.leadsAnalytics.page.addBlockBtn')}</button>
              <button type="button" className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs hover:bg-white/20" onClick={resetLayout}>{t('crm.leadsAnalytics.page.resetBtn')}</button>
              <button type="button" className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#222] hover:bg-white/90" onClick={saveLayout}>{t('crm.leadsAnalytics.page.saveDashboardBtn')}</button>
            </section>
          )}

          <div
            ref={gridRef}
            className={cx('grid min-h-[600px] grid-cols-12 gap-3 rounded-xl sm:gap-4', editing && 'bg-[linear-gradient(to_right,rgba(0,0,0,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.035)_1px,transparent_1px)] bg-[length:8.333%_72px]')}
            onClick={() => setSelected(null)}
          >
            {visualBlocks.map((block) => {
              const blockAllItems = applyFilterRows(filteredAllItems, block.filters);
              const blockItems = blockAllItems.filter((item) => inRange(item.createdAt, range));
              return (
                <div
                  key={block.id}
                  style={{ gridColumn: isMobile ? 'span 12' : `span ${block.span}` }}
                  onMouseEnter={() => {
                    if (!drag) return;
                    const toIdx = blocks.findIndex((item) => item.id === block.id);
                    if (toIdx !== drag.toIdx && toIdx >= 0) setDrag((prev) => prev ? { ...prev, toIdx } : prev);
                  }}
                >
                  <BlockShell
                    block={block}
                    editing={editing}
                    selected={selected === block.id}
                    onSelect={() => setSelected(block.id)}
                    onConfig={() => {
                      setConfigId(block.id);
                      setSelected(block.id);
                    }}
                    onAddHome={() => addHome(block)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onDelete={() => deleteBlock(block.id)}
                    onMoveStart={(event) => onMoveStart(event, block.id)}
                    onResizeStart={(event, mode) => onResizeStart(event, block.id, mode)}
                  >
	                    <RenderBlock block={block} items={blockItems} trendItems={blockAllItems} baseItems={filteredItems} fields={fields} period={period} reportCurrency={reportCurrency} />
                  </BlockShell>
                </div>
              );
            })}
            {editing && (
              <button type="button" className="col-span-6 flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed border-neutral-300 bg-white/50 text-sm text-neutral-500 transition hover:border-[#222] hover:bg-white hover:text-[#222]" onClick={() => setShowAdd(true)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current"><Icon name="plus" size={16} /></span>
                <span className="font-medium text-[#222]">{t('crm.leadsAnalytics.page.addBlockEmptyTitle')}</span>
                <span className="text-xs text-neutral-500">{t('crm.leadsAnalytics.page.addBlockEmptySubtitle')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddBlockModal activeView={activeView} onAdd={(block) => {
        updateBlocks((prev) => [...prev, block]);
        setSelected(block.id);
        setShowAdd(false);
        setEditing(true);
      }} onClose={() => setShowAdd(false)} />}
      <ConfigDrawer
        block={configBlock}
        fields={fields}
        metricOptions={metricOptions}
        valueFieldOptions={valueFieldOptions}
        valueOptionsByScope={valueOptionsByScope}
        onChange={updateBlock}
        onAddHome={() => configBlock && addHome(configBlock)}
        onClose={() => setConfigId(null)}
        onDelete={() => configId && deleteBlock(configId)}
      />
    </MainLayout>
  );
};
