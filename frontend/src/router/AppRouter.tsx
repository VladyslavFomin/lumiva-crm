// src/router/AppRouter.tsx
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import LandingPage from "../pages/LandingPage";

// STAFF
import { StaffDetailPage } from '../pages/staff/StaffDetailPage';
import { StaffListPage } from '../pages/staff/StaffListPage';
import { StaffProfilePage } from '../pages/staff/StaffProfilePage';
import { StaffPermissionsPage } from '../pages/staff/StaffPermissionsPage';

// SALES
import { SalesPage } from '../pages/sales/SalesPage';
import { SalesChannelsPage } from '../pages/sales/SalesChannelsPage';
import { SalesIntegrationsPage } from '../pages/sales/SalesIntegrationsPage';
import { SalesImportPage } from '../pages/sales/SalesImportPage';
import { SalesIntegrationNewPage } from '../pages/sales/SalesIntegrationNewPage';
import { SaleDetailsPage } from '../pages/sales/SaleDetailsPage';

// SETTINGS
import { SettingsCompanyPage } from '../pages/settings/SettingsCompanyPage';
import { SettingsApiPage } from '../pages/settings/SettingsApiPage';

// PROFILE (текущий пользователь)
import { ProfilePage } from '../pages/profile/ProfilePage';

// Лиды
import { LeadsBoardPage } from '../pages/leads/LeadsBoardPage';
import { LeadsListPage } from '../pages/leads/LeadsListPage';
import { LeadFormPage } from '../pages/leads/LeadFormPage';
import { LeadsAnalyticsPage } from '../pages/analytics/LeadsAnalyticsPage';
import { LeadsRoiPage } from '../pages/analytics/LeadsRoiPage';

// Проекты
import { ProjectsListPage } from '../pages/projects/ProjectsListPage';
import { ProjectsBoardPage } from '../pages/projects/ProjectsBoardPage';
import { ProjectFormPage } from '../pages/projects/ProjectFormPage';

// MARKETING
import { TrafficPage } from '../pages/marketing/TrafficPage';
import { CampaignsPage } from '../pages/marketing/CampaignsPage';
import { UtmsPage } from '../pages/marketing/UtmsPage';
import { SegmentsPage } from '../pages/marketing/SegmentsPage';
import { MarketingIntegrationsPage } from '../pages/marketing/MarketingIntegrationsPage';
import { AutomationsPage } from '../pages/marketing/AutomationsPage';
import { SmmPage } from '../pages/marketing/SmmPage';

import { getAccessToken } from '../auth/session';
import SetPasswordPage from '../pages/SetPasswordPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный лендинг CRM на корне */}
        <Route path="/" element={<LandingPage />} />

        {/* ПУБЛИЧНЫЕ РОУТЫ */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />

        {/* DASHBOARD */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ЛИДЫ -------- */}
        <Route
          path="/app/leads"
          element={
            <ProtectedRoute>
              <LeadsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/board"
          element={
            <ProtectedRoute>
              <LeadsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/list"
          element={
            <ProtectedRoute>
              <LeadsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/new"
          element={
            <ProtectedRoute>
              <LeadFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/analytics"
          element={
            <ProtectedRoute>
              <LeadsAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/roi"
          element={
            <ProtectedRoute>
              <LeadsRoiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/:id"
          element={
            <ProtectedRoute>
              <LeadFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОЕКТЫ -------- */}
        <Route
          path="/app/projects"
          element={
            <ProtectedRoute>
              <ProjectsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/board"
          element={
            <ProtectedRoute>
              <ProjectsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/new"
          element={
            <ProtectedRoute>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- Глобальная аналитика -------- */}
        <Route
          path="/app/analytics/leads"
          element={
            <ProtectedRoute>
              <LeadsAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/analytics/roi"
          element={
            <ProtectedRoute>
              <LeadsRoiPage />
            </ProtectedRoute>
          }
        />

        {/* -------- СОТРУДНИКИ -------- */}
        <Route
          path="/app/staff"
          element={
            <ProtectedRoute>
              <StaffListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/staff/:id/profile"
          element={
            <ProtectedRoute>
              <StaffProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/staff/:id"
          element={
            <ProtectedRoute>
              <StaffDetailPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОФИЛЬ -------- */}
        <Route
          path="/app/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* -------- НАСТРОЙКИ -------- */}
        <Route
          path="/app/settings"
          element={
            <ProtectedRoute>
              <SettingsCompanyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/settings/api"
          element={
            <ProtectedRoute>
              <SettingsApiPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРАВА ДОСТУПА -------- */}
        <Route
          path="/app/staff/permissions"
          element={
            <ProtectedRoute>
              <StaffPermissionsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОДАЖИ -------- */}
        <Route
          path="/app/sales"
          element={
            <ProtectedRoute>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/sales/:id"
          element={
            <ProtectedRoute>
              <SaleDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/sales/channels"
          element={
            <ProtectedRoute>
              <SalesChannelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/sales/integrations"
          element={
            <ProtectedRoute>
              <SalesIntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/sales/integrations/new"
          element={
            <ProtectedRoute>
              <SalesIntegrationNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/sales/import"
          element={
            <ProtectedRoute>
              <SalesImportPage />
            </ProtectedRoute>
          }
        />

        {/* -------- МАРКЕТИНГ -------- */}

        {/* корень маркетинга: /app/marketing → сразу на трафик */}
        <Route
          path="/app/marketing"
          element={
            <ProtectedRoute>
              <Navigate to="/app/marketing/traffic" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/marketing/traffic"
          element={
            <ProtectedRoute>
              <TrafficPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/smm"
          element={
            <ProtectedRoute>
              <SmmPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/utms"
          element={
            <ProtectedRoute>
              <UtmsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/segments"
          element={
            <ProtectedRoute>
              <SegmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/integrations"
          element={
            <ProtectedRoute>
              <MarketingIntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/automations"
          element={
            <ProtectedRoute>
              <AutomationsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОЧЕЕ -------- */}
        <Route
          path="/app/tools"
          element={
            <ProtectedRoute>
              <div className="text-slate-200 p-10">
                Инструменты (в разработке)
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/chat"
          element={
            <ProtectedRoute>
              <div className="text-slate-200 p-10">
                Онлайн-чат (в разработке)
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/client-accounts"
          element={
            <ProtectedRoute>
              <div className="text-slate-200 p-10">
                Счета клиентов (в разработке)
              </div>
            </ProtectedRoute>
          }
        />

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};