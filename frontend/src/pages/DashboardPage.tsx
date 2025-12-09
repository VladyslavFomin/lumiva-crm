// src/pages/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { MainLayout } from '../layout/MainLayout';
import { getStoredUser } from '../auth/session';

import { fetchLeads, type Lead } from '../api/leads';
import { fetchProjects } from '../api/projects';
import type { Project, ProjectTask } from './projects/projectTypes';

interface LeadShort {
  id: string;
  name: string;
  channel: string;
  status: string;
  createdAt: string;
}

interface DashboardData {
  summary: {
    todayLeads: number;
    totalLeads: number;
    conversion: number; // 0–100
    activeChats: number;
    revenueEUR: number;
    avgResponseMin: number;
  };
  leadsByChannel: {
    channel: string;
    count: number;
    trend: 'up' | 'down' | 'flat';
  }[];
  pipeline: {
    stage: string;
    count: number;
    valueEUR: number;
  }[];
  recentLeads: LeadShort[];
  myTasks: {
    id: string;
    title: string;
    due: string;
    type: 'call' | 'meeting' | 'todo';
  }[];

  // новые блоки
  leadsTimeline: {
    label: string; // формат ДД.ММ
    value: number; // лидов за день
  }[];
  projectsSummary: {
    total: number;
    open: number;
    won: number;
    lost: number;
    openValueEUR: number;
    wonValueEUR: number;
    lostValueEUR: number;
  };
  tasksSummary: {
    total: number;
    overdue: number;
    today: number;
    upcoming: number;
  };
}

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

// === Реальный загрузчик дашборда ===
async function loadDashboardData(): Promise<DashboardData> {
  const currentUser = getStoredUser();
  const staffName = currentUser?.name?.trim() || null;
  const staffEmail = currentUser?.email || null;
  const staffId =
    (currentUser as any).staffId ||
    (currentUser as any).staffUserId ||
    null;
  const role = (currentUser as any)?.role || 'user';
  const isOwner =
    role === 'owner' ||
    role === 'admin' ||
    role === 'superadmin';

  // границы "сегодня"
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [allLeads, projectsRes] = await Promise.all([
    fetchLeads(), // Lead[]
    fetchProjects(), // { items } | Project[] | что-то ещё
  ]);

  // аккуратно достаём проекты
  let projects: Project[] = [];
  if (Array.isArray((projectsRes as any)?.items)) {
    projects = (projectsRes as any).items;
  } else if (Array.isArray(projectsRes as any)) {
    projects = projectsRes as any;
  } else {
    projects = [];
  }

  let myLeads: Lead[] = [];
  let myProjects: Project[] = [];

  if (isOwner) {
    // Владелец видит всё
    myLeads = allLeads || [];
    myProjects = projects;
  } else {
    // ---- мои лиды ----
    myLeads = (allLeads || []).filter((l: any) => {
      if (staffId && l.assignedUserId && l.assignedUserId === staffId) {
        return true;
      }

      if (
        staffName &&
        l.assignedTo &&
        typeof l.assignedTo === 'string' &&
        l.assignedTo.trim() === staffName
      ) {
        return true;
      }

      if (staffEmail && (l as any).managerEmail === staffEmail) {
        return true;
      }

      return false;
    });

    // ---- мои проекты ----
    myProjects = projects.filter((p: any) => {
      if (staffId && p.ownerUserId && p.ownerUserId === staffId) {
        return true;
      }
      if (
        staffName &&
        (p.ownerName === staffName || (p as any).owner === staffName)
      ) {
        return true;
      }
      return false;
    });

    // Fallback: если ничего не привязано, но данные есть — показываем всё
    const hasAnyData =
      (allLeads && allLeads.length > 0) || projects.length > 0;

    if (!myLeads.length && !myProjects.length && hasAnyData) {
      myLeads = allLeads || [];
      myProjects = projects;
    }
  }

  /* ─────────── Summary ─────────── */

  const todayLeads = myLeads.filter((l) => {
    const d = new Date(l.createdAt);
    return d >= todayStart && d < todayEnd;
  }).length;

  const totalLeads = myLeads.length;

  const closedStatuses = [
    'Клиент',
    'Забронирован',
    'Оплачен',
    'Closed Won',
    'Выигран',
  ];
  const converted = myLeads.filter((l) =>
    closedStatuses.includes((l.status || '').trim()),
  ).length;
  const conversion =
    totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

  const revenueEUR = myProjects.reduce((sum, p: any) => {
    const st = (p.status || '').toString().toLowerCase();
    const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won'].some(
      (x) => st.includes(x),
    );
    if (isWon && typeof p.amount === 'number') {
      return sum + p.amount;
    }
    return sum;
  }, 0);

  /* ─────────── Leads by channel ─────────── */

  const leadsByChannelMap = new Map<string, number>();
  for (const l of myLeads) {
    const ch = (l.channel || 'Другие').toString();
    leadsByChannelMap.set(ch, (leadsByChannelMap.get(ch) || 0) + 1);
  }

  const leadsByChannel = Array.from(leadsByChannelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({
      channel,
      count,
      trend: 'flat' as const,
    }));

  /* ─────────── Pipeline по статусам ─────────── */

  const pipelineMap = new Map<
    string,
    { count: number; valueEUR: number }
  >();

  for (const p of myProjects) {
    const stage = p.status || 'Без статуса';
    const prev = pipelineMap.get(stage) || { count: 0, valueEUR: 0 };
    prev.count += 1;
    if (typeof p.amount === 'number') {
      prev.valueEUR += p.amount;
    }
    pipelineMap.set(stage, prev);
  }

  const pipeline = Array.from(pipelineMap.entries()).map(
    ([stage, { count, valueEUR }]) => ({
      stage,
      count,
      valueEUR,
    }),
  );

  /* ─────────── Последние лиды ─────────── */

  const recentLeads: LeadShort[] = myLeads
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    )
    .slice(0, 10)
    .map((l) => ({
      id: l.id,
      name: l.name || 'Без имени',
      channel: l.channel || '—',
      status: l.status || '—',
      createdAt: new Date(l.createdAt).toLocaleString('ru-RU'),
    }));

  /* ─────────── Динамика лидов (14 дней) ─────────── */

  const leadsTimelineMap = new Map<string, number>();
  for (const l of myLeads) {
    const d = new Date(l.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    leadsTimelineMap.set(key, (leadsTimelineMap.get(key) || 0) + 1);
  }

  const daysWindow = 14;
  const leadsTimeline: DashboardData['leadsTimeline'] = [];
  for (let i = daysWindow - 1; i >= 0; i--) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const value = leadsTimelineMap.get(key) || 0;
    const label = day.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
    leadsTimeline.push({ label, value });
  }

  /* ─────────── Структура проектов ─────────── */

  const projectsSummary: DashboardData['projectsSummary'] = {
    total: 0,
    open: 0,
    won: 0,
    lost: 0,
    openValueEUR: 0,
    wonValueEUR: 0,
    lostValueEUR: 0,
  };

  for (const p of myProjects) {
    projectsSummary.total += 1;
    const st = (p.status || '').toString().toLowerCase();
    const amount = typeof p.amount === 'number' ? p.amount : 0;

    let bucket: 'open' | 'won' | 'lost' = 'open';
    if (['lost', 'проигран', 'cancel', 'отмен'].some((x) => st.includes(x))) {
      bucket = 'lost';
    } else if (
      ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some(
        (x) => st.includes(x),
      )
    ) {
      bucket = 'won';
    }

    if (bucket === 'open') {
      projectsSummary.open += 1;
      projectsSummary.openValueEUR += amount;
    } else if (bucket === 'won') {
      projectsSummary.won += 1;
      projectsSummary.wonValueEUR += amount;
    } else {
      projectsSummary.lost += 1;
      projectsSummary.lostValueEUR += amount;
    }
  }

  /* ─────────── Задачи: summary + топ-10 ─────────── */

  const allTasksRaw: TaskWithProject[] = (Array.isArray(myProjects)
    ? myProjects
    : []
  ).flatMap((p) =>
    ((p.tasks || []) as ProjectTask[]).map((t) => ({
      projectId: p.id,
      projectName: p.name,
      ...t,
    })),
  );

  const tasksSummary: DashboardData['tasksSummary'] = {
    total: allTasksRaw.length,
    overdue: 0,
    today: 0,
    upcoming: 0,
  };

  for (const t of allTasksRaw) {
    if (!t.deadline) {
      tasksSummary.upcoming += 1;
      continue;
    }
    const d = new Date(t.deadline);
    d.setHours(0, 0, 0, 0);
    if (d < todayStart) {
      tasksSummary.overdue += 1;
    } else if (d >= todayStart && d < todayEnd) {
      tasksSummary.today += 1;
    } else {
      tasksSummary.upcoming += 1;
    }
  }

  const myTasks = allTasksRaw
    .slice()
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 10)
    .map((t: any) => ({
      id: t.id,
      title: `${t.title || 'Задача'} · ${t.projectName}`,
      due: t.deadline
        ? new Date(t.deadline).toLocaleString('ru-RU')
        : 'Без срока',
      type: 'todo' as const,
    }));

  return {
    summary: {
      todayLeads,
      totalLeads,
      conversion: Number(conversion.toFixed(1)),
      activeChats: 0,
      revenueEUR,
      avgResponseMin: 0,
    },
    leadsByChannel,
    pipeline,
    recentLeads,
    myTasks,
    leadsTimeline,
    projectsSummary,
    tasksSummary,
  };
}

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getStoredUser();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadDashboardData()
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        console.error(err);
        setError(err.message || 'Не удалось загрузить данные');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const summary = data?.summary;
  const projectsSummary = data?.projectsSummary;
  const tasksSummary = data?.tasksSummary;

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Верхний приветственный блок */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 shadow-lumiva">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-1">
                  Добро пожаловать
                </div>
                <div className="text-lg md:text-xl font-semibold text-slate-50">
                  {user?.name ?? 'Коллега'}, вот ваш радар по продажам.
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end text-[11px] text-slate-400">
                <span>
                  Смена: {new Date().toLocaleDateString('ru-RU')}
                </span>
                <span>Роль: {user?.role ?? 'owner'}</span>
              </div>
            </div>
            <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
              В одном экране — ваши лиды, активность каналов, движение по
              проектам и задачи. Смотрите, где вырастить выручку и что требует
              реакции прямо сейчас.
            </p>
          </div>

          <div className="bg-gradient-to-br from-lumiva-accent/15 via-slate-900 to-slate-950 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300 mb-2">
              Фокус дня
            </div>
            <div className="text-sm text-slate-100 mb-3">
              Ускорьте реакцию на новые лиды до{' '}
              <span className="font-semibold text-lumiva-accent">
                &lt; 5 минут
              </span>
              , чтобы поднять конверсию на 20–30%.
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li>• Проверить новые заявки из webchat и WhatsApp</li>
              <li>• Сверить статусы лидов «Ожидает ответа» &gt; 24 часов</li>
              <li>• Обновить заметки по ключевым агентствам</li>
            </ul>
          </div>
        </section>

        {/* Карточки KPI */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Лиды сегодня"
            value={summary?.todayLeads ?? 0}
            subtitle="за текущие сутки"
            accent
          />
          <KpiCard
            label="Все мои лиды"
            value={summary?.totalLeads ?? 0}
            format="number"
            subtitle="накопительно"
          />
          <KpiCard
            label="Моя конверсия"
            value={summary?.conversion ?? 0}
            suffix="%"
            subtitle="по закрытым лидам"
          />
          <KpiCard
            label="Выигранные проекты"
            value={projectsSummary?.won ?? 0}
            subtitle="кол-во"
          />
          <KpiCard
            label="Выручка (EUR)"
            value={summary?.revenueEUR ?? 0}
            format="currency"
            subtitle="по выигранным проектам"
          />
          <KpiCard
            label="Задачи всего"
            value={tasksSummary?.total ?? 0}
            subtitle={
              tasksSummary
                ? `Сегодня: ${tasksSummary.today}, просрочено: ${tasksSummary.overdue}`
                : ''
            }
          />
        </section>

        {/* Блок графиков: динамика лидов + проекты */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)]">
          {/* Динамика лидов */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Динамика моих лидов (14 дней)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Сколько заявок приходило каждый день
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div>
                  Всего за период:{' '}
                  <span className="text-slate-50 font-medium">
                    {(data?.leadsTimeline || []).reduce(
                      (s, d) => s + d.value,
                      0,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              {data && data.leadsTimeline.length > 0 ? (
                <SparklineBars data={data.leadsTimeline} />
              ) : (
                <div className="text-[11px] text-slate-500 italic">
                  Пока нет данных для построения графика.
                </div>
              )}
            </div>
          </div>

          {/* Структура проектов */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Структура моих проектов
                </h2>
                <p className="text-[11px] text-slate-500">
                  Открытые, выигранные и проигранные сделки
                </p>
              </div>
              {projectsSummary && (
                <div className="text-right text-[11px] text-slate-400">
                  <div>
                    Всего:{' '}
                    <span className="text-slate-50 font-medium">
                      {projectsSummary.total}
                    </span>
                  </div>
                  <div>
                    Потенциал (open):{' '}
                    <span className="text-slate-50 font-medium">
                      {projectsSummary.openValueEUR.toLocaleString('ru-RU')} €
                    </span>
                  </div>
                </div>
              )}
            </div>

            {projectsSummary && projectsSummary.total > 0 ? (
              <>
                <ProjectDistributionBar summary={projectsSummary} />
                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                  <ProjectSummaryChip
                    label="Открытые"
                    color="bg-sky-400"
                    count={projectsSummary.open}
                    value={projectsSummary.openValueEUR}
                  />
                  <ProjectSummaryChip
                    label="Выигранные"
                    color="bg-emerald-400"
                    count={projectsSummary.won}
                    value={projectsSummary.wonValueEUR}
                  />
                  <ProjectSummaryChip
                    label="Проигранные"
                    color="bg-rose-400"
                    count={projectsSummary.lost}
                    value={projectsSummary.lostValueEUR}
                  />
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-500 italic mt-2">
                У вас пока нет проектов.
              </div>
            )}

            {tasksSummary && (
              <div className="mt-5 border-t border-slate-800/80 pt-3 text-[11px]">
                <div className="text-slate-400 mb-1">
                  Кратко по задачам:
                </div>
                <div className="flex flex-wrap gap-2">
                  <TaskStatPill
                    label="Просрочено"
                    value={tasksSummary.overdue}
                    color="bg-rose-500/80"
                  />
                  <TaskStatPill
                    label="Сегодня"
                    value={tasksSummary.today}
                    color="bg-amber-400/80"
                  />
                  <TaskStatPill
                    label="Впереди"
                    value={tasksSummary.upcoming}
                    color="bg-emerald-500/80"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Средний блок: каналы + воронка */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Лиды по каналам (мои)
              </h2>
              <span className="text-[11px] text-slate-500">
                за всё время
              </span>
            </div>
            <div className="space-y-2">
              {data?.leadsByChannel.map((ch) => (
                <ChannelRow key={ch.channel} {...ch} />
              ))}
              {!data?.leadsByChannel.length && (
                <div className="text-[11px] text-slate-500 italic">
                  Пока нет лидов с привязкой к вам.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Воронка по моим проектам
              </h2>
              <span className="text-[11px] text-slate-500">
                сумма по статусам
              </span>
            </div>
            <div className="space-y-3">
              {data?.pipeline.map((st) => (
                <PipelineRow key={st.stage} {...st} />
              ))}
              {!data?.pipeline.length && (
                <div className="text-[11px] text-slate-500 italic">
                  У вас пока нет проектов.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Нижний блок: последние лиды + задачи */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)]">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Последние мои лиды
              </h2>
              <button className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft">
                Открыть все
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-normal px-2 py-1">Имя</th>
                    <th className="text-left font-normal px-2 py-1">Канал</th>
                    <th className="text-left font-normal px-2 py-1">
                      Статус
                    </th>
                    <th className="text-left font-normal px-2 py-1">
                      Создан
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="bg-slate-950/80 hover:bg-slate-900/80 transition-colors"
                    >
                      <td className="px-2 py-1.5 text-slate-100 whitespace-nowrap">
                        {lead.name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">
                        {lead.channel}
                      </td>
                      <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">
                        {lead.status}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                        {lead.createdAt}
                      </td>
                    </tr>
                  ))}

                  {!data?.recentLeads.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-3 text-center text-[11px] text-slate-500 italic"
                      >
                        Лидов пока нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Мои задачи в проектах
              </h2>
            </div>
            <div className="space-y-2">
              {data?.myTasks.map((t) => (
                <TaskRow key={t.id} {...t} />
              ))}
              {!data?.myTasks.length && (
                <div className="text-[11px] text-slate-500 italic">
                  На вас пока нет задач.
                </div>
              )}
            </div>
          </div>
        </section>

        {loading && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-slate-950/90 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent animate-pulse" />
              Обновляем данные дашборда…
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-red-950/95 border border-red-700/80 text-[11px] text-red-200">
              {error}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

/* ─────────────────────────────────────────────
 *  SMALL COMPONENTS
 * ─────────────────────────────────────────── */

const KpiCard: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  format?: 'number' | 'currency';
  accent?: boolean;
  subtitle?: string;
}> = ({
  label,
  value,
  suffix = '',
  format = 'number',
  accent,
  subtitle,
}) => {
  let display = value.toString();
  if (format === 'number') {
    display = value.toLocaleString('ru-RU');
  } else if (format === 'currency') {
    display = value.toLocaleString('ru-RU', {
      maximumFractionDigits: 0,
    });
  }

  return (
    <div
      className={`rounded-2xl border border-slate-800/80 px-3.5 py-3 bg-slate-950/80 transition-transform duration-300 hover:-translate-y-0.5 ${
        accent ? 'bg-gradient-to-br from-lumiva-accent/15 to-slate-950' : ''
      }`}
    >
      <div className="text-[11px] text-slate-400 mb-1 truncate">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-50">
        {display}
        {suffix && (
          <span className="text-xs text-slate-400 ml-1">{suffix}</span>
        )}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[10px] text-slate-500 truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};

const SparklineBars: React.FC<{
  data: { label: string; value: number }[];
}> = ({ data }) => {
  const max = Math.max(
    ...data.map((d) => d.value),
    1, // чтобы не делить на 0
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[3px] h-20 md:h-24">
        {data.map((d, idx) => {
          const height = Math.max(8, (d.value / max) * 100);
          const highlight = idx === data.length - 1 && d.value > 0;
          return (
            <div
              key={idx}
              className="flex-1 flex items-end justify-center"
            >
              <div
                className={`w-full rounded-t-full bg-gradient-to-t from-lumiva-accent/40 to-lumiva-accent ${
                  highlight ? 'shadow-[0_0_12px_rgba(56,189,248,0.9)]' : ''
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const ProjectDistributionBar: React.FC<{
  summary: DashboardData['projectsSummary'];
}> = ({ summary }) => {
  const { open, won, lost } = summary;
  const total = open + won + lost;

  return (
    <div className="mt-3">
      <div className="h-3 rounded-full bg-slate-800/80 overflow-hidden flex">
        {total === 0 ? (
          <div className="h-full w-full bg-slate-700/60" />
        ) : (
          <>
            {open > 0 && (
              <div
                className="h-full bg-sky-500/80"
                style={{ flex: open }}
              />
            )}
            {won > 0 && (
              <div
                className="h-full bg-emerald-500/80"
                style={{ flex: won }}
              />
            )}
            {lost > 0 && (
              <div
                className="h-full bg-rose-500/80"
                style={{ flex: lost }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ProjectSummaryChip: React.FC<{
  label: string;
  color: string;
  count: number;
  value: number;
}> = ({ label, color, count, value }) => (
  <div className="rounded-2xl bg-slate-950/80 border border-slate-800/80 px-3 py-2 flex flex-col gap-0.5">
    <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
    <div className="text-[11px] text-slate-400">
      Проектов:{' '}
      <span className="text-slate-50 font-medium">{count}</span>
    </div>
    <div className="text-[11px] text-slate-400">
      Сумма:{' '}
      <span className="text-slate-50 font-medium">
        {value.toLocaleString('ru-RU')} €
      </span>
    </div>
  </div>
);

const TaskStatPill: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/80 border border-slate-800/80 px-2.5 py-1">
    <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
    <span className="text-[11px] text-slate-300">{label}</span>
    <span className="text-[11px] text-slate-100 font-medium">
      {value}
    </span>
  </div>
);

const ChannelRow: React.FC<{
  channel: string;
  count: number;
  trend: 'up' | 'down' | 'flat';
}> = ({ channel, count, trend }) => {
  const maxBar = Math.max(1, count * 1.4); // адаптивная длина
  const width = Math.max(8, (count / maxBar) * 100);

  const trendLabel =
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor =
    trend === 'up'
      ? 'text-emerald-400'
      : trend === 'down'
      ? 'text-rose-400'
      : 'text-slate-400';

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-20 text-slate-300 truncate">{channel}</div>
      <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-lumiva-accent-soft to-lumiva-accent transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-16 text-right text-slate-300">
        {count.toLocaleString('ru-RU')}
      </div>
      <div className={`w-5 text-right ${trendColor}`}>{trendLabel}</div>
    </div>
  );
};

const PipelineRow: React.FC<{
  stage: string;
  count: number;
  valueEUR: number;
}> = ({ stage, count, valueEUR }) => {
  const max = Math.max(1, valueEUR * 1.4);
  const width = Math.max(10, (valueEUR / max) * 100);

  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-300 truncate">{stage}</span>
        <span className="text-slate-500 whitespace-nowrap">
          {count} лидов · {valueEUR.toLocaleString('ru-RU')} €
        </span>
      </div>
      <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-lumiva-accent-soft transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
};

const TaskRow: React.FC<{
  id: string;
  title: string;
  due: string;
  type: 'call' | 'meeting' | 'todo';
}> = ({ title, due, type }) => {
  const color =
    type === 'call'
      ? 'bg-emerald-500/80'
      : type === 'meeting'
      ? 'bg-lumiva-accent-soft'
      : 'bg-indigo-400';

  const label =
    type === 'call' ? 'Звонок' : type === 'meeting' ? 'Встреча' : 'Задача';

  return (
    <div className="flex items-start gap-2.5 text-xs bg-slate-950/80 border border-slate-800/80 rounded-2xl px-3 py-2">
      <div className={`mt-1 h-1.5 w-1.5 rounded-full ${color}`} />
      <div className="flex-1">
        <div className="text-slate-100">{title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {label} · {due}
        </div>
      </div>
    </div>
  );
};