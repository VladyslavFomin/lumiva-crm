// src/pages/DashboardPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../layout/MainLayout';
import { getStoredUser } from '../auth/session';

import { fetchLeads, type Lead } from '../api/leads';
import { fetchProject, fetchProjects } from '../api/projects';
import { fetchSalesStats } from '../api/sales';
import { fetchStaff, type StaffUser } from '../api/staff';
import type { Project, ProjectTask } from './projects/projectTypes';
import { readProjectTasksCache } from './projects/projectTasksCache';
import {
  buildDashboardTaskVisibility,
  taskMatchesDashboardVisibility,
} from '../dashboard/dashboardTaskVisibility';
import {
  ALL_DASHBOARD_WIDGET_IDS,
  DASHBOARD_LAYOUT_CHANGED_EVENT,
  loadDashboardLayout,
  saveDashboardLayout,
  type DashboardLayoutState,
  type WidgetSize,
  isDashboardPresetInstanceId,
  getDefaultWidgetHeight,
  requestAddDashboardPreset,
  sizeToColSpan,
  colSpanToSize,
  type DashboardLayoutChangedDetail,
} from '../dashboard/dashboardLayout';
import { getPresetDefinition } from '../dashboard/presetCatalog';
import { DashboardWidgetChrome } from '../dashboard/DashboardWidgetChrome';
import { DashboardCalendarMini } from '../dashboard/DashboardCalendarMini';
import { DashboardPresetWidget } from '../dashboard/DashboardPresetWidget';
import { DashboardAddPresetsModal } from '../dashboard/DashboardAddPresetsModal';
import { DashboardQuickActions } from '../dashboard/DashboardQuickActions';
import { DashboardActivityFeed } from '../dashboard/DashboardActivityFeed';
import {
  flattenLeadMeetingsFromLeads,
  type LeadMeetingCalendarEvent,
} from '../dashboard/flattenLeadMeetings';

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
    taskId: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    /** Совместимость: «задача · проект» одной строкой */
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

  staffPerformance: {
    id: string;
    name: string;
    leadsCount: number;
    revenueEUR: number;
  }[];
  /** Выручка по каналам лида (для владельца), из выигранных проектов с leadId */
  salesByChannel: { channel: string; revenueEUR: number }[];
  /** Для выбора лидов во встречах (календарь) */
  leadPickerOptions: { id: string; name: string }[];
  /** Встречи из карточек лидов (в т.ч. от ИИ) — показываем в календаре главной */
  leadCalendarMeetings: LeadMeetingCalendarEvent[];
  /** Сводка по продажам для виджета на главной */
  salesSnapshot: { count: number; amount: number };
  /** Проекты в области видимости дашборда (для пресетов аналитики) */
  myProjects: Project[];
  activityRecentLeads: { id: string; name: string; channel: string; createdAt: string }[];
  activityUrgentTasks: {
    id: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    due: string;
  }[];
}

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

/** Если API вернул пустой tasks, подмешиваем тот же кэш, что и на странице проекта */
function mergeProjectTasksWithCache(p: Project): Project {
  const apiTasks = p.tasks || [];
  if (apiTasks.length > 0) return p;
  const cached = readProjectTasksCache(p.id);
  if (cached?.length) {
    return { ...p, tasks: cached };
  }
  return p;
}

// === Реальный загрузчик дашборда ===
type TranslateFn = (key: string, options?: any) => string;

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

/** Как в канбане: не считаем удалённые в корзину и архив */
function isLeadActiveForDashboard(l: Lead): boolean {
  const m = (l as any).meta;
  if (m?.deleted) return false;
  if (m?.archived) return false;
  return true;
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

  const [leadsRaw, projectsRes, salesStatsRes] = await Promise.all([
    fetchLeads(),
    fetchProjects(),
    fetchSalesStats().catch(() => null),
  ]);

  const allLeads = (leadsRaw || []).filter(isLeadActiveForDashboard);

  const salesSnapshot = {
    count: salesStatsRes?.totalCount ?? 0,
    amount: salesStatsRes?.totalAmount ?? 0,
  };

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
    // Владелец видит все активные (не в корзине / не в архиве)
    myLeads = allLeads;
    myProjects = projects;
  } else {
    // ---- мои лиды ----
    myLeads = allLeads.filter((l: any) => {
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
    const hasAnyData = allLeads.length > 0 || projects.length > 0;

    if (!myLeads.length && !myProjects.length && hasAnyData) {
      myLeads = allLeads;
      myProjects = projects;
    }
  }

  // Задачи: берём все проекты из ответа API (уже с фильтром прав на бэкенде), не только myProjects
  // (иначе при «есть лиды, но нет своих проектов по owner» сводка задач обнулялась).
  // Полная карточка + кэш из localStorage, если в БД ещё пусто, а в UI задачи есть.
  const projectsWithTasksForDashboard: Project[] = await Promise.all(
    projects.map((p) =>
      fetchProject(p.id)
        .then((full) => mergeProjectTasksWithCache(full))
        .catch(() => mergeProjectTasksWithCache(p)),
    ),
  );

  let staffList: StaffUser[] = [];
  try {
    staffList = await fetchStaff();
  } catch {
    staffList = [];
  }

  const taskVisibility = await buildDashboardTaskVisibility({
    role,
    staffId,
    userEmail: staffEmail,
    userName: staffName,
    staffList,
  });

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

  const allTasksRaw: TaskWithProject[] = (Array.isArray(projectsWithTasksForDashboard)
    ? projectsWithTasksForDashboard
    : []
  ).flatMap((p) =>
    ((p.tasks || []) as ProjectTask[]).map((t) => ({
      projectId: p.id,
      projectName: p.name,
      ...t,
    })),
  );

  const visibleTasksForDashboard = allTasksRaw.filter((task) =>
    taskMatchesDashboardVisibility(task, taskVisibility),
  );

  const tasksSummary: DashboardData['tasksSummary'] = {
    total: visibleTasksForDashboard.length,
    overdue: 0,
    today: 0,
    upcoming: 0,
  };

  for (const t of visibleTasksForDashboard) {
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

  const myTasks = visibleTasksForDashboard
    .slice()
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 10)
    .map((task) => {
      const taskTitle =
        task.title || t('crm.dashboard.tasks.fallbackTitle');
      return {
        id: task.id,
        taskId: task.id,
        projectId: task.projectId,
        projectName: task.projectName,
        taskTitle,
        title: t('crm.dashboard.tasks.titleWithProject', {
          title: taskTitle,
          project: task.projectName,
        }),
        due: task.deadline
          ? new Date(task.deadline).toLocaleString(locale)
          : t('crm.dashboard.fallbacks.noDue'),
        type: 'todo' as const,
      };
    });

  let staffPerformance: DashboardData['staffPerformance'] = [];
  const salesByChannelMap = new Map<string, number>();

  if (isOwner) {
    try {
      staffPerformance = staffList
        .filter((s) => s.isActive)
        .map((s) => {
          const leadsCount = allLeads.filter((l: any) => {
            if (l.assignedUserId && l.assignedUserId === s.id) return true;
            if (
              l.assignedTo &&
              typeof l.assignedTo === 'string' &&
              l.assignedTo.trim() === s.fullName.trim()
            ) {
              return true;
            }
            return false;
          }).length;

          const revenueEUR = projects.reduce((sum, p: any) => {
            const ownerMatch =
              (p.ownerUserId && p.ownerUserId === s.id) ||
              p.ownerName === s.fullName ||
              p.owner === s.fullName;
            if (!ownerMatch) return sum;
            const st = (p.status || '').toString().toLowerCase();
            const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) =>
              st.includes(x),
            );
            if (!isWon || typeof p.amount !== 'number') return sum;
            return sum + p.amount;
          }, 0);

          return {
            id: s.id,
            name: s.fullName,
            leadsCount,
            revenueEUR,
          };
        });
    } catch {
      staffPerformance = [];
    }

    const leadById = new Map(allLeads.map((l) => [l.id, l]));
    for (const p of projects) {
      const st = (p.status || '').toString().toLowerCase();
      const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) =>
        st.includes(x),
      );
      if (!isWon || typeof (p as any).amount !== 'number') continue;
      const lead = (p as any).leadId ? leadById.get((p as any).leadId) : null;
      const ch = (lead?.channel || t('crm.dashboard.fallbacks.other')).toString();
      salesByChannelMap.set(ch, (salesByChannelMap.get(ch) || 0) + (p as any).amount);
    }
  }

  const salesByChannel = Array.from(salesByChannelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, revenueEUR]) => ({ channel, revenueEUR }));

  const leadPickerOptions = (myLeads || [])
    .slice(0, 200)
    .map((l) => ({
      id: l.id,
      name: l.name || t('crm.dashboard.fallbacks.noName'),
    }));

  // Встречи из meta.meetings: как у GET /leads (все видимые лиды), а не урезанный myLeads —
  // иначе встречи по лидам из co-assignees (assignedUserIds) и записи от ИИ не попадали в виджет.
  const leadCalendarMeetings = flattenLeadMeetingsFromLeads(allLeads);

  const activityRecentLeads = [...myLeads]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      name: l.name || t('crm.dashboard.fallbacks.noName'),
      channel: l.channel || t('crm.dashboard.fallbacks.empty'),
      createdAt: l.createdAt,
    }));

  const tsDay = todayStart.getTime();
  const teDay = todayEnd.getTime();
  const activityUrgentTasks = visibleTasksForDashboard
    .filter((task) => task.deadline)
    .map((task) => {
      const taskTitle =
        task.title || t('crm.dashboard.tasks.fallbackTitle');
      const day = new Date(task.deadline!);
      day.setHours(0, 0, 0, 0);
      const dt = day.getTime();
      let tier = 2;
      if (dt < tsDay) tier = 0;
      else if (dt >= tsDay && dt < teDay) tier = 1;
      return {
        tier,
        sortDue: new Date(task.deadline!).getTime(),
        id: task.id,
        projectId: task.projectId,
        projectName: task.projectName,
        taskTitle,
        due: new Date(task.deadline!).toLocaleString(locale),
      };
    })
    .sort((a, b) =>
      a.tier !== b.tier ? a.tier - b.tier : a.sortDue - b.sortDue,
    )
    .slice(0, 8)
    .map(({ tier: _t, sortDue: _s, ...rest }) => rest);

  return {
    myProjects,
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
    staffPerformance,
    salesByChannel,
    leadPickerOptions,
    leadCalendarMeetings,
    salesSnapshot,
    activityRecentLeads,
    activityUrgentTasks,
  };
}

export const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

  const role = (user as any)?.role || 'user';
  const isOwner =
    role === 'owner' || role === 'admin' || role === 'superadmin';

  const [layout, setLayout] = useState<DashboardLayoutState>(() =>
    loadDashboardLayout(),
  );
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
  const [resizing, setResizing] = useState<{
    id: string;
    startX: number;
    startY: number;
    startHeight: number;
    startColSpan: number;
    liveHeight: number;
    liveColSpan: number;
    minHeight: number;
    axis: 'x' | 'y' | 'both';
  } | null>(null);
  const [leadsModalOpen, setLeadsModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    place: 'before' | 'after';
  } | null>(null);
  const [widgetEditOpen, setWidgetEditOpen] = useState(false);
  const [widgetEditId, setWidgetEditId] = useState<string | null>(null);
  const [widgetEditTitle, setWidgetEditTitle] = useState('');

  const persistLayout = useCallback(
    (updater: (p: DashboardLayoutState) => DashboardLayoutState) => {
      setLayout((prev) => {
        const next = updater(prev);
        saveDashboardLayout(next);
        return next;
      });
    },
    [],
  );

  /** MainLayout сохраняет layout в localStorage; подтягиваем state и тост */
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<DashboardLayoutChangedDetail>).detail;
      setLayout(loadDashboardLayout());
      if (d?.addedWidget) {
        setToast(t('crm.dashboard.widgets.addedToHome'));
        window.setTimeout(() => setToast(null), 2800);
      }
    };
    window.addEventListener(DASHBOARD_LAYOUT_CHANGED_EVENT, h);
    return () => window.removeEventListener(DASHBOARD_LAYOUT_CHANGED_EVENT, h);
  }, [t]);

  const visibleIds = useMemo(() => {
    return layout.order.filter((id) => {
      if (layout.hidden.has(id)) return false;
      if (id === 'staff' && !isOwner) return false;
      if (isDashboardPresetInstanceId(id) && !layout.presetInstances[id]) return false;
      return true;
    });
  }, [layout, isOwner]);

  const availableToAdd = useMemo(() => {
    return ALL_DASHBOARD_WIDGET_IDS.filter((id) => {
      if (!layout.hidden.has(id)) return false;
      if (id === 'staff' && !isOwner) return false;
      return true;
    });
  }, [layout.hidden, isOwner]);

  const reorderByDrag = (fromId: string, toId: string, place: 'before' | 'after') => {
    if (fromId === toId) return;
    persistLayout((prev) => {
      const order = [...prev.order];
      const fromIdx = order.indexOf(fromId);
      const toIdx = order.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = order.filter((x) => x !== fromId);
      const newToIdx = next.indexOf(toId);
      if (newToIdx < 0) return prev;
      const insertAt = place === 'before' ? newToIdx : newToIdx + 1;
      next.splice(insertAt, 0, fromId);
      return { ...prev, order: next };
    });
  };

  const hideWidget = (id: string) => {
    persistLayout((prev) => ({
      ...prev,
      hidden: new Set([...prev.hidden, id]),
    }));
  };

  /** Полное удаление блока пресета (pid_*); стандартные — скрыть с главной */
  const removeWidgetBlock = (id: string) => {
    if (isDashboardPresetInstanceId(id)) {
      persistLayout((prev) => {
        const order = prev.order.filter((x) => x !== id);
        const presetInstances = { ...prev.presetInstances };
        delete presetInstances[id];
        const sizes = { ...prev.sizes };
        delete sizes[id];
        const heights = { ...prev.heights };
        delete heights[id];
        const titleOverrides = { ...prev.titleOverrides };
        delete titleOverrides[id];
        return { ...prev, order, presetInstances, sizes, heights, titleOverrides };
      });
      return;
    }
    hideWidget(id);
  };

  const saveWidgetTitle = (id: string, title: string) => {
    const trimmed = title.trim();
    persistLayout((prev) => {
      const titleOverrides = { ...prev.titleOverrides };
      if (!trimmed) {
        delete titleOverrides[id];
      } else {
        titleOverrides[id] = trimmed;
      }
      if (isDashboardPresetInstanceId(id) && prev.presetInstances[id]) {
        const inst = prev.presetInstances[id];
        const wc: Record<string, unknown> = { ...((inst.widgetConfig as object) || {}) };
        if (!trimmed) {
          delete wc.title;
        } else {
          wc.title = trimmed;
        }
        return {
          ...prev,
          titleOverrides,
          presetInstances: {
            ...prev.presetInstances,
            [id]: { ...inst, widgetConfig: wc },
          },
        };
      }
      return { ...prev, titleOverrides };
    });
  };

  const addWidget = (id: string) => {
    persistLayout((prev) => {
      const hidden = new Set(prev.hidden);
      hidden.delete(id);
      return { ...prev, hidden };
    });
    setPresetsModalOpen(false);
  };

  const beginResize = (
    id: string,
    size: WidgetSize,
    axis: 'x' | 'y' | 'both',
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startHeight = getDefaultWidgetHeight(id, layout);
    const startColSpan = sizeToColSpan(size);
    const startX = e.clientX;
    const startY = e.clientY;
    const minHeight = 160;

    setResizing({
      id,
      startX,
      startY,
      startHeight,
      startColSpan,
      liveHeight: startHeight,
      liveColSpan: startColSpan,
      minHeight,
      axis,
    });

    const handleMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;
      let liveHeight = startHeight;
      let liveColSpan = startColSpan;
      if (axis === 'y' || axis === 'both') {
        liveHeight = Math.min(720, Math.max(minHeight, startHeight + deltaY));
      }
      if (axis === 'x' || axis === 'both') {
        liveColSpan = Math.max(4, Math.min(12, startColSpan + Math.round(deltaX / 6)));
      }
      setResizing((prev) =>
        prev && prev.id === id
          ? { ...prev, liveHeight, liveColSpan }
          : prev,
      );
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setResizing((prev) => {
        if (prev && prev.id === id) {
          persistLayout((layoutState) => ({
            ...layoutState,
            heights: { ...layoutState.heights, [id]: prev.liveHeight },
            sizes: { ...layoutState.sizes, [id]: colSpanToSize(prev.liveColSpan) },
          }));
        }
        return null;
      });
    };

    document.body.style.cursor =
      axis === 'y'
        ? 'ns-resize'
        : axis === 'both'
          ? 'nwse-resize'
          : 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const widgetTitle = (id: string) => {
    const ov = layout.titleOverrides?.[id];
    if (ov && ov.trim()) return ov;
    if (isDashboardPresetInstanceId(id)) {
      const inst = layout.presetInstances[id];
      if (inst) {
        const wc = inst.widgetConfig as { title?: string } | undefined;
        if (wc && typeof wc.title === 'string' && wc.title.trim()) return wc.title;
        const def = getPresetDefinition(inst.source, inst.slug);
        if (def) return t(def.titleKey);
      }
      return t('crm.dashboard.presets.fallback');
    }
    const k = `crm.dashboard.widgets.names.${id}` as const;
    const tr = t(k, { defaultValue: '' });
    return tr || id;
  };

  const leadsForCalendar = useMemo(
    () => data?.leadPickerOptions || [],
    [data?.leadPickerOptions],
  );
  const leadMeetingsForCalendar = useMemo(
    () => data?.leadCalendarMeetings || [],
    [data?.leadCalendarMeetings],
  );

  const renderWidgetBody = (id: string) => {
    if (!data) return null;
    if (isDashboardPresetInstanceId(id)) {
      const inst = layout.presetInstances[id];
      if (!inst) return null;
      return (
        <DashboardPresetWidget
          instance={inst}
          projectsFromDashboard={data.myProjects}
        />
      );
    }
    switch (id) {
      case 'kpi':
        return (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
          </div>
        );
      case 'quick-actions':
        return <DashboardQuickActions />;
      case 'calendar':
        return (
          <DashboardCalendarMini
            locale={locale}
            leads={leadsForCalendar}
            leadMeetings={leadMeetingsForCalendar}
          />
        );
      case 'activity-feed':
        return (
          <DashboardActivityFeed
            locale={locale}
            todayLeads={data.summary?.todayLeads ?? 0}
            tasksOverdue={data.tasksSummary?.overdue ?? 0}
            tasksToday={data.tasksSummary?.today ?? 0}
            recentLeads={data.activityRecentLeads}
            urgentTasks={data.activityUrgentTasks}
          />
        );
      case 'leads-timeline':
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-slate-500">
                {t('crm.dashboard.leadsTimeline.subtitle')}
              </p>
              <div className="text-right text-[11px] text-slate-500">
                {t('crm.dashboard.leadsTimeline.total')}{' '}
                <span className="text-lumiva-accent font-medium">
                  {data.leadsTimeline.reduce((s, d) => s + d.value, 0)}
                </span>
              </div>
            </div>
            {data.leadsTimeline.length > 0 ? (
              <SparklineBars data={data.leadsTimeline} />
            ) : (
              <div className="text-[11px] text-slate-500 italic">
                {t('crm.dashboard.leadsTimeline.empty')}
              </div>
            )}
          </div>
        );
      case 'projects':
        return (
          <div>
            {projectsSummary && (
              <div className="flex flex-wrap justify-between gap-2 mb-3 text-[11px] text-slate-500">
                <span>
                  {t('crm.dashboard.projects.total')}{' '}
                  <span className="text-lumiva-accent font-medium">{projectsSummary.total}</span>
                </span>
                <span>
                  {t('crm.dashboard.projects.openPotential')}{' '}
                  <span className="text-lumiva-accent font-medium">
                    {projectsSummary.openValueEUR.toLocaleString(locale)} €
                  </span>
                </span>
              </div>
            )}
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
        );
      case 'channels-funnel':
        return (
          <div
            className={
              (layout.sizes['channels-funnel'] || 'md') === 'lg'
                ? 'grid gap-4 lg:grid-cols-2'
                : 'space-y-4'
            }
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500">
                  {t('crm.dashboard.channels.period')}
                </span>
              </div>
              <div className="space-y-2">
                {data.leadsByChannel.map((ch) => (
                  <ChannelRow key={ch.channel} {...ch} />
                ))}
                {!data.leadsByChannel.length && (
                  <div className="text-[11px] text-slate-500 italic">
                    {t('crm.dashboard.channels.empty')}
                  </div>
                )}
              </div>
              {isOwner && data.salesByChannel.length > 0 && (
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="text-[11px] font-medium text-slate-700 mb-2">
                    {t('crm.dashboard.salesByChannel.title')}
                  </div>
                  <div className="space-y-1.5">
                    {data.salesByChannel.slice(0, 8).map((row) => (
                      <div
                        key={row.channel}
                        className="flex justify-between text-[11px] text-slate-600"
                      >
                        <span className="truncate">{row.channel}</span>
                        <span className="font-medium text-lumiva-accent">
                          {row.revenueEUR.toLocaleString(locale)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500">
                  {t('crm.dashboard.pipeline.subtitle')}
                </span>
              </div>
              <div className="space-y-3">
                {data.pipeline.map((st) => (
                  <PipelineRow key={st.stage} {...st} />
                ))}
                {!data.pipeline.length && (
                  <div className="text-[11px] text-slate-500 italic">
                    {t('crm.dashboard.pipeline.empty')}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'recent-leads':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.dashboard.recentLeads.headers.name')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.dashboard.recentLeads.headers.channel')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.dashboard.recentLeads.headers.status')}
                  </th>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.dashboard.recentLeads.headers.created')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="bg-slate-100/70 hover:bg-slate-200 transition-colors cursor-pointer"
                    onClick={() => navigate(`/leads/${lead.id}`)}
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
                {!data.recentLeads.length && (
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
        );
      case 'recent-tasks':
        return (
          <div className="space-y-2">
            {data.myTasks.map((task) => (
              <TaskRow key={task.id} {...task} />
            ))}
            {!data.myTasks.length && (
              <div className="text-[11px] text-slate-500 italic">
                {t('crm.dashboard.tasks.empty')}
              </div>
            )}
          </div>
        );
      case 'staff':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-separate border-spacing-y-1">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left font-normal px-2 py-1">
                    {t('crm.dashboard.staff.headers.name')}
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    {t('crm.dashboard.staff.headers.leads')}
                  </th>
                  <th className="text-right font-normal px-2 py-1">
                    {t('crm.dashboard.staff.headers.revenue')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.staffPerformance.map((s) => (
                  <tr
                    key={s.id}
                    className="bg-slate-100/70 hover:bg-slate-200/90 transition-colors"
                  >
                    <td className="px-2 py-1.5 text-lumiva-accent">{s.name}</td>
                    <td className="px-2 py-1.5 text-right text-slate-700">
                      {s.leadsCount}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-700">
                      {s.revenueEUR.toLocaleString(locale)} €
                    </td>
                  </tr>
                ))}
                {!data.staffPerformance.length && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-3 text-center text-slate-500 italic"
                    >
                      {t('crm.dashboard.staff.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case 'projects-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.projectsAnalytics.kpiProjects')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {projectsSummary?.total ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.projectsAnalytics.kpiRevenue')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {(summary?.revenueEUR ?? 0).toLocaleString(locale)} €
                </div>
              </div>
            </div>
            <Link
              to="/projects/analytics"
              className="inline-flex items-center justify-center w-full rounded-2xl bg-lumiva-accent text-white text-[11px] font-semibold py-2 border border-lumiva-accent hover:opacity-90 transition-opacity"
            >
              {t('crm.dashboard.projectsAnalytics.openFull')}
            </Link>
          </div>
        );
      case 'leads-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.leadsAnalyticsWidget.kpiLeads')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {summary?.totalLeads ?? 0}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.leadsAnalyticsWidget.kpiConversion')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {summary?.conversion ?? 0}%
                </div>
              </div>
            </div>
            <Link
              to="/leads/analytics"
              className="inline-flex items-center justify-center w-full rounded-2xl bg-lumiva-accent text-white text-[11px] font-semibold py-2 border border-lumiva-accent hover:opacity-90 transition-opacity"
            >
              {t('crm.dashboard.leadsAnalyticsWidget.openFull')}
            </Link>
          </div>
        );
      case 'sales-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.salesAnalyticsWidget.kpiCount')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {data.salesSnapshot.count}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {t('crm.dashboard.salesAnalyticsWidget.kpiAmount')}
                </div>
                <div className="text-lg font-semibold text-slate-900">
                  {data.salesSnapshot.amount.toLocaleString(locale)}
                </div>
              </div>
            </div>
            <Link
              to="/sales/analytics"
              className="inline-flex items-center justify-center w-full rounded-2xl bg-lumiva-accent text-white text-[11px] font-semibold py-2 border border-lumiva-accent hover:opacity-90 transition-opacity"
            >
              {t('crm.dashboard.salesAnalyticsWidget.openFull')}
            </Link>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="relative isolate overflow-visible rounded-[24px] md:rounded-[28px] border border-slate-200/75 bg-gradient-to-b from-slate-50/95 via-white to-slate-50/50 px-3 py-5 sm:px-4 md:px-7 md:py-7 ring-1 ring-slate-900/[0.04]">
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px] md:rounded-[28px] opacity-[0.65] bg-[radial-gradient(920px_440px_at_50%_-18%,rgba(14,165,233,0.11),transparent_58%),radial-gradient(560px_320px_at_100%_0%,rgba(99,102,241,0.08),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.5)_0%,transparent_35%)]"
          aria-hidden
        />
        <div className="relative z-10 space-y-4 md:space-y-6 pb-2 md:pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500/90 font-medium">
            {t('crm.dashboard.hero.kicker')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPresetsModalOpen(true)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50"
            >
              + {t('crm.dashboard.widgets.addBlock')}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-12 gap-4 md:gap-5 items-start">
          {visibleIds.map((id) => {
            const size = layout.sizes[id] || 'md';
            const heightPx =
              resizing?.id === id ? resizing.liveHeight : getDefaultWidgetHeight(id, layout);
            const colSpan =
              resizing?.id === id ? resizing.liveColSpan : sizeToColSpan(size);
            return (
              <DashboardWidgetChrome
                key={id}
                title={widgetTitle(id)}
                size={size}
                colSpan={colSpan}
                heightPx={heightPx}
                resizeActive={resizing?.id === id}
                dragging={draggingId === id}
                dropBefore={
                  !!dropIndicator &&
                  dropIndicator.targetId === id &&
                  dropIndicator.place === 'before' &&
                  draggingId !== null &&
                  draggingId !== id
                }
                dropAfter={
                  !!dropIndicator &&
                  dropIndicator.targetId === id &&
                  dropIndicator.place === 'after' &&
                  draggingId !== null &&
                  draggingId !== id
                }
                onBeginResize={(axis, e) => beginResize(id, size, axis, e)}
                dragOver={
                  dropIndicator?.targetId === id && draggingId !== null && draggingId !== id
                }
                onEdit={() => {
                  setWidgetEditId(id);
                  setWidgetEditTitle(widgetTitle(id));
                  setWidgetEditOpen(true);
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggingId(id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropIndicator(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (!draggingId || draggingId === id) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const mid = rect.top + rect.height / 2;
                  const place = e.clientY < mid ? 'before' : 'after';
                  setDropIndicator({ targetId: id, place });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData('text/plain') || draggingId;
                  if (!from || from === id) {
                    setDraggingId(null);
                    setDropIndicator(null);
                    return;
                  }
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const mid = rect.top + rect.height / 2;
                  const place = e.clientY < mid ? 'before' : 'after';
                  reorderByDrag(from, id, place);
                  setDraggingId(null);
                  setDropIndicator(null);
                }}
                actions={
                  id === 'recent-leads' ? (
                    <button
                      type="button"
                      draggable={false}
                      onClick={() => setLeadsModalOpen(true)}
                      className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
                    >
                      {t('crm.dashboard.detailModal.open')}
                    </button>
                  ) : undefined
                }
              >
                {renderWidgetBody(id)}
              </DashboardWidgetChrome>
            );
          })}
        </section>

        {leadsModalOpen &&
          data &&
          createPortal(
            <div
              className="fixed inset-0 z-[10080] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
              role="presentation"
              onMouseDown={() => setLeadsModalOpen(false)}
            >
              <div
                role="dialog"
                className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200/90 bg-white/98 backdrop-blur-md p-5 ring-1 ring-slate-900/[0.08]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t('crm.dashboard.recentLeads.title')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/leads/list"
                      className="text-[11px] text-lumiva-accent hover:underline"
                    >
                      {t('crm.dashboard.recentLeads.openAll')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setLeadsModalOpen(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      {t('crm.common.close')}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left font-normal px-2 py-1">
                          {t('crm.dashboard.recentLeads.headers.name')}
                        </th>
                        <th className="text-left font-normal px-2 py-1">
                          {t('crm.dashboard.recentLeads.headers.channel')}
                        </th>
                        <th className="text-left font-normal px-2 py-1">
                          {t('crm.dashboard.recentLeads.headers.status')}
                        </th>
                        <th className="text-left font-normal px-2 py-1">
                          {t('crm.dashboard.recentLeads.headers.created')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="bg-slate-100/70 hover:bg-slate-200 transition-colors cursor-pointer"
                          onClick={() => {
                            setLeadsModalOpen(false);
                            navigate(`/leads/${lead.id}`);
                          }}
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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {presetsModalOpen && (
          <DashboardAddPresetsModal
            onClose={() => setPresetsModalOpen(false)}
            onPick={(preset) => {
              requestAddDashboardPreset(preset);
              setPresetsModalOpen(false);
            }}
            hiddenStandardIds={availableToAdd}
            onAddStandard={addWidget}
            widgetTitle={widgetTitle}
          />
        )}

        {widgetEditOpen && widgetEditId && (
          <div
            className="fixed inset-0 z-[10085] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
            onClick={() => {
              setWidgetEditOpen(false);
              setWidgetEditId(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setWidgetEditOpen(false);
                setWidgetEditId(null);
              }
            }}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="widget-edit-title"
              className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/[0.06]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="widget-edit-title"
                className="text-base font-semibold tracking-tight text-slate-900"
              >
                {t('crm.dashboard.widgets.editModalTitle')}
              </h3>
              <label
                htmlFor="widget-edit-title-input"
                className="mt-4 block text-[12px] font-medium text-slate-600"
              >
                {t('crm.dashboard.widgets.editTitleLabel')}
              </label>
              <input
                id="widget-edit-title-input"
                value={widgetEditTitle}
                onChange={(e) => setWidgetEditTitle(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-shadow focus:border-lumiva-accent focus:bg-white focus:ring-2 focus:ring-lumiva-accent/25"
                autoFocus
              />
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => {
                    removeWidgetBlock(widgetEditId);
                    setWidgetEditOpen(false);
                    setWidgetEditId(null);
                  }}
                  className="rounded-xl border border-rose-300/80 bg-rose-50 px-3.5 py-2 text-[12px] font-medium text-rose-800 hover:bg-rose-100"
                >
                  {t('crm.dashboard.widgets.deleteBlock')}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWidgetEditOpen(false);
                      setWidgetEditId(null);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[12px] font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    {t('crm.common.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveWidgetTitle(widgetEditId, widgetEditTitle);
                      setWidgetEditOpen(false);
                      setWidgetEditId(null);
                    }}
                    className="rounded-xl border border-lumiva-accent bg-lumiva-accent px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    {t('crm.common.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {toast && (
        <div className="fixed top-20 right-4 z-[10090] rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm px-4 py-2 text-[11px] text-slate-800 ring-1 ring-slate-900/[0.06]">
          {toast}
        </div>
      )}

      {loading && (
        <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-slate-200/90 text-[11px] text-lumiva-accent ring-1 ring-slate-900/[0.05] flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('crm.dashboard.loading')}
          </div>
        </div>
      )}

      {error && (
        <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-[11px] text-red-600 ring-1 ring-red-200/60">
            {error}
          </div>
        </div>
      )}
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
      className={`rounded-2xl border px-3.5 py-3 transition-colors duration-300 ring-1 ring-slate-900/[0.03] ${
        accent
          ? 'bg-gradient-to-br from-white via-sky-50/40 to-white border-lumiva-accent/25 ring-lumiva-accent/15'
          : 'border-slate-200/80 bg-white/90'
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
                  highlight ? 'ring-2 ring-lumiva-accent/35 ring-offset-1 ring-offset-white' : ''
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
    <div className="rounded-2xl bg-white/95 border border-slate-200/80 px-3 py-2 flex flex-col gap-0.5 ring-1 ring-slate-900/[0.03]">
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
  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 border border-slate-200/85 px-2.5 py-1 ring-1 ring-slate-900/[0.04]">
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
  taskId: string;
  projectId: string;
  projectName: string;
  taskTitle: string;
  title: string;
  due: string;
  type: 'call' | 'meeting' | 'todo';
}> = ({
  projectId,
  taskTitle,
  projectName,
  due,
  type,
}) => {
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

  const projectHref = `/projects/${encodeURIComponent(projectId)}?tab=tasks`;

  return (
    <div className="flex items-start gap-2.5 text-xs bg-white/90 border border-slate-200/80 rounded-2xl px-3 py-2 ring-1 ring-slate-900/[0.04] transition-colors hover:border-slate-300/90 hover:bg-white">
      <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
      <div className="flex-1 min-w-0">
        <Link
          to={projectHref}
          className="block font-medium text-lumiva-accent hover:underline text-left"
        >
          {taskTitle}
        </Link>
        <Link
          to={projectHref}
          className="block text-[11px] text-slate-600 mt-0.5 truncate hover:text-lumiva-accent hover:underline text-left"
        >
          {projectName}
        </Link>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {translatedLabel} · {due}
        </div>
      </div>
    </div>
  );
};
