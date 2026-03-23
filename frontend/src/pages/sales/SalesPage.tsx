// src/pages/sales/SalesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { getStoredUser } from '../../auth/session';
import { useNavigate } from 'react-router-dom';
import {
  fetchSales,
  fetchSalesStats,
  updateSale,
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

export const SalesPage: React.FC = () => {
  const { t } = useTranslation();
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
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);

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
          fetchSalesStats(params),
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
  }, [JSON.stringify(filters)]);

  const pageCount = useMemo(() => {
    if (!list) return 1;
    return Math.max(1, Math.ceil(list.total / list.pageSize));
  }, [list]);

  const handleQuickRange = (days: 7 | 14 | 30 | 'all') => {
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
      { id: 'purchaseDate', label: t('crm.sales.list.headers.purchaseDate') },
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

  const handleColumnDrop = (targetId: string) => {
    if (!dragColumnId || dragColumnId === targetId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(dragColumnId);
      const to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragColumnId);
      return next;
    });
    setDragColumnId(null);
  };

  const renderCustomFieldCell = (sale: Sale, field: CustomField) => {
    const value = sale.customFields?.[field.key];
    const commonClass =
      'w-full px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-200 outline-none focus:border-lumiva-accent-soft';

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-[11px] text-slate-300">
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
      return (
        <select
          className={commonClass}
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

    return (
      <input
        className={commonClass}
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
    const fmtDateTime = created
      ? new Date(created).toLocaleString(locale)
      : t('crm.sales.common.empty');

    const channelLabel =
      (sale as any).channelName || sale.channelId || t('crm.sales.common.empty');
    const productName = sale.hotel || t('crm.sales.common.empty');
    const marketLabel = sale.market;
    const clientName =
      sale.guestName || sale.agentName || t('crm.sales.common.empty');
    const clientCompany =
      sale.guestName && sale.agentName ? sale.agentName : null;
    const notes =
      typeof sale.notes === 'string' ? sale.notes.trim() : '';
    const productUrl =
      notes && /^https?:\/\//i.test(notes) ? notes : undefined;

    switch (column.id) {
      case 'date':
        return <span className="text-slate-100">{fmtDateTime}</span>;
      case 'id':
        return (
          <div className="flex flex-col">
            <span className="font-mono text-[11px] text-slate-300">{sale.id}</span>
            {sale.externalId && (
              <span className="font-mono text-[10px] text-slate-500">
                {sale.externalId}
              </span>
            )}
          </div>
        );
      case 'channel':
        return (
          <div className="flex flex-col text-slate-300">
            <span>{channelLabel}</span>
            {sale.managerName && (
              <input
                value={sale.managerName}
                onChange={(e) =>
                  updateSaleInline(
                    sale.id,
                    { managerName: e.target.value },
                    { managerName: e.target.value || null },
                  )
                }
                onClick={(e) => e.stopPropagation()}
                className="mt-1 w-full px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400"
                placeholder={t('crm.sales.list.manager')}
              />
            )}
          </div>
        );
      case 'product':
        return (
          <div className="flex flex-col text-slate-300">
            <span>{productName}</span>
            {marketLabel && (
              <span className="text-[10px] text-slate-500">
                {t('crm.sales.list.market')}: {marketLabel}
              </span>
            )}
          </div>
        );
      case 'customer':
        return (
          <div className="flex flex-col text-slate-300">
            <span>{clientName}</span>
            {clientCompany && (
              <span className="text-[10px] text-slate-500">
                {t('crm.sales.list.company')}: {clientCompany}
              </span>
            )}
          </div>
        );
      case 'amount':
        return (
          <span className="text-slate-100">
            {sale.amount.toLocaleString(locale, { maximumFractionDigits: 0 })}{' '}
            <span className="text-slate-400">{sale.currency}</span>
          </span>
        );
      case 'status':
        return (
          <select
            value={sale.status}
            onChange={(e) =>
              updateSaleInline(
                sale.id,
                { status: e.target.value as SaleStatus },
                { status: e.target.value as SaleStatus },
              )
            }
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-200"
          >
            {(['new', 'pending', 'confirmed', 'cancelled', 'refunded', 'other'] as SaleStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ),
            )}
          </select>
        );
      case 'purchaseDate':
        return <span className="text-slate-400">{fmtDateTime}</span>;
      case 'productLink':
        return productUrl ? (
          <a
            href={productUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lumiva-accent hover:underline truncate inline-block max-w-[190px]"
            title={productUrl}
            onClick={(e) => e.stopPropagation()}
          >
            {t('crm.sales.list.openProduct')}
          </a>
        ) : notes ? (
          <span className="truncate inline-block max-w-[190px]" title={notes}>
            {notes}
          </span>
        ) : (
          t('crm.sales.common.empty')
        );
      default:
        if (column.field) return renderCustomFieldCell(sale, column.field);
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + краткий summary */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              {t('crm.sales.kicker')}
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              {t('crm.sales.title')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {t('crm.sales.subtitle')}
            </p>
            {user?.name && (
              <p className="text-[11px] text-slate-500 mt-1">
                {t('crm.sales.manager')}:{' '}
                <span className="text-slate-300">{user.name}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {stats && (
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                  {t('crm.sales.summary.totalSales')}:{' '}
                  <span className="font-semibold">
                    {stats.totalCount.toLocaleString(locale)}
                  </span>
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                  {t('crm.sales.summary.revenue')}:{' '}
                  <span className="font-semibold">
                    {stats.totalAmount.toLocaleString(locale, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    €
                  </span>
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                  {t('crm.sales.summary.avgCheck')}:{' '}
                  <span className="font-semibold">
                    {stats.avgCheck.toLocaleString(locale, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    €
                  </span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAutomationOpen(true)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80 inline-flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M4 12h4" />
                <path d="M16 12h4" />
                <path d="M7.8 7.8l2.8 2.8" />
                <path d="M13.4 13.4l2.8 2.8" />
                <path d="M16.2 7.8l-2.8 2.8" />
                <path d="M10.6 13.4l-2.8 2.8" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
              {t('crm.automations.panel.button')}
            </button>
          </div>
        </section>

        {/* Фильтры */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-3.5 md:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1 shadow-sm">
              <span className="text-[11px] text-slate-600 pl-1">
                {t('crm.sales.filters.period')}
              </span>
              <QuickRangeButton
                label={t('crm.sales.filters.lastDays', { count: 7 })}
                active={!!filters.from && !!filters.to}
                onClick={() => handleQuickRange(7)}
              />
              <QuickRangeButton
                label={t('crm.sales.filters.lastDays', { count: 14 })}
                onClick={() => handleQuickRange(14)}
              />
              <QuickRangeButton
                label={t('crm.sales.filters.lastDays', { count: 30 })}
                onClick={() => handleQuickRange(30)}
              />
              <QuickRangeButton
                label={t('crm.sales.filters.allTime')}
                onClick={() => handleQuickRange('all')}
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[11px] text-slate-500">
                {t('crm.sales.filters.status')}:
              </span>
              <StatusPill
                label={t('crm.sales.filters.statusAll')}
                active={!filters.status || filters.status === 'all'}
                onClick={() => onStatusChange('all')}
              />
              {(['pending', 'confirmed', 'cancelled', 'refunded'] as SaleStatus[]).map(
                (s) => (
                  <StatusPill
                    key={s}
                    label={statusLabels[s]}
                    active={filters.status === s}
                    onClick={() => onStatusChange(s)}
                  />
                ),
              )}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={filters.channelId || ''}
                onChange={onChannelChange}
                className="h-8 px-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 outline-none min-w-[150px]"
              >
                <option value="">{t('crm.sales.filters.allChannels')}</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <input
                  type="text"
                  placeholder={t('crm.sales.filters.searchPlaceholder')}
                  defaultValue={filters.search || ''}
                  onChange={onSearchChange}
                  className="h-8 w-56 md:w-72 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[11px] text-slate-100 px-7 pr-2 outline-none"
                />
                <span className="absolute left-2 top-1.5 text-slate-500 text-[13px]">
                  🔍
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* KPI + «графики» по статусам и валютам */}
        {stats && (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1.4fr)]">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {t('crm.sales.charts.statusStructureTitle')}
                </h2>
                <span className="text-[11px] text-slate-500">
                  {t('crm.sales.charts.statusStructureHint')}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {stats.byStatus.map((s) => (
                  <StatusBarRow key={s.status} stat={s} />
                ))}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-100">
                  {t('crm.sales.charts.byCurrencyTitle')}
                </h2>
                <span className="text-[11px] text-slate-500">
                  {t('crm.sales.charts.byCurrencyHint')}
                </span>
              </div>
              {stats.byCurrency.length ? (
                <div className="space-y-2 text-xs">
                  <CurrencyRowList stats={stats.byCurrency} />
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.sales.charts.byCurrencyEmpty')}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Таблица продаж */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              {t('crm.sales.list.title')}
            </h2>
            <div className="flex items-center gap-3">
              {list && (
                <span className="text-[11px] text-slate-500">
                  {t('crm.sales.list.shown', {
                    shown: list.items.length,
                    total: list.total.toLocaleString(locale),
                  })}
                </span>
              )}
              <button
                type="button"
                onClick={() => setCustomFieldsOpen(true)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-200 hover:bg-slate-900/80"
              >
                {`+ ${t('crm.sales.list.addColumn')}`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1 table-fixed">
              <thead className="text-slate-500">
                <tr>
                  {orderedColumns.map((col) => {
                    const fallback =
                      col.id === 'date'
                        ? 170
                        : col.id === 'id'
                          ? 180
                          : col.id === 'channel'
                            ? 200
                            : col.id === 'product'
                              ? 200
                              : col.id === 'customer'
                                ? 200
                                : col.id === 'amount'
                                  ? 140
                                  : col.id === 'status'
                                    ? 160
                                    : col.id === 'purchaseDate'
                                      ? 170
                                      : col.id === 'productLink'
                                        ? 200
                                        : 180;
                    const width = getColumnWidth(col.id, fallback);
                    return (
                      <th
                        key={col.id}
                        draggable
                        onDragStart={(e) => {
                          setDragColumnId(col.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', col.id);
                        }}
                        onDragEnd={() => setDragColumnId(null)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleColumnDrop(col.id)}
                        className="text-left font-normal px-2 py-1 relative group"
                        style={{ width, minWidth: width }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="cursor-move">⋮⋮</span>
                          <span>{col.label}</span>
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover:opacity-100"
                          onMouseDown={(e) => startResize(col.id, e)}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {list?.items.map((s: Sale) => (
                  <tr
                    key={s.id}
                    className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/app/sales/${s.id}`)}
                  >
                    {orderedColumns.map((col) => {
                      const fallback =
                        col.id === 'date'
                          ? 170
                          : col.id === 'id'
                            ? 180
                            : col.id === 'channel'
                              ? 200
                              : col.id === 'product'
                                ? 200
                                : col.id === 'customer'
                                  ? 200
                                  : col.id === 'amount'
                                    ? 140
                                    : col.id === 'status'
                                      ? 160
                                      : col.id === 'purchaseDate'
                                        ? 170
                                        : col.id === 'productLink'
                                          ? 200
                                          : 180;
                      const width = getColumnWidth(col.id, fallback);
                      return (
                        <td
                          key={col.id}
                          className="px-2 py-1.5 text-slate-400"
                          style={{ width, minWidth: width }}
                        >
                          {renderCell(s, col)}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {(!list || list.items.length === 0) && !loading && (
                  <tr>
                    <td
                      colSpan={orderedColumns.length}
                      className="px-2 py-5 text-center text-[11px] text-slate-500 italic"
                    >
                      {t('crm.sales.list.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Пагинация */}
          {list && pageCount > 1 && (
            <div className="mt-4 flex justify-between items-center text-[11px] text-slate-400">
              <div>
                {t('crm.sales.pagination.page', {
                  page: list.page,
                  pages: pageCount,
                })}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={list.page <= 1}
                  onClick={() => onPageChange(list.page - 1)}
                  className="px-2 py-1 rounded-lg border border-slate-700/80 disabled:opacity-40 bg-slate-950/80 hover:bg-slate-900/80"
                >
                  {t('crm.sales.pagination.prev')}
                </button>
                <button
                  type="button"
                  disabled={list.page >= pageCount}
                  onClick={() => onPageChange(list.page + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-700/80 disabled:opacity-40 bg-slate-950/80 hover:bg-slate-900/80"
                >
                  {t('crm.sales.pagination.next')}
                </button>
              </div>
            </div>
          )}
        </section>
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
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/95 border border-slate-700/80 text-[11px] text-slate-200 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent animate-pulse" />
              {t('crm.sales.loading')}
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-red-950/95 border border-red-700/80 text-[11px] text-red-100">
              {error}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

/* ─────────────────────────────── */
/* Мелкие компоненты              */
/* ─────────────────────────────── */

const QuickRangeButton: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'px-3 py-1.5 rounded-xl text-[11px] transition ' +
      (active
        ? 'bg-black text-white font-semibold shadow-[0_10px_30px_rgba(15,23,42,0.2)]'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
    }
  >
    {label}
  </button>
);

const StatusPill: React.FC<{
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'px-2.5 py-1 rounded-full text-[11px] border ' +
      (active
        ? 'border-lumiva-accent-soft bg-lumiva-accent/15 text-slate-50'
        : 'border-slate-700/80 text-slate-300 hover:bg-slate-900/80')
    }
  >
    {label}
  </button>
);

const StatusBarRow: React.FC<{
  stat: SalesStats['byStatus'][number];
}> = ({ stat }) => {
  const { t } = useTranslation();
  const locale = getLocale();
  const maxAmount = Math.max(stat.amount, 1);
  const width = Math.max(8, (stat.amount / maxAmount) * 100);

  const statusLabel = t(`crm.sales.status.${stat.status}`);

  let color = 'from-slate-400 to-slate-300';
  if (stat.status === 'confirmed') color = 'from-emerald-400 to-lumiva-accent';
  if (stat.status === 'pending') color = 'from-amber-400 to-amber-300';
  if (stat.status === 'cancelled' || stat.status === 'refunded')
    color = 'from-rose-400 to-rose-300';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-300">{statusLabel}</span>
        <span className="text-slate-500 whitespace-nowrap">
          {t('crm.sales.units.items', {
            count: stat.count.toLocaleString(locale),
          })}{' '}
          · {stat.amount.toLocaleString(locale)} €
        </span>
      </div>
      <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const CurrencyRowList: React.FC<{
  stats: { currency: string; amount: number }[];
}> = ({ stats }) => {
  const locale = getLocale();
  const max = Math.max(...stats.map((s) => s.amount), 1);

  return (
    <>
      {stats.map((c) => {
        const width = Math.max(8, (c.amount / max) * 100);
        return (
          <div key={c.currency} className="flex items-center gap-3">
            <div className="w-10 text-slate-300">{c.currency}</div>
            <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lumiva-accent-soft to-lumiva-accent"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="w-24 text-right text-slate-300">
              {c.amount.toLocaleString(locale, {
                maximumFractionDigits: 0,
              })}
            </div>
          </div>
        );
      })}
    </>
  );
};

const SalesRow: React.FC<{ sale: Sale; onOpen: () => void }> = ({
  sale,
  onOpen,
}) => {
  const { t } = useTranslation();
  const locale = getLocale();
  const created = sale.saleDate || sale.createdAt;
  const fmtDateTime = created
    ? new Date(created).toLocaleString(locale)
    : t('crm.sales.common.empty');

  const statusLabel = t(`crm.sales.status.${sale.status}`);

  let statusColor = 'bg-slate-800 text-slate-300';
  if (sale.status === 'confirmed')
    statusColor = 'bg-emerald-900/60 text-emerald-300';
  if (sale.status === 'pending')
    statusColor = 'bg-amber-900/60 text-amber-300';
  if (sale.status === 'cancelled' || sale.status === 'refunded')
    statusColor = 'bg-rose-900/60 text-rose-300';

  const channelLabel =
    (sale as any).channelName || sale.channelId || t('crm.sales.common.empty');

  // Товар: храним в поле hotel, рынок — в market
  const productName = sale.hotel || t('crm.sales.common.empty');
  const marketLabel = sale.market;

  // Клиент: имя → guestName, компания/доп.инфо → agentName
  const clientName =
    sale.guestName || sale.agentName || t('crm.sales.common.empty');
  const clientCompany =
    sale.guestName && sale.agentName ? sale.agentName : null;

  // Ссылка на товар: если в notes лежит URL — делаем кликабельной
  const notes =
    typeof sale.notes === 'string' ? sale.notes.trim() : '';
  const productUrl =
    notes && /^https?:\/\//i.test(notes) ? notes : undefined;

  return (
    <tr
      className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors cursor-pointer"
      onClick={onOpen}
    >
      <td className="px-2 py-1.5 text-slate-100 whitespace-nowrap">
        {fmtDateTime}
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="font-mono text-[11px]">{sale.id}</span>
          {sale.externalId && (
            <span className="font-mono text-[10px] text-slate-500">
              {sale.externalId}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
            <span>{channelLabel}</span>
          {sale.managerName && (
            <span className="text-[10px] text-slate-500">
              {t('crm.sales.list.manager')}: {sale.managerName}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{productName}</span>
          {marketLabel && (
            <span className="text-[10px] text-slate-500">
              {t('crm.sales.list.market')}: {marketLabel}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{clientName}</span>
          {clientCompany && (
            <span className="text-[10px] text-slate-500">
              {t('crm.sales.list.company')}: {clientCompany}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-slate-100 whitespace-nowrap">
        {sale.amount.toLocaleString(locale, {
          maximumFractionDigits: 0,
        })}{' '}
        <span className="text-slate-400">{sale.currency}</span>
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">
        {fmtDateTime}
      </td>
      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap max-w-[200px]">
        {productUrl ? (
          <a
            href={productUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lumiva-accent hover:underline truncate inline-block max-w-[190px]"
            title={productUrl}
            onClick={(e) => e.stopPropagation()}
          >
            {t('crm.sales.list.openProduct')}
          </a>
        ) : notes ? (
          <span
            className="truncate inline-block max-w-[190px]"
            title={notes}
          >
            {notes}
          </span>
        ) : (
          t('crm.sales.common.empty')
        )}
      </td>
    </tr>
  );
};
