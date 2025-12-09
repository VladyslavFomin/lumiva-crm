import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '../../layout/MainLayout';
import {
  fetchSmmProfiles,
  fetchSmmStats,
  createSmmProfile,
  deleteSmmProfile,
  type SmmProfile,
  type SmmPlatform,
  type SmmStatsResponse,
  type SmmProfileLastStat,
} from '../../api/smm';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';



type PeriodPreset = '7d' | '30d' | '90d';

interface DateRange {
  from?: string;
  to?: string;
}

const periodLabel: Record<PeriodPreset, string> = {
  '7d': '7 дней',
  '30d': '30 дней',
  '90d': '90 дней',
};

const PLATFORM_LABEL: Record<SmmPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  vk: 'VK',
  tiktok: 'TikTok',
  other: 'Другое',
};

const PLATFORM_COLORS: Record<SmmPlatform, string> = {
  instagram: '#e1306c',
  facebook: '#1877f2',
  vk: '#4c75a3',
  tiktok: '#25f4ee',
  other: '#9ca3af',
};

interface FollowersChartPoint {
  date: string;
  instagram?: number;
  facebook?: number;
  vk?: number;
  tiktok?: number;
  other?: number;
}

const FollowersTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-[11px] text-slate-100 shadow-xl max-w-[260px]">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-slate-300">
          <span className="inline-block w-3 h-3 rounded-full mr-1 align-middle"
            style={{ background: p.color }} />
          <span className="align-middle">
            {p.name}: {p.value?.toLocaleString?.('ru-RU') ?? p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const SmmPage: React.FC = () => {
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [range, setRange] = useState<DateRange>({});
  const [profiles, setProfiles] = useState<SmmProfile[]>([]);
  const [stats, setStats] = useState<SmmStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    platform: SmmPlatform;
    handle: string;
    url: string;
    note: string;
  }>({
    platform: 'instagram',
    handle: '',
    url: '',
    note: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // ------ helpers: период

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p);

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

  useEffect(() => {
    applyPreset('30d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------ загрузка профилей

  useEffect(() => {
    setLoadingProfiles(true);
    fetchSmmProfiles()
      .then(setProfiles)
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить SMM-профили');
      })
      .finally(() => setLoadingProfiles(false));
  }, []);

  // ------ загрузка статов

  useEffect(() => {
    if (!range.from || !range.to) return;
    setLoading(true);
    setError(null);

    fetchSmmStats({
      from: range.from,
      to: range.to,
    })
      .then((res) => setStats(res))
      .catch((e: any) => {
        console.error(e);
        setError(e.message || 'Не удалось загрузить SMM-статистику');
      })
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  // ------ агрегаты

  const latestFollowersByProfile = useMemo(() => {
    const map = new Map<string, { followers: number; platform: SmmPlatform }>();
    if (!stats?.items?.length) return map;

    // предполагаем, что items по дате уже отсортированы ASC на бэке
    for (const row of stats.items) {
      map.set(row.profileId, {
        followers: row.followers || 0,
        platform: row.platform || 'other',
      });
    }
    return map;
  }, [stats]);

  const totalFollowers = useMemo(() => {
    let sum = 0;
    for (const v of latestFollowersByProfile.values()) {
      sum += v.followers;
    }
    return sum;
  }, [latestFollowersByProfile]);

  // прирост фолловеров за период: берём первые и последние значения по каждому профилю
  const followersDeltaTotal = useMemo(() => {
    if (!stats?.items?.length) return 0;

    const firstByProfile = new Map<string, number>();
    const lastByProfile = new Map<string, number>();

    for (const row of stats.items) {
      if (!firstByProfile.has(row.profileId)) {
        firstByProfile.set(row.profileId, row.followers || 0);
      }
      lastByProfile.set(row.profileId, row.followers || 0);
    }

    let delta = 0;
    for (const [id, first] of firstByProfile.entries()) {
      const last = lastByProfile.get(id) ?? first;
      delta += last - first;
    }
    return delta;
  }, [stats]);

  const totalImpressions = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.impressions || 0), 0);
  }, [stats]);

  const totalVideoViews = useMemo(() => {
    if (!stats?.items?.length) return 0;
    return stats.items.reduce((s, r) => s + (r.videoViews || 0), 0);
  }, [stats]);

  // ------ данные для графика

  const chartData: FollowersChartPoint[] = useMemo(() => {
    if (!stats?.items?.length) return [];

    const byDate = new Map<string, FollowersChartPoint>();

    for (const row of stats.items) {
      const date = row.date;
      const platform: SmmPlatform = row.platform || 'other';

      const point =
        byDate.get(date) ||
        ({
          date,
        } as FollowersChartPoint);

      const platformKey = platform as keyof FollowersChartPoint;
      (point as any)[platformKey] =
    Number((point as any)[platformKey] || 0) + Number(row.followers || 0);

      byDate.set(date, point);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }, [stats]);

  // ------ создание профиля

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.handle.trim()) return;

    try {
      setSavingProfile(true);
      const created = await createSmmProfile({
        platform: form.platform,
        handle: form.handle.trim(),
        url: form.url.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setProfiles((prev) => [...prev, { ...created, lastStat: null }]);
      setForm((prev) => ({
        ...prev,
        handle: '',
        url: '',
        note: '',
      }));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Не удалось создать профиль');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async (p: SmmProfile) => {
    if (!window.confirm(`Удалить профиль ${PLATFORM_LABEL[p.platform]} @${p.handle}?`)) {
      return;
    }
    try {
      await deleteSmmProfile(p.id);
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Не удалось удалить профиль');
    }
  };

  // ------ render

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Заголовок + пресеты */}
        <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
              Маркетинг · SMM
            </div>
            <h1 className="text-lg md:text-xl font-semibold text-slate-50">
              Соцсети и динамика аудитории
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Хранение профилей соцсетей (Instagram, Facebook, VK, TikTok) и
              дневной статистики: подписчики, охват, просмотры, вовлечение.
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            {/* Период */}
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 px-2 py-1">
              <span className="text-[11px] text-slate-500 pl-1">Период</span>
              {(['7d', '30d', '90d'] as PeriodPreset[]).map((p) => (
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

        {error && (
          <div className="text-[11px] text-red-400">{error}</div>
        )}

        {/* KPI блоки */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-950/90 via-slate-900/90 to-slate-950/90 border border-slate-800/80 px-4 py-4 flex flex-col justify-between">
            <div className="text-[11px] text-slate-400 mb-1">
              Активные профили
            </div>
            <div className="text-2xl font-semibold text-slate-50">
              {profiles.length.toLocaleString('ru-RU')}
            </div>
            <div className="text-[11px] text-slate-500 mt-2">
              Суммарное количество профилей, подгруженных в CRM.
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-slate-950 border border-sky-500/40 px-4 py-4 flex flex-col justify-between">
            <div className="text-[11px] text-sky-300 mb-1">
              Подписчики (текущие)
            </div>
            <div className="text-2xl font-semibold text-sky-300">
              {totalFollowers.toLocaleString('ru-RU')}
            </div>
            <div className="text-[11px] text-sky-100/70 mt-2">
              Сумма подписчиков по всем профилям на последнюю дату.
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 via-emerald-400/10 to-slate-950 border border-emerald-500/40 px-4 py-4 flex flex-col justify-between">
            <div className="text-[11px] text-emerald-300 mb-1">
              Прирост подписчиков
            </div>
            <div className="text-2xl font-semibold text-emerald-300">
              {followersDeltaTotal >= 0 ? '+' : ''}
              {followersDeltaTotal.toLocaleString('ru-RU')}
            </div>
            <div className="text-[11px] text-emerald-200/70 mt-2">
              Разница между началом и концом выбранного периода.
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-fuchsia-500/10 via-rose-500/5 to-slate-950 border border-fuchsia-500/40 px-4 py-4 flex flex-col justify-between">
            <div className="text-[11px] text-fuchsia-300 mb-1">
              Охват и видео-просмотры
            </div>
            <div className="text-sm font-semibold text-fuchsia-100">
              Охват:{' '}
              <span className="text-lg">
                {totalImpressions.toLocaleString('ru-RU')}
              </span>
            </div>
            <div className="text-[11px] text-fuchsia-100/70 mt-1">
              Видео-просмотры:{' '}
              {totalVideoViews.toLocaleString('ru-RU')}
            </div>
            <div className="text-[11px] text-fuchsia-100/60 mt-1">
              Сумма по всем платформам за период.
            </div>
          </div>
        </section>

        {/* График + список профилей */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)] md:gap-5">
          {/* График фолловеров */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 shadow-[0_24px_70px_rgba(15,23,42,0.9)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Динамика подписчиков по платформам
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Суммарное количество подписчиков по каждой платформе.
                </p>
              </div>
            </div>

            <div className="h-64 md:h-72">
              {loading && (
                <div className="text-[11px] text-slate-400">
                  Загружаем SMM-данные…
                </div>
              )}
              {!loading && chartData.length === 0 && (
                <div className="text-[11px] text-slate-500">
                  Пока нет статистики за выбранный период.
                </div>
              )}
              {!loading && chartData.length > 0 && (
                <ResponsiveContainer>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 16, left: -16, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#1f2937"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      width={52}
                    />
                    <Tooltip content={<FollowersTooltip />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10 }}
                    />

                    {(Object.keys(PLATFORM_LABEL) as SmmPlatform[]).map(
                      (platform) => (
                        <Line
                          key={platform}
                          type="monotone"
                          dataKey={platform}
                          name={PLATFORM_LABEL[platform]}
                          stroke={PLATFORM_COLORS[platform]}
                          dot={false}
                          strokeWidth={1.6}
                          isAnimationActive={false}
                        />
                      ),
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Профили + форма добавления */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/80 px-4 py-4 md:px-5 md:py-5 text-xs flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Профили соцсетей
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Список профилей, для которых приходят статы из n8n.
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                Всего: {profiles.length}
              </span>
            </div>

            {/* Форма */}
            <form
              onSubmit={handleCreateProfile}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 flex flex-col md:flex-row gap-2 md:items-end"
            >
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Платформа
                </label>
                <select
                  className="rounded-xl bg-slate-950/80 border border-slate-800/80 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
                  value={form.platform}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      platform: e.target
                        .value as unknown as SmmPlatform,
                    }))
                  }
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="vk">VK</option>
                  <option value="tiktok">TikTok</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  Handle / @аккаунт
                </label>
                <input
                  className="rounded-xl bg-slate-950/80 border border-slate-800/80 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
                  placeholder="@lumiva.agency"
                  value={form.handle}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, handle: e.target.value }))
                  }
                />
              </div>

              <div className="hidden md:flex-1 md:flex md:flex-col md:gap-1">
                <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  URL (опционально)
                </label>
                <input
                  className="rounded-xl bg-slate-950/80 border border-slate-800/80 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
                  placeholder="https://instagram.com/..."
                  value={form.url}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, url: e.target.value }))
                  }
                />
              </div>

              <button
                type="submit"
                disabled={!form.handle.trim() || savingProfile}
                className="px-4 py-1.5 rounded-xl bg-sky-500 text-slate-950 text-[11px] font-semibold hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {savingProfile ? 'Добавляем…' : 'Добавить профиль'}
              </button>
            </form>

            {/* Таблица профилей */}
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    <th className="py-1.5 pr-3 text-left font-normal">
                      Профиль
                    </th>
                    <th className="py-1.5 px-3 text-left font-normal">
                      Платформа
                    </th>
                    <th className="py-1.5 px-3 text-right font-normal">
                      Подписчики
                    </th>
                    <th className="py-1.5 px-3 text-right font-normal">
                      Охват / видео
                    </th>
                    <th className="py-1.5 px-3 text-right font-normal">
                      Дата
                    </th>
                    <th className="py-1.5 px-3 text-right font-normal">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingProfiles && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-slate-500"
                      >
                        Загружаем профили…
                      </td>
                    </tr>
                  )}

                  {!loadingProfiles && profiles.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-slate-500"
                      >
                        Пока нет ни одного профиля. Добавь хотя бы один
                        профиль выше.
                      </td>
                    </tr>
                  )}

                  {!loadingProfiles &&
                    profiles.map((p) => {
                      const s = (p as any).lastStat as
                        | SmmProfileLastStat
                        | null
                        | undefined;
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-slate-800/40 last:border-none hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="py-1.5 pr-3 text-slate-100 max-w-[200px] truncate">
                            @{p.handle}
                          </td>
                          <td className="py-1.5 px-3 text-slate-300">
                            {PLATFORM_LABEL[p.platform]}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-100">
                            {s
                              ? s.followers.toLocaleString('ru-RU')
                              : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-300">
                            {s
                              ? `${s.impressions.toLocaleString(
                                  'ru-RU',
                                )} / ${s.videoViews.toLocaleString(
                                  'ru-RU',
                                )}`
                              : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-400">
                            {s?.date || '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-slate-400">
                            <button
                              type="button"
                              onClick={() => handleDeleteProfile(p)}
                              className="text-[10px] px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
};