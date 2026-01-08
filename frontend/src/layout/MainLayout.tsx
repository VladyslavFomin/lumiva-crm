// src/layout/MainLayout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getStoredUser, clearSession } from '../auth/session';
import { fetchChatSessions } from '../api/onlineChat';
import { fetchStaffPermissions, fetchUserPermissions, type PermissionKey, type RolePermissionMatrix, type UserPermissionMatrix } from '../api/rbac';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '../i18n';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t, i18n } = useTranslation();
  const user = getStoredUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [roleMatrix, setRoleMatrix] = useState<RolePermissionMatrix | null>(null);
  const [userMatrix, setUserMatrix] = useState<UserPermissionMatrix | null>(null);
  const [permsLoaded, setPermsLoaded] = useState(false);

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

  const closeMobile = () => setMobileOpen(false);

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

  const NAV = useMemo(
    () => [
      { label: t('crm.nav.dashboard'), path: '/app' },

      {
        label: t('crm.nav.leads'),
        path: '/app/leads',
        children: [
          { label: t('crm.nav.leadsNew'), path: '/app/leads/new' },
          { label: t('crm.nav.leadsLost'), path: '/app/leads/lost' },
          { label: t('crm.nav.leadsAnalytics'), path: '/app/leads/analytics' },
          { label: t('crm.nav.leadsRoi'), path: '/app/leads/roi' },
        ],
      },

      {
        label: t('crm.nav.projects'),
        path: '/app/projects',
        children: [
          { label: t('crm.nav.projectsNew'), path: '/app/projects/new-projects' },
          { label: t('crm.nav.projectsClosed'), path: '/app/projects/closed' },
          { label: t('crm.nav.projectsInProgress'), path: '/app/projects/in-progress' },
          { label: t('crm.nav.projectsTasks'), path: '/app/projects/tasks' },
          { label: t('crm.nav.projectsOverdue'), path: '/app/projects/tasks/overdue' },
          { label: t('crm.nav.projectsAnalytics'), path: '/app/projects/analytics' },
        ],
      },

      {
        label: t('crm.nav.sales'),
        path: '/app/sales',
        children: [
          { label: t('crm.nav.sales'), path: '/app/sales' },
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
        ],
      },

      {
        label: t('crm.nav.tools'),
        path: '/app/settings',
        children: [
          { label: t('crm.nav.settingsCompany'), path: '/app/settings' },
          { label: t('crm.nav.settingsApi'), path: '/app/settings/api' },
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
        ],
      },
    ],
    [t],
  );

  // выбираем самый "глубокий" root-route
  const permissionForPath = (path: string): PermissionKey | null => {
    if (path.startsWith('/app/leads')) return 'leads';
    if (path.startsWith('/app/projects')) return 'projects';
    if (path.startsWith('/app/staff')) return 'staff';
    if (path.startsWith('/app/settings')) return 'settings';
    if (path.startsWith('/app/chat')) return 'chat';
    if (path.startsWith('/app/analytics')) return 'analytics';
    if (path.startsWith('/app/sales')) return 'finance';
    return null;
  };

  const canAccess = (perm: PermissionKey | null) => {
    if (!perm) return true;
    if (user?.role === 'owner') return true;
    const userId = user?.id;
    const rolePerms = roleMatrix ? roleMatrix[user?.role] ?? [] : [];
    const userPerms = userId && userMatrix ? userMatrix[userId] ?? [] : [];
    return rolePerms.includes(perm) || userPerms.includes(perm);
  };

  const filteredNav = NAV.map((item) => {
    const perm = permissionForPath(item.path);
    if (!canAccess(perm)) return null;
    const children = item.children
      ?.filter((child) => canAccess(permissionForPath(child.path)));
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

  // редирект на forbidden если нет доступа
  useEffect(() => {
    const perm = permissionForPath(location.pathname);
    if (permsLoaded && !canAccess(perm) && location.pathname.startsWith('/app')) {
      navigate('/app/forbidden', { replace: true });
    }
  }, [location.pathname, permsLoaded]);

  return (
    <div className="h-full flex bg-lumiva-bg text-lumiva-accent">
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
          {filteredNav.map((item) => {
            const hasChildren = !!item.children?.length;
            const open = hasChildren && isSectionOpen(item.path);

            return (
              <div key={item.path}>
                <NavLink
                  to={item.path}
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
          })}
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

            <button
              type="button"
              onClick={() => (window.location.href = '/app/chat')}
              className="relative hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:shadow transition"
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
                  d="M14.857 17.657a2 2 0 0 1-1.757 1.09h-2.2a2 2 0 0 1-1.757-1.09l-.828-1.657H5.5a1 1 0 0 1-.894-1.447l1.03-2.06A5.5 5.5 0 0 0 6 10.5V9a6 6 0 1 1 12 0v1.5c0 .89.211 1.768.614 2.565l1.03 2.06A1 1 0 0 1 18.5 16h-2.115l-.828 1.657Z"
                />
              </svg>
              {unreadChats > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-semibold shadow">
                  {unreadChats}
                </span>
              )}
            </button>

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
                {NAV.map((item) => {
                  const hasChildren = !!item.children?.length;
                  const open = hasChildren && isSectionOpen(item.path);

                  return (
                    <div key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={closeMobile}
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
                            onClick={closeMobile}
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
                })}
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

        <main className="flex-1 min-w-0 overflow-y-auto bg-gradient-to-b from-white via-lumiva-bg to-lumiva-bg px-3 md:px-6 py-4 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
