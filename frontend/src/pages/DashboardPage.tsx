// src/pages/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
type TranslateFn = (key: string, options?: any) => string;

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

async function loadDashboardData(
  t: TranslateFn,
  locale: string,
): Promise<DashboardData> {
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
    const ch = (l.channel || t('crm.dashboard.fallbacks.other')).toString();
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
    const stage = p.status || t('crm.dashboard.fallbacks.noStatus');
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
      name: l.name || t('crm.dashboard.fallbacks.noName'),
      channel: l.channel || t('crm.dashboard.fallbacks.empty'),
      status: l.status || t('crm.dashboard.fallbacks.empty'),
      createdAt: new Date(l.createdAt).toLocaleString(locale),
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
    const label = day.toLocaleDateString(locale, {
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
    .map((task: any) => ({
      id: task.id,
      title: t('crm.dashboard.tasks.titleWithProject', {
        title: task.title || t('crm.dashboard.tasks.fallbackTitle'),
        project: task.projectName,
      }),
      due: task.deadline
        ? new Date(task.deadline).toLocaleString(locale)
        : t('crm.dashboard.fallbacks.noDue'),
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
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = getStoredUser();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadDashboardData(t, locale)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        console.error(err);
        setError(err.message || t('crm.dashboard.errors.loadFailed'));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [t, locale]);

  const summary = data?.summary;
  const projectsSummary = data?.projectsSummary;
  const tasksSummary = data?.tasksSummary;

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6 pb-8">
        {/* Верхний приветственный блок */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)]">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_24px_60px_rgba(17,24,39,0.08)]">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-1">
                  {t('crm.dashboard.welcome.badge')}
                </div>
                <div className="text-lg md:text-xl font-semibold text-lumiva-accent">
                  {t('crm.dashboard.welcome.title', {
                    name: user?.name ?? t('crm.dashboard.fallbacks.user'),
                  })}
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end text-[11px] text-slate-500">
                <span>
                  {t('crm.dashboard.welcome.shift', {
                    date: new Date().toLocaleDateString(locale),
                  })}
                </span>
                <span>
                  {t('crm.dashboard.welcome.role', {
                    role: t(`crm.dashboard.roles.${user?.role}`, {
                      defaultValue: user?.role ?? 'owner',
                    }),
                  })}
                </span>
              </div>
            </div>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl">
              {t('crm.dashboard.welcome.summary')}
            </p>
          </div>

          <div className="bg-gradient-to-br from-white via-slate-100 to-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_50px_rgba(17,24,39,0.08)]">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
              {t('crm.dashboard.focus.title')}
            </div>
            <div className="text-sm text-lumiva-accent mb-3">
              {t('crm.dashboard.focus.prefix')}{' '}
              <span className="font-semibold text-black underline decoration-2">
                {t('crm.dashboard.focus.highlight')}
              </span>
              {t('crm.dashboard.focus.suffix')}
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-600">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
                <span>{t('crm.dashboard.focus.items.webchat')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
                <span>{t('crm.dashboard.focus.items.pending')}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-lumiva-accent" />
                <span>{t('crm.dashboard.focus.items.notes')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Карточки KPI */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label={t('crm.dashboard.kpi.todayLeads')}
            value={summary?.todayLeads ?? 0}
            subtitle={t('crm.dashboard.kpi.todayLeadsHint')}
            accent
          />
          <KpiCard
            label={t('crm.dashboard.kpi.totalLeads')}
            value={summary?.totalLeads ?? 0}
            format="number"
            subtitle={t('crm.dashboard.kpi.totalLeadsHint')}
          />
          <KpiCard
            label={t('crm.dashboard.kpi.conversion')}
            value={summary?.conversion ?? 0}
            suffix="%"
            subtitle={t('crm.dashboard.kpi.conversionHint')}
          />
          <KpiCard
            label={t('crm.dashboard.kpi.wonProjects')}
            value={projectsSummary?.won ?? 0}
            subtitle={t('crm.dashboard.kpi.wonProjectsHint')}
          />
          <KpiCard
            label={t('crm.dashboard.kpi.revenue')}
            value={summary?.revenueEUR ?? 0}
            format="currency"
            subtitle={t('crm.dashboard.kpi.revenueHint')}
          />
          <KpiCard
            label={t('crm.dashboard.kpi.tasksTotal')}
            value={tasksSummary?.total ?? 0}
            subtitle={
              tasksSummary
                ? t('crm.dashboard.kpi.tasksSubtitle', {
                    today: tasksSummary.today,
                    overdue: tasksSummary.overdue,
                  })
                : ''
            }
          />
        </section>

        {/* Блок графиков: динамика лидов + проекты */}
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)]">
          {/* Динамика лидов */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-lumiva-accent">
                  {t('crm.dashboard.leadsTimeline.title')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('crm.dashboard.leadsTimeline.subtitle')}
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <div>
                  {t('crm.dashboard.leadsTimeline.total')}{' '}
                  <span className="text-lumiva-accent font-medium">
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
                  {t('crm.dashboard.leadsTimeline.empty')}
                </div>
              )}
            </div>
          </div>

          {/* Структура проектов */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-lumiva-accent">
                  {t('crm.dashboard.projects.title')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('crm.dashboard.projects.subtitle')}
                </p>
              </div>
              {projectsSummary && (
                <div className="text-right text-[11px] text-slate-500">
                  <div>
                    {t('crm.dashboard.projects.total')}{' '}
                    <span className="text-lumiva-accent font-medium">
                      {projectsSummary.total}
                    </span>
                  </div>
                  <div>
                    {t('crm.dashboard.projects.openPotential')}{' '}
                    <span className="text-lumiva-accent font-medium">
                      {projectsSummary.openValueEUR.toLocaleString(locale)} €
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
                    label={t('crm.dashboard.projects.chips.open')}
                    color="bg-sky-400"
                    count={projectsSummary.open}
                    value={projectsSummary.openValueEUR}
                  />
                  <ProjectSummaryChip
                    label={t('crm.dashboard.projects.chips.won')}
                    color="bg-emerald-400"
                    count={projectsSummary.won}
                    value={projectsSummary.wonValueEUR}
                  />
                  <ProjectSummaryChip
                    label={t('crm.dashboard.projects.chips.lost')}
                    color="bg-rose-400"
                    count={projectsSummary.lost}
                    value={projectsSummary.lostValueEUR}
                  />
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-500 italic mt-2">
                {t('crm.dashboard.projects.empty')}
              </div>
            )}

            {tasksSummary && (
              <div className="mt-5 border-t border-slate-200 pt-3 text-[11px]">
                <div className="text-slate-500 mb-1">
                  {t('crm.dashboard.projects.tasksSummary')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <TaskStatPill
                    label={t('crm.dashboard.tasks.overdue')}
                    value={tasksSummary.overdue}
                    color="bg-rose-500/80"
                  />
                  <TaskStatPill
                    label={t('crm.dashboard.tasks.today')}
                    value={tasksSummary.today}
                    color="bg-amber-400/80"
                  />
                  <TaskStatPill
                    label={t('crm.dashboard.tasks.upcoming')}
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
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.dashboard.channels.title')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('crm.dashboard.channels.period')}
              </span>
            </div>
            <div className="space-y-2">
              {data?.leadsByChannel.map((ch) => (
                <ChannelRow key={ch.channel} {...ch} />
              ))}
              {!data?.leadsByChannel.length && (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.dashboard.channels.empty')}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.dashboard.pipeline.title')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('crm.dashboard.pipeline.subtitle')}
              </span>
            </div>
            <div className="space-y-3">
              {data?.pipeline.map((st) => (
                <PipelineRow key={st.stage} {...st} />
              ))}
              {!data?.pipeline.length && (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.dashboard.pipeline.empty')}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Нижний блок: последние лиды + задачи */}
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)]">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 min-w-0 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.dashboard.recentLeads.title')}
              </h2>
              <button className="text-[11px] text-lumiva-accent hover:text-lumiva-accent-soft">
                {t('crm.dashboard.recentLeads.openAll')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.name')}</th>
                    <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.channel')}</th>
                    <th className="text-left font-normal px-2 py-1">
                      {t('crm.dashboard.recentLeads.headers.status')}
                    </th>
                    <th className="text-left font-normal px-2 py-1">
                      {t('crm.dashboard.recentLeads.headers.created')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="bg-slate-100/70 hover:bg-slate-200 transition-colors"
                    >
                      <td className="px-2 py-1.5 text-lumiva-accent whitespace-nowrap">
                        {lead.name}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                        {lead.channel}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
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
                        {t('crm.dashboard.recentLeads.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-lumiva-accent">
                {t('crm.dashboard.tasks.title')}
              </h2>
            </div>
            <div className="space-y-2">
              {data?.myTasks.map((t) => (
                <TaskRow key={t.id} {...t} />
              ))}
              {!data?.myTasks.length && (
                <div className="text-[11px] text-slate-500 italic">
                  {t('crm.dashboard.tasks.empty')}
                </div>
              )}
            </div>
          </div>
        </section>

        {loading && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-[11px] text-lumiva-accent shadow-[0_10px_30px_rgba(17,24,39,0.08)] flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('crm.dashboard.loading')}
            </div>
          </div>
        )}

        {error && (
          <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-[11px] text-red-600 shadow-[0_10px_30px_rgba(248,113,113,0.25)]">
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
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  let display = value.toString();
  if (format === 'number') {
    display = value.toLocaleString(locale);
  } else if (format === 'currency') {
    display = value.toLocaleString(locale, {
      maximumFractionDigits: 0,
    });
  }

  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 bg-white transition-transform duration-300 hover:-translate-y-0.5 shadow-[0_16px_50px_rgba(17,24,39,0.06)] ${
        accent
          ? 'bg-gradient-to-br from-white via-slate-100 to-white border-lumiva-accent/30 shadow-[0_20px_60px_rgba(34,34,34,0.08)]'
          : 'border-slate-200'
      }`}
    >
      <div className="text-[11px] text-slate-500 mb-1 truncate uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="text-lg font-semibold text-lumiva-accent">
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
                className={`w-full rounded-t-full bg-gradient-to-t from-slate-300 to-lumiva-accent ${
                  highlight ? 'shadow-[0_0_12px_rgba(34,34,34,0.4)]' : ''
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
      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
        {total === 0 ? (
          <div className="h-full w-full bg-slate-200" />
        ) : (
          <>
            {open > 0 && (
              <div
                className="h-full bg-sky-500/70"
                style={{ flex: open }}
              />
            )}
            {won > 0 && (
              <div
                className="h-full bg-emerald-500/70"
                style={{ flex: won }}
              />
            )}
            {lost > 0 && (
              <div
                className="h-full bg-rose-500/70"
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
}> = ({ label, color, count, value }) => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 flex flex-col gap-0.5 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
        <span>{label}</span>
      </div>
      <div className="text-[11px] text-slate-500">
        {t('crm.dashboard.projects.countLabel')}{' '}
        <span className="text-lumiva-accent font-medium">{count}</span>
      </div>
      <div className="text-[11px] text-slate-500">
        {t('crm.dashboard.projects.amountLabel')}{' '}
        <span className="text-lumiva-accent font-medium">
          {value.toLocaleString(locale)} €
        </span>
      </div>
    </div>
  );
};

const TaskStatPill: React.FC<{
  label: string;
  value: number;
  color: string;
}> = ({ label, value, color }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 shadow-sm">
    <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
    <span className="text-[11px] text-slate-600">{label}</span>
    <span className="text-[11px] text-lumiva-accent font-medium">
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
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  const trendLabel =
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor =
    trend === 'up'
      ? 'text-emerald-600'
      : trend === 'down'
      ? 'text-rose-500'
      : 'text-slate-500';

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-20 text-slate-600 truncate">{channel}</div>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-slate-300 to-lumiva-accent transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-16 text-right text-slate-600">
        {count.toLocaleString(locale)}
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
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);

  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lumiva-accent truncate">{stage}</span>
        <span className="text-slate-500 whitespace-nowrap">
          {t('crm.dashboard.pipeline.itemLabel', {
            count,
            value: valueEUR.toLocaleString(locale),
          })}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-lumiva-accent transition-all duration-500"
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
  const { t } = useTranslation();
  const color =
    type === 'call'
      ? 'bg-emerald-500/80'
      : type === 'meeting'
      ? 'bg-lumiva-accent-soft'
      : 'bg-indigo-400';

  const translatedLabel =
    type === 'call'
      ? t('crm.dashboard.taskTypes.call')
      : type === 'meeting'
      ? t('crm.dashboard.taskTypes.meeting')
      : t('crm.dashboard.taskTypes.todo');

  return (
    <div className="flex items-start gap-2.5 text-xs bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-[0_12px_40px_rgba(17,24,39,0.06)]">
      <div className={`mt-1 h-1.5 w-1.5 rounded-full ${color}`} />
      <div className="flex-1">
        <div className="text-lumiva-accent">{title}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {translatedLabel} · {due}
        </div>
      </div>
    </div>
  );
};
