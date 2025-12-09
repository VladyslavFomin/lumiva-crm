// src/pages/marketing/TrafficPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchMarketingTraffic,
  type MarketingTrafficStats,
  type MarketingTrafficRow,
} from '../../api/marketing';

type PeriodPreset = '7d' | '30d' | '90d' | 'all';

interface DateRange {
  from?: string;
  to?: string;
}

const periodLabel: Record<PeriodPreset, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
  all: 'Все время',
};

interface ChannelAgg {
  key: string;                // google / cpc
  source: string | null;      // google
  medium: string | null;      // cpc / organic / direct

  sessions: number;
  conversions: number;        // leads
  revenue: number;
  currency: string;

  cr: number;                 // conversions / sessions
  revPerSession: number;      // revenue / sessions
}

const formatNumber = (v: number) =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

export const TrafficPage: React.FC = () => {
  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [range, setRange] = useState<DateRange>({});
  const [stats, setStats] = useState<MarketingTrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Пересчёт диапазона по пресетам
  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);

    if (p === 'all') {
      setRange({});
      return;
    }

    const today = new Date();
    const end = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );

    const start = new Date(end);
    if (p === '7d') {
      start.setUTCDate(end.getUTCDate() - 6);
    } else if (p === '30d') {
      start.setUTCDate(end.getUTCDate() - 29);
    } else if (p === '90d') {
      start.setUTCDate(end.getUTCDate() - 89);
    }

    setRange({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  };

  // первый рендер — "Все время"
  useEffect(() => {
    applyPreset('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // загрузка данных
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchMarketingTraffic({
      from: range.from,
      to: range.to,
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить данные по трафику');
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const currency = stats?.currency || 'EUR';

  // Агрегация по источнику/medium
  const channels: ChannelAgg[] = useMemo(() => {
    if (!stats) return [];

    const map = new Map<string, ChannelAgg>();

    (stats.items || []).forEach((row: MarketingTrafficRow) => {
      const r: any = row; // utm-поля храним как any, чтобы не ругался TS

      const source = (r.source as string | undefined) ?? '(unknown)';
      const medium = (r.medium as string | undefined) ?? '(none)';
      const key = `${source} / ${medium}`;

      const current = map.get(key) || {
        key,
        source,
        medium,
        sessions: 0,
        conversions: 0,
        revenue: 0,
        currency: row.currency || currency,
        cr: 0,
        revPerSession: 0,
      };

      const sessions = (r.sessions as number | undefined) || 0;
      const leads = row.leads || 0;

      current.sessions += sessions;
      current.conversions += leads;
      current.revenue += row.revenue || 0;

      map.set(key, current);
    });

    const list = Array.from(map.values());

    list.forEach((ch) => {
      ch.cr = ch.sessions > 0 ? ch.conversions / ch.sessions : 0;
      ch.revPerSession =
        ch.sessions > 0 ? ch.revenue / ch.sessions : 0;
    });

    // сортировка по сессиям
    list.sort((a, b) => b.sessions - a.sessions);

    return list;
  }, [stats, currency]);

  // Глобальные KPI
  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
  const totalConversions = channels.reduce(
    (s, c) => s + c.conversions,
    0,
  );
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);

  const globalCr =
    totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const revPerSession =
    totalSessions > 0 ? totalRevenue / totalSessions : 0;

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Маркетинг · Трафик
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Источники трафика и эффективность
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Здесь отображаются реальные данные из аналитики (Google
              Analytics, Яндекс.Метрика и др.), агрегированные по
              основным каналам. Пока цифры берутся из таблицы
              маркетингового трафика в CRM.
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 px-2 py-1">
              <span className="text-[11px] text-slate-500 pl-1">
                Период
              </span>
              {(['7d', '30d', '90d', 'all'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={
                    'px-3 py-1.5 rounded-xl text-[11px] transition ' +
                    (preset === p
                      ? 'bg-sky-500 text-slate-950 font-semibold shadow-[0_0_0_1px_rgba(56,189,248,0.3)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900')
                  }
                >
                  {periodLabel[p]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading && (
          <div className="text-[11px] text-slate-400">
            Загружаем данные по трафику…
          </div>
        )}

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* KPI плашки */}
            <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
              <div className="rounded-3xl bg-slate-950/90 border border-slate-800/80 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-slate-400 mb-1">
                  Сессии
                </div>
                <div className="text-2xl font-semibold text-slate-50">
                  {formatNumber(totalSessions)}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Всего сессий по всем источникам за период.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-400/10 to-slate-950 border border-emerald-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-emerald-300 mb-1">
                  Конверсии
                </div>
                <div className="text-2xl font-semibold text-emerald-300">
                  {formatNumber(totalConversions)}
                </div>
                <div className="text-[11px] text-emerald-100/70 mt-2">
                  Суммарное количество заявок / лидов.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-slate-950 border border-sky-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-sky-300 mb-1">
                  Конверсия (CR)
                </div>
                <div className="text-2xl font-semibold text-sky-300">
                  {totalSessions > 0
                    ? `${globalCr.toFixed(1)}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-sky-100/70 mt-2">
                  Доля сессий, которые превратились в лиды.
                </div>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-slate-950 border border-fuchsia-500/40 px-4 py-4 flex flex-col justify-between">
                <div className="text-[11px] text-fuchsia-300 mb-1">
                  Доход на сессию
                </div>
                <div className="text-2xl font-semibold text-fuchsia-200">
                  {totalSessions > 0
                    ? `${revPerSession.toFixed(2)} ${currency}`
                    : '—'}
                </div>
                <div className="text-[11px] text-fuchsia-100/70 mt-2">
                  Средний доход, который приносит одна сессия.
                </div>
              </div>
            </section>

            {/* Таблица каналов */}
            <section className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs">
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-slate-50">
                  Источники трафика
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Каналы сессий, количество конверсий и доход по
                  каждому источнику.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800/80 text-slate-400">
                      <th className="py-1.5 pr-3 text-left font-normal">
                        Источник / канал
                      </th>
                      <th className="py-1.5 px-3 text-left font-normal">
                        Тип
                      </th>
                      <th className="py-1.5 px-3 text-right font-normal">
                        Сессии
                      </th>
                      <th className="py-1.5 px-3 text-right font-normal">
                        Конверсии
                      </th>
                      <th className="py-1.5 px-3 text-right font-normal">
                        CR
                      </th>
                      <th className="py-1.5 px-3 text-right font-normal">
                        Доход
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-3 text-center text-slate-500"
                        >
                          Пока нет данных по трафику за выбранный период.
                        </td>
                      </tr>
                    )}

                    {channels.map((ch) => {
                      const type = (() => {
                        const m = (ch.medium || '').toLowerCase();
                        if (m === 'cpc' || m === 'paid') return 'Paid';
                        if (m === 'organic') return 'Organic Search';
                        if (m === 'email') return 'Email';
                        if (m === 'social' || m === 'paid_social')
                          return 'Social';
                        if (m === '(none)' || m === 'direct') return 'Direct';
                        return m || 'Other';
                      })();

                      return (
                        <tr
                          key={ch.key}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-slate-100">
                            {ch.key}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300">
                            {type}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
                            {formatNumber(ch.sessions)}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
                            {formatNumber(ch.conversions)}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sky-300">
                            {ch.cr ? `${(ch.cr * 100).toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-emerald-300 font-mono">
                            {ch.revenue
                              ? `${formatNumber(ch.revenue)} ${ch.currency}`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};