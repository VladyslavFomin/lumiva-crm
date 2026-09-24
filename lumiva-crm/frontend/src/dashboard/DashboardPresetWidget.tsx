import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import type { Project } from '../pages/projects/projectTypes';
import type { DashboardPresetInstance } from './dashboardLayout';
import { getPresetDefinition } from './presetCatalog';
import { DASH_BTN_PRIMARY } from './dashboardUi';
import type { ProjectsAnalyticsWidgetConfig } from './analyticsStorage';
import { ProjectsAnalyticsWidgetEmbed } from './projectsAnalyticsWidgetEmbed';
import { loadAnalyticsItemsForSource } from './analyticsPresetData';
import { loadWorkspaceAnalyticsItems } from './workspaceAnalyticsItems';
import { loadClientAccountAnalyticsItems } from './clientAccountAnalyticsItems';

const CHART_COLORS = ['#38bdf8', '#e11d48', '#f97316', '#22c55e', '#2563eb', '#6366f1'];

function resolveLocale(lang: string) {
  if (lang.startsWith('tr')) return 'tr-TR';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

/** Фильтр по периоду (instance.filters, YYYY-MM-DD) — на клиенте, по p.createdAt, до
 * агрегации metric/donut/bar/table. Ставится вручную или ИИ-ассистентом (crm_dashboard_configure). */
function filterByDateRange(
  items: Project[],
  filters: DashboardPresetInstance['filters'],
): Project[] {
  if (!filters?.dateFrom && !filters?.dateTo) return items;
  const fromMs = filters.dateFrom ? new Date(filters.dateFrom).getTime() : null;
  let toMs: number | null = null;
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    toMs = end.getTime();
  }
  return items.filter((p) => {
    const ms = p.createdAt ? new Date(p.createdAt).getTime() : NaN;
    if (Number.isNaN(ms)) return false;
    if (fromMs != null && ms < fromMs) return false;
    if (toMs != null && ms > toMs) return false;
    return true;
  });
}

function formatPeriodLabel(filters: DashboardPresetInstance['filters'], locale: string): string {
  const fmt = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString(locale);
  };
  if (filters?.dateFrom && filters?.dateTo) return `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`;
  if (filters?.dateFrom) return `${fmt(filters.dateFrom)} →`;
  if (filters?.dateTo) return `→ ${fmt(filters.dateTo)}`;
  return '';
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
          const loaded = await loadAnalyticsItemsForSource('projects', t);
          if (!alive) return;
          setItems(loaded);
          return;
        }
        if (instance.source === 'leads' || instance.source === 'sales') {
          // Суммы приводятся к валюте отчёта по актуальному курсу — см. loadDashboardFx.
          const loaded = await loadAnalyticsItemsForSource(instance.source, t);
          if (!alive) return;
          setItems(loaded);
          return;
        }
        if (instance.source === 'workspace') {
          if (!instance.sourceRef) {
            if (!alive) return;
            setItems([]);
            return;
          }
          const { items: mapped } = await loadWorkspaceAnalyticsItems(instance.sourceRef);
          if (!alive) return;
          setItems(mapped);
          return;
        }
        if (instance.source === 'client-account') {
          if (!instance.sourceRef) {
            if (!alive) return;
            setItems([]);
            return;
          }
          const mapped = await loadClientAccountAnalyticsItems(instance.sourceRef, t);
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
  }, [instance.source, instance.slug, instance.sourceRef, projectsFromDashboard, variant, t]);

  const filteredItems = useMemo(
    () => filterByDateRange(items, instance.filters),
    [items, instance.filters],
  );
  const periodLabel = useMemo(
    () => formatPeriodLabel(instance.filters, locale) || t('crm.projects.analytics.period.all'),
    [instance.filters, locale, t],
  );

  const currency = filteredItems[0]?.currency || 'EUR';

  const analyticsHref =
    instance.source === 'sales'
      ? '/sales/analytics'
      : instance.source === 'leads'
        ? '/leads/analytics'
        : instance.source === 'workspace'
          ? instance.sourceRef
            ? `/workspace/${instance.sourceRef}/analytics`
            : '/projects/analytics'
          : instance.source === 'client-account'
            ? instance.sourceRef
              ? `/client-accounts/${instance.sourceRef}/analytics`
              : '/projects/analytics'
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
      const v = filteredItems.length;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{v.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{periodLabel}</div>
        </div>
      );
    }

    if (slug === 'metric-amount') {
      const sum = filteredItems.reduce((s, p) => s + (p.amount || 0), 0);
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{formatAmount(sum)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{periodLabel}</div>
        </div>
      );
    }

    if (slug === 'metric-owners') {
      const n = new Set(filteredItems.map((p) => p.owner || t('crm.projects.analytics.unknownOwner'))).size;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#222] leading-none">{n.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{periodLabel}</div>
        </div>
      );
    }

    if (slug === 'metric-won') {
      const n = filteredItems.filter(isWonProject).length;
      return (
        <div className="flex min-h-[64px] flex-col justify-end gap-1">
          <div className="font-['Inter_Tight'] text-[2rem] font-semibold tracking-[-0.04em] text-[#1f8a5e] leading-none">{n.toLocaleString(locale)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">{periodLabel}</div>
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
      filteredItems.forEach((p) => {
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
      filteredItems.forEach((p) => {
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
      const rows = filteredItems.slice(0, rowLimit);
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
            {t('crm.projects.analytics.table.total', { count: filteredItems.length })}
          </div>
        </div>
      );
    }

    return <div className="text-[11px] text-neutral-500">—</div>;
  }, [hasEmbed, loading, def, instance.slug, filteredItems, periodLabel, t, locale, currency, variant]);

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
            items={filteredItems}
            locale={locale}
            t={t}
            compact={variant === 'preview'}
            isWorkspaceMode={instance.source === 'workspace' || instance.source === 'client-account'}
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
