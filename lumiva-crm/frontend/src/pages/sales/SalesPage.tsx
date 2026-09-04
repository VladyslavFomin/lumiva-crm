// src/pages/sales/SalesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSaleStatus } from './saleStatusI18n';
import { MainLayout } from '../../layout/MainLayout';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import { getStoredUser } from '../../auth/session';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchSales,
  fetchSalesStats,
  updateSale,
  exportSalesAnalytics,
  type Sale,
  type SaleStatus,
  type SalesStats,
  type ListSalesParams,
} from '../../api/sales';
import {
  fetchSalesChannels,
  type SalesChannel,
} from '../../api/salesChannels';
import { getLocale } from '../../i18n/utils';
import {
  fetchCustomFields,
  type CustomField,
} from '../../api/custom-fields';
import { CustomFieldsManager } from '../../components/CustomFieldsManager';
import { AutomationPanel } from '../../components/AutomationPanel';
import { useWorkspaceStyleColumnDrag } from '../../components/table/useWorkspaceStyleColumnDrag';
import { SalesStatusPillSelect } from './SalesStatusPillSelect';
import { useMarketingDisplayCurrencyPrefs } from '../marketing/MarketingDisplayCurrencyToolbar';
import {
  MARKETING_ALLOWED_CURRENCIES,
  normalizeMarketingDisplayCurrency,
} from '../marketing/marketingDisplayCurrencyStorage';
import { saleStorefrontProductName } from '../../utils/saleOrderDisplay';
import { LottieIcon } from '../../components/LottieIcon';
import { Ic, SL_ICON } from './SalesIcons';
import './sales-design.css';

const cxs = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ─────────────────────────────── */
/* Локальные типы для фильтров     */
/* ─────────────────────────────── */

type SalesFilters = {
  from?: string;
  to?: string;
  status?: SaleStatus | 'all';
  channelId?: string;
  search?: string;
  page: number;
  pageSize: number;
};

type SalesListResponse = {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
};

type PeriodKey = '7' | '14' | '30' | 'all';

const UUID_LIKE =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** ID заказа у источника (WP/Woo — числовой; тестовая витрина/embed-формы — код ORD-XXXXXXXX), без UUID CRM. */
function saleWpNumericId(sale: Sale): string | null {
  const on = sale.externalOrderNo?.trim();
  if (on && !UUID_LIKE.test(on)) return on;
  const ext = sale.externalId?.trim();
  if (ext && !UUID_LIKE.test(ext)) return ext;
  return null;
}

function looksUuidLike(s: string): boolean {
  return UUID_LIKE.test(s.trim());
}

/** Домен + подпись интеграции (не показываем UUID канала). */
function saleChannelLines(
  sale: Sale,
  channelsList: SalesChannel[],
): { site: string | null; integration: string | null; sq: string } {
  let site = sale.channelSiteLabel?.trim() || null;
  let integration = sale.channelIntegrationLabel?.trim() || null;

  const ch = channelsList.find((c) => c.id === sale.channelId);
  if (!site && ch?.name?.trim()) {
    const n = ch.name.trim();
    if (!looksUuidLike(n)) site = n;
  }
  if (!integration && ch?.integrationName?.trim()) {
    const n = ch.integrationName.trim();
    if (!looksUuidLike(n)) integration = n;
  }

  const sq = ch?.type === 'direct' ? '' : ch?.type === 'b2b' || ch?.type === 'ota' ? 'b' : 'c';

  return { site, integration, sq };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function paginationWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>(
    [1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total),
  );
  const arr = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  arr.forEach((n, i) => {
    if (i > 0 && n - (arr[i - 1] as number) > 1) out.push('…');
    out.push(n);
  });
  return out;
}

function Kpi({ l, v, sub }: { l: string; v: string; sub?: string }) {
  return (
    <div className="sl-kpi">
      <div className="l">{l}</div>
      <div className="v">
        {v}
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export const SalesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const user = getStoredUser();
  const navigate = useNavigate();
  const locale = getLocale();
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

  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('7');
  const [filters, setFilters] = useState<SalesFilters>(() => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 13);
    const to = today;

    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    return {
      from: fmt(from),
      to: fmt(to),
      status: 'all',
      page: 1,
      pageSize: 25,
    };
  });

  const [list, setList] = useState<SalesListResponse | null>(null);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);
  const currenciesPresent = useMemo(
    () => Array.from(new Set((list?.items || []).map((sale) => sale.currency || 'EUR'))),
    [list],
  );
  const { state: currencyPrefs, setState: setCurrencyPrefs } =
    useMarketingDisplayCurrencyPrefs(currenciesPresent);
  const reportCurrency = normalizeMarketingDisplayCurrency(currencyPrefs.displayCurrency);

  const currencyOptions = useMemo(() => {
    const api = currencyPrefs.availableDisplayCurrencies;
    const base = api?.length ? [...api] : [...MARKETING_ALLOWED_CURRENCIES];
    const set = new Set(base);
    set.add(reportCurrency);
    return [...set].sort();
  }, [currencyPrefs.availableDisplayCurrencies, reportCurrency]);

  const onCurrencyChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const nextCurrency = normalizeMarketingDisplayCurrency(e.target.value);
    setCurrencyPrefs({
      ...currencyPrefs,
      currencyMode: 'converted',
      displayCurrency: nextCurrency,
      rates: { [nextCurrency]: 1 },
    });
  };

  useEffect(() => {
    if (currencyPrefs.currencyMode === 'converted') return;
    setCurrencyPrefs({
      ...currencyPrefs,
      currencyMode: 'converted',
      rates: { ...currencyPrefs.rates, [reportCurrency]: 1 },
    });
  }, [currencyPrefs, reportCurrency, setCurrencyPrefs]);

  // первая загрузка каналов
  useEffect(() => {
    fetchSalesChannels()
      .then(setChannels)
      .catch((err) => {
        console.error(err);
      });
  }, []);

  // загрузка списка продаж и статистики
  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      // Нормализуем статус: 'all' -> undefined, чтобы не ломать backend-DTO
      const params: ListSalesParams = {
        ...filters,
        status:
          filters.status === 'all' || !filters.status
            ? undefined
            : filters.status,
      };

      try {
        const [resList, resStats] = await Promise.all([
          fetchSales(params),
          fetchSalesStats({
            ...params,
            currencyMode: 'converted',
            displayCurrency: reportCurrency,
            rates: { ...currencyPrefs.rates, [reportCurrency]: 1 },
          }),
        ]);
        if (!alive) return;
        setList(resList);
        setStats(resStats);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e.message || t('crm.sales.errors.load'));
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingStats(false);
      }
    };

    setLoadingStats(true);
    load();

    return () => {
      alive = false;
    };
  }, [JSON.stringify(filters), reportCurrency, JSON.stringify(currencyPrefs.rates)]);

  const pageCount = useMemo(() => {
    if (!list) return 1;
    return Math.max(1, Math.ceil(list.total / list.pageSize));
  }, [list]);

  const handleQuickRange = (days: 7 | 14 | 30 | 'all') => {
    setPeriod(String(days) as PeriodKey);
    const now = new Date();

    if (days === 'all') {
      setFilters((f: SalesFilters) => ({
        ...f,
        from: undefined,
        to: undefined,
        page: 1,
      }));
      return;
    }

    const from = new Date();
    from.setDate(now.getDate() - (days - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setFilters((f: SalesFilters) => ({
      ...f,
      from: fmt(from),
      to: fmt(now),
      page: 1,
    }));
  };

  const onStatusChange = (s: SaleStatus | 'all') =>
    setFilters((f: SalesFilters) => ({ ...f, status: s, page: 1 }));

  const onChannelChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const v = e.target.value || undefined;
    setFilters((f: SalesFilters) => ({ ...f, channelId: v, page: 1 }));
  };

  const onSearchChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const v = e.target.value;
    setFilters((f: SalesFilters) => ({
      ...f,
      search: v || undefined,
      page: 1,
    }));
  };

  const onPageChange = (page: number) => {
    setFilters((f: SalesFilters) => ({ ...f, page }));
  };

  const resetFilters = () => {
    setPeriod('all');
    setFilters((f) => ({ ...f, from: undefined, to: undefined, status: 'all', channelId: undefined, search: undefined, page: 1 }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportSalesAnalytics({
        from: filters.from,
        to: filters.to,
        status: filters.status === 'all' ? undefined : filters.status,
        channelIds: filters.channelId ? [filters.channelId] : undefined,
        search: filters.search,
        currencyMode: 'converted',
        displayCurrency: reportCurrency,
        rates: { ...currencyPrefs.rates, [reportCurrency]: 1 },
        format: 'xlsx',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || t('crm.sales.list.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const activeCustomFields = useMemo(
    () => customFields.filter((field) => field.isActive),
    [customFields],
  );

  const baseColumns = useMemo(
    () => [
      { id: 'date', label: t('crm.sales.list.headers.date') },
      { id: 'id', label: t('crm.sales.list.headers.id') },
      { id: 'channel', label: t('crm.sales.list.headers.channel') },
      { id: 'product', label: t('crm.sales.list.headers.product') },
      { id: 'customer', label: t('crm.sales.list.headers.customer') },
      { id: 'amount', label: t('crm.sales.list.headers.amount') },
      { id: 'status', label: t('crm.sales.list.headers.status') },
      { id: 'productLink', label: t('crm.sales.list.headers.productLink') },
    ],
    [t],
  );

  const columns = useMemo(() => {
    const customCols = activeCustomFields.map((field) => ({
      id: `cf:${field.id}`,
      label: field.label,
      field,
    }));
    return [...baseColumns, ...customCols];
  }, [activeCustomFields, baseColumns]);

  const orderedColumns = useMemo(() => {
    if (!columns.length) return [];
    const map = new Map(columns.map((col) => [col.id, col]));
    const order =
      columnOrder.length > 0 ? columnOrder : columns.map((col) => col.id);
    const result: typeof columns = [];
    order.forEach((id) => {
      const col = map.get(id);
      if (col) result.push(col);
    });
    columns.forEach((col) => {
      if (!result.find((r) => r.id === col.id)) result.push(col);
    });
    return result;
  }, [columns, columnOrder]);

  const getColumnWidth = (id: string, fallback: number) =>
    columnWidths[id] ?? fallback;

  const updateSaleInline = async (
    id: string,
    patch: Partial<Sale>,
    apiPatch: any,
  ) => {
    setList((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((s) => (s.id === id ? { ...s, ...patch } : s)),
          }
        : prev,
    );
    try {
      const updated = await updateSale(id, apiPatch);
      setList((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((s) => (s.id === id ? updated : s)),
            }
          : prev,
      );
    } catch (e: any) {
      console.error(e);
      setError(e.message || t('crm.sales.errors.load'));
    }
  };

  useEffect(() => {
    fetchCustomFields('sale')
      .then((items) =>
        setCustomFields([...items].sort((a, b) => a.order - b.order)),
      )
      .catch((e) => console.error('Failed to load sale custom fields:', e));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('sales_table_columns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.order)) setColumnOrder(parsed.order);
        if (parsed.widths && typeof parsed.widths === 'object')
          setColumnWidths(parsed.widths);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'sales_table_columns',
        JSON.stringify({ order: columnOrder, widths: columnWidths }),
      );
    } catch {
      // ignore
    }
  }, [columnOrder, columnWidths]);

  useEffect(() => {
    if (!columns.length) return;
    setColumnOrder((prev) => {
      if (!prev.length) return columns.map((c) => c.id);
      const ids = columns.map((c) => c.id);
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      return [...filtered, ...missing];
    });
  }, [columns]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizing.startX;
      const next = Math.max(90, resizing.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizing.id]: next }));
    };
    const handleUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizing]);

  const startResize = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id,
      startX: e.clientX,
      startWidth: columnWidths[id] ?? 160,
    });
  };

  const reorderColumns = useCallback((dragId: string, targetId: string) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  }, []);

  const columnDrag = useWorkspaceStyleColumnDrag(reorderColumns, 'light');

  const altAmount = (sale: Sale): string | null => {
    if (sale.currency === reportCurrency) return null;
    const rate = currencyPrefs.rates?.[sale.currency];
    if (!rate) return null;
    const converted = sale.amount * rate;
    return `≈ ${converted.toLocaleString(locale, { maximumFractionDigits: 0 })} ${reportCurrency}`;
  };

  const renderCustomFieldCell = (sale: Sale, field: CustomField) => {
    if (field.type === 'boolean') {
      const value = sale.customFields?.[field.key];
      return (
        <label className="inline-flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              const next = {
                ...(sale.customFields ?? {}),
                [field.key]: e.target.checked,
              };
              updateSaleInline(sale.id, { customFields: next }, { customFields: next });
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {Boolean(value) ? t('crm.sales.list.boolean.yes') : t('crm.sales.list.boolean.no')}
        </label>
      );
    }

    if (field.type === 'select') {
      const value = sale.customFields?.[field.key];
      return (
        <select
          className="cf-select"
          value={value ?? ''}
          onChange={(e) => {
            const next = {
              ...(sale.customFields ?? {}),
              [field.key]: e.target.value || null,
            };
            updateSaleInline(sale.id, { customFields: next }, { customFields: next });
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">—</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    const value = sale.customFields?.[field.key];
    return (
      <input
        className="cf-input"
        value={value ?? ''}
        onChange={(e) =>
          setList((prev) =>
            prev
              ? {
                  ...prev,
                  items: prev.items.map((s) =>
                    s.id === sale.id
                      ? {
                          ...s,
                          customFields: {
                            ...(s.customFields ?? {}),
                            [field.key]: e.target.value,
                          },
                        }
                      : s,
                  ),
                }
              : prev,
          )
        }
        onBlur={(e) => {
          const next = {
            ...(sale.customFields ?? {}),
            [field.key]: e.target.value,
          };
          updateSaleInline(sale.id, { customFields: next }, { customFields: next });
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  };

  const renderCell = (sale: Sale, column: any) => {
    const created = sale.saleDate || sale.createdAt;
    const dateStr = created ? new Date(created).toLocaleDateString(locale) : t('crm.sales.common.empty');
    const timeStr = created ? new Date(created).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';

    const { site: channelSite, integration: channelIntegration, sq } = saleChannelLines(sale, channels);
    const productName =
      sale.hotel || saleStorefrontProductName(sale) || t('crm.sales.common.empty');
    const marketLabel = sale.market;
    const clientName =
      sale.guestName || sale.agentName || t('crm.sales.common.empty');
    const clientCompany =
      sale.guestName && sale.agentName ? sale.agentName : null;
    switch (column.id) {
      case 'date':
        return (
          <>
            {dateStr}
            {timeStr && <span className="sub">{timeStr}</span>}
          </>
        );
      case 'id': {
        const wpId = saleWpNumericId(sale);
        return wpId ?? '—';
      }
      case 'channel':
        return channelSite || channelIntegration ? (
          <span className="sl-chan">
            <span className={cxs('sq', sq)} />
            {channelSite || channelIntegration}
          </span>
        ) : (
          <span style={{ color: 'var(--fg-3)' }}>{t('crm.sales.common.empty')}</span>
        );
      case 'product':
        return (
          <>
            <span className="prod">{productName}</span>
            <span className="sub">
              {marketLabel ? `${t('crm.sales.list.market')}: ${marketLabel}` : sale.managerName ? `${t('crm.sales.list.manager')}: ${sale.managerName}` : ''}
            </span>
          </>
        );
      case 'customer':
        return (
          <span className="sl-cli">
            <span className="av">{initialsOf(clientName)}</span>
            <span className="nm">{clientName}{clientCompany ? ` · ${clientCompany}` : ''}</span>
          </span>
        );
      case 'amount': {
        const alt = altAmount(sale);
        return (
          <>
            {sale.amount.toLocaleString(locale, { maximumFractionDigits: 0 })} {sale.currency}
            {alt && <i>{alt}</i>}
          </>
        );
      }
      case 'status':
        return (
          <SalesStatusPillSelect
            value={sale.status}
            labels={statusLabels}
            onChange={(next) =>
              updateSaleInline(
                sale.id,
                { status: next },
                { status: next },
              )
            }
          />
        );
      case 'productLink': {
        const wooAdminUrl = sale.wooAdminEditUrl;
        const openLabel = t('crm.sales.list.openInWpAdmin');
        return wooAdminUrl ? (
          <a
            href={wooAdminUrl}
            target="_blank"
            rel="noreferrer"
            className="sl-link"
            title={wooAdminUrl}
            onClick={(e) => e.stopPropagation()}
          >
            {openLabel}
            <Ic d={SL_ICON.ext} size={11} />
          </a>
        ) : (
          <Link
            to={`/app/sales/${sale.id}`}
            className="sl-link"
            title={`/app/sales/${sale.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            {openLabel}
            <Ic d={SL_ICON.ext} size={11} />
          </Link>
        );
      }
      default:
        if (column.field) return renderCustomFieldCell(sale, column.field);
        return null;
    }
  };

  const refundedStat = stats?.byStatus.find((s) => s.status === 'refunded') || null;

  const statusChipDefs = useMemo(() => {
    const countFor = (s: SaleStatus) => stats?.byStatus.find((b) => b.status === s)?.count ?? 0;
    return [
      { k: 'all' as const, label: t('crm.sales.filters.statusAll'), n: stats?.totalCount ?? 0 },
      { k: 'new' as const, label: statusLabels.new, n: countFor('new') },
      { k: 'pending' as const, label: statusLabels.pending, n: countFor('pending') },
      { k: 'confirmed' as const, label: statusLabels.confirmed, n: countFor('confirmed') },
      { k: 'cancelled' as const, label: statusLabels.cancelled, n: countFor('cancelled') },
      { k: 'refunded' as const, label: statusLabels.refunded, n: countFor('refunded') },
    ];
  }, [stats, statusLabels, t]);

  const emptyResult = !!list && list.items.length === 0 && !loading;

  return (
    <MainLayout>
      <PageHelpButton topic="sales" />
      <div className="px-scope">
        <div className="sl-hero">
          <div>
            <div className="kicker">
              <span className="dot" />
              {t('crm.sales.kicker')}
            </div>
            <h1>{t('crm.sales.title')}</h1>
            <p className="sub">{t('crm.sales.subtitle')}</p>
            {user?.name && (
              <p className="mgr">
                {t('crm.sales.manager')}: <b>{user.name}</b>
              </p>
            )}
          </div>
          <div className="sl-hero-r">
            <span className="sl-cur">
              <span className="l">Валюта отчёта</span>
              <select value={reportCurrency} onChange={onCurrencyChange}>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </span>
            <button type="button" className="sl-btn" disabled={exporting} onClick={() => void handleExport()}>
              <Ic d={SL_ICON.down} size={14} />
              {exporting ? '…' : t('crm.sales.list.export')}
            </button>
            <button type="button" className="sl-btn solid" onClick={() => setAutomationOpen(true)}>
              <Ic d={SL_ICON.bolt} size={14} />
              {t('crm.automations.panel.button')}
            </button>
          </div>
        </div>

        <div className="sl-kpis">
          <Kpi l={t('crm.sales.summary.totalSales')} v={(stats?.totalCount ?? 0).toLocaleString(locale)} />
          <Kpi
            l={t('crm.sales.summary.revenue')}
            v={`${(stats?.totalAmount ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })} ${reportCurrency}`}
          />
          <Kpi
            l={t('crm.sales.summary.avgCheck')}
            v={`${(stats?.avgCheck ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })} ${reportCurrency}`}
          />
          <Kpi
            l={t('crm.sales.summary.refunds')}
            v={(refundedStat?.count ?? 0).toLocaleString(locale)}
            sub={refundedStat ? `${refundedStat.amount.toLocaleString(locale, { maximumFractionDigits: 0 })} ${reportCurrency}` : undefined}
          />
        </div>

        <div className="sl-filters">
          <span className="sl-fl-l">{t('crm.sales.filters.period')}</span>
          <div className="sl-seg">
            {([['7', 7], ['14', 14], ['30', 30], ['all', 'all']] as [PeriodKey, 7 | 14 | 30 | 'all'][]).map(([k, v]) => (
              <button key={k} className={period === k ? 'on' : ''} onClick={() => handleQuickRange(v)}>
                {v === 'all' ? t('crm.sales.filters.allTime') : t('crm.sales.filters.lastDays', { count: v })}
              </button>
            ))}
          </div>
          <span className="sl-div" />
          <span className="sl-fl-l">{t('crm.sales.filters.status')}</span>
          <div className="sl-chips">
            {statusChipDefs.map((s) => (
              <button
                key={s.k}
                className={cxs('sl-chip', (filters.status || 'all') === s.k && 'on')}
                onClick={() => onStatusChange(s.k)}
              >
                {s.label}
                <span className="n">{s.n}</span>
              </button>
            ))}
          </div>
          <span className="sl-sp" />
          <select className="sl-sel" value={filters.channelId || ''} onChange={onChannelChange}>
            <option value="">{t('crm.sales.filters.allChannels')}</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
          <div className="sl-search">
            <Ic d={SL_ICON.search} size={13} />
            <input
              placeholder={t('crm.sales.filters.searchPlaceholder')}
              defaultValue={filters.search || ''}
              onChange={onSearchChange}
            />
          </div>
        </div>

        {stats && (
          <div className="sl-two">
            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.charts.statusStructureTitle')}</span>
                <span className="s">{t('crm.sales.charts.statusStructureHint')}</span>
              </div>
              <div className="sl-panel-b">
                {stats.byStatus.length ? (
                  <div className="sl-bars">
                    {stats.byStatus.map((s) => {
                      const pct = stats.totalCount > 0 ? Math.round((s.count / stats.totalCount) * 100) : 0;
                      return (
                        <div key={s.status} className={cxs('sl-bar', s.status)}>
                          <div className="r1">
                            <span className="nm">{translateSaleStatus(t, i18n, s.status)}</span>
                            <span className="ct">{s.count}</span>
                            <span className="pc">{pct}%</span>
                          </div>
                          <div className="track">
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--fg-3)', fontStyle: 'italic', margin: 0 }}>
                    {t('crm.sales.charts.byCurrencyEmpty')}
                  </p>
                )}
              </div>
            </div>

            <div className="sl-panel">
              <div className="sl-panel-h">
                <span className="t">{t('crm.sales.charts.byCurrencyTitle')}</span>
                <span className="s">{t('crm.sales.charts.byCurrencyHint')}</span>
              </div>
              <div className="sl-panel-b">
                {stats.byCurrency.length ? (
                  <div className="sl-cur-rows">
                    {(() => {
                      const max = Math.max(...stats.byCurrency.map((c) => c.amount), 1);
                      return stats.byCurrency.map((c) => {
                        const pct = Math.max(8, (c.amount / max) * 100);
                        return (
                          <div key={c.currency} className="sl-cur-row">
                            <span className="code">{c.currency}</span>
                            <span className="track">
                              <span style={{ width: `${pct}%` }} />
                            </span>
                            <span className="amt">{c.amount.toLocaleString(locale, { maximumFractionDigits: 0 })}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', fontStyle: 'italic' }}>
                    {t('crm.sales.charts.byCurrencyEmpty')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="sl-panel">
          <div className="sl-panel-h">
            <span className="t">{t('crm.sales.list.title')}</span>
            <button type="button" className="sl-btn sm" style={{ marginLeft: 4 }} onClick={() => setCustomFieldsOpen(true)}>
              <Ic d={SL_ICON.cols} size={12} />
              {t('crm.sales.list.addColumn')}
            </button>
            {list && (
              <span className="s">{t('crm.sales.list.shown', { shown: list.items.length, total: list.total.toLocaleString(locale) })}</span>
            )}
          </div>

          {emptyResult ? (
            <div className="sl-empty">
              <span className="ic">
                <Ic d={SL_ICON.bag} size={17} />
              </span>
              <b>{t('crm.sales.list.empty')}</b>
              <p>{t('crm.sales.list.emptyHint')}</p>
              <div className="acts">
                <button type="button" className="sl-btn" onClick={resetFilters}>
                  {t('crm.sales.list.resetFilters')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="sl-tbl-wrap">
                <table className="sl-tbl">
                  <thead>
                    <tr>
                      {orderedColumns.map((col) => {
                        const fallback =
                          col.id === 'date'
                            ? 170
                            : col.id === 'id'
                              ? 130
                              : col.id === 'channel'
                                ? 190
                                : col.id === 'product'
                                  ? 210
                                  : col.id === 'customer'
                                    ? 200
                                    : col.id === 'amount'
                                      ? 150
                                      : col.id === 'status'
                                        ? 160
                                        : col.id === 'productLink'
                                          ? 130
                                          : 180;
                        const width = getColumnWidth(col.id, fallback);
                        const isRight = col.id === 'amount';
                        return (
                          <th
                            key={col.id}
                            {...columnDrag.getThProps(
                              col.id,
                              typeof col.label === 'string' ? col.label : String(col.label),
                              cxs(isRight && 'r'),
                            )}
                            style={{ width, minWidth: width }}
                          >
                            <span className="colhdr-drag">⋮⋮ </span>
                            {col.label}
                            <div data-col-resize onMouseDown={(e) => startResize(col.id, e)} />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {list?.items.map((s: Sale) => (
                      <tr key={s.id} onClick={() => navigate(`/app/sales/${s.id}`)}>
                        {orderedColumns.map((col) => {
                          const fallback =
                            col.id === 'date'
                              ? 170
                              : col.id === 'id'
                                ? 130
                                : col.id === 'channel'
                                  ? 190
                                  : col.id === 'product'
                                    ? 210
                                    : col.id === 'customer'
                                      ? 200
                                      : col.id === 'amount'
                                        ? 150
                                        : col.id === 'status'
                                          ? 160
                                          : col.id === 'productLink'
                                            ? 130
                                            : 180;
                          const width = getColumnWidth(col.id, fallback);
                          const cls =
                            col.id === 'date'
                              ? 'mono'
                              : col.id === 'id'
                                ? 'mono'
                                : col.id === 'amount'
                                  ? 'sum'
                                  : undefined;
                          return (
                            <td key={col.id} className={cls} style={{ width, minWidth: width }}>
                              {renderCell(s, col)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {(!list || list.items.length === 0) && !loading && (
                      <tr>
                        <td colSpan={orderedColumns.length} style={{ textAlign: 'center', padding: '20px 0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <LottieIcon name="empty-pulse" size={72} />
                            <span style={{ color: 'var(--fg-3)', fontStyle: 'italic', fontSize: 11.5 }}>
                              {t('crm.sales.list.empty')}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {list && (
                <div className="sl-tfoot">
                  <span className="h">{t('crm.sales.list.footHint')}</span>
                  {pageCount > 1 && (
                    <div className="pg">
                      <button type="button" disabled={list.page <= 1} onClick={() => onPageChange(list.page - 1)}>
                        {t('crm.sales.pagination.prev')}
                      </button>
                      {paginationWindow(list.page, pageCount).map((p, i) =>
                        p === '…' ? (
                          <button key={`gap-${i}`} disabled style={{ border: 'none', background: 'none' }}>
                            …
                          </button>
                        ) : (
                          <button key={p} className={p === list.page ? 'on' : ''} onClick={() => onPageChange(p)}>
                            {p}
                          </button>
                        ),
                      )}
                      <button type="button" disabled={list.page >= pageCount} onClick={() => onPageChange(list.page + 1)}>
                        {t('crm.sales.pagination.next')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {customFieldsOpen && (
          <CustomFieldsManager
            entityType="sale"
            title={t('crm.sales.list.customFieldsTitle')}
            onClose={() => setCustomFieldsOpen(false)}
            onUpdated={(list) =>
              setCustomFields([...list].sort((a, b) => a.order - b.order))
            }
          />
        )}
        <AutomationPanel
          open={automationOpen}
          onClose={() => setAutomationOpen(false)}
          entityType="sale"
        />

        {loading && (
          <div className="sl-toast">
            <span>
              <i className="pulse" />
              {t('crm.sales.loading')}
            </span>
          </div>
        )}

        {error && (
          <div className="sl-toast err">
            <span>{error}</span>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
