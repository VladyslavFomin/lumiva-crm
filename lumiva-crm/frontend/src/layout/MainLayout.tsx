// src/layout/MainLayout.tsx
import React, { useEffect, useMemo, useReducer, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  getStoredUser,
  clearSession,
  isBillingLocked,
  getStoredTenantName,
  updateStoredTenantName,
  SESSION_USER_UPDATED_EVENT,
} from '../auth/session';
import { WorkspaceSidebarBlock } from '../components/layout/WorkspaceSidebarBlock';
import { WorkspaceAreaSwitcher } from '../components/workspace/WorkspaceAreaSwitcher';
import { NAV_ICON_MAP, NavChevronDown, NavIconDots, type NavIconKey } from '../components/layout/NavSidebarIcons';
import { fetchChatSessions } from '../api/onlineChat';
import { fetchLeadsList, isLeadOmittedFromAnalytics } from '../api/leads';
import {
  fetchProject,
  fetchProjects,
  updateProject,
} from '../api/projects';
import { fetchStaff, type StaffRole, type StaffUser } from '../api/staff';
import type { Project, ProjectTask, TaskStatus } from '../pages/projects/projectTypes';
import {
  readProjectTasksCache,
  writeProjectTasksCache,
} from '../pages/projects/projectTasksCache';
import {
  assigneeEntryDisplayLabel,
  isTaskAssigneeSelected,
  normalizeAssigneesToStaffIds,
  toggleTaskAssigneeIds,
} from '../pages/projects/taskAssignees';
import { fetchStaffPermissions, fetchUserPermissions, type PermissionKey, type RolePermissionMatrix, type UserPermissionMatrix } from '../api/rbac';
import { fetchTenantComponents, type TenantComponent } from '../api/tenants';
import { fetchCustomObject } from '../api/customObjects';
import {
  fetchCompanySettings,
  TENANT_BRANDING_EVENT,
} from '../api/settings';
import { resolvePublicAssetUrl } from '../api/client';
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../utils/withTimeout';
import { AiAssistantPanel } from '../components/ai/AiAssistantPanel';
import { AiAssistantTriggerIcon } from '../components/ai/AiAssistantTriggerIcon';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type InAppNotification,
} from '../api/notifications';

const DEFAULT_SIDEBAR_LOGO = '/lumiva-default-logo.svg';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';
import { BillingPage } from '../pages/BillingPage';
import {
  DASHBOARD_ADD_WIDGET_EVENT,
  DASHBOARD_LAYOUT_CHANGED_EVENT,
  applyDashboardAddWidgetDetail,
  type DashboardAddWidgetDetail,
  type DashboardLayoutChangedDetail,
} from '../dashboard/dashboardLayout';

interface MainLayoutProps {
  children: React.ReactNode;
  fullBleed?: boolean;
}

type NavChild = { label: string; path: string; matchPaths?: string[] };
type NavSectionId = 'main' | 'clients' | 'tools' | 'management';
type NavCountBadge = 'leads' | 'projects' | 'chat';
type NavItem = {
  label: string;
  path: string;
  icon: NavIconKey;
  section: NavSectionId;
  countBadge?: NavCountBadge;
  children?: NavChild[];
  matchPaths?: string[];
};

const NAV_SECTION_ORDER: NavSectionId[] = ['main', 'clients', 'tools', 'management'];

function normalizeLayoutPath(pathname: string): string {
  if (pathname.startsWith('/app/')) return pathname.slice(4);
  if (pathname === '/app' || pathname === '/app/') return '/dashboard';
  return pathname;
}

function toLegacyNavPath(navPath: string): string {
  if (navPath === '/app' || navPath === '/app/') return '/dashboard';
  if (navPath.startsWith('/app/')) return navPath.slice(4);
  return navPath;
}

function matchesNavPath(pathname: string, navPath: string): boolean {
  const stripQuery = (p: string) => p.split('?')[0];
  const candidates = [navPath, toLegacyNavPath(navPath)]
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(stripQuery);
  return candidates.some(
    (c) => pathname === c || pathname.startsWith(`${c}/`),
  );
}

/** Сегменты /projects/:x, которые не являются карточкой одного проекта (списки, формы). */
const PROJECT_ROUTE_PREFIXES = new Set([
  'archive',
  'trash',
  'closed',
  'in-progress',
  'tasks',
  'analytics',
  'board',
  'calendar',
  'new',
  'create',
]);

function isProjectDetailPath(pathname: string): boolean {
  const m = pathname.match(/^\/projects\/([^/]+)/);
  if (!m) return false;
  return !PROJECT_ROUTE_PREFIXES.has(m[1]);
}

function itemMatchScore(pathname: string, item: NavItem): number {
  let best = 0;
  const paths = [
    item.path,
    ...(item.matchPaths ?? []),
    ...(item.children?.flatMap((c) => [c.path, ...(c.matchPaths ?? [])]) ?? []),
  ];
  for (const p of paths) {
    if (!matchesNavPath(pathname, p)) continue;
    const leg = toLegacyNavPath(p);
    const candidates = [p, leg].filter((v, i, a) => a.indexOf(v) === i);
    for (const c of candidates) {
      if (pathname === c || pathname.startsWith(`${c}/`)) {
        if (c.length > best) best = c.length;
      }
    }
  }
  return best;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, fullBleed = false }) => {
  const { t, i18n } = useTranslation();
  const [, bumpSessionUser] = useReducer((n: number) => n + 1, 0);
  const user = getStoredUser();
  const staffRoleLabel = useMemo(() => {
    const raw = String(user?.role ?? 'owner').toLowerCase();
    const key = `crm.staff.roles.${raw}`;
    if (i18n.exists(key)) return t(key);
    return String(user?.role ?? 'owner');
  }, [user?.role, i18n, t]);
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [navLeadCount, setNavLeadCount] = useState<number | null>(null);
  const [navProjectCount, setNavProjectCount] = useState<number | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsPreviewOpen, setNotificationsPreviewOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [taskNotifications, setTaskNotifications] = useState<
    Array<{
      projectId: string;
      projectName: string;
      taskId: string;
      task: ProjectTask;
      isAssigned: boolean;
      isMentioned: boolean;
      isDone: boolean;
      project: Project;
    }>
  >([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [openAssigneeMenuId, setOpenAssigneeMenuId] = useState<string | null>(null);
  const [notificationsTab, setNotificationsTab] = useState<
    'assigned' | 'mentioned' | 'all' | 'system'
  >('all');
  const [inAppNotifications, setInAppNotifications] = useState<InAppNotification[]>([]);
  const [inAppUnread, setInAppUnread] = useState(0);
  const [inAppLoading, setInAppLoading] = useState(false);
  const [filterProjectId, setFilterProjectId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<ProjectTask['status'] | ''>('');
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const notificationsPanelRef = useRef<HTMLDivElement | null>(null);
  const tasksByProjectRef = useRef<Record<string, ProjectTask[]>>({});
  const projectsByIdRef = useRef<Record<string, Project>>({});
  const [roleMatrix, setRoleMatrix] = useState<RolePermissionMatrix | null>(null);
  const [userMatrix, setUserMatrix] = useState<UserPermissionMatrix | null>(null);
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [tenantComponents, setTenantComponents] = useState<TenantComponent[]>([]);
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const billingLocked = isBillingLocked();
  
  // Используем useRef для хранения флага загрузки, чтобы он не сбрасывался при ре-рендерах
  const componentsLoadedRef = useRef<{ userId: string | null; loaded: boolean }>({ userId: null, loaded: false });
  const loadingInProgressRef = useRef(false);

  /** Подменю: явное сворачивание стрелкой (иначе activeRoot снова раскрывает раздел) */
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({});
  const SIDEBAR_COLLAPSED_KEY = 'lumiva_sidebar_rail_v1';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [sidebarEdgeHover, setSidebarEdgeHover] = useState(false);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [tenantLogoFailed, setTenantLogoFailed] = useState(false);
  const [tenantNameDisplay, setTenantNameDisplay] = useState<string | null>(null);

  const LUMIVA_WS_AREA = 'lumiva_workspace_area_id';
  const [sidebarWorkspaceAreaId, setSidebarWorkspaceAreaId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LUMIVA_WS_AREA);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const path = normalizeLayoutPath(location.pathname);
    const am = path.match(/^\/workspace\/areas\/([0-9a-f-]{36})/i);
    if (am) {
      setSidebarWorkspaceAreaId(am[1]);
      try {
        localStorage.setItem(LUMIVA_WS_AREA, am[1]);
      } catch {
        /* ignore */
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    const path = normalizeLayoutPath(location.pathname);
    if (path.match(/^\/workspace\/areas\//i)) return;
    const tm = path.match(/^\/workspace\/([0-9a-f-]{36})\//i);
    if (!tm) return;
    let cancelled = false;
    void fetchCustomObject(tm[1])
      .then((o) => {
        if (cancelled || !o.workspaceAreaId) return;
        setSidebarWorkspaceAreaId(o.workspaceAreaId);
        try {
          localStorage.setItem(LUMIVA_WS_AREA, o.workspaceAreaId);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    setTenantLogoFailed(false);
  }, [tenantLogoUrl]);

  const sidebarBrandLogoSrc = useMemo(() => {
    if (!tenantLogoUrl?.trim()) return DEFAULT_SIDEBAR_LOGO;
    if (tenantLogoFailed) return DEFAULT_SIDEBAR_LOGO;
    return resolvePublicAssetUrl(tenantLogoUrl) || DEFAULT_SIDEBAR_LOGO;
  }, [tenantLogoUrl, tenantLogoFailed]);

  useEffect(() => {
    let cancelled = false;
    const loadBranding = async () => {
      try {
        const s = await fetchCompanySettings();
        if (!cancelled) {
          setTenantLogoUrl(s.logoUrl ?? null);
          const n = s.name?.trim();
          setTenantNameDisplay(n || null);
          if (n) updateStoredTenantName(n);
        }
      } catch {
        if (!cancelled) {
          setTenantLogoUrl(null);
          setTenantNameDisplay(null);
        }
      }
    };
    void loadBranding();
    const onBranding = () => void loadBranding();
    window.addEventListener(TENANT_BRANDING_EVENT, onBranding);
    return () => {
      cancelled = true;
      window.removeEventListener(TENANT_BRANDING_EVENT, onBranding);
    };
  }, []);

  useEffect(() => {
    const onUser = () => bumpSessionUser();
    window.addEventListener(SESSION_USER_UPDATED_EVENT, onUser);
    return () => window.removeEventListener(SESSION_USER_UPDATED_EVENT, onUser);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    setSectionExpanded({});
  }, [location.pathname]);

  /** «Добавить на главную» из аналитики: Dashboard не смонтирован — пишем layout здесь */
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<DashboardAddWidgetDetail>).detail;
      if (applyDashboardAddWidgetDetail(d)) {
        window.dispatchEvent(
          new CustomEvent<DashboardLayoutChangedDetail>(DASHBOARD_LAYOUT_CHANGED_EVENT, {
            detail: { addedWidget: true },
          }),
        );
      }
    };
    window.addEventListener(DASHBOARD_ADD_WIDGET_EVENT, h);
    return () => window.removeEventListener(DASHBOARD_ADD_WIDGET_EVENT, h);
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/login';
  };

  // Поллинг открытых чатов (условно непрочитанные)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const sessions = await fetchChatSessions({ status: 'open' });
        if (!alive) return;
        const unread = sessions.filter((s: any) => s.unread || s.lastSender === 'visitor').length;
        setUnreadChats(unread);
      } catch {
        if (!alive) return;
        setUnreadChats(0);
      }
    };
    load();
    const timer = window.setInterval(load, 10000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  /** Счётчики лидов / проектов для бейджей в меню */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [leads, projRes] = await Promise.all([fetchLeadsList(), fetchProjects()]);
        if (!alive) return;
        const leadCount = leads.filter((l) => !isLeadOmittedFromAnalytics(l)).length;
        setNavLeadCount(leadCount);
        setNavProjectCount(
          typeof projRes.total === 'number' ? projRes.total : projRes.items.length,
        );
      } catch {
        if (!alive) return;
        setNavLeadCount(null);
        setNavProjectCount(null);
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const normalize = (value?: string | null) =>
    (value ?? '').toString().trim().toLowerCase();
  const extractMentions = (text: string) => {
    const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
    const result: string[] = [];
    for (const match of matches) {
      if (match[1]) result.push(match[1]);
    }
    return result;
  };
  const currentLabels = useMemo(
    () =>
      [user?.name, user?.email]
        .filter(Boolean)
        .map((v) => normalize(v as string)),
    [user],
  );
  const statusOptions: ProjectTask['status'][] = [
    'К выполнению',
    'В работе',
    'На проверке',
    'Заблокировано',
    'Отложено',
    'Готово',
  ];
  const priorityOptions: ProjectTask['priority'][] = ['Обычный', 'Высокий', 'Низкий'];
  const progressValue = (project: Project) => {
    const total = project.tasks?.length ?? 0;
    if (!total) return 0;
    const done = project.tasks.filter((t) => isDoneStatus(t.status)).length;
    return Math.round((done / total) * 100);
  };
  const isDoneStatus = (status?: string | null) => {
    if (!status) return false;
    const normalized = status.toString().trim().toLowerCase();
    return (
      normalized.includes('готов') ||
      normalized.includes('done') ||
      normalized.includes('complete') ||
      normalized.includes('completed') ||
      normalized.includes('finished')
    );
  };

  const loadTaskNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const [projectsRes, staffUsers] = await Promise.all([
        fetchProjects(),
        fetchStaff(),
      ]);
      setStaff(staffUsers);
      const detailed = await Promise.all(
        projectsRes.items.map((p) => fetchProject(p.id).catch(() => p)),
      );
      const result: Array<{
        projectId: string;
        projectName: string;
        taskId: string;
        task: ProjectTask;
        isAssigned: boolean;
        isMentioned: boolean;
        isDone: boolean;
        project: Project;
      }> = [];
      detailed.forEach((project) => {
        const cached = readProjectTasksCache(project.id);
        const source =
          project.tasks && project.tasks.length > 0 ? project.tasks : cached ?? [];
        if (source.length > 0) writeProjectTasksCache(project.id, source);
        tasksByProjectRef.current[project.id] = source;
        projectsByIdRef.current[project.id] = project as Project;
        source.forEach((task) => {
          const assignees = (task.assignees || []).map((a) => normalize(a));
          const mentions = extractMentions(task.title || '').map((m) =>
            normalize(m),
          );
          const isAssigned = assignees.some((a) => currentLabels.includes(a));
          const isMentioned = mentions.some((m) => currentLabels.includes(m));
          const isDone = isDoneStatus(task.status);
          result.push({
            projectId: project.id,
            projectName: project.name,
            taskId: task.id,
            task,
            isAssigned,
            isMentioned,
            isDone,
            project,
          });
        });
      });
      setTaskNotifications(result);
    } catch {
      setTaskNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    const base = taskNotifications.filter((item) => {
      if (notificationsTab === 'assigned' && !item.isAssigned) return false;
      if (notificationsTab === 'mentioned' && !item.isMentioned) return false;
      if (filterProjectId && item.projectId !== filterProjectId) return false;
      if (filterStatus && item.task.status !== filterStatus) return false;
      return true;
    });
    const withOverdue = base.map((item) => {
      const deadline = item.task.deadline ? new Date(item.task.deadline) : null;
      const isOverdue =
        deadline && !item.isDone
          ? deadline.getTime() < new Date().setHours(0, 0, 0, 0)
          : false;
      return { ...item, isOverdue };
    });
    return withOverdue.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return 0;
    });
  }, [
    taskNotifications,
    notificationsTab,
    filterProjectId,
    filterStatus,
    currentLabels,
  ]);

  const systemNotificationLink = (notification: InAppNotification): string | null => {
    const meta = notification.meta && typeof notification.meta === 'object' ? notification.meta : {};
    const raw = String(meta.link || '').trim();
    if (!raw.startsWith('/')) return null;
    return raw.replace(/^\/app(?=\/|$)/, '') || '/dashboard';
  };

  const systemNotificationTypeLabel = (notification: InAppNotification): string => {
    const meta = notification.meta && typeof notification.meta === 'object' ? notification.meta : {};
    if (meta.type === 'email.message_received') return 'Почта';
    if (meta.type === 'email.calendar_invite_received') return 'Встреча';
    return 'Система';
  };

  const markSystemNotificationReadLocal = (id: string) => {
    setInAppNotifications((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    setInAppUnread((prev) => Math.max(0, prev - 1));
  };

  const openSystemNotification = (notification: InAppNotification) => {
    if (!notification.isRead) {
      markNotificationRead(notification.id).catch(() => {});
      markSystemNotificationReadLocal(notification.id);
    }
    const link = systemNotificationLink(notification);
    if (link) {
      setNotificationsOpen(false);
      navigate(link);
    }
  };

  useEffect(() => {
    if (!notificationsOpen && !notificationsPreviewOpen) return;
    loadTaskNotifications();
  }, [notificationsOpen, notificationsPreviewOpen]);

  useEffect(() => {
    let alive = true;
    const refreshUnread = () => {
      fetchNotifications({ unread: true, limit: 1 })
        .then(({ unread }) => {
          if (alive) setInAppUnread(unread);
        })
        .catch(() => {});
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    let alive = true;
    const loadInAppNotifications = (showLoading: boolean) => {
      if (showLoading) setInAppLoading(true);
      fetchNotifications({ limit: 50 })
        .then(({ items, unread }) => {
          if (!alive) return;
          setInAppNotifications(items);
          setInAppUnread(unread);
        })
        .catch(() => {})
        .finally(() => {
          if (alive && showLoading) setInAppLoading(false);
        });
    };
    loadInAppNotifications(true);
    const timer = window.setInterval(() => loadInAppNotifications(false), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        notificationsPanelRef.current &&
        !notificationsPanelRef.current.contains(target) &&
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [notificationsOpen]);

  useEffect(() => {
    setNotificationsOpen(false);
    setNotificationsPreviewOpen(false);
    setOpenAssigneeMenuId(null);
  }, [location.pathname]);

  const updateProjectTasks = async (
    projectId: string,
    nextTasks: ProjectTask[],
  ) => {
    const target =
      projectsByIdRef.current[projectId] ?? (await fetchProject(projectId));
    writeProjectTasksCache(projectId, nextTasks);
    await updateProject({ ...target, tasks: nextTasks }, { includeEmptyTasks: true });
    tasksByProjectRef.current[projectId] = nextTasks;
    projectsByIdRef.current[projectId] = {
      ...target,
      tasks: nextTasks,
    } as Project;
    await loadTaskNotifications();
  };

  const toggleTaskDone = async (projectId: string, task: ProjectTask) => {
    const project = await fetchProject(projectId);
    const nextStatus: TaskStatus =
      task.status === 'Готово' ? 'К выполнению' : 'Готово';
    const nextTasks = (project.tasks || []).map((t) =>
      t.id === task.id ? { ...t, status: nextStatus } : t,
    );
    await updateProjectTasks(projectId, nextTasks);
  };

  const updateTaskField = async (
    projectId: string,
    taskId: string,
    patch: Partial<ProjectTask>,
  ) => {
    if (patch.status && filterStatus && patch.status !== filterStatus) {
      setFilterStatus('');
    }
    const baseTasks = tasksByProjectRef.current[projectId] ?? [];
    const nextTasks = baseTasks.map((t) =>
      t.id === taskId ? { ...t, ...patch } : t,
    );
    if (!nextTasks.length) {
      const fallback = await fetchProject(projectId);
      const fallbackTasks = fallback.tasks || [];
      tasksByProjectRef.current[projectId] = fallbackTasks;
      const recovered = fallbackTasks.map((t) =>
        t.id === taskId ? { ...t, ...patch } : t,
      );
      await updateProjectTasks(projectId, recovered);
      return;
    }
    await updateProjectTasks(projectId, nextTasks);
  };

  const closeMobile = () => setMobileOpen(false);
  /** Со страниц карточки проекта (в т.ч. после автосохранения задач) переход по меню иногда «залипал»; ведём на канонические пути через navigate. */
  const shouldForceNavFallback =
    location.pathname.startsWith('/app/projects/') || isProjectDetailPath(location.pathname);
  const navigateWithFallback = (path: string) => {
    if (location.pathname === path) return;
    navigate(path);
    window.setTimeout(() => {
      if (window.location.pathname !== path) {
        window.location.href = path;
      }
    }, 150);
  };
  const handleNavClick = (
    event: React.MouseEvent,
    path: string,
    closeAfter?: () => void,
  ) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
      return;
    }
    const target = toLegacyNavPath(path);
    if (shouldForceNavFallback) {
      event.preventDefault();
      if (closeAfter) closeAfter();
      // Полная перезагрузка по каноническому пути: иначе в RR v7 иногда рассинхрон
      // адресной строки и внутреннего location (страница «замирает» на карточке проекта).
      if (window.location.pathname !== target) {
        window.location.assign(target);
      }
      return;
    }
    if (closeAfter) closeAfter();
  };

  // загрузка матрицы прав (для не-owner)
  useEffect(() => {
    if (!user || user.role === 'owner') {
      setPermsLoaded(true);
      return;
    }
    let alive = true;
    withTimeout(
      Promise.all([fetchStaffPermissions(), fetchUserPermissions()]),
      DEFAULT_FETCH_TIMEOUT_MS,
      'rbac permissions',
    )
      .then(([roles, users]) => {
        if (!alive) return;
        setRoleMatrix(roles);
        setUserMatrix(users);
      })
      .catch(() => {
        if (!alive) return;
        setRoleMatrix(null);
        setUserMatrix(null);
      })
      .finally(() => {
        if (alive) setPermsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  // загрузка компонентов тенанта - только один раз при монтировании или смене пользователя
  useEffect(() => {
    if (!user) {
      setComponentsLoaded(true);
      componentsLoadedRef.current = { userId: null, loaded: true };
      return;
    }
    
    const userId = user.id || user.sub || null;
    
    // Если уже загружали для этого пользователя, не загружаем снова
    if (componentsLoadedRef.current.loaded && componentsLoadedRef.current.userId === userId) {
      setComponentsLoaded(true);
      return;
    }
    
    // Если уже идет загрузка, не запускаем еще одну
    if (loadingInProgressRef.current) {
      return;
    }
    
    // Проверяем кеш в localStorage (TTL — 30 секунд, чтобы включение компонента в админке
    // отображалось сразу при следующем переходе, без долгого ожидания)
    const cacheKey = `tenant_components_v3_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { components, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 30 * 1000) {
          setTenantComponents(components);
          componentsLoadedRef.current = { userId, loaded: true };
          setComponentsLoaded(true);
          return;
        }
      } catch {
        // Игнорируем ошибки парсинга кеша
      }
    }
    
    loadingInProgressRef.current = true;
    let alive = true;
    setComponentsLoaded(false);
    
    withTimeout(
      fetchTenantComponents(),
      DEFAULT_FETCH_TIMEOUT_MS,
      'tenant components',
    )
      .then((components) => {
        if (!alive) return;
        setTenantComponents(components);
        componentsLoadedRef.current = { userId, loaded: true };
        // Сохраняем в кеш
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            components,
            timestamp: Date.now(),
          }));
        } catch {
          // Игнорируем ошибки localStorage
        }
      })
      .catch((err) => {
        console.error('Failed to load tenant components:', err);
        if (!alive) return;
        // В случае ошибки считаем, что все компоненты включены
        setTenantComponents([]);
        componentsLoadedRef.current = { userId, loaded: true };
      })
      .finally(() => {
        if (alive) {
          setComponentsLoaded(true);
          loadingInProgressRef.current = false;
        }
      });
      
    return () => {
      alive = false;
      loadingInProgressRef.current = false;
    };
  }, [user?.id, user?.sub]); // Зависим только от ID пользователя

  const NAV = useMemo(
    (): NavItem[] => [
      {
        label: t('crm.nav.dashboard'),
        path: '/dashboard',
        icon: 'home',
        section: 'main',
        matchPaths: ['/app'],
      },

      {
        label: t('crm.nav.leads'),
        path: '/app/leads',
        icon: 'leads',
        section: 'clients',
        countBadge: 'leads',
        children: [
          { label: t('crm.nav.leadsNew'), path: '/app/leads/new' },
          { label: t('crm.nav.leadsLost'), path: '/app/leads/lost' },
          { label: t('crm.nav.leadsArchive'), path: '/app/leads/archive' },
          { label: t('crm.nav.leadsTrash'), path: '/app/leads/trash' },
          { label: t('crm.nav.leadsAnalytics'), path: '/app/leads/analytics' },
          { label: t('crm.nav.leadsRoi'), path: '/app/leads/roi' },
        ],
      },

      {
        label: t('crm.nav.projects'),
        path: '/projects',
        icon: 'projects',
        section: 'clients',
        countBadge: 'projects',
        matchPaths: ['/app/projects'],
        children: [
          { label: t('crm.nav.projectsClosed'), path: '/projects/closed' },
          { label: t('crm.nav.projectsInProgress'), path: '/projects/in-progress' },
          { label: t('crm.nav.projectsTasks'), path: '/projects/tasks' },
          { label: t('crm.nav.projectsOverdue'), path: '/projects/tasks/overdue' },
          { label: t('crm.nav.projectsArchive'), path: '/projects/archive' },
          { label: t('crm.nav.projectsTrash'), path: '/projects/trash' },
          { label: t('crm.nav.projectsAnalytics'), path: '/projects/analytics' },
        ],
      },

      {
        label: t('crm.nav.sales'),
        path: '/app/sales',
        icon: 'sales',
        section: 'clients',
        children: [
          { label: t('crm.nav.sales'), path: '/app/sales' },
          { label: t('crm.nav.salesAnalytics'), path: '/app/sales/analytics' },
          { label: t('crm.nav.salesChannels'), path: '/app/sales/channels' },
          { label: t('crm.nav.salesIntegrations'), path: '/app/sales/integrations' },
          { label: t('crm.nav.salesImport'), path: '/app/sales/import' },
        ],
      },

      {
        label: t('crm.nav.products'),
        path: '/app/products',
        icon: 'products',
        section: 'clients',
        matchPaths: ['/app/products', '/products'],
        children: [
          { label: t('crm.nav.productsList'), path: '/app/products' },
          { label: t('crm.nav.productsCategories'), path: '/app/products/categories' },
          { label: t('crm.nav.productsStock'), path: '/app/products/stock' },
          { label: t('crm.nav.productsAttributes'), path: '/app/products/attributes' },
          { label: t('crm.nav.productsFieldTypes'), path: '/app/products/field-types' },
          { label: t('crm.nav.productsAnalytics'), path: '/app/products/analytics' },
        ],
      },

      {
        label: t('crm.nav.booking'),
        path: '/bookings',
        icon: 'calendar',
        section: 'clients',
        matchPaths: ['/app/bookings'],
        children: [
          { label: t('crm.nav.bookingOverview'), path: '/bookings' },
          { label: t('crm.nav.bookingReservations'), path: '/bookings/reservations' },
          { label: t('crm.nav.bookingWaitlist'), path: '/bookings/waitlist' },
          { label: t('crm.nav.bookingResources'), path: '/bookings/resources' },
          { label: t('crm.nav.bookingLocations'), path: '/bookings/locations' },
          { label: t('crm.nav.bookingServices'), path: '/bookings/services' },
          { label: t('crm.nav.bookingAvailability'), path: '/bookings/availability' },
          { label: t('crm.nav.bookingAnalytics'), path: '/bookings/analytics' },
          { label: t('crm.nav.bookingTemplates'), path: '/bookings/templates' },
          { label: t('crm.nav.bookingLogs'), path: '/bookings/logs' },
          { label: t('crm.nav.bookingSettings'), path: '/bookings/settings' },
        ],
      },

      {
        label: t('crm.nav.hotels'),
        path: '/hotels',
        icon: 'calendar',
        section: 'clients',
        matchPaths: ['/app/hotels'],
        children: [
          { label: t('crm.nav.hotelsOverview'), path: '/hotels' },
          { label: t('crm.nav.hotelsList'), path: '/hotels/list' },
          { label: t('crm.nav.hotelsReservations'), path: '/hotels/reservations' },
          { label: t('crm.nav.hotelsFrontDesk'), path: '/hotels/frontdesk' },
          { label: t('crm.nav.hotelsPricing'), path: '/hotels/pricing' },
          { label: t('crm.nav.hotelsCalendar'), path: '/hotels/calendar' },
          { label: t('crm.nav.hotelsAnalytics'), path: '/hotels/analytics' },
        ],
      },

      {
        label: t('crm.nav.contacts'),
        path: '/app/contacts',
        icon: 'contacts',
        section: 'clients',
        matchPaths: ['/app/contacts', '/contacts', '/app/companies', '/companies'],
        children: [
          { label: t('crm.nav.companies'), path: '/app/companies' },
          { label: t('crm.nav.companiesAnalytics'), path: '/app/companies/analytics' },
        ],
      },

      {
        label: t('crm.nav.mail'),
        path: '/app/email/inbox',
        icon: 'mail',
        section: 'clients',
        matchPaths: [
          '/app/email',
          '/email',
          '/app/email/inbox',
          '/email/inbox',
        ],
        children: [
          { label: t('crm.nav.mailInbox'), path: '/app/email/inbox' },
          { label: t('crm.nav.mailAccounts'), path: '/app/email' },
        ],
      },

      {
        label: t('crm.nav.chat'),
        path: '/app/chat',
        icon: 'chat',
        section: 'clients',
        countBadge: 'chat',
      },

      {
        label: t('crm.nav.sms'),
        path: '/app/sms',
        icon: 'chat',
        section: 'clients',
        matchPaths: ['/app/sms', '/sms'],
        children: [
          { label: t('crm.nav.smsMessages'), path: '/app/sms' },
          { label: t('crm.nav.smsSettings'), path: '/app/sms/settings' },
        ],
      },

      {
        label: t('crm.nav.marketing'),
        path: '/app/marketing',
        icon: 'marketing',
        section: 'tools',
        children: [
          { label: t('crm.nav.marketingTraffic'), path: '/app/marketing/traffic' },
          { label: t('crm.nav.marketingCampaigns'), path: '/app/marketing/campaigns' },
          { label: t('crm.nav.marketingUtms'), path: '/app/marketing/utms' },
          { label: t('crm.nav.marketingSegments'), path: '/app/marketing/segments' },
          { label: t('crm.nav.marketingChannels'), path: '/app/marketing/channels' },
          { label: t('crm.nav.marketingSeo'), path: '/app/marketing/seo' },
          { label: t('crm.nav.marketingSmm'), path: '/app/marketing/smm' },
          { label: t('crm.nav.marketingIntegrations'), path: '/app/integrations-hub?tab=marketing' },
          { label: t('crm.nav.marketingEmailTemplates'), path: '/app/marketing/email-templates' },
        ],
      },

      {
        label: t('crm.nav.aiEmployees'),
        path: '/app/ai-employees',
        icon: 'tools',
        section: 'tools',
        matchPaths: [
          '/app/ai-employees',
          '/ai-employees',
        ],
        children: [
          { label: t('crm.nav.aiEmployeesDashboard'), path: '/app/ai-employees' },
          { label: t('crm.nav.aiEmployeesChoose'), path: '/app/ai-employees/choose' },
          { label: t('crm.nav.aiEmployeesApprovals'), path: '/app/ai-employees/approvals' },
          { label: t('crm.nav.aiEmployeesLogs'), path: '/app/ai-employees/logs' },
          { label: t('crm.nav.aiEmployeesReports'), path: '/app/ai-employees/reports' },
        ],
      },

      {
        label: t('crm.nav.tools'),
        path: '/app/automations',
        icon: 'tools',
        section: 'tools',
        matchPaths: [
          '/app/automations',
          '/automations',
          '/app/telegram',
          '/telegram',
          '/app/integrations-hub',
          '/integrations-hub',
          '/app/web-forms',
          '/web-forms',
        ],
        children: [
          { label: t('crm.nav.toolsAutomations'), path: '/app/automations' },
          {
            label: t('crm.nav.toolsWebForms'),
            path: '/app/web-forms',
            matchPaths: ['/app/web-forms', '/web-forms'],
          },
          {
            label: t('crm.nav.integrationsHub'),
            path: '/app/integrations-hub',
            matchPaths: ['/app/integrations-hub', '/integrations-hub'],
          },
          { label: t('crm.nav.toolsTelegram'), path: '/app/telegram' },
        ],
      },

      {
        label: t('crm.nav.clientAccounts'),
        path: '/app/client-accounts',
        icon: 'invoice',
        section: 'management',
        matchPaths: ['/app/client-accounts', '/client-accounts'],
        children: [
          { label: t('crm.nav.clientAccounts'), path: '/app/client-accounts' },
          { label: 'Финансовые операции', path: '/app/client-accounts/operations' },
          { label: 'Сайты счетов', path: '/app/client-accounts/sites' },
        ],
      },

      {
        label: t('crm.nav.settings'),
        path: '/app/settings',
        icon: 'settings',
        section: 'management',
        matchPaths: [
          '/app/settings',
          '/settings',
          '/app/staff',
          '/staff',
          '/app/departments',
          '/departments',
          '/app/profile',
          '/profile',
          '/app/staff/permissions',
          '/staff/permissions',
          '/app/contacts/duplicates',
          '/contacts/duplicates',
        ],
        children: [
          { label: t('crm.nav.settingsCompany'), path: '/app/settings' },
          { label: t('crm.nav.settingsApi'), path: '/app/settings/api' },
          {
            label: t('crm.nav.settingsAccount'),
            path: '/app/profile/overview',
            matchPaths: ['/app/profile', '/profile'],
          },
          { label: t('crm.nav.staffList'), path: '/app/staff' },
          { label: t('crm.nav.staffPermissions'), path: '/app/staff/permissions' },
          { label: t('crm.nav.departments'), path: '/app/departments' },
          { label: t('crm.nav.deduplication'), path: '/app/contacts/duplicates' },
        ],
      },
    ],
    [t],
  );

  // Маппинг путей к ключам компонентов (после редиректа /app → короткие пути)
  const componentKeyForPath = (path: string): string | null => {
    const p = normalizeLayoutPath(path);
    if (p.startsWith('/leads')) return 'leads';
    if (p.startsWith('/projects/analytics')) return 'projects_analytics';
    if (p.startsWith('/projects')) return 'projects';
    if (p.startsWith('/sales')) return 'sales';
    if (p.startsWith('/marketing/campaigns')) return 'marketing_campaigns';
    if (p.startsWith('/marketing')) return 'marketing';
    if (p.startsWith('/contacts/duplicates')) return 'deduplication';
    if (p.startsWith('/contacts')) return 'contacts';
    if (p.startsWith('/companies')) return 'companies';
    if (p.startsWith('/automations')) return 'tools_automation';
    if (p.startsWith('/web-forms')) return 'tools_automation';
    if (p.startsWith('/integrations-hub')) return 'tools_automation';
    if (p.startsWith('/email')) return 'email';
    if (p.startsWith('/telegram')) return 'telegram';
    if (p.startsWith('/settings')) return 'tools_settings';
    if (p.startsWith('/profile')) return 'tools_settings';
    if (p.startsWith('/chat')) return 'chat';
    if (p.startsWith('/client-accounts')) return 'client_accounts';
    if (p.startsWith('/workspace')) return 'custom_objects';
    if (p.startsWith('/products')) return 'products';
    if (p.startsWith('/bookings')) return 'bookings';
    if (p.startsWith('/hotels')) return 'hotels';
    if (p.startsWith('/sms')) return 'sms';
    return null;
  };

  // Проверка, включен ли компонент
  const isComponentEnabled = (componentKey: string | null): boolean => {
    if (!componentKey) return true; // Если нет ключа компонента, разрешаем доступ
    if (!componentsLoaded) return true; // Пока загружаются, разрешаем доступ
    if (tenantComponents.length === 0) return true; // Если компоненты не загружены (ошибка), разрешаем доступ
    const component = tenantComponents.find((c) => c.key === componentKey);
    // Если компонент не найден в списке, разрешаем доступ (новый компонент)
    // Если найден, проверяем его статус
    // Для новых модулей (contacts, companies, automations) разрешаем доступ по умолчанию
    if (!component && ['contacts', 'companies', 'tools_automation', 'email', 'telegram', 'notes', 'custom_objects', 'products', 'bookings', 'hotels'].includes(componentKey)) {
      return true;
    }
    return component ? component.enabled : true;
  };

  const permissionForPath = (path: string): PermissionKey | null => {
    const p = normalizeLayoutPath(path);
    if (p.startsWith('/leads')) return 'leads';
    if (p.startsWith('/projects')) return 'projects';
    if (p.startsWith('/staff/permissions')) return 'settings';
    if (p.startsWith('/staff')) return 'staff';
    if (p.startsWith('/departments')) return 'staff';
    if (p.startsWith('/settings')) return 'settings';
    // /profile — личный аккаунт пользователя, не требует прав (доступен всем)
    if (p.startsWith('/profile')) return null;
    if (p.startsWith('/contacts')) return 'contacts';
    if (p.startsWith('/companies')) return 'companies';
    if (p.startsWith('/automations')) return 'tools_automation';
    if (p.startsWith('/web-forms')) return 'tools_automation';
    if (p.startsWith('/integrations-hub')) return 'tools_automation';
    if (p.startsWith('/email')) return 'email';
    if (p.startsWith('/telegram')) return 'chat';
    if (p.startsWith('/chat')) return 'chat';
    if (p.startsWith('/online-chat')) return 'chat';
    if (p.startsWith('/analytics')) return 'analytics';
    if (p.startsWith('/sales')) return 'analytics';
    if (p.startsWith('/marketing')) return 'marketing';
    if (p.startsWith('/workspace')) return 'custom_objects';
    if (p.startsWith('/products')) return 'products';
    if (p.startsWith('/bookings')) return 'bookings';
    if (p.startsWith('/hotels')) return 'hotels';
    if (p.startsWith('/sms')) return 'chat';
    if (p.startsWith('/contacts/duplicates')) return 'settings';
    return null;
  };

  const canAccess = (perm: PermissionKey | null) => {
    if (!perm) return true;
    if (user?.role === 'owner') return true;

    const userId = user?.id || user?.userId || user?.sub;
    const rawRole = user?.role;
    const matrixRole: StaffRole | null =
      typeof rawRole === 'string' &&
      (
        [
          'owner',
          'manager',
          'viewer',
          'finance',
          'sales',
          'developer',
          'support',
        ] as const
      ).includes(rawRole as StaffRole)
        ? (rawRole as StaffRole)
        : null;

    // Если матрица прав ещё не загружена — разрешаем доступ (избегаем мигания)
    if (!roleMatrix) return true;

    const rolePerms = matrixRole ? roleMatrix[matrixRole] ?? [] : [];
    const userPerms = userId && userMatrix ? userMatrix[userId] ?? [] : [];
    return rolePerms.includes(perm) || userPerms.includes(perm);
  };

  const filteredNav = NAV.map((item) => {
    // Проверка компонента
    const componentKey = componentKeyForPath(item.path);
    if (!isComponentEnabled(componentKey)) return null;

    // Проверка прав доступа
    const perm = permissionForPath(item.path);
    if (!canAccess(perm)) return null;

    // Фильтрация дочерних элементов
    const children = item.children
      ?.filter((child) => {
        const childComponentKey = componentKeyForPath(child.path);
        if (!isComponentEnabled(childComponentKey)) return false;
        return canAccess(permissionForPath(child.path));
      });
    
    // Если у родителя есть дочерние элементы, но все они отфильтрованы, скрываем родителя
    if (item.children && item.children.length > 0 && (!children || children.length === 0)) {
      return null;
    }

    return { ...item, children };
  }).filter(Boolean) as NavItem[];

  const groupedNav = useMemo(() => {
    const buckets = new Map<NavSectionId, NavItem[]>();
    for (const id of NAV_SECTION_ORDER) buckets.set(id, []);
    for (const item of filteredNav) {
      buckets.get(item.section)?.push(item);
    }
    return NAV_SECTION_ORDER.map((id) => ({
      id,
      items: buckets.get(id) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filteredNav]);

  const navSectionTitle = (id: NavSectionId) => {
    switch (id) {
      case 'main':
        return t('crm.sidebar.sectionMain');
      case 'clients':
        return t('crm.sidebar.sectionClients');
      case 'tools':
        return t('crm.sidebar.sectionTools');
      case 'management':
        return t('crm.sidebar.sectionManagement');
      default:
        return '';
    }
  };

  const renderNavBadge = (
    item: NavItem,
    sectionActive: boolean,
    compact: boolean,
  ): React.ReactNode => {
    if (!item.countBadge) return null;
    if (item.countBadge === 'chat') {
      if (unreadChats <= 0) return null;
      const txt = unreadChats > 99 ? '99+' : String(unreadChats);
      if (compact) {
        return (
          <span className="absolute -right-1 -top-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center leading-none border-2 border-[#fafafa] z-10">
            {unreadChats > 9 ? '9+' : txt}
          </span>
        );
      }
      return (
        <span
          className={`ml-auto shrink-0 min-h-5 min-w-5 px-1 rounded-md text-[11px] font-semibold tabular-nums flex items-center justify-center ${
            sectionActive ? 'bg-white/20 text-white' : 'bg-rose-500 text-white'
          }`}
        >
          {txt}
        </span>
      );
    }
    const val = item.countBadge === 'leads' ? navLeadCount : navProjectCount;
    if (val == null) return null;
    const txt = val > 999 ? '999+' : String(val);
    if (compact) {
      return (
        <span className="absolute -right-1 -top-0.5 min-w-[15px] h-4 px-0.5 rounded-md bg-neutral-300/90 text-[9px] font-semibold text-neutral-800 flex items-center justify-center leading-none border-2 border-[#fafafa] z-10">
          {val > 99 ? '99' : txt}
        </span>
      );
    }
    return (
      <span
        className={`ml-auto shrink-0 min-h-5 min-w-[1.25rem] px-1.5 rounded-md text-[11px] font-medium tabular-nums flex items-center justify-center ${
          sectionActive ? 'bg-white/15 text-white' : 'bg-neutral-200/90 text-neutral-700'
        }`}
      >
        {txt}
      </span>
    );
  };

  const pathname = location.pathname;
  const scored = filteredNav
    .map((item) => ({ item, score: itemMatchScore(pathname, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const activeRoot = scored[0]?.item ?? filteredNav[0] ?? NAV[0];

  const isSectionOpen = (path: string) => {
    if (Object.prototype.hasOwnProperty.call(sectionExpanded, path)) {
      return sectionExpanded[path];
    }
    return activeRoot?.path === path;
  };

  const toggleSection = (path: string) => {
    setSectionExpanded((prev) => {
      const defaultOpen = activeRoot?.path === path;
      const current = path in prev ? prev[path] : defaultOpen;
      return { ...prev, [path]: !current };
    });
  };

  const activeChild =
    activeRoot.children?.find((child) =>
      matchesNavPath(pathname, child.path),
    ) || null;

  const headerSubtitle = activeChild
    ? `${activeRoot.label} · ${activeChild.label}`
    : activeRoot.label;
  const canOpenWorkspace = isComponentEnabled('custom_objects');
  const normPathForWs = normalizeLayoutPath(pathname);
  const workspaceAreaRouteMatch = normPathForWs.match(
    /^\/workspace\/areas\/([0-9a-f-]{36})/i,
  );
  const activeWorkspaceAreaIdForSwitcher =
    workspaceAreaRouteMatch?.[1] ?? sidebarWorkspaceAreaId;

  // инициалы для аватарки
  const initials = (() => {
    const raw = user?.name || user?.email || 'U';
    const safe = typeof raw === 'string' ? raw : String(raw);

    return safe
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  })();

  const headerAvatarSrc = resolvePublicAssetUrl(
    typeof user?.avatarUrl === 'string' && user.avatarUrl.trim()
      ? user.avatarUrl
      : null,
  );

  const sidebarTenantName = tenantNameDisplay ?? getStoredTenantName();

  const isCrmShellPath = (pathname: string): boolean => {
    if (pathname.startsWith('/app')) return true;
    const roots = [
      '/dashboard',
      '/workspace',
      '/leads',
      '/contacts',
      '/companies',
      '/projects',
      '/sales',
      '/marketing',
      '/automations',
      '/ai-employees',
      '/email',
      '/telegram',
      '/settings',
      '/staff',
      '/departments',
      '/profile',
      '/chat',
      '/client-accounts',
      '/billing',
      '/forbidden',
    ];
    return roots.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  };

  // редирект на forbidden если нет доступа или компонент отключен
  useEffect(() => {
    if (!componentsLoaded || !permsLoaded) return;

    if (isCrmShellPath(location.pathname)) {
      const componentKey = componentKeyForPath(location.pathname);
      if (!isComponentEnabled(componentKey)) {
        navigate('/forbidden', { replace: true });
        return;
      }

      const perm = permissionForPath(location.pathname);
      if (!canAccess(perm)) {
        navigate('/forbidden', { replace: true });
      }
    }
  }, [location.pathname, permsLoaded, componentsLoaded, tenantComponents]);

  return (
    <div className="h-full flex bg-lumiva-bg text-lumiva-accent">
      {/* SIDEBAR — только на md+ (узкий режим: только иконки + кнопка на грани) */}
      <div
        className="relative hidden md:flex shrink-0"
        onMouseLeave={() => setSidebarEdgeHover(false)}
      >
        <aside
          className={`flex flex-col h-full min-h-0 bg-[#fafafa] border-r border-neutral-200/90 py-5 transition-[width,padding] duration-200 ease-out ${
            sidebarCollapsed ? 'w-[4.5rem] px-2' : 'w-[17.5rem] px-3'
          }`}
        >
        {/* Компания */}
        <div
          className={`flex items-center gap-3 mb-6 shrink-0 ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <img
            src={sidebarBrandLogoSrc}
            alt=""
            onError={() => {
              if (tenantLogoUrl?.trim()) setTenantLogoFailed(true);
            }}
            className="h-9 w-9 rounded-2xl object-cover shadow-[0_10px_30px_rgba(34,34,34,0.18)] ring-1 ring-slate-200/80 bg-white"
          />
          <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'hidden' : ''}`}>
            <div className="text-[13px] font-semibold text-neutral-900 truncate tracking-tight">
              {sidebarTenantName || t('crm.sidebar.brandFallback')}
            </div>
            <div className="text-[11px] text-neutral-500">{t('crm.common.adminLabel')}</div>
          </div>
        </div>

        {/* Навигация (desktop) + рабочие области сразу под пунктами меню (общий скролл) */}
        <nav className="flex-1 min-h-0 overflow-y-auto text-[14px] leading-snug pr-0.5 text-neutral-800">
          {(!componentsLoaded || !permsLoaded) ? (
            // Показываем скелетон загрузки вместо меню
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-full h-10 rounded-xl bg-neutral-200/60 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
            {groupedNav.map(({ id: sectionId, items: secItems }, sectionIdx) => (
              <div key={sectionId} className={sectionIdx > 0 ? 'mt-1' : ''}>
                {!sidebarCollapsed && (
                  <div
                    className={`px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 ${
                      sectionIdx === 0 ? 'pt-0.5 pb-1.5' : 'pt-4 pb-1.5'
                    }`}
                  >
                    {navSectionTitle(sectionId)}
                  </div>
                )}
                <div className="space-y-0.5">
                  {secItems.map((item) => {
            const hasChildren = !!item.children?.length;
            const open = hasChildren && isSectionOpen(item.path);
            const sectionActive = activeRoot.path === item.path;
            const Icon = NAV_ICON_MAP[item.icon];

            return (
              <div key={item.path}>
                <NavLink
                  to={item.path}
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={(event) => handleNavClick(event, item.path)}
                  className={() =>
                    [
                      'w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 transition-colors duration-150',
                      sidebarCollapsed ? 'justify-center' : 'justify-between',
                      sectionActive
                        ? 'bg-[#1a1a1a] text-white shadow-sm'
                        : 'text-neutral-700 hover:bg-neutral-100/90',
                    ].join(' ')
                  }
                >
                  <span
                    className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'justify-center' : 'flex-1'}`}
                  >
                    <span className="relative inline-flex shrink-0">
                      <Icon
                        className={
                          sectionActive ? 'text-white' : 'text-neutral-500'
                        }
                      />
                      {sidebarCollapsed ? renderNavBadge(item, sectionActive, true) : null}
                    </span>
                    <span className={sidebarCollapsed ? 'sr-only' : 'truncate flex-1 text-left font-normal'}>
                      {item.label}
                    </span>
                    {!sidebarCollapsed ? renderNavBadge(item, sectionActive, false) : null}
                  </span>
                  {hasChildren && !sidebarCollapsed && (
                    <button
                      type="button"
                      className={`ml-1 shrink-0 inline-flex items-center justify-center rounded-md p-0.5 ${
                        sectionActive
                          ? 'text-white/70 hover:bg-white/10'
                          : 'text-neutral-400 hover:bg-neutral-200/70'
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSection(item.path);
                      }}
                      aria-expanded={open}
                    >
                      <NavChevronDown expanded={open} />
                    </button>
                  )}
                </NavLink>

                {hasChildren && open && !sidebarCollapsed && (
                  <div className="mt-0.5 mb-1 ml-2 pl-2 border-l border-neutral-200/90 space-y-0.5">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={(event) => handleNavClick(event, child.path)}
                        className={() =>
                          [
                            'block text-[13px] px-2.5 py-1.5 rounded-lg transition-colors',
                            matchesNavPath(pathname, child.path)
                              ? 'bg-[#f0f0f0] text-neutral-900 font-medium'
                              : 'text-neutral-600 hover:bg-neutral-100',
                          ].join(' ')
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
                  })}
                </div>
              </div>
            ))}

          {canOpenWorkspace && (
            <div className="mt-2 min-w-0 border-t border-neutral-200/90 pt-3">
              <WorkspaceAreaSwitcher
                compact={sidebarCollapsed}
                activeAreaId={activeWorkspaceAreaIdForSwitcher}
              />
              <WorkspaceSidebarBlock
                enabled
                compact={sidebarCollapsed}
                workspaceAreaIdFilter={sidebarWorkspaceAreaId}
                flushTop
              />
            </div>
          )}
            </>
          )}
        </nav>

        <div
          className={`mt-auto pt-5 shrink-0 border-t border-neutral-200/90 text-[11px] text-neutral-600 ${
            sidebarCollapsed ? 'flex flex-col items-center gap-2' : ''
          }`}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 mb-3 px-0.5">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/app/profile/overview';
                }}
                className="h-10 w-10 shrink-0 rounded-full bg-neutral-200/70 border border-neutral-200/90 overflow-hidden flex items-center justify-center hover:bg-neutral-200 transition-colors"
                aria-label={t('crm.nav.settingsAccount')}
              >
                {headerAvatarSrc ? (
                  <img src={headerAvatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[12px] font-semibold text-neutral-700">
                    {initials.slice(0, 2) || 'U'}
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="text-left w-full min-w-0"
                  onClick={() => {
                    window.location.href = '/app/profile/overview';
                  }}
                >
                  <div className="text-[13px] font-semibold text-neutral-900 truncate">
                    {user?.name ?? t('crm.common.user')}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-500 truncate">
                    {staffRoleLabel}
                  </div>
                </button>
              </div>
              <button
                type="button"
                className="shrink-0 p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200/60 transition-colors"
                title={t('crm.nav.settingsAccount')}
                aria-label={t('crm.nav.settingsAccount')}
                onClick={() => {
                  window.location.href = '/app/profile/overview';
                }}
              >
                <NavIconDots className="text-neutral-600" />
              </button>
            </div>
          )}
          {sidebarCollapsed && (
            <button
              type="button"
              title={user?.name ?? t('crm.common.user')}
              onClick={() => (window.location.href = '/app/profile/overview')}
              className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-semibold text-lumiva-accent border border-slate-200 hover:bg-slate-200"
            >
              {headerAvatarSrc ? (
                <img src={headerAvatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                initials.slice(0, 2) || 'U'
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title={t('crm.common.logout')}
            aria-label={t('crm.common.logout')}
            className={`text-slate-500 hover:text-lumiva-accent transition-colors ${
              sidebarCollapsed
                ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50'
                : ''
            }`}
          >
            {sidebarCollapsed ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
            ) : (
              t('crm.common.logout')
            )}
          </button>
        </div>
      </aside>

        <div
          className="absolute top-0 right-0 bottom-0 z-50 flex w-5 translate-x-1/2 items-center justify-center"
          onMouseEnter={() => setSidebarEdgeHover(true)}
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={
              sidebarCollapsed
                ? t('crm.sidebar.expandSidebar')
                : t('crm.sidebar.collapseSidebar')
            }
            aria-label={
              sidebarCollapsed
                ? t('crm.sidebar.expandSidebar')
                : t('crm.sidebar.collapseSidebar')
            }
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white text-slate-600 shadow-md transition-opacity hover:bg-sky-50 ${
              sidebarCollapsed || sidebarEdgeHover ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {sidebarCollapsed ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="crm-main-header relative z-30 h-14 border-b border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between px-3 md:px-6 shadow-[0_10px_30px_rgba(17,24,39,0.05)]">
          <div className="flex items-center gap-2">
            {/* Бургер — только на мобиле */}
            <button
              type="button"
              className="md:hidden mr-1 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-lumiva-accent hover:-translate-y-[1px] hover:shadow-[0_12px_30px_rgba(17,24,39,0.08)] transition-all"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="sr-only">{t('crm.header.openMenu')}</span>
              <div className="space-y-0.5">
                <span className="block h-[2px] w-4 bg-lumiva-accent rounded-full" />
                <span className="block h-[2px] w-4 bg-lumiva-accent rounded-full" />
                <span className="block h-[2px] w-4 bg-lumiva-accent rounded-full" />
              </div>
            </button>

            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                {activeRoot?.label ?? t('crm.nav.dashboard')}
              </div>
              <div className="text-sm font-semibold text-lumiva-accent">
                {headerSubtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('crm.header.realtime')}</span>
            </div>

            <select
              value={(i18n.language || 'ru').slice(0, 2)}
              onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
              className="hidden sm:inline-flex rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label={t('crm.common.language')}
              title={t('crm.common.language')}
            >
              <option value="ru">{t('lang.ru')}</option>
              <option value="en">{t('lang.en')}</option>
              <option value="tr">{t('lang.tr')}</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                setAiAssistantOpen(true);
              }}
              className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 hover:shadow"
              title={t('crm.header.aiAssistant')}
              aria-label={t('crm.header.aiAssistant')}
            >
              <AiAssistantTriggerIcon className="h-5 w-5 text-zinc-900" />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => (window.location.href = '/app/chat')}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:shadow transition"
                title={t('crm.header.newMessages')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.6}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 8h10M7 12h6m-6 4h4m8-2a4 4 0 0 1-4 4H8l-4 3V6a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10Z"
                  />
                </svg>
                {unreadChats > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-semibold shadow">
                    {unreadChats}
                  </span>
                )}
              </button>

              <div
                className="relative z-[1000]"
                ref={notificationsRef}
                onMouseEnter={() => setNotificationsPreviewOpen(true)}
                onMouseLeave={() => setNotificationsPreviewOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:shadow transition"
                  title={t('crm.header.notifications')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.6}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 17h-6a3 3 0 0 1-3-3v-2a6 6 0 1 1 12 0v2a3 3 0 0 1-3 3Z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h4" />
                  </svg>
                  {(taskNotifications.some((n) => !n.isDone) || inAppUnread > 0) && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-semibold shadow">
                      {taskNotifications.filter((n) => !n.isDone).length + inAppUnread}
                    </span>
                  )}
                </button>

                {notificationsPreviewOpen && (filteredNotifications.length > 0 || inAppUnread > 0) && (
                  <div className="absolute right-0 z-[1000] mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-700">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">
                      {t('crm.header.notifications')}
                    </div>
                    <div className="space-y-1">
                      {filteredNotifications.slice(0, 3).map((item) => (
                        <div key={item.taskId} className="truncate">
                          {item.task.title}
                        </div>
                      ))}
                      {inAppUnread > 0 && (
                        <div className="truncate font-medium text-slate-900">
                          Системные: {inAppUnread} новых
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Профиль — скрыт на самых маленьких, виден на sm+ */}
            <button
              onClick={() => (window.location.href = '/app/profile/overview')}
              className="hidden sm:flex items-center gap-2 text-xs text-slate-600 hover:text-lumiva-accent"
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold text-lumiva-accent">
                {headerAvatarSrc ? (
                  <img src={headerAvatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-[11px] leading-tight">
                  {user?.name || user?.email || t('crm.common.user')}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  {staffRoleLabel}
                </span>
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs rounded-xl border border-slate-200 text-lumiva-accent hover:bg-slate-100 transition-colors"
            >
              {t('crm.common.logout')}
            </button>
          </div>
        </header>

        {notificationsOpen && (
          <div className="fixed inset-0 z-[3000]">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setNotificationsOpen(false)}
            />
            <div
              ref={notificationsPanelRef}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                    {t('crm.header.notifications')}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {t('crm.notifications.title')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="h-8 w-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNotificationsTab('assigned')}
                    className={`px-3 py-1.5 text-[11px] rounded-full border ${
                      notificationsTab === 'assigned'
                        ? 'border-slate-900 text-slate-900 bg-slate-100'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t('crm.notifications.tabs.assigned')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsTab('mentioned')}
                    className={`px-3 py-1.5 text-[11px] rounded-full border ${
                      notificationsTab === 'mentioned'
                        ? 'border-slate-900 text-slate-900 bg-slate-100'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t('crm.notifications.tabs.mentioned')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsTab('all')}
                    className={`px-3 py-1.5 text-[11px] rounded-full border ${
                      notificationsTab === 'all'
                        ? 'border-slate-900 text-slate-900 bg-slate-100'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    {t('crm.notifications.tabs.all')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationsTab('system')}
                    className={`px-3 py-1.5 text-[11px] rounded-full border flex items-center gap-1.5 ${
                      notificationsTab === 'system'
                        ? 'border-slate-900 text-slate-900 bg-slate-100'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    Системные
                    {inAppUnread > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-rose-500 text-white text-[9px] font-bold px-1">
                        {inAppUnread > 99 ? '99+' : inAppUnread}
                      </span>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterProjectId}
                    onChange={(e) => setFilterProjectId(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                  >
                    <option value="">
                      {t('crm.notifications.filters.project')}
                    </option>
                    {Array.from(
                      new Map(
                        taskNotifications.map((item) => [
                          item.projectId,
                          item.projectName,
                        ]),
                      ),
                    ).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as ProjectTask['status'] | '')
                    }
                    className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                  >
                    <option value="">
                      {t('crm.notifications.filters.status')}
                    </option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400">
                    {t('crm.notifications.sort.overdue')}
                  </span>
                </div>
                {notificationsTab === 'system' ? (
                  <div className="space-y-2">
                    {inAppLoading && <div className="text-xs text-slate-500">Загрузка…</div>}
                    {!inAppLoading && inAppNotifications.length === 0 && (
                      <div className="text-xs text-slate-500">Нет системных уведомлений</div>
                    )}
                    {!inAppLoading && inAppUnread > 0 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => markAllNotificationsRead().then(() => {
                            setInAppNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                            setInAppUnread(0);
                          })}
                          className="text-[11px] text-slate-400 hover:text-slate-700"
                        >
                          Отметить все прочитанными
                        </button>
                      </div>
                    )}
                    {inAppNotifications.map((n) => {
                      const link = systemNotificationLink(n);
                      const label = systemNotificationTypeLabel(n);
                      return (
                        <div
                          key={n.id}
                          onClick={() => openSystemNotification(n)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openSystemNotification(n);
                            }
                          }}
                          className={`rounded-2xl border p-3 transition-colors ${
                            n.isRead ? 'border-slate-200 bg-white' : 'border-slate-300 bg-slate-50'
                          } ${link || !n.isRead ? 'cursor-pointer hover:border-slate-400' : 'cursor-default'}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && <span className="mt-1.5 h-2 w-2 rounded-full bg-rose-500 flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <div className="mb-1 flex items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {label}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(n.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {n.title && (
                                <div className="text-xs font-semibold text-slate-900 mb-0.5">{n.title}</div>
                              )}
                              <div className="text-xs text-slate-700 whitespace-pre-wrap">{n.body}</div>
                              {link ? (
                                <div className="mt-2 text-[11px] font-semibold text-slate-900">
                                  Открыть
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                {notificationsLoading && (
                  <div className="text-xs text-slate-500">
                    {t('crm.notifications.loading')}
                  </div>
                )}
                {!notificationsLoading && filteredNotifications.length === 0 && (
                  <div className="text-xs text-slate-500">
                    {t('crm.notifications.empty')}
                  </div>
                )}
                {filteredNotifications.map((item) => (
                  <div
                    key={`${item.projectId}-${item.taskId}`}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {item.task.title}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5">
                            {item.projectName}
                          </span>
                          {item.isOverdue && (
                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">
                              {t('crm.notifications.overdue')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {progressValue(item.project)}%
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <select
                        value={item.task.status}
                        onChange={(e) =>
                          updateTaskField(item.projectId, item.taskId, {
                            status: e.target.value as ProjectTask['status'],
                          })
                        }
                        className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <select
                        value={item.task.priority}
                        onChange={(e) =>
                          updateTaskField(item.projectId, item.taskId, {
                            priority: e.target.value as ProjectTask['priority'],
                          })
                        }
                        className="px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                      >
                        {priorityOptions.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        {(item.task.assignees || []).map((assignee) => (
                          <span
                            key={assignee}
                            className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            {assigneeEntryDisplayLabel(staff, assignee)}
                          </span>
                        ))}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenAssigneeMenuId((prev) =>
                                prev === `${item.projectId}:${item.taskId}`
                                  ? null
                                  : `${item.projectId}:${item.taskId}`,
                              )
                            }
                            className="h-6 w-6 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
                            title={t('crm.notifications.assign')}
                          >
                            +
                          </button>
                          {openAssigneeMenuId ===
                            `${item.projectId}:${item.taskId}` && (
                            <div className="absolute z-20 mt-2 w-56 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg p-2">
                              {staff.map((u) => (
                                <label
                                  key={u.id}
                                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isTaskAssigneeSelected(item.task.assignees, u)}
                                    onChange={() => {
                                      const nextAssignees = normalizeAssigneesToStaffIds(
                                        toggleTaskAssigneeIds(item.task.assignees, u),
                                        staff,
                                      );
                                      updateTaskField(item.projectId, item.taskId, {
                                        assignees: nextAssignees,
                                      });
                                    }}
                                  />
                                  <span className="text-xs text-slate-700">
                                    {u.fullName}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                  </>
                )}
              </div>
              {notificationsTab !== 'system' && (
                <div className="border-t border-slate-200 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate('/projects/tasks')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {t('crm.notifications.openTasks')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* МОБИЛЬНОЕ МЕНЮ */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-[2500]">
            {/* затемнение */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={closeMobile}
            />
            {/* панель */}
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-[#fafafa] border-r border-neutral-200/90 px-4 py-4 flex flex-col shadow-[0_20px_60px_rgba(17,24,39,0.12)]">
              {/* шапка меню */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={sidebarBrandLogoSrc}
                    alt=""
                    onError={() => {
                      if (tenantLogoUrl?.trim()) setTenantLogoFailed(true);
                    }}
                    className="h-8 w-8 shrink-0 rounded-2xl object-cover shadow-[0_10px_30px_rgba(34,34,34,0.18)] ring-1 ring-slate-200/80 bg-white"
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 truncate">
                      {sidebarTenantName || t('crm.sidebar.brandFallback')}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {user?.name || user?.email || t('crm.common.user')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-slate-100 text-lumiva-accent border border-slate-200 hover:bg-slate-200"
                  onClick={closeMobile}
                >
                  <span className="sr-only">{t('crm.header.close')}</span>
                  ✕
                </button>
              </div>

              {/* Навигация (mobile) + workspace под меню */}
              <nav className="flex-1 min-h-0 overflow-y-auto text-[14px] leading-snug text-neutral-800">
                {(!componentsLoaded || !permsLoaded) ? (
                  // Показываем скелетон загрузки вместо меню
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-full h-10 rounded-xl bg-neutral-200/60 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                  {groupedNav.map(({ id: sectionId, items: secItems }, sectionIdx) => (
                    <div key={sectionId} className={sectionIdx > 0 ? 'mt-1' : ''}>
                      <div
                        className={`px-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-500 ${
                          sectionIdx === 0 ? 'pt-0.5 pb-1.5' : 'pt-4 pb-1.5'
                        }`}
                      >
                        {navSectionTitle(sectionId)}
                      </div>
                      <div className="space-y-0.5">
                  {secItems.map((item) => {
                    const hasChildren = !!item.children?.length;
                    const open = hasChildren && isSectionOpen(item.path);
                    const sectionActive = activeRoot.path === item.path;
                    const Icon = NAV_ICON_MAP[item.icon];

                    return (
                      <div key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={(event) => handleNavClick(event, item.path, closeMobile)}
                          className={() =>
                            [
                              'w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2.5 transition-colors duration-150',
                              sectionActive
                                ? 'bg-[#1a1a1a] text-white shadow-sm'
                                : 'text-neutral-700 hover:bg-neutral-100/90',
                            ].join(' ')
                          }
                        >
                          <span className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="relative inline-flex shrink-0">
                              <Icon
                                className={
                                  sectionActive ? 'text-white' : 'text-neutral-500'
                                }
                              />
                            </span>
                            <span className="truncate flex-1 text-left font-normal">{item.label}</span>
                            {renderNavBadge(item, sectionActive, false)}
                          </span>
                          {hasChildren && (
                            <button
                              type="button"
                              className={`ml-1 shrink-0 inline-flex items-center justify-center rounded-md p-0.5 ${
                                sectionActive
                                  ? 'text-white/70 hover:bg-white/10'
                                  : 'text-neutral-400 hover:bg-neutral-200/70'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleSection(item.path);
                              }}
                              aria-expanded={open}
                            >
                              <NavChevronDown expanded={open} />
                            </button>
                          )}
                        </NavLink>

                        {hasChildren && open && (
                          <div className="mt-0.5 mb-1 ml-2 pl-2 border-l border-neutral-200/90 space-y-0.5">
                            {item.children!.map((child) => (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                onClick={(event) =>
                                  handleNavClick(event, child.path, closeMobile)
                                }
                                className={() =>
                                  [
                                    'block text-[13px] px-2.5 py-1.5 rounded-lg transition-colors',
                                    matchesNavPath(pathname, child.path)
                                      ? 'bg-[#f0f0f0] text-neutral-900 font-medium'
                                      : 'text-neutral-600 hover:bg-neutral-100',
                                  ].join(' ')
                                }
                              >
                                {child.label}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                      </div>
                    </div>
                  ))}

                  {canOpenWorkspace && (
                    <div className="pt-3 mt-2 border-t border-slate-200">
                      <WorkspaceAreaSwitcher
                        activeAreaId={activeWorkspaceAreaIdForSwitcher}
                      />
                      <WorkspaceSidebarBlock
                        enabled
                        onMobileNavigate={closeMobile}
                        workspaceAreaIdFilter={sidebarWorkspaceAreaId}
                        flushTop
                      />
                    </div>
                  )}
                  </>
                )}
              </nav>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  {t('crm.common.language')}
                </div>
                <div className="mt-2">
                  <select
                    value={(i18n.language || 'ru').slice(0, 2)}
                    onChange={(e) => setAppLanguage(e.target.value as 'ru' | 'en' | 'tr')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                    aria-label={t('crm.common.language')}
                  >
                    <option value="ru">{t('lang.ru')}</option>
                    <option value="en">{t('lang.en')}</option>
                    <option value="tr">{t('lang.tr')}</option>
                  </select>
                </div>
              </div>

              {/* Низ меню */}
              <div className="pt-3 mt-3 border-t border-slate-200 text-[11px] text-slate-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    {staffRoleLabel}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-slate-500 hover:text-lumiva-accent"
                  >
                    {t('crm.common.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main
          className={`flex-1 min-w-0 overflow-y-auto bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg ${
            fullBleed ? 'px-0 py-0' : 'px-3 md:px-6 py-4 md:py-6'
          }`}
        >
          {(!componentsLoaded || !permsLoaded) ? (
            // Показываем загрузку вместо контента
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-lumiva-accent border-r-transparent"></div>
                <p className="mt-4 text-sm text-slate-500">{t('crm.common.loading') || 'Загрузка...'}</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className={billingLocked ? 'pointer-events-none blur-[2px] select-none' : ''}>
                {children}
              </div>
              {billingLocked && location.pathname !== '/app/billing' && (
                <div className="fixed inset-0 z-[8500] flex items-start justify-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm md:items-center md:px-6">
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label={t('crm.common.logout') || 'Выйти'}
                    className="absolute right-4 top-4 z-20 h-9 w-9 rounded-full border border-white/70 bg-white/90 text-xl leading-none text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:bg-white"
                  >
                    ×
                  </button>
                  <div className="relative max-h-[96vh] w-full max-w-[99vw] overflow-x-hidden overflow-y-auto rounded-[28px] bg-white/20 p-2 shadow-[0_28px_90px_rgba(15,23,42,0.35)] 2xl:max-w-[1700px] md:p-3">
                    <BillingPage embedded />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <AiAssistantPanel
        open={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        userName={user?.name?.trim() || null}
      />
    </div>
  );
};
