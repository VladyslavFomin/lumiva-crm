// src/layout/MainLayout.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getStoredUser, clearSession, isBillingLocked } from '../auth/session';
import { fetchChatSessions } from '../api/onlineChat';
import {
  fetchProject,
  fetchProjects,
  updateProject,
} from '../api/projects';
import { fetchStaff, type StaffUser } from '../api/staff';
import type { Project, ProjectTask } from '../pages/projects/projectTypes';
import { fetchStaffPermissions, fetchUserPermissions, type PermissionKey, type RolePermissionMatrix, type UserPermissionMatrix } from '../api/rbac';
import { fetchTenantComponents, type TenantComponent } from '../api/tenants';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';
import { BillingPage } from '../pages/BillingPage';

interface MainLayoutProps {
  children: React.ReactNode;
}

const tasksCacheKey = (projectId: string) => `project_tasks_${projectId}`;
const readTasksCache = (projectId: string): ProjectTask[] | null => {
  try {
    const raw = localStorage.getItem(tasksCacheKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as ProjectTask[];
  } catch {
    return null;
  }
};
const writeTasksCache = (projectId: string, tasks: ProjectTask[]) => {
  try {
    localStorage.setItem(tasksCacheKey(projectId), JSON.stringify(tasks));
  } catch {
    // ignore
  }
};

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const user = getStoredUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsPreviewOpen, setNotificationsPreviewOpen] = useState(false);
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
    'assigned' | 'mentioned' | 'all'
  >('all');
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

  // какой root-раздел раскрыт (для подменю)
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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
        const cached = readTasksCache(project.id);
        const source =
          project.tasks && project.tasks.length > 0 ? project.tasks : cached ?? [];
        if (source.length > 0) writeTasksCache(project.id, source);
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

  useEffect(() => {
    if (!notificationsOpen && !notificationsPreviewOpen) return;
    loadTaskNotifications();
  }, [notificationsOpen, notificationsPreviewOpen]);

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
    writeTasksCache(projectId, nextTasks);
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
    const nextTasks = (project.tasks || []).map((t) =>
      t.id === task.id
        ? { ...t, status: task.status === 'Готово' ? 'К выполнению' : 'Готово' }
        : t,
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
  const shouldForceNavFallback = location.pathname.startsWith('/app/projects/');
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
    if (shouldForceNavFallback) {
      event.preventDefault();
      if (closeAfter) closeAfter();
      window.location.href = path;
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
    Promise.all([fetchStaffPermissions(), fetchUserPermissions()])
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
    
    // Проверяем кеш в localStorage
    const cacheKey = `tenant_components_${userId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { components, timestamp } = JSON.parse(cached);
        // Кеш действителен 5 минут
        if (Date.now() - timestamp < 5 * 60 * 1000) {
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
    
    fetchTenantComponents()
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
    () => [
      { label: t('crm.nav.dashboard'), path: '/app' },

      {
        label: t('crm.nav.leads'),
        path: '/app/leads',
        children: [
          { label: t('crm.nav.leadsNew'), path: '/app/leads/new' },
          { label: t('crm.nav.leadsLost'), path: '/app/leads/lost' },
          { label: t('crm.nav.leadsArchive'), path: '/app/leads/archive' },
          { label: t('crm.nav.leadsTrash'), path: '/app/leads/trash' },
          { label: t('crm.nav.leadsAnalytics'), path: '/app/leads/analytics' },
          { label: t('crm.nav.leadsRoi'), path: '/app/leads/roi' },
        ],
      },

      { label: t('crm.nav.contacts'), path: '/app/contacts' },
      {
        label: t('crm.nav.companies'),
        path: '/app/companies',
        children: [
          { label: t('crm.nav.companiesAnalytics'), path: '/app/companies/analytics' },
        ],
      },

      {
        label: t('crm.nav.projects'),
        path: '/app/projects',
        children: [
          { label: t('crm.nav.projectsClosed'), path: '/app/projects/closed' },
          { label: t('crm.nav.projectsInProgress'), path: '/app/projects/in-progress' },
          { label: t('crm.nav.projectsTasks'), path: '/app/projects/tasks' },
          { label: t('crm.nav.projectsOverdue'), path: '/app/projects/tasks/overdue' },
          { label: t('crm.nav.projectsBulkEdit'), path: '/app/projects/bulk-edit' },
          { label: t('crm.nav.projectsArchive'), path: '/app/projects/archive' },
          { label: t('crm.nav.projectsTrash'), path: '/app/projects/trash' },
          { label: t('crm.nav.projectsAnalytics'), path: '/app/projects/analytics' },
        ],
      },

      {
        label: t('crm.nav.sales'),
        path: '/app/sales',
        children: [
          { label: t('crm.nav.sales'), path: '/app/sales' },
          { label: t('crm.nav.salesAnalytics'), path: '/app/sales/analytics' },
          { label: t('crm.nav.salesChannels'), path: '/app/sales/channels' },
          { label: t('crm.nav.salesIntegrations'), path: '/app/sales/integrations' },
          { label: t('crm.nav.salesImport'), path: '/app/sales/import' },
        ],
      },

      {
        label: t('crm.nav.marketing'),
        path: '/app/marketing',
        children: [
          { label: t('crm.nav.marketingTraffic'), path: '/app/marketing/traffic' },
          { label: t('crm.nav.marketingCampaigns'), path: '/app/marketing/campaigns' },
          { label: t('crm.nav.marketingUtms'), path: '/app/marketing/utms' },
          { label: t('crm.nav.marketingSegments'), path: '/app/marketing/segments' },
          { label: t('crm.nav.marketingChannels'), path: '/app/marketing/channels' },
          { label: t('crm.nav.marketingSeo'), path: '/app/marketing/seo' },
          { label: t('crm.nav.marketingSmm'), path: '/app/marketing/smm' },
          { label: t('crm.nav.marketingIntegrations'), path: '/app/marketing/integrations' },
          { label: t('crm.nav.marketingAutomations'), path: '/app/marketing/automations' },
          { label: t('crm.nav.marketingEmailTemplates'), path: '/app/marketing/email-templates' },
        ],
      },

      {
        label: t('crm.nav.tools'),
        path: '/app/settings',
        children: [
          { label: t('crm.nav.settingsCompany'), path: '/app/settings' },
          { label: t('crm.nav.settingsApi'), path: '/app/settings/api' },
          { label: t('crm.nav.toolsAutomations'), path: '/app/automations' },
          { label: t('crm.nav.toolsEmail'), path: '/app/email' },
          { label: t('crm.nav.toolsTelegram'), path: '/app/telegram' },
        ],
      },

      { label: t('crm.nav.chat'), path: '/app/chat' },
      { label: t('crm.nav.clientAccounts'), path: '/app/client-accounts' },

      {
        label: t('crm.nav.staff'),
        path: '/app/staff',
        children: [
          { label: t('crm.nav.staffList'), path: '/app/staff' },
          { label: t('crm.nav.staffPermissions'), path: '/app/staff/permissions' },
          { label: t('crm.nav.departments'), path: '/app/departments' },
        ],
      },
    ],
    [t],
  );

  // Маппинг путей к ключам компонентов (проверяем более специфичные пути первыми)
  const componentKeyForPath = (path: string): string | null => {
    // Лиды
    if (path.startsWith('/app/leads')) return 'leads';
    
    // Проекты - подменю
    if (path.startsWith('/app/projects/analytics')) return 'projects_analytics';
    if (path.startsWith('/app/projects')) return 'projects';
    
    // Продажи - подменю
    if (path.startsWith('/app/sales')) return 'sales';
    
    // Маркетинг - подменю
    if (path.startsWith('/app/marketing/campaigns')) return 'marketing_campaigns';
    if (path.startsWith('/app/marketing')) return 'marketing';
    
    // Контакты
    if (path.startsWith('/app/contacts')) return 'contacts';
    
    // Компании
    if (path.startsWith('/app/companies')) return 'companies';
    
    // Автоматизации
    if (path.startsWith('/app/automations')) return 'tools_automation';
    
    // Email
    if (path.startsWith('/app/email')) return 'email';
    
    // Telegram
    if (path.startsWith('/app/telegram')) return 'telegram';
    
    // Инструменты - подменю
    if (path.startsWith('/app/settings')) return 'tools_settings';
    
    // Чат
    if (path.startsWith('/app/chat')) return 'chat';
    
    // Счета клиентов
    if (path.startsWith('/app/client-accounts')) return 'client_accounts';
    
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
    if (!component && ['contacts', 'companies', 'tools_automation', 'email', 'telegram', 'notes'].includes(componentKey)) {
      return true;
    }
    return component ? component.enabled : true;
  };

  // выбираем самый "глубокий" root-route
  const permissionForPath = (path: string): PermissionKey | null => {
    if (path.startsWith('/app/leads')) return 'leads';
    if (path.startsWith('/app/projects')) return 'projects';
    if (path.startsWith('/app/staff')) return 'staff';
    if (path.startsWith('/app/settings')) return 'settings';
    if (path.startsWith('/app/contacts')) return 'contacts';
    if (path.startsWith('/app/companies')) return 'companies';
    if (path.startsWith('/app/automations')) return 'tools_automation';
    if (path.startsWith('/app/email')) return 'email';
    if (path.startsWith('/app/telegram')) return 'telegram';
    if (path.startsWith('/app/chat')) return 'chat';
    if (path.startsWith('/app/analytics')) return 'analytics';
    if (path.startsWith('/app/sales')) return 'finance';
    return null;
  };

  const canAccess = (perm: PermissionKey | null) => {
    if (!perm) return true;
    if (user?.role === 'owner') return true;
    
    // Для новых модулей разрешаем доступ по умолчанию (пока не настроены права)
    const newModules = ['contacts', 'companies', 'tools_automation', 'email', 'telegram', 'notes'];
    if (newModules.includes(perm)) {
      return true;
    }
    
    const userId = user?.id || user?.userId || user?.sub;
    const rolePerms = roleMatrix ? roleMatrix[user?.role] ?? [] : [];
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
  }).filter(Boolean) as typeof NAV;

  const activeRoot =
    [...filteredNav]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => location.pathname.startsWith(item.path)) || filteredNav[0] || NAV[0];

  const isSectionOpen = (path: string) =>
    openGroup ? openGroup === path : activeRoot?.path === path;

  const toggleSection = (path: string) =>
    setOpenGroup((prev) => (prev === path ? null : path));

  // ищем активный дочерний пункт (например, "Аналитика" у "Лиды")
  const activeChild =
    activeRoot.children?.find((child) =>
      location.pathname.startsWith(child.path),
    ) || null;

  const headerSubtitle = activeChild
    ? `${activeRoot.label} · ${activeChild.label}`
    : activeRoot.label;

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

  // редирект на forbidden если нет доступа или компонент отключен
  useEffect(() => {
    if (!componentsLoaded || !permsLoaded) return;
    
    if (location.pathname.startsWith('/app')) {
      // Проверка компонента
      const componentKey = componentKeyForPath(location.pathname);
      if (!isComponentEnabled(componentKey)) {
        navigate('/app/forbidden', { replace: true });
        return;
      }

      // Проверка прав доступа
      const perm = permissionForPath(location.pathname);
      if (!canAccess(perm)) {
        navigate('/app/forbidden', { replace: true });
      }
    }
  }, [location.pathname, permsLoaded, componentsLoaded, tenantComponents]);

  return (
    <div key={location.pathname} className="h-full flex bg-lumiva-bg text-lumiva-accent">
      {/* SIDEBAR — только на md+ */}
      <aside className="hidden md:flex md:flex-col w-64 bg-white/95 border-r border-slate-200 px-4 py-5 shadow-[0_20px_60px_rgba(17,24,39,0.08)] backdrop-blur">
        {/* Лого / заголовок */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-2xl bg-lumiva-accent flex items-center justify-center text-white font-bold text-sm shadow-[0_10px_30px_rgba(34,34,34,0.18)]">
            C
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Lumiva
            </div>
            <div className="text-[11px] text-slate-400">
              {t('crm.common.adminLabel')}
            </div>
          </div>
        </div>

        {/* Навигация (desktop) */}
        <nav className="space-y-1 text-[13px]">
          {(!componentsLoaded || !permsLoaded) ? (
            // Показываем скелетон загрузки вместо меню
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-full h-10 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : (
            filteredNav.map((item) => {
            const hasChildren = !!item.children?.length;
            const open = hasChildren && isSectionOpen(item.path);

            return (
              <div key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={(event) => handleNavClick(event, item.path)}
                  className={({ isActive }) =>
                    [
                      'w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-all',
                      isActive || location.pathname.startsWith(item.path)
                        ? 'bg-slate-100 text-lumiva-accent shadow-sm'
                        : 'text-slate-500 hover:text-lumiva-accent hover:bg-slate-50',
                    ].join(' ')
                  }
                >
                  <span>{item.label}</span>
                  {hasChildren && (
                    <button
                      type="button"
                      className="ml-2 text-[10px] text-slate-400 hover:text-lumiva-accent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSection(item.path);
                      }}
                    >
                      {open ? '▲' : '▼'}
                    </button>
                  )}
                </NavLink>

                {/* Подменю — только если раздел открыт */}
                {hasChildren && open && (
                  <div className="mt-1 mb-1 ml-3 space-y-0.5">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        onClick={(event) => handleNavClick(event, child.path)}
                        className={({ isActive }) =>
                          [
                            'block text-[12px] px-2 py-1 rounded-lg',
                            isActive
                              ? 'bg-slate-100 text-lumiva-accent shadow-sm'
                              : 'text-slate-500 hover:text-lumiva-accent hover:bg-slate-50',
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
          })
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-200 text-[11px] text-slate-500">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => (window.location.href = '/app/profile')}
              className="text-lumiva-accent hover:text-black"
            >
              {user?.name ?? t('crm.common.user')}
            </button>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {user?.role ?? 'owner'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-lumiva-accent transition-colors"
          >
            {t('crm.common.logout')}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 bg-white/95 backdrop-blur flex items-center justify-between px-3 md:px-6 shadow-[0_10px_30px_rgba(17,24,39,0.05)]">
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
                className="relative"
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
                  {taskNotifications.some((n) => !n.isDone) && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-semibold shadow">
                      {taskNotifications.filter((n) => !n.isDone).length}
                    </span>
                  )}
                </button>

                {notificationsPreviewOpen && filteredNotifications.length > 0 && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3 text-xs text-slate-700">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">
                      {t('crm.header.notifications')}
                    </div>
                    <div className="space-y-1">
                      {filteredNotifications.slice(0, 3).map((item) => (
                        <div key={item.taskId} className="truncate">
                          {item.task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Профиль — скрыт на самых маленьких, виден на sm+ */}
            <button
              onClick={() => (window.location.href = '/app/profile')}
              className="hidden sm:flex items-center gap-2 text-xs text-slate-600 hover:text-lumiva-accent"
            >
              <span className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-semibold">
                {initials}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-[11px] leading-tight">
                  {user?.name || user?.email || t('crm.common.user')}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  {user?.role || 'owner'}
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
          <div className="fixed inset-0 z-40">
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
                            {assignee}
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
                                    checked={(item.task.assignees || []).includes(u.fullName)}
                                    onChange={() => {
                                      const exists = (item.task.assignees || []).includes(
                                        u.fullName,
                                      );
                                      const nextAssignees = exists
                                        ? (item.task.assignees || []).filter(
                                            (name) => name !== u.fullName,
                                          )
                                        : [...(item.task.assignees || []), u.fullName];
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
              </div>
              <div className="border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => navigate('/app/projects/tasks')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {t('crm.notifications.openTasks')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* МОБИЛЬНОЕ МЕНЮ */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            {/* затемнение */}
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={closeMobile}
            />
            {/* панель */}
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-white border-r border-slate-200 px-4 py-4 flex flex-col shadow-[0_20px_60px_rgba(17,24,39,0.12)]">
              {/* шапка меню */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-2xl bg-lumiva-accent flex items-center justify-center text-white text-xs font-bold shadow-[0_10px_30px_rgba(34,34,34,0.18)]">
                    C
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Lumiva CRM
                    </div>
                    <div className="text-[11px] text-slate-400">
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

              {/* Навигация (mobile) */}
              <nav className="flex-1 overflow-y-auto text-[13px] space-y-1">
                {(!componentsLoaded || !permsLoaded) ? (
                  // Показываем скелетон загрузки вместо меню
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-full h-10 rounded-xl bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  filteredNav.map((item) => {
                    const hasChildren = !!item.children?.length;
                    const open = hasChildren && isSectionOpen(item.path);

                    return (
                      <div key={item.path}>
                        <NavLink
                          to={item.path}
                      onClick={(event) => handleNavClick(event, item.path, closeMobile)}
                          className={({ isActive }) =>
                            [
                              'w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-all',
                              isActive ||
                              location.pathname.startsWith(item.path)
                                ? 'bg-slate-100 text-lumiva-accent shadow-sm'
                                : 'text-slate-500 hover:text-lumiva-accent hover:bg-slate-50',
                            ].join(' ')
                          }
                        >
                          <span>{item.label}</span>
                          {hasChildren && (
                            <button
                              type="button"
                              className="ml-2 text-[10px] text-slate-400 hover:text-lumiva-accent"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleSection(item.path);
                              }}
                            >
                              {open ? '▲' : '▼'}
                            </button>
                          )}
                        </NavLink>

                        {hasChildren && open && (
                          <div className="mt-1 mb-1 ml-3 space-y-0.5">
                            {item.children!.map((child) => (
                            <NavLink
                              key={child.path}
                              to={child.path}
                              onClick={(event) =>
                                handleNavClick(event, child.path, closeMobile)
                              }
                              className={({ isActive }) =>
                                [
                                  'block text-[12px] px-2 py-1 rounded-lg',
                                  isActive
                                    ? 'bg-slate-100 text-lumiva-accent shadow-sm'
                                    : 'text-slate-500 hover:text-lumiva-accent hover:bg-slate-50',
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
                  })
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
                    {user?.role ?? 'owner'}
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
          key={location.pathname}
          className="flex-1 min-w-0 overflow-y-auto bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg px-3 md:px-6 py-4 md:py-6"
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
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-6 backdrop-blur-sm md:items-center md:px-6">
                  <div className="max-h-[96vh] w-full max-w-[99vw] overflow-auto rounded-3xl 2xl:max-w-[1700px]">
                    <BillingPage embedded />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
