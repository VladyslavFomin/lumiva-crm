// src/App.tsx
import React from "react";
import {
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import TenantsPage from "./pages/TenantsPage";
import TenantDetailsPage from "./pages/TenantDetailsPage";
import GlobalLogsPage from "./pages/GlobalLogsPage";
import ApiStatusPage from "./pages/ApiStatusPage";
import DemoRequestsPage from "./pages/DemoRequestsPage";
import PlatformSettingsPage from "./pages/PlatformSettingsPage";
import PanelLoginPage from "./pages/PanelLoginPage";
import ModulesPage from "./pages/ModulesPage";
import ComponentsPage from "./pages/ComponentsPage";
import BillingMonitorPage from "./pages/BillingMonitorPage";
import { isPanelAuthed } from "./auth/panelSession";

const PanelProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  if (!isPanelAuthed()) {
    return <Navigate to="/panel-login" replace />;
  }
  return children;
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const onTenants = location.pathname.startsWith("/tenants");

  const title = onTenants ? "Тенанты" : "Обзор платформы";
  const subtitle = onTenants
    ? "Список всех компаний, статусы, планы и управление доступом."
    : "Панель управления компаниями и доступами.";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex">
      {/* Сайдбар */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800/80">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-sm font-semibold">
            LM
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Lumiva Platform
            </span>
            <span className="text-[11px] text-slate-500">
              Панель управления
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Главная</span>
          </NavLink>

          <NavLink
            to="/tenants"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span>Тенанты</span>
          </NavLink>

          <NavLink
            to="/modules"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
            <span>Модули</span>
          </NavLink>

          <NavLink
            to="/components"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            <span>Компоненты</span>
          </NavLink>

          <NavLink
            to="/logs"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>Логи</span>
          </NavLink>

          <NavLink
            to="/apis"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>API</span>
          </NavLink>

          <NavLink
            to="/requests"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <span>Запросы</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>Настройки</span>
          </NavLink>

          <NavLink
            to="/billing-monitor"
            className={({ isActive }) =>
              [
                "flex items-center gap-2 rounded-xl px-3 py-2 transition-colors",
                isActive
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-50",
              ].join(" ")
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            <span>Billing</span>
          </NavLink>
        </nav>

        <div className="px-5 pb-4 text-[11px] text-slate-500">
          v0.1 · internal only
        </div>
      </aside>

      {/* Основная часть */}
      <main className="flex-1 min-w-0">
        {/* Верхняя шапка */}
        <header className="border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-xl">
          {/* убрали mx-auto max-w-6xl */}
          <div className="px-5 md:px-8 py-4 md:py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg md:text-xl font-semibold tracking-tight text-slate-50">
                  {title}
                </h1>
                <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
                  {subtitle}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Контент страниц */}
        {/* убрали mx-auto max-w-6xl, оставили только паддинги */}
        <div className="px-4 md:px-8 py-4 md:py-6">{children}</div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const location = useLocation();
  const isLogin = location.pathname === "/panel-login";

  // Для /panel-login показываем только экран логина, без сайдбара
  if (isLogin) {
    return (
      <Routes>
        <Route path="/panel-login" element={<PanelLoginPage />} />
        <Route path="*" element={<Navigate to="/panel-login" replace />} />
      </Routes>
    );
  }

  // Основные маршруты панели
  return (
    <AppShell>
      <Routes>
        <Route
          path="/"
          element={
            <PanelProtectedRoute>
              <DashboardPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/tenants"
          element={
            <PanelProtectedRoute>
              <TenantsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/tenants/:id"
          element={
            <PanelProtectedRoute>
              <TenantDetailsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/modules"
          element={
            <PanelProtectedRoute>
              <ModulesPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/components"
          element={
            <PanelProtectedRoute>
              <ComponentsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <PanelProtectedRoute>
              <GlobalLogsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/apis"
          element={
            <PanelProtectedRoute>
              <ApiStatusPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <PanelProtectedRoute>
              <DemoRequestsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PanelProtectedRoute>
              <PlatformSettingsPage />
            </PanelProtectedRoute>
          }
        />
        <Route
          path="/billing-monitor"
          element={
            <PanelProtectedRoute>
              <BillingMonitorPage />
            </PanelProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
