// src/pages/sales/SalesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { getStoredUser } from '../../auth/session';
import { useNavigate } from 'react-router-dom';
import {
  fetchSales,
  fetchSalesStats,
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
            {list && (
              <span className="text-[11px] text-slate-500">
                {t('crm.sales.list.shown', {
                  shown: list.items.length,
                  total: list.total.toLocaleString(locale),
                })}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.date')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.id')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.channel')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.product')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.customer')}
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    {t('crm.sales.list.headers.amount')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.status')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.purchaseDate')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.sales.list.headers.productLink')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list?.items.map((s: Sale) => (
                  <SalesRow
                    key={s.id}
                    sale={s}
                    onOpen={() => navigate(`/app/sales/${s.id}`)}
                  />
                ))}

                {(!list || list.items.length === 0) && !loading && (
                  <tr>
                    <td
                      colSpan={9}
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
