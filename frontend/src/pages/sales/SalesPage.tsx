// src/pages/sales/SalesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
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

/* Карточки статусов — полное соответствие SaleStatus */
const STATUS_LABEL: Record<SaleStatus, string> = {
  new: 'Новый',
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  refunded: 'Возврат',
  other: 'Другое',
};

export const SalesPage: React.FC = () => {
  const user = getStoredUser();
  const navigate = useNavigate();

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
        setError(e.message || 'Не удалось загрузить продажи');
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
              Продажи
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Все продажи по каналам
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Здесь вы видите консолидированный список заказов из
              подключённых каналов: интернет-магазины, сайты, маркетплейсы
              и другие источники. Используйте фильтры, чтобы анализировать
              продажи по периодам, статусам и каналам.
            </p>
            {user?.name && (
              <p className="text-[11px] text-slate-500 mt-1">
                Менеджер:{' '}
                <span className="text-slate-300">{user.name}</span>
              </p>
            )}
          </div>
          {stats && (
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                Всего продаж:{' '}
                <span className="font-semibold">
                  {stats.totalCount.toLocaleString('ru-RU')}
                </span>
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                Выручка:{' '}
                <span className="font-semibold">
                  {stats.totalAmount.toLocaleString('ru-RU', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  €
                </span>
              </span>
              <span className="px-2 py-1 rounded-full bg-slate-900/80 border border-slate-800/80">
                Средний чек:{' '}
                <span className="font-semibold">
                  {stats.avgCheck.toLocaleString('ru-RU', {
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
            <span className="text-[11px] text-slate-500 mr-1">
              Период:
            </span>
            <QuickRangeButton
              label="7 дней"
              active={!!filters.from && !!filters.to}
              onClick={() => handleQuickRange(7)}
            />
            <QuickRangeButton
              label="14 дней"
              onClick={() => handleQuickRange(14)}
            />
            <QuickRangeButton
              label="30 дней"
              onClick={() => handleQuickRange(30)}
            />
            <QuickRangeButton
              label="Всё время"
              onClick={() => handleQuickRange('all')}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-[11px] text-slate-500">
                Статус:
              </span>
              <StatusPill
                label="Все"
                active={!filters.status || filters.status === 'all'}
                onClick={() => onStatusChange('all')}
              />
              {(['pending', 'confirmed', 'cancelled', 'refunded'] as SaleStatus[]).map(
                (s) => (
                  <StatusPill
                    key={s}
                    label={STATUS_LABEL[s]}
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
                <option value="">Все каналы</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск: ID, клиент, товар..."
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
                  Структура по статусам
                </h2>
                <span className="text-[11px] text-slate-500">
                  количество и выручка
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
                  Выручка по валютам
                </h2>
                <span className="text-[11px] text-slate-500">
                  сумма по текущему фильтру
                </span>
              </div>
              {stats.byCurrency.length ? (
                <div className="space-y-2 text-xs">
                  <CurrencyRowList stats={stats.byCurrency} />
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Нет данных по валютам.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Таблица продаж */}
        <section className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Список продаж
            </h2>
            {list && (
              <span className="text-[11px] text-slate-500">
                Показано {list.items.length} из{' '}
                {list.total.toLocaleString('ru-RU')}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    Дата
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    ID / External
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Канал
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Товар
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Клиент
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    Сумма
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Статус
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Дата покупки
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    Ссылка на товар
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
                      Продаж пока нет по выбранным фильтрам.
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
                Страница {list.page} из {pageCount}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={list.page <= 1}
                  onClick={() => onPageChange(list.page - 1)}
                  className="px-2 py-1 rounded-lg border border-slate-700/80 disabled:opacity-40 bg-slate-950/80 hover:bg-slate-900/80"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  disabled={list.page >= pageCount}
                  onClick={() => onPageChange(list.page + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-700/80 disabled:opacity-40 bg-slate-950/80 hover:bg-slate-900/80"
                >
                  Вперёд →
                </button>
              </div>
            </div>
          )}
        </section>

        {loading && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/95 border border-slate-700/80 text-[11px] text-slate-200 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent animate-pulse" />
              Загружаем продажи…
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
      'px-2.5 py-1 rounded-full text-[11px] border ' +
      (active
        ? 'border-lumiva-accent-soft bg-lumiva-accent/10 text-slate-50'
        : 'border-slate-700/80 text-slate-300 hover:bg-slate-900/80')
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
  const maxAmount = Math.max(stat.amount, 1);
  const width = Math.max(8, (stat.amount / maxAmount) * 100);

  const statusLabel = STATUS_LABEL[stat.status];

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
          {stat.count.toLocaleString('ru-RU')} шт ·{' '}
          {stat.amount.toLocaleString('ru-RU')} €
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
              {c.amount.toLocaleString('ru-RU', {
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
  const created = sale.saleDate || sale.createdAt;
  const fmtDateTime = created
    ? new Date(created).toLocaleString('ru-RU')
    : '—';

  const statusLabel = STATUS_LABEL[sale.status];

  let statusColor = 'bg-slate-800 text-slate-300';
  if (sale.status === 'confirmed')
    statusColor = 'bg-emerald-900/60 text-emerald-300';
  if (sale.status === 'pending')
    statusColor = 'bg-amber-900/60 text-amber-300';
  if (sale.status === 'cancelled' || sale.status === 'refunded')
    statusColor = 'bg-rose-900/60 text-rose-300';

  const channelLabel =
    (sale as any).channelName || sale.channelId || '—';

  // Товар: храним в поле hotel, рынок — в market
  const productName = sale.hotel || '—';
  const marketLabel = sale.market;

  // Клиент: имя → guestName, компания/доп.инфо → agentName
  const clientName = sale.guestName || sale.agentName || '—';
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
              Менеджер: {sale.managerName}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{productName}</span>
          {marketLabel && (
            <span className="text-[10px] text-slate-500">
              Страна / рынок: {marketLabel}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-slate-300 whitespace-nowrap">
        <div className="flex flex-col">
          <span>{clientName}</span>
          {clientCompany && (
            <span className="text-[10px] text-slate-500">
              Компания: {clientCompany}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right text-slate-100 whitespace-nowrap">
        {sale.amount.toLocaleString('ru-RU', {
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
            Открыть товар
          </a>
        ) : notes ? (
          <span
            className="truncate inline-block max-w-[190px]"
            title={notes}
          >
            {notes}
          </span>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
};