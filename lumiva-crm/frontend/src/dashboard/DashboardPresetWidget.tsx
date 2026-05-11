import { translateSalesOrderStatus } from './salesOrderStatusLabel';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { fetchProjects } from '../api/projects';
import { fetchLeads, isLeadOmittedFromAnalytics, type Lead } from '../api/leads';
import { fetchSales } from '../api/sales';
import { fetchSalesChannels } from '../api/salesChannels';
import type { Project } from '../pages/projects/projectTypes';
import type { DashboardPresetInstance } from './dashboardLayout';
import type { DashboardPresetSource } from './presetCatalog';
import { getPresetDefinition } from './presetCatalog';
import { DASH_BTN_PRIMARY } from './dashboardUi';
import type { ProjectsAnalyticsWidgetConfig } from './analyticsStorage';
import { ProjectsAnalyticsWidgetEmbed } from './projectsAnalyticsWidgetEmbed';
import { loadAnalyticsItemsForSource } from './analyticsPresetData';
import {
  convertMarketingAmount,
  loadMarketingDisplayCurrency,
  normalizeMarketingDisplayCurrency,
} from '../pages/marketing/marketingDisplayCurrencyStorage';

const CHART_COLORS = ['#38bdf8', '#e11d48', '#f97316', '#22c55e', '#2563eb', '#6366f1'];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function parseProjectsRes(res: unknown): Project[] {
  if (Array.isArray((res as any)?.items)) return (res as any).items;
  if (Array.isArray(res)) return res as Project[];
  return [];
}

function splitMulti(raw: unknown) {
  if (Array.isArray(raw)) return raw.map((value) => String(value).trim()).filter(Boolean);
  return String(raw ?? '')
    .split(/[,;/]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueFilled(values: unknown[]) {
  return Array.from(new Set(values.flatMap(splitMulti).filter(Boolean)));
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

async function loadAllSalesMapped(
  channelNameById: Map<string, string>,
  t: TFunction,
): Promise<Project[]> {
  const currencyPrefs = loadMarketingDisplayCurrency();
  const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
  const pageSize = 200;
  let page = 1;
  const all: Project[] = [];
  let total = 0;
  while (true) {
    const res = await fetchSales({ page, pageSize });
    const chunk = res.items.map((sale) => {
      const channelName =
        sale.channel?.name || (sale.channelId ? channelNameById.get(sale.channelId) : '') || '';
      const product = sale.hotel || '';
      const market = sale.market || '';
      const manager = sale.managerName || '';
      const guestName = sale.guestName || '';
	      const statusLabel = translateSalesOrderStatus(sale.status, t);
	      const orderNo = sale.externalOrderNo || sale.externalId || '';
	      const sourceAmount = typeof sale.amount === 'number' ? sale.amount : 0;
	      const sourceCurrency = sale.currency || 'EUR';
	      const converted = convertMarketingAmount(
	        sourceAmount,
	        sourceCurrency,
	        'converted',
	        displayCurrency,
	        rates,
	      );
	      const rowName =
	        orderNo || guestName || product || `Sale ${sale.id.slice(0, 6)}`;
	      return {
        id: sale.id,
        name: rowName,
        description: sale.notes || '',
	        amount: converted.value,
	        currency: converted.currency,
        status: statusLabel as any,
        category: market || null,
        tags: Array.from(new Set([channelName, product, market, statusLabel].filter(Boolean).map(String))),
        owner: manager || null,
        leadId: sale.leadId || null,
        leadName: guestName || null,
        leadEmail: null,
        ownerUserIds: [],
        customFields: {
          ...(sale.customFields || {}),
          status: statusLabel,
          statusCode: sale.status || '',
          channel: channelName || t('crm.dashboard.fallbacks.noChannel'),
          product,
          hotel: product,
          market,
          manager,
          customer: guestName,
          guestName,
          orderNo,
          externalOrderNo: orderNo,
	          amount: converted.value,
	          convertedAmount: converted.value,
	          sourceAmount,
	          nativeAmount: sourceAmount,
	          currency: sourceCurrency,
	          sourceCurrency,
	          nativeCurrency: sourceCurrency,
	          reportCurrency: converted.currency,
	          displayCurrency: converted.currency,
          saleDate: sale.saleDate || sale.createdAt,
          createdDate: sale.createdAt,
          updatedDate: sale.updatedAt,
        },
        tasks: [],
        comments: [],
        createdAt: sale.saleDate || sale.createdAt,
        updatedAt: sale.updatedAt,
      } as Project;
    });
    all.push(...chunk);
    total = res.total || all.length;
    if (!res.items.length || all.length >= total) break;
    page += 1;
  }
  return all;
}

function mapLeadsToProjects(
  leads: Lead[],
  projectsByLeadId: Map<string, Project[]>,
  t: TFunction,
): Project[] {
  const currencyPrefs = loadMarketingDisplayCurrency();
  const displayCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);
  const rates = { ...currencyPrefs.rates, [displayCurrency]: 1 };
  const detectAmount = (lead: Lead) => {
    const fields = (lead.customFields || {}) as Record<string, any>;
    const amountLikeKey = Object.keys(fields).find((key) => {
      const lower = key.toLowerCase();
      return (
        lower.includes('amount') ||
        lower.includes('price') ||
        lower.includes('sum') ||
        lower.includes('value') ||
        lower.includes('total')
      );
    });
    const raw = amountLikeKey ? fields[amountLikeKey] : null;
    if (typeof raw === 'number') return raw;
    if (raw === undefined || raw === null || raw === '') return 0;
    const normalized = String(raw)
      .replace(/\s+/g, '')
      .replace(/,/g, '.')
      .replace(/[^0-9.\-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const detectCurrency = (lead: Lead) => {
    const fields = (lead.customFields || {}) as Record<string, any>;
    const key = Object.keys(fields).find((fieldKey) =>
      fieldKey.toLowerCase().includes('currency'),
    );
    if (key) return String(fields[key] || 'EUR');
    return 'EUR';
  };

  return leads.map(
    (lead) => {
	      const source =
	        lead.source ||
	        lead.channel ||
	        lead.utmSource ||
	        t('crm.dashboard.fallbacks.notSpecified');
	      const manager =
	        lead.assignedTo ||
	        lead.assignedToList?.join(', ') ||
	        t('crm.projects.analytics.unknownOwner');
	      const linkedProjects = (projectsByLeadId.get(lead.id) || []).filter((project) => !project.isArchived && !project.isDeleted);
	      const projectAmount = linkedProjects.reduce((sum, project) => {
	        const converted = convertMarketingAmount(
	          Number(project.amount) || 0,
	          project.currency || 'EUR',
	          'converted',
	          displayCurrency,
	          rates,
	        );
	        return sum + converted.value;
	      }, 0);
      const projectStatuses = uniqueFilled(linkedProjects.map((project) => project.status));
      const projectCategories = uniqueFilled(linkedProjects.map((project) => project.category));
      const projectOwners = uniqueFilled(linkedProjects.map((project) => project.owner));
      const projectTags = uniqueFilled(linkedProjects.flatMap((project) => project.tags || []));
	      const leadCurrency = detectCurrency(lead);
	      const leadAmount = convertMarketingAmount(
	        detectAmount(lead),
	        leadCurrency,
	        'converted',
	        displayCurrency,
	        rates,
	      ).value;
      return ({
        id: lead.id,
        name: lead.name || lead.phone || lead.email || `Lead ${lead.id.slice(0, 6)}`,
        description: '',
        amount: projectAmount || leadAmount,
	        currency: displayCurrency,
        status: (lead.status || 'new') as any,
        category: source,
        tags: Array.from(new Set([
          lead.channel,
          lead.utmSource,
          lead.utmMedium,
          lead.utmCampaign,
          lead.country,
        ].filter(Boolean).map(String))),
        owner: manager,
        leadId: lead.id,
        leadName: lead.name || null,
        leadEmail: lead.email || null,
        ownerUserIds: lead.assignedUserIds || [],
        customFields: {
          ...(lead.customFields || {}),
          status: lead.status,
          source,
          channel: lead.channel || source,
          country: lead.country || '',
          manager,
	          assignedTo: manager,
	          leadAmount,
	          leadCurrency,
	          projectCount: linkedProjects.length,
          projectAmount,
          projectStatus: projectStatuses,
          projectCategory: projectCategories,
          projectOwner: projectOwners,
          projectTags,
          projectName: uniqueFilled(linkedProjects.map((project) => project.name)),
          utmSource: lead.utmSource || '',
          utmMedium: lead.utmMedium || '',
          utmCampaign: lead.utmCampaign || '',
          utmContent: lead.utmContent || '',
          utmTerm: lead.utmTerm || '',
          phone: lead.phone || '',
          email: lead.email || '',
          createdDate: lead.createdAt,
          updatedDate: lead.updatedAt,
        },
        tasks: [],
        comments: [],
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      }) as Project;
    },
  );
}

function isWonProject(p: Project): boolean {
  const st = (p.status || '').toString().toLowerCase();
  return ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) =>
    st.includes(x),
  );
}

export const DashboardPresetWidget: React.FC<{
  instance: DashboardPresetInstance;
  /** Переданные с главной «мои» проекты (для projects совпадает с дашбордом) */
  projectsFromDashboard?: Project[] | null;
  /** Превью в модалке: передать данные с API или null (загрузка). Без пропа — один запрос внутри виджета. */
  variant?: 'default' | 'preview';
}> = ({ instance, projectsFromDashboard, variant = 'default' }) => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const wc = instance.widgetConfig as ProjectsAnalyticsWidgetConfig | undefined;
  const hasEmbed = !!(wc && wc.type);
  const def = getPresetDefinition(instance.source, instance.slug);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (variant === 'preview') {
      if (projectsFromDashboard != null) {
        setItems(projectsFromDashboard);
        setLoading(false);
        return;
      }
      if (projectsFromDashboard === null) {
        setItems([]);
        setLoading(true);
        return;
      }
      let alive = true;
      setLoading(true);
      loadAnalyticsItemsForSource(instance.source, t).then((data) => {
        if (!alive) return;
        setItems(data);
        setLoading(false);
      });
      return () => {
        alive = false;
      };
    }

    let alive = true;
    setLoading(true);

    const run = async () => {
      try {
        if (instance.source === 'projects') {
          if (projectsFromDashboard != null) {
            if (!alive) return;
            setItems(projectsFromDashboard);
            return;
          }
          const res = await fetchProjects();
          if (!alive) return;
          setItems(parseProjectsRes(res));
          return;
        }
        if (instance.source === 'leads') {
          const [raw, projectsRes] = await Promise.all([
            fetchLeads(),
            fetchProjects().catch(() => ({ total: 0, items: [] as Project[] })),
          ]);
          if (!alive) return;
          const leads = (raw || []).filter((l) => !isLeadOmittedFromAnalytics(l));
          setItems(mapLeadsToProjects(leads, buildProjectsByLeadId(parseProjectsRes(projectsRes)), t));
          return;
        }
        if (instance.source === 'sales') {
          const channels = await fetchSalesChannels().catch(() => [] as any[]);
          const map = new Map<string, string>();
          (channels || []).forEach((c: any) => map.set(c.id, c.name));
          const mapped = await loadAllSalesMapped(map, t);
          if (!alive) return;
          setItems(mapped);
          return;
        }
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [instance.source, instance.slug, projectsFromDashboard, variant, t]);

  const currency = items[0]?.currency || 'EUR';

  const analyticsHref =
    instance.source === 'sales'
      ? '/sales/analytics'
      : instance.source === 'leads'
        ? '/leads/analytics'
        : '/projects/analytics';

  const body = useMemo(() => {
    const formatAmount = (amount: number) => {
      const formatted = new Intl.NumberFormat(locale).format(amount);
      return t('crm.projects.common.amountWithCurrency', { amount: formatted, currency });
    };

    if (hasEmbed) {
      return null;
    }

    if (loading || !def) {
      return (
        <div className="text-[11px] text-neutral-500 py-6 text-center">
          {loading ? t('crm.dashboard.loading') : '—'}
        </div>
      );
    }

    const slug = instance.slug;

    if (slug === 'metric-total') {
      const v = items.length;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{v.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{t('crm.projects.analytics.period.all')}</div>
        </div>
      );
    }

    if (slug === 'metric-amount') {
      const sum = items.reduce((s, p) => s + (p.amount || 0), 0);
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{formatAmount(sum)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{t('crm.projects.analytics.period.all')}</div>
        </div>
      );
    }

    if (slug === 'metric-owners') {
      const n = new Set(items.map((p) => p.owner || t('crm.projects.analytics.unknownOwner'))).size;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{n.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{t('crm.projects.analytics.period.all')}</div>
        </div>
      );
    }

    if (slug === 'metric-won') {
      const n = items.filter(isWonProject).length;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#1f8a5e] leading-none">{n.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{t('crm.projects.analytics.period.all')}</div>
        </div>
      );
    }

    const isPreview = variant === 'preview';
    const pieInner = isPreview ? 28 : 48;
    const pieOuter = isPreview ? 44 : 72;
    const chartWrapH = isPreview ? 'h-[110px]' : 'h-[200px]';
    const barH = isPreview ? 120 : 220;
    const rowLimit = isPreview ? 3 : 12;

    if (slug === 'chart-status') {
      const grouped = new Map<string, number>();
      items.forEach((p) => {
        const label = String(p.status || '—');
        grouped.set(label, (grouped.get(label) ?? 0) + 1);
      });
      const data = Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
      const total = data.reduce((s, d) => s + d.value, 0);
      return (
        <div
          className={
            isPreview
              ? 'flex flex-row gap-2 items-center min-h-[110px]'
              : 'flex flex-col md:flex-row gap-3 items-center min-h-[200px]'
          }
        >
          <div className={isPreview ? 'w-1/2 h-[110px]' : 'w-full md:w-1/2 ' + chartWrapH}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={pieInner}
                  outerRadius={pieOuter}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, '']} contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul
            className={
              isPreview
                ? 'text-[9px] space-y-0.5 flex-1 max-h-[110px] overflow-hidden'
                : 'text-[10px] space-y-1 flex-1 max-h-[200px] overflow-y-auto'
            }
          >
            {data.map((d, i) => (
              <li key={d.name} className="flex justify-between gap-2">
                <span className="truncate text-neutral-600">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {d.name}
                </span>
                <span className="font-mono text-[11px] text-[#222] tabular-nums">
                  {total ? Math.round((d.value / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (slug === 'chart-categories') {
      const map = new Map<string, number>();
      items.forEach((p) => {
        const raw = p.category || t('crm.projects.analytics.noCategory');
        map.set(raw, (map.get(raw) ?? 0) + 1);
      });
      const data = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
      return (
        <div className="w-full" style={{ height: barH }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: isPreview ? 9 : 10, fill: '#888888' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: isPreview ? 9 : 10, fill: '#b5b5b5' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 12 }} />
              <Bar dataKey="value" fill="#222222" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (slug === 'table-projects') {
      const rows = items.slice(0, rowLimit);
      return (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[10px] border-separate border-spacing-y-1">
            <thead className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-400">
              <tr>
                <th className="text-left font-medium px-1 py-1 border-b border-neutral-200">
                  {t('crm.projects.analytics.table.headers.project')}
                </th>
                <th className="text-left font-medium px-1 py-1 border-b border-neutral-200">
                  {t('crm.projects.analytics.table.headers.status')}
                </th>
                <th className="text-left font-medium px-1 py-1 border-b border-neutral-200">
                  {t('crm.projects.analytics.table.headers.category')}
                </th>
                <th className="text-left font-medium px-1 py-1 border-b border-neutral-200">
                  {t('crm.projects.analytics.table.headers.owner')}
                </th>
                <th className="text-right font-medium px-1 py-1 border-b border-neutral-200">
                  {t('crm.projects.analytics.table.headers.amount')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="bg-neutral-50/90">
                  <td className="px-1 py-1 text-[#222] truncate max-w-[120px]">{p.name}</td>
                  <td className="px-1 py-1 text-neutral-600 whitespace-nowrap">{p.status}</td>
                  <td className="px-1 py-1 text-neutral-600 truncate max-w-[100px]">
                    {p.category || t('crm.projects.analytics.noCategory')}
                  </td>
                  <td className="px-1 py-1 text-neutral-600 truncate max-w-[100px]">
                    {p.owner || '—'}
                  </td>
                  <td className="px-1 py-1 text-right text-[#222] whitespace-nowrap font-mono tabular-nums">
                    {formatAmount(p.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[10px] text-neutral-500 mt-2 text-right">
            {t('crm.projects.analytics.table.total', { count: items.length })}
          </div>
        </div>
      );
    }

    return <div className="text-[11px] text-neutral-500">—</div>;
  }, [hasEmbed, loading, def, instance.slug, items, t, locale, currency, variant]);

  if (loading && variant !== 'preview') {
    return (
      <div className="flex flex-col gap-3 min-h-0 h-full">
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="text-[11px] text-neutral-500 py-6 text-center">{t('crm.dashboard.loading')}</div>
        </div>
        <Link to={analyticsHref} className={`${DASH_BTN_PRIMARY} w-full shrink-0`}>
          {t('crm.dashboard.presets.openAnalytics')}
        </Link>
      </div>
    );
  }

  if (hasEmbed && wc) {
    return (
      <div className="flex flex-col gap-3 min-h-0 h-full">
        <div className={`flex-1 min-h-0 ${variant === 'preview' ? 'overflow-hidden' : 'overflow-auto'}`}>
          <ProjectsAnalyticsWidgetEmbed
            widget={wc}
            items={items}
            locale={locale}
            t={t}
            compact={variant === 'preview'}
          />
        </div>
        {variant !== 'preview' && (
          <Link to={analyticsHref} className={`${DASH_BTN_PRIMARY} w-full shrink-0`}>
            {t('crm.dashboard.presets.openAnalytics')}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <div className={`flex-1 min-h-0 ${variant === 'preview' ? 'overflow-hidden' : 'overflow-auto'}`}>
        {body}
      </div>
      {variant !== 'preview' && (
        <Link to={analyticsHref} className={`${DASH_BTN_PRIMARY} w-full shrink-0`}>
          {t('crm.dashboard.presets.openAnalytics')}
        </Link>
      )}
    </div>
  );
};
