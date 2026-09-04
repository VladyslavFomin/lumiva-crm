// src/pages/DashboardPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../layout/MainLayout';
import { getStoredUser } from '../auth/session';

import { fetchLeads, isLeadOmittedFromAnalytics, type Lead } from '../api/leads';
import { fetchProject, fetchProjects } from '../api/projects';
import { resolvePublicAssetUrl } from '../api/client';
import { fetchSalesStats } from '../api/sales';
import { fetchDashboardHome, type ProfileCompletionStepId } from '../api/dashboard';
import { fetchStaff, type StaffUser } from '../api/staff';
import type { Project, ProjectTask } from './projects/projectTypes';
import { readProjectTasksCache } from './projects/projectTasksCache';
import {
  buildDashboardTaskVisibility,
  taskMatchesDashboardVisibility } from '../dashboard/dashboardTaskVisibility';
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
  type DashboardLayoutChangedDetail } from '../dashboard/dashboardLayout';
import { getPresetDefinition } from '../dashboard/presetCatalog';
import { DashboardWidgetChrome } from '../dashboard/DashboardWidgetChrome';
import { DashboardCalendarMini } from '../dashboard/DashboardCalendarMini';
import { DashboardPresetWidget } from '../dashboard/DashboardPresetWidget';
import { DashboardAddPresetsModal } from '../dashboard/DashboardAddPresetsModal';
import { DashboardActivityFeed } from '../dashboard/DashboardActivityFeed';
import { DashboardProfileCompletion } from '../dashboard/DashboardProfileCompletion';
import { DashboardLearnInspire } from '../dashboard/DashboardLearnInspire';
import { DashboardQuickActions } from '../dashboard/DashboardQuickActions';
import { DashboardLayoutTemplateModal } from '../dashboard/DashboardLayoutTemplateModal';
import {
  flattenLeadMeetingsFromLeads,
  type LeadMeetingCalendarEvent } from '../dashboard/flattenLeadMeetings';
import { FunnelTodayWidget } from '../dashboard/widgets/FunnelTodayWidget';
import { LeadSourcesWidget } from '../dashboard/widgets/LeadSourcesWidget';
import { RecentDealsWidget } from '../dashboard/widgets/RecentDealsWidget';
import { BirthdaysWidget } from '../dashboard/widgets/BirthdaysWidget';
import { ProductsAnalyticsWidget } from '../dashboard/widgets/ProductsAnalyticsWidget';
import { BookingsAnalyticsWidget } from '../dashboard/widgets/BookingsAnalyticsWidget';
import { HotelsAnalyticsWidget } from '../dashboard/widgets/HotelsAnalyticsWidget';
import { usePermission } from '../hooks/usePermission';
import type { PermissionKey } from '../api/rbac';

/**
 * Which staff permission a dashboard block's DATA belongs to — same idea as MainLayout's
 * permissionForPath, applied to widgets instead of routes. Blocks with no entry here (kpi,
 * quick-actions, calendar, activity-feed, profile-completion, learn-inspire) are either purely
 * personal (my tasks/my profile) or already deliberately mixed-source summaries; deep-linked
 * items inside them still go through route-level gating when clicked.
 */
const WIDGET_PERMISSION: Partial<Record<string, PermissionKey>> = {
  'leads-timeline': 'leads',
  projects: 'projects',
  'channels-funnel': 'leads',
  'recent-leads': 'leads',
  'recent-tasks': 'projects',
  staff: 'staff',
  funnel_today: 'leads',
  lead_sources_week: 'leads',
  recent_deals: 'sales',
  birthdays: 'contacts',
  'projects-analytics': 'projects',
  'leads-analytics': 'leads',
  'sales-analytics': 'sales',
  'products-analytics': 'products',
  'bookings-analytics': 'bookings',
  'hotels-analytics': 'hotels',
};

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
    conversion: number;
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
    title: string;
    due: string;
    type: 'call' | 'meeting' | 'todo';
  }[];
  leadsTimeline: {
    label: string;
    value: number;
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
    avatarUrl: string | null;
  }[];
  salesByChannel: { channel: string; revenueEUR: number }[];
  leadPickerOptions: { id: string; name: string }[];
  leadCalendarMeetings: LeadMeetingCalendarEvent[];
  salesSnapshot: { count: number; amount: number };
  myProjects: Project[];
  activityRecentLeads: { id: string; name: string; channel: string; createdAt: string }[];
  activityUrgentTasks: {
    id: string;
    projectId: string;
    projectName: string;
    taskTitle: string;
    due: string;
  }[];
  topProjectItems: {
    id: string;
    name: string;
    taskTotal: number;
    taskDone: number;
    amount: number;
  }[];
  profileCompletion: {
    percent: number;
    steps: { id: ProfileCompletionStepId; done: boolean }[];
  };
  leadActivityStream: {
    id: string;
    createdAt: string;
    type: string;
    leadId: string;
    leadName: string | null;
    summary: string | null;
  }[];
  learnSlugs: string[];
}

interface TaskWithProject extends ProjectTask {
  projectId: string;
  projectName: string;
}

function mergeProjectTasksWithCache(p: Project): Project {
  const apiTasks = p.tasks || [];
  if (apiTasks.length > 0) return p;
  const cached = readProjectTasksCache(p.id);
  if (cached?.length) return { ...p, tasks: cached };
  return p;
}

type TranslateFn = (key: string, options?: any) => string;

const DEFAULT_LEARN_SLUGS = [
  'crm-adoption',
  'analytics-dashboards',
  'automation-triggers',
] as const;

type StoredUser = ReturnType<typeof getStoredUser>;

function mergeDashboardHome(
  api: Awaited<ReturnType<typeof fetchDashboardHome>> | null,
  user: StoredUser,
  tenantHasLeads: boolean,
  teamInvitedOk: boolean,
): Pick<DashboardData, 'profileCompletion' | 'leadActivityStream' | 'learnSlugs'> {
  if (api) {
    return {
      profileCompletion: api.profileCompletion,
      leadActivityStream: api.leadActivityStream,
      learnSlugs: api.learnSlugs?.length ? api.learnSlugs : [...DEFAULT_LEARN_SLUGS] };
  }
  const nameOk = !!user?.name?.trim();
  const phoneOk = !!user?.phone?.trim();
  const avatarOk = !!user?.avatarUrl?.trim();
  const firstLeadOk = tenantHasLeads;
  const steps: { id: ProfileCompletionStepId; done: boolean }[] = [
    { id: 'display_name', done: nameOk },
    { id: 'phone', done: phoneOk },
    { id: 'avatar', done: avatarOk },
    { id: 'first_lead', done: firstLeadOk },
    { id: 'team_invited', done: teamInvitedOk },
  ];
  const doneN = steps.filter((s) => s.done).length;
  return {
    profileCompletion: { percent: Math.round((doneN / steps.length) * 100), steps },
    leadActivityStream: [],
    learnSlugs: [...DEFAULT_LEARN_SLUGS] };
}

function resolveLocale(lang: string) {
  if (lang === 'tr') return 'tr-TR';
  if (lang === 'en') return 'en-US';
  return 'ru-RU';
}

async function loadDashboardData(t: TranslateFn, locale: string): Promise<DashboardData> {
  const currentUser = getStoredUser();
  const staffName = currentUser?.name?.trim() || null;
  const staffEmail = currentUser?.email || null;
  const staffId = (currentUser as any).staffId || (currentUser as any).staffUserId || null;
  const role = (currentUser as any)?.role || 'user';
  const isOwner = role === 'owner' || role === 'admin' || role === 'superadmin';

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Каждый источник — .catch() на пустое значение, не re-throw: сотруднику может быть не выдано
  // право на лиды/проекты/продажи, и это не должно ронять весь дашборд с сырой ошибкой API —
  // виджеты, которым эти данные нужны, сами скрываются через widgetAllowed() в DashboardPage.
  const [leadsRaw, projectsRes, salesStatsRes, homeApi] = await Promise.all([
    fetchLeads().catch((err) => { console.warn('fetchLeads', err); return []; }),
    fetchProjects().catch((err) => { console.warn('fetchProjects', err); return { items: [], total: 0 }; }),
    fetchSalesStats().catch(() => null),
    fetchDashboardHome().catch((err) => { console.warn('fetchDashboardHome', err); return null; }),
  ]);

  const allLeads = (leadsRaw || []).filter((l) => !isLeadOmittedFromAnalytics(l));
  const salesSnapshot = {
    count: salesStatsRes?.totalCount ?? 0,
    amount: salesStatsRes?.totalAmount ?? 0 };

  let projects: Project[] = [];
  if (Array.isArray((projectsRes as any)?.items)) {
    projects = (projectsRes as any).items;
  } else if (Array.isArray(projectsRes as any)) {
    projects = projectsRes as any;
  }

  let myLeads: Lead[] = [];
  let myProjects: Project[] = [];

  if (isOwner) {
    myLeads = allLeads;
    myProjects = projects;
  } else {
    myLeads = allLeads.filter((l: any) => {
      if (staffId && l.assignedUserId && l.assignedUserId === staffId) return true;
      if (staffName && l.assignedTo && typeof l.assignedTo === 'string' && l.assignedTo.trim() === staffName) return true;
      if (staffEmail && (l as any).managerEmail === staffEmail) return true;
      return false;
    });
    myProjects = projects.filter((p: any) => {
      if (staffId && p.ownerUserId && p.ownerUserId === staffId) return true;
      if (staffName && (p.ownerName === staffName || (p as any).owner === staffName)) return true;
      return false;
    });
    const hasAnyData = allLeads.length > 0 || projects.length > 0;
    if (!myLeads.length && !myProjects.length && hasAnyData) {
      myLeads = allLeads;
      myProjects = projects;
    }
  }

  const projectsWithTasksForDashboard: Project[] = await Promise.all(
    projects.map((p) =>
      fetchProject(p.id)
        .then((full) => mergeProjectTasksWithCache(full))
        .catch(() => mergeProjectTasksWithCache(p)),
    ),
  );

  let staffList: StaffUser[] = [];
  try { staffList = await fetchStaff(); } catch { staffList = []; }

  const taskVisibility = await buildDashboardTaskVisibility({
    role, staffId, userEmail: staffEmail, userName: staffName, staffList });

  const todayLeads = myLeads.filter((l) => {
    const d = new Date(l.createdAt);
    return d >= todayStart && d < todayEnd;
  }).length;
  const totalLeads = myLeads.length;
  const closedStatuses = ['Клиент', 'Забронирован', 'Оплачен', 'Closed Won', 'Выигран'];
  const converted = myLeads.filter((l) => closedStatuses.includes((l.status || '').trim())).length;
  const conversion = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;
  const revenueEUR = myProjects.reduce((sum, p: any) => {
    const st = (p.status || '').toString().toLowerCase();
    const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won'].some((x) => st.includes(x));
    return isWon && typeof p.amount === 'number' ? sum + p.amount : sum;
  }, 0);

  const leadsByChannelMap = new Map<string, number>();
  for (const l of myLeads) {
    const ch = (l.channel || t('crm.dashboard.fallbacks.other')).toString();
    leadsByChannelMap.set(ch, (leadsByChannelMap.get(ch) || 0) + 1);
  }
  const leadsByChannel = Array.from(leadsByChannelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({ channel, count, trend: 'flat' as const }));

  const pipelineMap = new Map<string, { count: number; valueEUR: number }>();
  for (const p of myProjects) {
    const stage = p.status || t('crm.dashboard.fallbacks.noStatus');
    const prev = pipelineMap.get(stage) || { count: 0, valueEUR: 0 };
    prev.count += 1;
    if (typeof p.amount === 'number') prev.valueEUR += p.amount;
    pipelineMap.set(stage, prev);
  }
  const pipeline = Array.from(pipelineMap.entries()).map(([stage, { count, valueEUR }]) => ({ stage, count, valueEUR }));

  const recentLeads: LeadShort[] = myLeads
    .slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((l) => ({
      id: l.id,
      name: l.name || t('crm.dashboard.fallbacks.noName'),
      channel: l.channel || t('crm.dashboard.fallbacks.empty'),
      status: l.status || t('crm.dashboard.fallbacks.empty'),
      createdAt: new Date(l.createdAt).toLocaleString(locale) }));

  const leadsTimelineMap = new Map<string, number>();
  for (const l of myLeads) {
    const d = new Date(l.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    leadsTimelineMap.set(key, (leadsTimelineMap.get(key) || 0) + 1);
  }
  const daysWindow = 14;
  const leadsTimeline: DashboardData['leadsTimeline'] = [];
  for (let i = daysWindow - 1; i >= 0; i--) {
    const day = new Date(todayStart);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    leadsTimeline.push({
      label: day.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
      value: leadsTimelineMap.get(key) || 0 });
  }

  const projectsSummary: DashboardData['projectsSummary'] = { total: 0, open: 0, won: 0, lost: 0, openValueEUR: 0, wonValueEUR: 0, lostValueEUR: 0 };
  for (const p of myProjects) {
    projectsSummary.total += 1;
    const st = (p.status || '').toString().toLowerCase();
    const amount = typeof p.amount === 'number' ? p.amount : 0;
    let bucket: 'open' | 'won' | 'lost' = 'open';
    if (['lost', 'проигран', 'cancel', 'отмен'].some((x) => st.includes(x))) bucket = 'lost';
    else if (['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) => st.includes(x))) bucket = 'won';
    if (bucket === 'open') { projectsSummary.open += 1; projectsSummary.openValueEUR += amount; }
    else if (bucket === 'won') { projectsSummary.won += 1; projectsSummary.wonValueEUR += amount; }
    else { projectsSummary.lost += 1; projectsSummary.lostValueEUR += amount; }
  }

  const allTasksRaw: TaskWithProject[] = (Array.isArray(projectsWithTasksForDashboard) ? projectsWithTasksForDashboard : []).flatMap((p) =>
    ((p.tasks || []) as ProjectTask[]).map((t) => ({ projectId: p.id, projectName: p.name, ...t })),
  );
  const visibleTasksForDashboard = allTasksRaw.filter((task) => taskMatchesDashboardVisibility(task, taskVisibility));
  const tasksSummary: DashboardData['tasksSummary'] = { total: visibleTasksForDashboard.length, overdue: 0, today: 0, upcoming: 0 };
  for (const t of visibleTasksForDashboard) {
    if (!t.deadline) { tasksSummary.upcoming += 1; continue; }
    const d = new Date(t.deadline);
    d.setHours(0, 0, 0, 0);
    if (d < todayStart) tasksSummary.overdue += 1;
    else if (d >= todayStart && d < todayEnd) tasksSummary.today += 1;
    else tasksSummary.upcoming += 1;
  }

  const myTasks = visibleTasksForDashboard.slice()
    .sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 10)
    .map((task) => {
      const taskTitle = task.title || t('crm.dashboard.tasks.fallbackTitle');
      return {
        id: task.id, taskId: task.id, projectId: task.projectId, projectName: task.projectName,
        taskTitle,
        title: t('crm.dashboard.tasks.titleWithProject', { title: taskTitle, project: task.projectName }),
        due: task.deadline ? new Date(task.deadline).toLocaleString(locale) : t('crm.dashboard.fallbacks.noDue'),
        type: 'todo' as const };
    });

  let staffPerformance: DashboardData['staffPerformance'] = [];
  const salesByChannelMap = new Map<string, number>();
  if (isOwner) {
    try {
      staffPerformance = staffList.filter((s) => s.isActive).map((s) => {
        const leadsCount = allLeads.filter((l: any) => {
          if (l.assignedUserId && l.assignedUserId === s.id) return true;
          if (l.assignedTo && typeof l.assignedTo === 'string' && l.assignedTo.trim() === s.fullName.trim()) return true;
          return false;
        }).length;
        const revenueEUR = projects.reduce((sum, p: any) => {
          const ownerMatch = (p.ownerUserId && p.ownerUserId === s.id) || p.ownerName === s.fullName || p.owner === s.fullName;
          if (!ownerMatch) return sum;
          const st = (p.status || '').toString().toLowerCase();
          const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) => st.includes(x));
          return isWon && typeof p.amount === 'number' ? sum + p.amount : sum;
        }, 0);
        return {
          id: s.id,
          name: s.fullName,
          leadsCount,
          revenueEUR,
          avatarUrl: s.avatarUrl?.trim() || null };
      });
    } catch { staffPerformance = []; }

    const leadById = new Map(allLeads.map((l) => [l.id, l]));
    for (const p of projects) {
      const st = (p.status || '').toString().toLowerCase();
      const isWon = ['забронирован', 'оплачен', 'выигран', 'closed won', 'client'].some((x) => st.includes(x));
      if (!isWon || typeof (p as any).amount !== 'number') continue;
      const lead = (p as any).leadId ? leadById.get((p as any).leadId) : null;
      const ch = (lead?.channel || t('crm.dashboard.fallbacks.other')).toString();
      salesByChannelMap.set(ch, (salesByChannelMap.get(ch) || 0) + (p as any).amount);
    }
  }

  const salesByChannel = Array.from(salesByChannelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, revenueEUR]) => ({ channel, revenueEUR }));

  const leadPickerOptions = (myLeads || []).slice(0, 200).map((l) => ({
    id: l.id, name: l.name || t('crm.dashboard.fallbacks.noName') }));
  const leadCalendarMeetings = flattenLeadMeetingsFromLeads(allLeads);

  const activityRecentLeads = [...myLeads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map((l) => ({ id: l.id, name: l.name || t('crm.dashboard.fallbacks.noName'), channel: l.channel || t('crm.dashboard.fallbacks.empty'), createdAt: l.createdAt }));

  const tsDay = todayStart.getTime();
  const teDay = todayEnd.getTime();
  const activityUrgentTasks = visibleTasksForDashboard
    .filter((task) => task.deadline)
    .map((task) => {
      const taskTitle = task.title || t('crm.dashboard.tasks.fallbackTitle');
      const day = new Date(task.deadline!);
      day.setHours(0, 0, 0, 0);
      const dt = day.getTime();
      let tier = 2;
      if (dt < tsDay) tier = 0;
      else if (dt >= tsDay && dt < teDay) tier = 1;
      return { tier, sortDue: new Date(task.deadline!).getTime(), id: task.id, projectId: task.projectId, projectName: task.projectName, taskTitle, due: new Date(task.deadline!).toLocaleString(locale) };
    })
    .sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : a.sortDue - b.sortDue)
    .slice(0, 8)
    .map(({ tier: _t, sortDue: _s, ...rest }) => rest);

  const activeStaffCount = staffList.filter((s) => s.isActive).length;
  const homeMerged = mergeDashboardHome(
    homeApi,
    currentUser,
    (leadsRaw || []).length > 0,
    activeStaffCount >= 2,
  );

  const projectTaskCountMap = new Map<string, { total: number; done: number }>();
  for (const task of allTasksRaw) {
    const prev = projectTaskCountMap.get(task.projectId) || { total: 0, done: 0 };
    prev.total += 1;
    const st = ((task as any).status || '').toLowerCase();
    const done = (task as any).done === true || st === 'done' || st === 'completed' || st === 'завершена' || st === 'выполнена';
    if (done) prev.done += 1;
    projectTaskCountMap.set(task.projectId, prev);
  }
  const topProjectItems = (isOwner ? projectsWithTasksForDashboard : myProjects)
    .map((p) => {
      const stats = projectTaskCountMap.get(p.id) || { total: 0, done: 0 };
      return { id: p.id, name: p.name, taskTotal: stats.total, taskDone: stats.done, amount: typeof p.amount === 'number' ? p.amount : 0 };
    })
    .sort((a, b) => b.amount - a.amount || b.taskTotal - a.taskTotal)
    .slice(0, 5);

  return {
    myProjects, summary: { todayLeads, totalLeads, conversion: Number(conversion.toFixed(1)), activeChats: 0, revenueEUR, avgResponseMin: 0 },
    leadsByChannel, pipeline, recentLeads, myTasks, leadsTimeline, projectsSummary, tasksSummary,
    staffPerformance, salesByChannel, leadPickerOptions, leadCalendarMeetings, salesSnapshot,
    activityRecentLeads, activityUrgentTasks, topProjectItems, ...homeMerged };
}

/* ─────────────────────────────────────────────
 *  QUICK ACCESS CARDS (Recently visited)
 * ─────────────────────────────────────────── */
const QUICK_ACCESS = [
  { id: 'projects' as const, labelKey: 'projectsTable' as const, href: '/projects/list', preview: 'table' as const },
  { id: 'leads' as const, labelKey: 'leadsFunnel' as const, href: '/leads', preview: 'kanban' as const },
  { id: 'analytics' as const, labelKey: 'leadsAnalytics' as const, href: '/leads/analytics', preview: 'chart' as const },
  { id: 'calendar' as const, labelKey: 'meetingsTasks' as const, href: '/calendar', preview: 'cal' as const },
];

const PrevTable = () => (
  <div className="flex flex-col gap-[3px] p-2 h-full">
    <div className="h-[5px] w-[60%] rounded-sm bg-[#222] mb-1" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="h-[7px] rounded-sm bg-neutral-100 relative overflow-hidden">
        <span className="absolute top-0 h-full rounded-sm" style={{ left: '4%', width: '18%', background: '#1769d1', opacity: 0.5 }} />
        <span className="absolute top-0 h-full rounded-sm" style={{ left: '26%', width: '14%', background: '#1f8a5e', opacity: 0.5 }} />
        <span className="absolute top-0 h-full rounded-sm" style={{ left: '44%', width: '22%', background: '#cc2f47', opacity: 0.45 }} />
      </div>
    ))}
  </div>
);

const PrevKanban = () => (
  <div className="grid grid-cols-3 gap-1 p-2 h-full">
    {[0, 1, 2].map((i) => (
      <div key={i} className="bg-neutral-100 rounded p-1 flex flex-col gap-1">
        {Array.from({ length: i === 1 ? 4 : 3 }).map((_, j) => (
          <div key={j} className="h-[6px] bg-[#222] rounded-sm" style={{ opacity: 0.85 - j * 0.15 }} />
        ))}
      </div>
    ))}
  </div>
);

const PrevChart = () => (
  <div className="p-2 h-full">
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className="w-full h-full">
      <path d="M0,60 L25,55 L50,42 L75,48 L100,30 L125,35 L150,18 L175,25 L200,12" fill="none" stroke="#222" strokeWidth="1.6" />
      <path d="M0,60 L25,55 L50,42 L75,48 L100,30 L125,35 L150,18 L175,25 L200,12 L200,80 L0,80 Z" fill="#222" opacity="0.06" />
      {[20, 45, 70].map((y) => <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#e7e7e7" strokeWidth="0.5" strokeDasharray="2 3" />)}
    </svg>
  </div>
);

const PrevCal = () => (
  <div className="p-2 h-full grid" style={{ gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(4,1fr)', gap: 2 }}>
    {Array.from({ length: 28 }).map((_, i) => (
      <div key={i} className="rounded-sm" style={{ background: [3, 9, 15, 21].includes(i) ? '#222' : '#e7e7e7', opacity: [3, 9, 15, 21].includes(i) ? 0.85 : 0.5 }} />
    ))}
  </div>
);

const STARRED_KEY = 'lumiva_dash_starred';
function loadStarred(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) || '[]')); } catch { return new Set(); }
}
function saveStarred(s: Set<string>) {
  try { localStorage.setItem(STARRED_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}

const QuickAccessCard: React.FC<{ item: typeof QUICK_ACCESS[number]; t: TranslateFn }> = ({ item, t }) => {
  const [starred, setStarred] = React.useState(() => loadStarred().has(item.id));
  const toggleStar = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setStarred((prev) => {
      const next = !prev;
      const s = loadStarred();
      if (next) s.add(item.id); else s.delete(item.id);
      saveStarred(s);
      return next;
    });
  };
  return (
    <Link
      to={item.href}
      className="group relative block rounded-[18px] border border-neutral-200 bg-white p-3.5 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition-all duration-150 hover:border-[#222] hover:-translate-y-px"
    >
      <div className="relative h-[72px] rounded-md bg-neutral-50 border border-neutral-100 overflow-hidden mb-3">
        {item.preview === 'table' && <PrevTable />}
        {item.preview === 'kanban' && <PrevKanban />}
        {item.preview === 'chart' && <PrevChart />}
        {item.preview === 'cal' && <PrevCal />}
        <button
          type="button"
          onClick={toggleStar}
          className={`absolute top-1.5 right-1.5 w-[18px] h-[18px] flex items-center justify-center rounded cursor-pointer transition-colors bg-white/60 backdrop-blur-sm ${starred ? 'text-amber-500' : 'text-neutral-400 opacity-0 group-hover:opacity-100'}`}
          title={t('crm.dashboard.quickAccess.starTitle')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
          </svg>
        </button>
      </div>
      <div className="font-mono text-[9px] text-neutral-400 uppercase tracking-[0.1em] mb-0.5">
        {t(`crm.dashboard.quickAccess.kinds.${item.id}`)}
      </div>
      <div className="text-[12px] font-semibold text-[#222] leading-snug">
        {t(`crm.dashboard.quickAccess.labels.${item.labelKey}`)}
      </div>
    </Link>
  );
};

const QuickAccessSection: React.FC<{ t: TranslateFn }> = ({ t }) => {
  const canProjects = usePermission('projects');
  const canLeads = usePermission('leads');
  const items = QUICK_ACCESS.filter((item) => {
    if (item.id === 'projects') return canProjects;
    if (item.id === 'leads' || item.id === 'analytics') return canLeads;
    return true;
  });
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <span className="text-[13px] font-semibold text-[#222] tracking-tight">{t('crm.dashboard.quickAccess.sectionTitle')}</span>
          <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{items.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <QuickAccessCard key={item.id} item={item} t={t} />
        ))}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
 *  KPI STRIP
 * ─────────────────────────────────────────── */
const MiniSparkline: React.FC<{ data: number[]; up?: boolean }> = ({ data, up = true }) => {
  const w = 80; const h = 28;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  const color = up ? '#222222' : '#cc2f47';
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.08" />
    </svg>
  );
};

const KpiStrip: React.FC<{
  data: DashboardData;
  locale: string;
  onRemove: () => void;
  t: TranslateFn;
}> = ({ data, locale, onRemove, t }) => {
  const { summary, projectsSummary, tasksSummary, leadsTimeline } = data;
  const sparkLeads = leadsTimeline.slice(-9).map((d) => d.value);
  const sparkRevenue = [60, 72, 68, 80, 78, 88, 85, 92, 100].map((v) => Math.round(v * (summary.revenueEUR / 100 || 1)));
  const sparkConv = [18, 20, 19, 22, 21, 23, 22, 24, summary.conversion];
  const sparkTasks = [tasksSummary?.total || 0, tasksSummary?.total || 0].concat(Array(7).fill(tasksSummary?.today || 0));

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />
          </svg>
          <span className="text-[13px] font-semibold text-[#222] tracking-tight">{t('crm.dashboard.kpi.sectionTitle')}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-neutral-400 hover:text-[#222] transition-colors px-1.5 py-0.5 rounded hover:bg-neutral-100"
          title={t('crm.dashboard.widgets.hide')}
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
        <KpiCell
          label={t('crm.dashboard.kpi.todayLeads')}
          value={summary?.todayLeads ?? 0}
          delta={null}
          sparkData={sparkLeads}
          up
          locale={locale}
        />
        <KpiCell
          label={t('crm.dashboard.kpi.totalLeads')}
          value={summary?.totalLeads ?? 0}
          delta={null}
          sparkData={sparkRevenue}
          up
          locale={locale}
        />
        <KpiCell
          label={t('crm.dashboard.kpi.conversion')}
          value={summary?.conversion ?? 0}
          suffix="%"
          delta={null}
          sparkData={sparkConv}
          up
          locale={locale}
        />
        <KpiCell
          label={t('crm.dashboard.kpi.tasksTotal')}
          value={tasksSummary?.total ?? 0}
          sub={
            tasksSummary
              ? t('crm.dashboard.kpi.tasksSubtitle', {
                  overdue: tasksSummary.overdue,
                  today: tasksSummary.today })
              : undefined
          }
          delta={null}
          sparkData={sparkTasks}
          up={false}
          locale={locale}
          last
        />
      </div>
    </div>
  );
};

const KpiCell: React.FC<{
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  delta: string | null;
  sparkData: number[];
  up: boolean;
  locale: string;
  last?: boolean;
}> = ({ label, value, suffix, sub, delta, sparkData, up, locale, last }) => (
  <div className={`px-5 py-4 relative cursor-pointer hover:bg-neutral-50/80 transition-colors ${!last ? 'border-r border-neutral-200' : ''}`}>
    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 font-medium">{label}</div>
    <div className="mt-3 text-[1.85rem] sm:text-[2.1rem] font-semibold text-[#222] leading-none tracking-[-0.04em] flex items-baseline gap-1">
      {value.toLocaleString(locale)}
      {suffix && <span className="text-[14px] text-neutral-400 font-medium">{suffix}</span>}
    </div>
    {delta && (
      <div className={`font-mono text-[10.5px] mt-2 ${up ? 'text-emerald-600' : 'text-rose-500'}`}>{delta}</div>
    )}
    {sub && !delta && (
      <div className="font-mono text-[10px] text-neutral-500 mt-1.5">{sub}</div>
    )}
    {sparkData.length > 1 && <MiniSparkline data={sparkData} up={up} />}
  </div>
);

/* ─────────────────────────────────────────────
 *  SIDEBAR CARDS
 * ─────────────────────────────────────────── */
const SidebarProfileCard: React.FC<{
  percent: number;
  steps: { id: ProfileCompletionStepId; done: boolean }[];
  onDismiss: () => void;
  t: TranslateFn;
}> = ({ percent, steps, onDismiss, t }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
    <div className="flex items-start justify-between mb-3.5">
      <div>
        <Link
          to="/profile/overview"
          className="text-[13px] font-semibold text-[#222] leading-snug hover:text-neutral-600 transition-colors block"
        >
          {t('crm.dashboard.profileCompletion.title')}
        </Link>
        <div className="text-[11.5px] text-neutral-500 mt-0.5">
          {t('crm.dashboard.profileCompletion.progressLine', {
            done: steps.filter((s) => s.done).length,
            total: steps.length,
            percent })}
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-[#222] hover:bg-neutral-100 rounded transition-colors"
        aria-label={t('crm.common.close')}
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>
    </div>
    <div className="flex items-center gap-2.5 mb-3">
      <div className="flex-1 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neutral-600 via-neutral-800 to-[#222222] transition-all duration-500"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-[#222] font-medium min-w-[32px] text-right">{percent}%</span>
    </div>
    <div className="flex flex-col gap-px">
      <DashboardProfileCompletion percent={percent} steps={steps} inSidebar />
    </div>
  </div>
);

const SidebarDarkCard: React.FC<{ t: TranslateFn; onChooseTemplate: () => void }> = ({
  t,
  onChooseTemplate }) => (
  <div className="rounded-xl bg-[#222222] text-white p-[18px]">
    <div className="text-[13px] font-semibold leading-snug mb-1.5 text-white">
      {t('crm.dashboard.sidebar.personalizeTitle')}
    </div>
    <div className="text-[11.5px] text-white/80 leading-relaxed">
      {t('crm.dashboard.sidebar.personalizeDesc')}
    </div>
    <button
      type="button"
      onClick={onChooseTemplate}
      className="mt-3.5 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#222222] bg-white rounded-[7px] px-3 py-1.5 hover:bg-neutral-100 transition-colors"
    >
      {t('crm.dashboard.sidebar.personalizeBtn')}
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  </div>
);

const SidebarTemplatesCard: React.FC<{ t: TranslateFn }> = ({ t }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
    <div className="text-[13px] font-semibold text-[#222] leading-snug mb-1.5">
      {t('crm.dashboard.sidebar.templatesTitle')}
    </div>
    <div className="text-[11.5px] text-neutral-500 leading-relaxed">
      {t('crm.dashboard.sidebar.templatesDesc')}
    </div>
    <Link
      to="/automations"
      className="mt-3.5 inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-[#222222] rounded-[7px] px-3 py-1.5 hover:opacity-95 transition-opacity"
    >
      {t('crm.dashboard.sidebar.templatesBtn')}
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  </div>
);

/* ─────────────────────────────────────────────
 *  MAIN PAGE
 * ─────────────────────────────────────────── */
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
      .then((res) => { if (!alive) return; setData(res); setError(null); })
      .catch((err) => { if (!alive) return; console.error(err); setError(err.message || t('crm.dashboard.errors.loadFailed')); })
      .finally(() => { if (!alive) return; setLoading(false); });
    return () => { alive = false; };
  }, [t, locale]);

  const summary = data?.summary;
  const projectsSummary = data?.projectsSummary;
  const tasksSummary = data?.tasksSummary;

  const [layout, setLayout] = useState<DashboardLayoutState>(() => loadDashboardLayout());

  // Fixed set of hook calls (rules of hooks) covering every key WIDGET_PERMISSION/preset sources
  // can reference — see widgetAllowed() below.
  const permLeads = usePermission('leads');
  const permProjects = usePermission('projects');
  const permSales = usePermission('sales');
  const permStaff = usePermission('staff');
  const permProducts = usePermission('products');
  const permBookings = usePermission('bookings');
  const permHotels = usePermission('hotels');
  const permContacts = usePermission('contacts');
  const widgetPerms: Partial<Record<PermissionKey, boolean>> = {
    leads: permLeads,
    projects: permProjects,
    sales: permSales,
    staff: permStaff,
    products: permProducts,
    bookings: permBookings,
    hotels: permHotels,
    contacts: permContacts,
  };
  const widgetAllowed = (id: string): boolean => {
    if (isDashboardPresetInstanceId(id)) {
      const source = layout.presetInstances[id]?.source;
      if (!source) return true;
      return widgetPerms[source as PermissionKey] ?? true;
    }
    const perm = WIDGET_PERMISSION[id];
    if (!perm) return true;
    return widgetPerms[perm] ?? true;
  };
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
  const [resizing, setResizing] = useState<{
    id: string; startX: number; startY: number; startHeight: number; startColSpan: number;
    liveHeight: number; liveColSpan: number; minHeight: number; axis: 'x' | 'y' | 'both';
  } | null>(null);
  const [leadsModalOpen, setLeadsModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; place: 'before' | 'after' } | null>(null);
  const [widgetEditOpen, setWidgetEditOpen] = useState(false);
  const [widgetEditId, setWidgetEditId] = useState<string | null>(null);
  const [widgetEditTitle, setWidgetEditTitle] = useState('');
  const [layoutTemplateModalOpen, setLayoutTemplateModalOpen] = useState(false);

  // Sidebar onboarding dismissal — key scoped to user+tenant so new accounts always see the widget
  const _uid = (user as any)?.id || (user as any)?.userId || (user as any)?.sub || '';
  const _tid = (user as any)?.tenantId || '';
  const dismissKey = `lumiva_onboard_dismissed_${_tid || 'x'}_${_uid || 'x'}`;
  const [profileDismissed, setProfileDismissed] = useState(
    () => localStorage.getItem(dismissKey) === '1',
  );
  const dismissProfile = () => {
    localStorage.setItem(dismissKey, '1');
    setProfileDismissed(true);
  };

  // Auto-dismiss once all steps are complete
  useEffect(() => {
    if (data?.profileCompletion.percent === 100 && !profileDismissed) {
      dismissProfile();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.profileCompletion.percent]);

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
      if (isDashboardPresetInstanceId(id) && !layout.presetInstances[id]) return false;
      if (!widgetAllowed(id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, widgetPerms]);

  // Sidebar widgets are rendered separately, not in main grid
  const SIDEBAR_WIDGET_IDS = new Set(['profile-completion', 'learn-inspire']);
  const KPI_STRIP_ID = 'kpi';

  const mainGridIds = useMemo(() =>
    visibleIds.filter((id) => !SIDEBAR_WIDGET_IDS.has(id) && id !== KPI_STRIP_ID),
    [visibleIds],
  );
  const kpiVisible = visibleIds.includes(KPI_STRIP_ID);

  const availableToAdd = useMemo(() => {
    return ALL_DASHBOARD_WIDGET_IDS.filter((id) => {
      if (!layout.hidden.has(id)) return false;
      if (!widgetAllowed(id)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.hidden, widgetPerms]);

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
    persistLayout((prev) => ({ ...prev, hidden: new Set([...prev.hidden, id]) }));
  };

  const removeWidgetBlock = (id: string) => {
    if (isDashboardPresetInstanceId(id)) {
      persistLayout((prev) => {
        const order = prev.order.filter((x) => x !== id);
        const presetInstances = { ...prev.presetInstances };
        delete presetInstances[id];
        const sizes = { ...prev.sizes }; delete sizes[id];
        const heights = { ...prev.heights }; delete heights[id];
        const titleOverrides = { ...prev.titleOverrides }; delete titleOverrides[id];
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
      if (!trimmed) { delete titleOverrides[id]; } else { titleOverrides[id] = trimmed; }
      if (isDashboardPresetInstanceId(id) && prev.presetInstances[id]) {
        const inst = prev.presetInstances[id];
        const wc: Record<string, unknown> = { ...((inst.widgetConfig as object) || {}) };
        if (!trimmed) { delete wc.title; } else { wc.title = trimmed; }
        return { ...prev, titleOverrides, presetInstances: { ...prev.presetInstances, [id]: { ...inst, widgetConfig: wc } } };
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

  const beginResize = (id: string, size: WidgetSize, axis: 'x' | 'y' | 'both', e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startHeight = getDefaultWidgetHeight(id, layout);
    const startColSpan = sizeToColSpan(size);
    const startX = e.clientX; const startY = e.clientY;
    const minHeight = 160;
    setResizing({ id, startX, startY, startHeight, startColSpan, liveHeight: startHeight, liveColSpan: startColSpan, minHeight, axis });

    const handleMove = (ev: MouseEvent) => {
      const deltaX = ev.clientX - startX; const deltaY = ev.clientY - startY;
      let liveHeight = startHeight; let liveColSpan = startColSpan;
      if (axis === 'y' || axis === 'both') liveHeight = Math.min(720, Math.max(minHeight, startHeight + deltaY));
      if (axis === 'x' || axis === 'both') liveColSpan = Math.max(4, Math.min(12, startColSpan + Math.round(deltaX / 6)));
      setResizing((prev) => prev && prev.id === id ? { ...prev, liveHeight, liveColSpan } : prev);
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
            sizes: { ...layoutState.sizes, [id]: colSpanToSize(prev.liveColSpan) } }));
        }
        return null;
      });
    };

    document.body.style.cursor = axis === 'y' ? 'ns-resize' : axis === 'both' ? 'nwse-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  const widgetSub = (id: string): string | undefined => {
    const now = new Date();
    const monthName = now.toLocaleDateString(locale, { month: 'long' });
    switch (id) {
      case 'channels-funnel':
        return `${monthName} · ${t('crm.dashboard.channels.allChannels')}`;
      case 'staff':
        return `${t('crm.dashboard.staff.subLabel')} · ${monthName}`;
      case 'activity-feed':
        return t('crm.dashboard.activity.sub');
      case 'projects':
        return t('crm.dashboard.projects.sub');
      case 'calendar': return now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
      case 'lead_sources_week': return t('crm.dashboard.widgets.leadSourcesWeekSub', { defaultValue: 'Last 7 days' });
      default: return undefined;
    }
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

  const leadsForCalendar = useMemo(() => data?.leadPickerOptions || [], [data?.leadPickerOptions]);
  const leadMeetingsForCalendar = useMemo(() => data?.leadCalendarMeetings || [], [data?.leadCalendarMeetings]);

  const renderWidgetBody = (id: string) => {
    if (!data) return null;
    if (isDashboardPresetInstanceId(id)) {
      const inst = layout.presetInstances[id];
      if (!inst) return null;
      return <DashboardPresetWidget instance={inst} projectsFromDashboard={data.myProjects} />;
    }
    switch (id) {
      case 'quick-actions':
        return <DashboardQuickActions />;
      case 'activity-feed':
        return (
          <DashboardActivityFeed
            locale={locale}
            todayLeads={data.summary?.todayLeads ?? 0}
            tasksOverdue={data.tasksSummary?.overdue ?? 0}
            tasksToday={data.tasksSummary?.today ?? 0}
            recentLeads={data.activityRecentLeads}
            urgentTasks={data.activityUrgentTasks}
            crmActivity={data.leadActivityStream}
          />
        );
      case 'calendar':
        return <DashboardCalendarMini locale={locale} leads={leadsForCalendar} leadMeetings={leadMeetingsForCalendar} />;
      case 'leads-timeline':
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-neutral-500">{t('crm.dashboard.leadsTimeline.subtitle')}</p>
              <div className="text-right text-[11px] text-neutral-500">
                {t('crm.dashboard.leadsTimeline.total')}{' '}
                <span className="text-[#222] font-semibold">{data.leadsTimeline.reduce((s, d) => s + d.value, 0)}</span>
              </div>
            </div>
            {data.leadsTimeline.length > 0 ? <SparklineBars data={data.leadsTimeline} /> : (
              <div className="text-[11px] text-neutral-500 italic">{t('crm.dashboard.leadsTimeline.empty')}</div>
            )}
          </div>
        );
      case 'projects': {
        const topP = data.topProjectItems;
        if (topP.length > 0) {
          return (
            <div className="flex flex-col gap-0">
              {topP.map((p, i) => {
                const pct = p.taskTotal > 0 ? Math.round((p.taskDone / p.taskTotal) * 100) : 0;
                return (
                  <div
                    key={p.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 80px 44px', gap: '10px', alignItems: 'center', padding: '9px 4px', borderBottom: i < topP.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-[#222] truncate">{p.name}</div>
                      <div  className="text-[10px] text-neutral-400 mt-0.5">
                        {p.taskTotal} {t('crm.dashboard.projects.tasksLabel')}{p.amount > 0 ? ` · ${p.amount.toLocaleString(locale)} €` : ''}
                      </div>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#222222] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div  className="text-[11px] text-[#222] text-right font-medium">{pct}%</div>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <div>
            {projectsSummary && projectsSummary.total > 0 ? (
              <>
                <ProjectDistributionBar summary={projectsSummary} />
                <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
                  <ProjectSummaryChip label={t('crm.dashboard.projects.chips.open')} color="bg-sky-400" count={projectsSummary.open} value={projectsSummary.openValueEUR} />
                  <ProjectSummaryChip label={t('crm.dashboard.projects.chips.won')} color="bg-emerald-400" count={projectsSummary.won} value={projectsSummary.wonValueEUR} />
                  <ProjectSummaryChip label={t('crm.dashboard.projects.chips.lost')} color="bg-rose-400" count={projectsSummary.lost} value={projectsSummary.lostValueEUR} />
                </div>
              </>
            ) : (
              <div className="text-[11px] text-neutral-500 italic mt-2">{t('crm.dashboard.projects.empty')}</div>
            )}
          </div>
        );
      }
      case 'channels-funnel': {
        const maxCount = Math.max(...data.pipeline.map((s) => s.count), 1);
        const stages = data.pipeline.length > 0 ? data.pipeline : data.leadsByChannel.map((ch) => ({ stage: ch.channel, count: ch.count, valueEUR: 0 }));
        return (
          <div className="flex flex-col gap-0">
            {stages.map((stage, i) => {
              const pct = Math.round((stage.count / maxCount) * 100);
              const valLabel = 'valueEUR' in stage && stage.valueEUR > 0 ? `${stage.valueEUR.toLocaleString(locale)} €` : 'count' in stage && 'channel' in (stage as any) ? '' : '—';
              return (
                <div
                  key={('stage' in stage ? stage.stage : (stage as any).channel) + i}
                  style={{ display: 'grid', gridTemplateColumns: '130px 1fr 80px', gap: '10px', alignItems: 'center', padding: '7px 0', borderBottom: i < stages.length - 1 ? '1px dashed #e5e5e5' : 'none' }}
                >
                  <div className="text-[12.5px] text-[#222] flex items-center gap-2 truncate">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#222] shrink-0" style={{ opacity: Math.max(0.25, 1 - i * 0.15) }} />
                    <span className="truncate">{'stage' in stage ? stage.stage : (stage as any).channel}</span>
                  </div>
                  <div className="h-[7px] bg-neutral-100 border border-neutral-200 rounded overflow-hidden">
                    <div className="h-full bg-[#222222] rounded transition-all duration-500" style={{ width: `${pct}%`, opacity: Math.max(0.25, 1 - i * 0.12) }} />
                  </div>
                  <div className="font-mono text-[11px] text-neutral-500 text-right">
                    <strong className="text-[#222] font-medium">{stage.count}</strong>
                    {valLabel ? <span> · {valLabel}</span> : null}
                  </div>
                </div>
              );
            })}
            {!stages.length && <div className="text-[11px] text-neutral-500 italic">{t('crm.dashboard.pipeline.empty')}</div>}
          </div>
        );
      }
      case 'recent-leads':
        return (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-0.5">
              <thead>
                <tr>
                  {[t('crm.dashboard.recentLeads.headers.name'), t('crm.dashboard.recentLeads.headers.channel'), t('crm.dashboard.recentLeads.headers.status'), t('crm.dashboard.recentLeads.headers.created')].map((h) => (
                    <th key={h}  className="text-left text-[9px] uppercase tracking-[0.16em] text-neutral-400 font-normal px-2 py-1.5 border-b border-neutral-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-neutral-50/80 transition-colors cursor-pointer group" onClick={() => navigate(`/leads/${lead.id}`)}>
                    <td className="px-2 py-1.5 text-[12px] font-medium text-[#222] whitespace-nowrap group-hover:text-[#222]">{lead.name}</td>
                    <td className="px-2 py-1.5 text-[11px] text-neutral-600 whitespace-nowrap">{lead.channel}</td>
                    <td className="px-2 py-1.5 text-[11px] text-neutral-600 whitespace-nowrap">{lead.status}</td>
                    <td  className="px-2 py-1.5 text-[10px] text-neutral-400 whitespace-nowrap">{lead.createdAt}</td>
                  </tr>
                ))}
                {!data.recentLeads.length && (
                  <tr><td colSpan={4} className="px-2 py-3 text-center text-[11px] text-neutral-400 italic">{t('crm.dashboard.recentLeads.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case 'recent-tasks':
        return (
          <div className="space-y-2">
            {data.myTasks.map((task) => <TaskRow key={task.id} {...task} />)}
            {!data.myTasks.length && <div className="text-[11px] text-neutral-500 italic">{t('crm.dashboard.tasks.empty')}</div>}
          </div>
        );
      case 'staff': {
        const sorted = [...data.staffPerformance].sort((a, b) => b.revenueEUR - a.revenueEUR);
        const maxRev = Math.max(...sorted.map((s) => s.revenueEUR), 1);
        return (
          <div className="flex flex-col gap-0">
            {sorted.map((s, i) => {
              const raw = s.name?.trim() || '';
              const parts = raw.split(/\s+/).filter(Boolean);
              const initials =
                parts.length >= 2
                  ? `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase()
                  : raw.slice(0, 2).toUpperCase() || '?';
              const avatarSrc = resolvePublicAssetUrl(s.avatarUrl);
              const pct = Math.round((s.revenueEUR / maxRev) * 100);
              return (
                <div
                  key={s.id}
                  className="hover:bg-neutral-50/80 transition-colors rounded-lg"
                  style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 56px', gap: '10px', alignItems: 'center', padding: '9px 4px', borderBottom: i < sorted.length - 1 ? '1px solid #f5f5f5' : 'none' }}
                >
                  <div  className={`text-[11px] ${i === 0 ? 'text-[#222] font-medium' : 'text-neutral-400'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-neutral-200"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold bg-[#222222] text-white"
                        
                      >
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-[#222] truncate">{s.name}</div>
                      <div  className="text-[10px] text-neutral-400 uppercase tracking-[0.04em] mt-0.5">{s.leadsCount} {t('crm.dashboard.staff.leadsLabel')}</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#222222] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div  className="text-[11px] text-[#222] text-right font-medium">{s.revenueEUR.toLocaleString(locale)} €</div>
                </div>
              );
            })}
            {!data.staffPerformance.length && (
              <div className="text-[11px] text-neutral-500 italic py-2">{t('crm.dashboard.staff.empty')}</div>
            )}
          </div>
        );
      }
      case 'projects-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.projectsAnalytics.kpiProjects')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{projectsSummary?.total ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.projectsAnalytics.kpiRevenue')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{(summary?.revenueEUR ?? 0).toLocaleString(locale)} €</div>
              </div>
            </div>
            <Link to="/projects/analytics" className="inline-flex items-center justify-center w-full rounded-2xl border border-[#222] bg-[#222] text-white text-[11px] font-semibold py-2.5 hover:bg-neutral-800 transition-colors">{t('crm.dashboard.projectsAnalytics.openFull')}</Link>
          </div>
        );
      case 'leads-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.leadsAnalyticsWidget.kpiLeads')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{summary?.totalLeads ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.leadsAnalyticsWidget.kpiConversion')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{summary?.conversion ?? 0}%</div>
              </div>
            </div>
            <Link to="/leads/analytics" className="inline-flex items-center justify-center w-full rounded-2xl border border-[#222] bg-[#222] text-white text-[11px] font-semibold py-2.5 hover:bg-neutral-800 transition-colors">{t('crm.dashboard.leadsAnalyticsWidget.openFull')}</Link>
          </div>
        );
      case 'sales-analytics':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.salesAnalyticsWidget.kpiCount')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{data.salesSnapshot.count}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1">{t('crm.dashboard.salesAnalyticsWidget.kpiAmount')}</div>
                <div className="text-2xl font-semibold tracking-[-0.03em] text-[#222]">{data.salesSnapshot.amount.toLocaleString(locale)}</div>
              </div>
            </div>
            <Link to="/sales/analytics" className="inline-flex items-center justify-center w-full rounded-2xl border border-[#222] bg-[#222] text-white text-[11px] font-semibold py-2.5 hover:bg-neutral-800 transition-colors">{t('crm.dashboard.salesAnalyticsWidget.openFull')}</Link>
          </div>
        );
      case 'products-analytics':
        return <ProductsAnalyticsWidget />;
      case 'bookings-analytics':
        return <BookingsAnalyticsWidget />;
      case 'hotels-analytics':
        return <HotelsAnalyticsWidget />;
      case 'funnel_today':
        return <FunnelTodayWidget />;
      case 'lead_sources_week':
        return <LeadSourcesWidget />;
      case 'recent_deals':
        return <RecentDealsWidget />;
      case 'birthdays':
        return <BirthdaysWidget />;
      default:
        return null;
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('crm.dashboard.greeting.morning');
    if (h < 18) return t('crm.dashboard.greeting.afternoon');
    return t('crm.dashboard.greeting.evening');
  };

  return (
    <MainLayout>
      <div className="relative isolate overflow-visible rounded-[18px] border border-neutral-200 bg-white px-3 py-5 shadow-[0_16px_45px_rgba(15,23,42,0.05)] sm:px-4 md:px-7 md:py-7">
        <div className="relative z-10 pb-2 md:pb-4">

          {/* ── HERO ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-neutral-100 pb-5 mb-6 flex-wrap">
            <div>
              <div  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-1">
                {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <h1  className="text-[26px] md:text-[30px] font-semibold text-[#222] tracking-tight leading-tight">
                <span className="text-neutral-400 font-medium">{getGreeting()}, </span>
                {user?.name?.trim() || user?.email || t('crm.dashboard.fallbacks.user')}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {tasksSummary && tasksSummary.today > 0 && (
                  <span  className="text-[10.5px] uppercase tracking-[0.1em] text-neutral-600">
                    {t('crm.dashboard.hero.stats.tasksToday', { count: tasksSummary.today })}
                  </span>
                )}
                {tasksSummary && tasksSummary.overdue > 0 && (
                  <span  className="text-[10.5px] uppercase tracking-[0.1em] text-rose-600">
                    {t('crm.dashboard.hero.stats.overdue', { count: tasksSummary.overdue })}
                  </span>
                )}
                {summary && summary.todayLeads > 0 && (
                  <span  className="text-[10.5px] uppercase tracking-[0.1em] text-neutral-600">
                    {t('crm.dashboard.hero.stats.newLeads', { count: summary.todayLeads })}
                  </span>
                )}
                {summary && summary.revenueEUR > 0 && (
                  <span  className="text-[10.5px] uppercase tracking-[0.1em] text-neutral-600">
                    {t('crm.dashboard.hero.stats.revenue', {
                      amount: summary.revenueEUR.toLocaleString(locale) })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPresetsModalOpen(true)}
                className="rounded-2xl border border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-600 hover:border-[#222] hover:text-[#222] transition-colors"
              >
                + {t('crm.dashboard.widgets.addBlock')}
              </button>
            </div>
          </div>

          {/* ── MAIN GRID + SIDEBAR ── */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">

            {/* Main column */}
            <div className="min-w-0">
              {/* Quick access */}
              <QuickAccessSection t={t} />

              {/* KPI Strip */}
              {kpiVisible && data && (
                <KpiStrip
                  data={data}
                  locale={locale}
                  t={t}
                  onRemove={() => hideWidget('kpi')}
                />
              )}

              {/* Widget section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
                      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
                    </svg>
                    <span className="text-[13px] font-semibold text-[#222] tracking-tight">{t('crm.dashboard.sections.myBlocks')}</span>
                    <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{mainGridIds.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPresetsModalOpen(true)}
                    className="text-[11px] text-neutral-500 hover:text-[#222] font-medium transition-colors flex items-center gap-1"
                  >
                    + {t('crm.dashboard.widgets.addBlock')}
                  </button>
                </div>

                <section className="grid grid-cols-12 gap-4 md:gap-5 items-start">
                  {mainGridIds.map((id) => {
                    const size = layout.sizes[id] || 'md';
                    const heightPx = resizing?.id === id ? resizing.liveHeight : getDefaultWidgetHeight(id, layout);
                    const colSpan = resizing?.id === id ? resizing.liveColSpan : sizeToColSpan(size);
                    return (
                      <DashboardWidgetChrome
                        key={id}
                        title={widgetTitle(id)}
                        sub={widgetSub(id)}
                        size={size}
                        colSpan={colSpan}
                        heightPx={heightPx}
                        resizeActive={resizing?.id === id}
                        dragging={draggingId === id}
                        dropBefore={!!dropIndicator && dropIndicator.targetId === id && dropIndicator.place === 'before' && draggingId !== null && draggingId !== id}
                        dropAfter={!!dropIndicator && dropIndicator.targetId === id && dropIndicator.place === 'after' && draggingId !== null && draggingId !== id}
                        onBeginResize={(axis, e) => beginResize(id, size, axis, e)}
                        dragOver={dropIndicator?.targetId === id && draggingId !== null && draggingId !== id}
                        onEdit={() => { setWidgetEditId(id); setWidgetEditTitle(widgetTitle(id)); setWidgetEditOpen(true); }}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDraggingId(id); }}
                        onDragEnd={() => { setDraggingId(null); setDropIndicator(null); }}
                        onDragOver={(e) => {
                          e.preventDefault(); e.dataTransfer.dropEffect = 'move';
                          if (!draggingId || draggingId === id) return;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const mid = rect.top + rect.height / 2;
                          setDropIndicator({ targetId: id, place: e.clientY < mid ? 'before' : 'after' });
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = e.dataTransfer.getData('text/plain') || draggingId;
                          if (!from || from === id) { setDraggingId(null); setDropIndicator(null); return; }
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const mid = rect.top + rect.height / 2;
                          reorderByDrag(from, id, e.clientY < mid ? 'before' : 'after');
                          setDraggingId(null); setDropIndicator(null);
                        }}
                        actions={
                          id === 'recent-leads' ? (
                            <button
                              type="button"
                              draggable={false}
                              onClick={() => setLeadsModalOpen(true)}
                              className="rounded-lg border border-neutral-200 bg-white/80 px-2 py-1 text-[10px] text-neutral-600 hover:bg-neutral-50"
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

                  {/* Empty add slot */}
                  {mainGridIds.length === 0 && (
                    <div
                      className="col-span-12 border border-dashed border-neutral-300 rounded-[18px] p-10 text-center text-neutral-500 text-[12px] cursor-pointer transition-colors hover:border-[#222] hover:text-[#222]"
                      onClick={() => setPresetsModalOpen(true)}
                    >
                      <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14" /></svg>
                      </div>
                      {t('crm.dashboard.widgets.addBlock')}
                      <div className="text-[11px] text-neutral-400 mt-1">{t('crm.dashboard.widgets.addBlockHint')}</div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* ── SIDEBAR ── */}
            <aside className="flex flex-col gap-4 xl:sticky xl:top-[72px]">

              {/* Profile completion — hide when dismissed, at 100%, or when steps not loaded */}
              {!profileDismissed && data && data.profileCompletion.steps.length > 0 && data.profileCompletion.percent < 100 && (
                <SidebarProfileCard
                  percent={data.profileCompletion.percent}
                  steps={data.profileCompletion.steps}
                  onDismiss={dismissProfile}
                  t={t}
                />
              )}

              {/* Personalize */}
              <SidebarDarkCard t={t} onChooseTemplate={() => setLayoutTemplateModalOpen(true)} />

              {/* Templates */}
              <SidebarTemplatesCard t={t} />

              {/* Learn & Inspire */}
              {data && (
                <div className="rounded-xl border border-neutral-200 bg-white p-[18px]">
                  <div className="text-[13px] font-semibold text-[#222] leading-snug mb-2">
                    {t('crm.dashboard.learn.sidebarTitle')}
                  </div>
                  <DashboardLearnInspire slugs={data.learnSlugs} inSidebar />
                </div>
              )}
            </aside>
          </div>

          {/* ── MODALS ── */}
          {leadsModalOpen && data && createPortal(
            <div className="fixed inset-0 z-[10080] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm" role="presentation" onMouseDown={() => setLeadsModalOpen(false)}>
              <div role="dialog" className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[18px] border border-neutral-200/90 bg-white/98 backdrop-blur-md p-5 ring-1 ring-neutral-900/[0.08]" onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-semibold text-[#222]">{t('crm.dashboard.recentLeads.title')}</h3>
                  <div className="flex items-center gap-2">
                    <Link to="/leads/list" className="text-[11px] text-[#222] font-medium hover:underline">{t('crm.dashboard.recentLeads.openAll')}</Link>
                    <button type="button" onClick={() => setLeadsModalOpen(false)} className="text-[11px] text-neutral-500 hover:text-[#222]">{t('crm.common.close')}</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] md:text-xs border-separate border-spacing-y-1">
                    <thead className="text-neutral-500">
                      <tr>
                        <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.name')}</th>
                        <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.channel')}</th>
                        <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.status')}</th>
                        <th className="text-left font-normal px-2 py-1">{t('crm.dashboard.recentLeads.headers.created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentLeads.map((lead) => (
                        <tr key={lead.id} className="bg-neutral-100/70 hover:bg-neutral-200 transition-colors cursor-pointer" onClick={() => { setLeadsModalOpen(false); navigate(`/leads/${lead.id}`); }}>
                          <td className="px-2 py-1.5 text-[#222] font-medium whitespace-nowrap">{lead.name}</td>
                          <td className="px-2 py-1.5 text-neutral-600 whitespace-nowrap">{lead.channel}</td>
                          <td className="px-2 py-1.5 text-neutral-600 whitespace-nowrap">{lead.status}</td>
                          <td className="px-2 py-1.5 text-neutral-500 whitespace-nowrap">{lead.createdAt}</td>
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
              onPick={(preset) => { requestAddDashboardPreset(preset); setPresetsModalOpen(false); }}
              hiddenStandardIds={availableToAdd}
              onAddStandard={addWidget}
              widgetTitle={widgetTitle}
            />
          )}

          {layoutTemplateModalOpen && (
            <DashboardLayoutTemplateModal
              onClose={() => setLayoutTemplateModalOpen(false)}
              getLayout={() => layout}
              onApplied={(next) => {
                setLayout(next);
                setToast(t('crm.dashboard.layoutTemplate.applied'));
                window.setTimeout(() => setToast(null), 2800);
              }}
            />
          )}

          {widgetEditOpen && widgetEditId && createPortal(
            <div
              className="fixed inset-0 z-[10085] flex items-center justify-center p-4 bg-black/45 backdrop-blur-md"
              onClick={() => { setWidgetEditOpen(false); setWidgetEditId(null); }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setWidgetEditOpen(false); setWidgetEditId(null); } }}
              role="presentation"
            >
              <div role="dialog" aria-modal="true" aria-labelledby="widget-edit-title"
                className="w-full max-w-md rounded-[18px] border border-neutral-200/90 bg-white p-6 text-[#222] shadow-2xl shadow-neutral-900/20 ring-1 ring-neutral-900/[0.06]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="widget-edit-title" className="text-base font-semibold tracking-tight text-[#222]">{t('crm.dashboard.widgets.editModalTitle')}</h3>
                <label htmlFor="widget-edit-title-input" className="mt-4 block text-[12px] font-medium text-neutral-600">{t('crm.dashboard.widgets.editTitleLabel')}</label>
                <input
                  id="widget-edit-title-input"
                  value={widgetEditTitle}
                  onChange={(e) => setWidgetEditTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-[#222] outline-none transition-shadow focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-900/10"
                  autoFocus
                />
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                  <button type="button" onClick={() => { removeWidgetBlock(widgetEditId); setWidgetEditOpen(false); setWidgetEditId(null); }}
                    className="rounded-xl border border-[#f0c8cf] bg-[#fbecef] px-3.5 py-2 text-[12px] font-medium text-[#9a1f31] hover:bg-[#f7d8dd]">
                    {t('crm.dashboard.widgets.deleteBlock')}
                  </button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => { setWidgetEditOpen(false); setWidgetEditId(null); }}
                      className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-[12px] font-medium text-[#222] shadow-sm hover:bg-neutral-50">
                      {t('crm.common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { saveWidgetTitle(widgetEditId, widgetEditTitle); setWidgetEditOpen(false); setWidgetEditId(null); }}
                      className="btn-primary"
                    >
                      {t('crm.common.save')}
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )}

        </div>
      </div>

      {toast && (
        <div className="fixed top-20 right-4 z-[10090] rounded-[18px] border border-neutral-200/90 bg-white/95 backdrop-blur-sm px-4 py-2 text-[11px] text-[#222] ring-1 ring-neutral-900/[0.06]">
          {toast}
        </div>
      )}
      {loading && (
        <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-neutral-200/90 text-[11px] text-neutral-700 ring-1 ring-neutral-900/[0.05] flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t('crm.dashboard.loading')}
          </div>
        </div>
      )}
      {error && (
        <div className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <div className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 text-[11px] text-red-600 ring-1 ring-red-200/60">{error}</div>
        </div>
      )}
    </MainLayout>
  );
};

/* ─────────────────────────────────────────────
 *  SMALL COMPONENTS (unchanged)
 * ─────────────────────────────────────────── */
const SparklineBars: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-[3px] h-20 md:h-24">
        {data.map((d, idx) => {
          const height = Math.max(8, (d.value / max) * 100);
          const isLast = idx === data.length - 1 && d.value > 0;
          return (
            <div key={idx} className="flex-1 flex items-end justify-center">
              <div className={`w-full rounded-t-[4px] transition-all ${isLast ? 'bg-[#222222]' : 'bg-neutral-200 hover:bg-neutral-300'}`} style={{ height: `${height}%` }} />
            </div>
          );
        })}
      </div>
      <div  className="flex justify-between text-[9px] text-neutral-400 tracking-[0.06em]">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const ProjectDistributionBar: React.FC<{ summary: DashboardData['projectsSummary'] }> = ({ summary }) => {
  const { open, won, lost } = summary;
  const total = open + won + lost;
  return (
    <div className="mt-3">
      <div className="h-3 rounded-full bg-neutral-100 overflow-hidden flex ring-1 ring-neutral-100">
        {total === 0 ? <div className="h-full w-full bg-neutral-200" /> : (
          <>
            {open > 0 && <div className="h-full bg-[#1769d1]/75" style={{ flex: open }} />}
            {won > 0 && <div className="h-full bg-[#1f8a5e]/80" style={{ flex: won }} />}
            {lost > 0 && <div className="h-full bg-[#cc2f47]/75" style={{ flex: lost }} />}
          </>
        )}
      </div>
    </div>
  );
};

const ProjectSummaryChip: React.FC<{ label: string; color: string; count: number; value: number }> = ({ label, color, count, value }) => {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  return (
    <div className="rounded-2xl bg-white border border-neutral-200 px-3 py-2.5 flex flex-col gap-0.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 font-medium">
        <span className={`h-1.5 w-1.5 rounded-full ${color}`} /><span>{label}</span>
      </div>
      <div  className="text-[10px] text-neutral-500">
        {t('crm.dashboard.projects.countLabel')} <span className="text-[#222] font-medium">{count}</span>
      </div>
      <div  className="text-[10px] text-neutral-500">
        {t('crm.dashboard.projects.amountLabel')} <span className="text-[#222] font-medium">{value.toLocaleString(locale)} €</span>
      </div>
    </div>
  );
};

const TaskStatPill: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="inline-flex items-center gap-1.5 rounded-full bg-white border border-neutral-200 px-2.5 py-1">
    <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
    <span className="text-[11px] text-neutral-600">{label}</span>
    <span  className="text-[11px] text-[#222] font-medium">{value}</span>
  </div>
);

const ChannelRow: React.FC<{ channel: string; count: number; trend: 'up' | 'down' | 'flat' }> = ({ channel, count, trend }) => {
  const maxBar = Math.max(1, count * 1.4);
  const width = Math.max(8, (count / maxBar) * 100);
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const trendLabel = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-500' : 'text-neutral-400';
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 text-[12px] text-neutral-600 truncate font-medium">{channel}</div>
      <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#222] transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      <div  className="w-14 text-right text-[11px] text-neutral-700">{count.toLocaleString(locale)}</div>
      <div className={`w-4 text-right text-[11px] ${trendColor}`}>{trendLabel}</div>
    </div>
  );
};

const PipelineRow: React.FC<{ stage: string; count: number; valueEUR: number }> = ({ stage, count, valueEUR }) => {
  const max = Math.max(1, valueEUR * 1.4);
  const width = Math.max(10, (valueEUR / max) * 100);
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[#222] truncate">{stage}</span>
        <span  className="text-[10px] text-neutral-500 whitespace-nowrap">
          {t('crm.dashboard.pipeline.itemLabel', { count, value: valueEUR.toLocaleString(locale) })}
        </span>
      </div>
      <div className="h-1 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#222] transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const TaskRow: React.FC<{ id: string; taskId: string; projectId: string; projectName: string; taskTitle: string; title: string; due: string; type: 'call' | 'meeting' | 'todo' }> = ({ projectId, taskTitle, projectName, due, type }) => {
  const { t } = useTranslation();
  const color = type === 'call' ? 'bg-[#1f8a5e]/85' : type === 'meeting' ? 'bg-[#5a45a8]/80' : 'bg-[#1769d1]/85';
  const translatedLabel = type === 'call' ? t('crm.dashboard.taskTypes.call') : type === 'meeting' ? t('crm.dashboard.taskTypes.meeting') : t('crm.dashboard.taskTypes.todo');
  const projectHref = `/projects/${encodeURIComponent(projectId)}?tab=tasks`;
  return (
    <div className="flex items-start gap-2.5 bg-white border border-neutral-200 rounded-2xl px-3 py-2.5 transition-colors hover:border-neutral-300 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
      <div className="flex-1 min-w-0">
        <Link to={projectHref} className="block text-[12px] font-medium text-[#222] hover:text-neutral-700 text-left">{taskTitle}</Link>
        <Link to={projectHref} className="block text-[11px] text-neutral-500 mt-0.5 truncate hover:text-neutral-700 text-left">{projectName}</Link>
        <div  className="text-[10px] text-neutral-400 mt-0.5 tracking-[0.04em]">{translatedLabel} · {due}</div>
      </div>
    </div>
  );
};
