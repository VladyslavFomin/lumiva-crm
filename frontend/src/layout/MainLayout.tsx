// src/layout/MainLayout.tsx
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getStoredUser, clearSession } from '../auth/session';

interface MainLayoutProps {
  children: React.ReactNode;
}

const NAV = [
  { label: 'Главная', path: '/app' },

  {
    label: 'Лиды',
    path: '/app/leads',
    children: [
      { label: 'Создать лид', path: '/app/leads/new' },
      { label: 'Утраченные лиды', path: '/app/leads/lost' },
      { label: 'Аналитика', path: '/app/leads/analytics' },
      { label: 'ROI', path: '/app/leads/roi' },
    ],
  },

  {
    label: 'Проекты',
    path: '/app/projects',
    children: [
      { label: 'Новые проекты', path: '/app/projects/new' },
      { label: 'Закрытые проекты', path: '/app/projects/closed' },
      { label: 'Проекты в работе', path: '/app/projects/in-progress' },
      { label: 'Задачи', path: '/app/projects/tasks' },
      { label: 'Просроченные задачи', path: '/app/projects/tasks/overdue' },
      { label: 'Аналитика проектов', path: '/app/projects/analytics' },
    ],
  },

  {
    label: 'Продажи',
    path: '/app/sales',
    children: [
      { label: 'Продажи', path: '/app/sales' },
      { label: 'Каналы продаж', path: '/app/sales/channels' },
      { label: 'Интеграции', path: '/app/sales/integrations' },
      { label: 'Импорт продаж', path: '/app/sales/import' },
    ],
  },

  {
    label: 'Маркетинг',
    path: '/app/marketing',
    children: [
      { label: 'Трафик', path: '/app/marketing/traffic' },
      { label: 'Кампании (ROAS)', path: '/app/marketing/campaigns' },
      { label: 'UTM-метки', path: '/app/marketing/utms' },
      { label: 'Сегменты', path: '/app/marketing/segments' },
      { label: 'Статусы лидов/клиентов', path: '/app/marketing/statuses' },
      { label: 'Каналы и площадки', path: '/app/marketing/channels' },
      { label: 'SEO & контент', path: '/app/marketing/seo' },
      { label: 'SMM / соцсети', path: '/app/marketing/smm' },
      { label: 'Интеграции маркетинга', path: '/app/marketing/integrations' },
      { label: 'Автоматизации (n8n)', path: '/app/marketing/automations' },
    ],
  },

  {
    label: 'Инструменты',
    path: '/app/settings',
    children: [
      { label: 'Настройки компании', path: '/app/settings' },
      { label: 'API и интеграции', path: '/app/settings/api' },
    ],
  },

  { label: 'Чат', path: '/app/chat' },
  { label: 'Счета клиентов', path: '/app/client-accounts' },

  {
    label: 'Сотрудники',
    path: '/app/staff',
    children: [
      { label: 'Список сотрудников', path: '/app/staff' },
      { label: 'Права доступа', path: '/app/staff/permissions' },
    ],
  },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const user = getStoredUser();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // какой root-раздел раскрыт (для подменю)
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/login';
  };

  const closeMobile = () => setMobileOpen(false);

  // выбираем самый "глубокий" root-route
  const activeRoot =
    [...NAV]
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => location.pathname.startsWith(item.path)) || NAV[0];

  const isSectionOpen = (path: string) =>
    openGroup ? openGroup === path : activeRoot.path === path;

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

  return (
    <div className="h-full flex bg-lumiva-bg text-slate-50">
      {/* SIDEBAR — только на md+ */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-950/80 border-r border-slate-800/80 px-4 py-4">
        {/* Лого / заголовок */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-9 w-9 rounded-2xl bg-lumiva-accent flex items-center justify-center text-slate-950 font-bold text-sm">
            C
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Lumiva
            </div>
            <div className="text-[11px] text-slate-500">WP ·CRM Админ</div>
          </div>
        </div>

        {/* Навигация (desktop) */}
        <nav className="space-y-1 text-[13px]">
          {NAV.map((item) => {
            const hasChildren = !!item.children?.length;
            const open = hasChildren && isSectionOpen(item.path);

            return (
              <div key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      'w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors',
                      isActive || location.pathname.startsWith(item.path)
                        ? 'bg-slate-900 text-slate-50'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70',
                    ].join(' ')
                  }
                >
                  <span>{item.label}</span>
                  {hasChildren && (
                    <button
                      type="button"
                      className="ml-2 text-[10px] text-slate-500 hover:text-slate-200"
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
                              ? 'bg-slate-900 text-slate-100'
                              : 'text-slate-500 hover:text-slate-100 hover:bg-slate-900/60',
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

        <div className="mt-auto pt-6 border-t border-slate-800/80 text-[11px] text-slate-500">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => (window.location.href = '/app/profile')}
              className="text-slate-300 hover:text-slate-50"
            >
              {user?.name ?? 'Пользователь'}
            </button>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-[10px] uppercase tracking-[0.16em]">
              {user?.role ?? 'owner'}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur flex items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-2">
            {/* Бургер — только на мобиле */}
            <button
              type="button"
              className="md:hidden mr-1 inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800 transition"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span className="sr-only">Открыть меню</span>
              <div className="space-y-0.5">
                <span className="block h-[1px] w-4 bg-slate-200" />
                <span className="block h-[1px] w-4 bg-slate-200" />
                <span className="block h-[1px] w-4 bg-slate-200" />
              </div>
            </button>

            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {activeRoot?.label ?? 'Overview'}
              </div>
              <div className="text-sm font-medium text-slate-100">
                {headerSubtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Реальное время · подключено</span>
            </div>

            {/* Профиль — скрыт на самых маленьких, виден на sm+ */}
            <button
              onClick={() => (window.location.href = '/app/profile')}
              className="hidden sm:flex items-center gap-2 text-xs text-slate-300 hover:text-slate-50"
            >
              <span className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-[11px] font-semibold">
                {initials}
              </span>
              <span className="flex flex-col items-start">
                <span className="text-[11px] leading-tight">
                  {user?.name || user?.email || 'Пользователь'}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {user?.role || 'owner'}
                </span>
              </span>
            </button>

            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs rounded-xl border border-slate-700/80 text-slate-300 hover:bg-slate-900/70 transition-colors"
            >
              Выйти
            </button>
          </div>
        </header>

        {/* МОБИЛЬНОЕ МЕНЮ */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            {/* затемнение */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeMobile}
            />
            {/* панель */}
            <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-slate-950 border-r border-slate-800/80 px-4 py-4 flex flex-col">
              {/* шапка меню */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-2xl bg-lumiva-accent flex items-center justify-center text-slate-950 text-xs font-bold">
                    C
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Lumiva CRM
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {user?.name || user?.email || 'Пользователь'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-slate-900 text-slate-300 hover:bg-slate-800"
                  onClick={closeMobile}
                >
                  <span className="sr-only">Закрыть</span>
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
                            'w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors',
                            isActive ||
                            location.pathname.startsWith(item.path)
                              ? 'bg-slate-900 text-slate-50'
                              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/70',
                          ].join(' ')
                        }
                      >
                        <span>{item.label}</span>
                        {hasChildren && (
                          <button
                            type="button"
                            className="ml-2 text-[10px] text-slate-500 hover:text-slate-200"
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
                                    ? 'bg-slate-900 text-slate-100'
                                    : 'text-slate-500 hover:text-slate-100 hover:bg-slate-900/60',
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

              {/* Низ меню */}
              <div className="pt-3 mt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-[10px] uppercase tracking-[0.16em]">
                    {user?.role ?? 'owner'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-slate-400 hover:text-slate-100"
                  >
                    Выйти
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-3 md:px-6 py-4 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
};