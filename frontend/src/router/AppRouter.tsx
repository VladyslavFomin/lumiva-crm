// src/router/AppRouter.tsx
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { LoginPage } from '../pages/LoginPage';
import { BillingPage } from '../pages/BillingPage';
import { DashboardPage } from '../pages/DashboardPage';
import LandingPage from "../pages/LandingPage";
import DevelopmentPage from '../pages/public/DevelopmentPage';
import ScenariosPage from '../pages/public/ScenariosPage';
import ApiPage from '../pages/public/ApiPage';
import SolutionsPage from '../pages/public/SolutionsPage';
import PrivacyPage from '../pages/public/PrivacyPage';
import BlogPage from '../pages/public/BlogPage';
import PricingPage from '../pages/public/PricingPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import TenantInactivePage from '../pages/TenantInactivePage';
import ForgotPasswordPage from "../pages/ForgotPasswordPage";

// STAFF
import { StaffDetailPage } from '../pages/staff/StaffDetailPage';
import { StaffListPage } from '../pages/staff/StaffListPage';
import { StaffProfilePage } from '../pages/staff/StaffProfilePage';
import { StaffPermissionsPage } from '../pages/staff/StaffPermissionsPage';

// DEPARTMENTS
import { DepartmentsPage } from '../pages/departments/DepartmentsPage';
import { DepartmentFormPage } from '../pages/departments/DepartmentFormPage';

// SALES
import { SalesPage } from '../pages/sales/SalesPage';
import { SalesAnalyticsPage } from '../pages/sales/SalesAnalyticsPage';
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
import { CompaniesAnalyticsPage } from '../pages/analytics/CompaniesAnalyticsPage';
import { LostLeadsPage } from '../pages/leads/LostLeadsPage';
import { LeadsArchivePage } from '../pages/leads/LeadsArchivePage';
import { LeadsTrashPage } from '../pages/leads/LeadsTrashPage';

// Проекты
import { ProjectsListPage } from '../pages/projects/ProjectsListPage';
import { ProjectsBoardPage } from '../pages/projects/ProjectsBoardPage';
import { ProjectsArchivePage } from '../pages/projects/ProjectsArchivePage';
import { ProjectsTrashPage } from '../pages/projects/ProjectsTrashPage';
import { ProjectsBulkEditPage } from '../pages/projects/ProjectsBulkEditPage';
import { ProjectFormPage } from '../pages/projects/ProjectFormPage';
import { ClosedProjectsPage } from '../pages/projects/ClosedProjectsPage';
import { InProgressProjectsPage } from '../pages/projects/InProgressProjectsPage';
import { ProjectTasksPage } from '../pages/projects/ProjectTasksPage';
import { OverdueTasksPage } from '../pages/projects/OverdueTasksPage';
import { ProjectsAnalyticsPage } from '../pages/projects/ProjectsAnalyticsPage';

// CCP
import ClientAccountsPage from '../pages/client-accounts/ClientAccountsPage';
import ClientAccountDetailsPage from '../pages/client-accounts/ClientAccountDetailsPage';

// MARKETING
import { TrafficPage } from '../pages/marketing/TrafficPage';
import { CampaignsPage } from '../pages/marketing/CampaignsPage';
import { UtmsPage } from '../pages/marketing/UtmsPage';
import { SegmentsPage } from '../pages/marketing/SegmentsPage';
import { MarketingIntegrationsPage } from '../pages/marketing/MarketingIntegrationsPage';
import { AutomationsPage } from '../pages/marketing/AutomationsPage';
import { SmmPage } from '../pages/marketing/SmmPage';
import { ChannelsPage } from '../pages/marketing/ChannelsPage';
import { SeoPage } from '../pages/marketing/SeoPage';
import { EmailTemplatesPage } from '../pages/marketing/EmailTemplatesPage';
import { EmailTemplateFormPage } from '../pages/marketing/EmailTemplateFormPage';
import  OnlineChatPage  from '../pages/online-chat/OnlineChatPage'; // или default export
import { getAccessToken } from '../auth/session';
import SetPasswordPage from '../pages/SetPasswordPage';

// NEW MODULES
import { ContactsListPage } from '../pages/contacts/ContactsListPage';
import { ContactFormPage } from '../pages/contacts/ContactFormPage';
import { ContactDetailsPage } from '../pages/contacts/ContactDetailsPage';
import { CompaniesListPage } from '../pages/companies/CompaniesListPage';
import { CompanyFormPage } from '../pages/companies/CompanyFormPage';
import { CompanyDetailsPage } from '../pages/companies/CompanyDetailsPage';
import { CompanyTasksBoardPage } from '../pages/companies/CompanyTasksBoardPage';
import { AutomationsPage as AutomationsPageNew } from '../pages/automations/AutomationsPage';
import { AutomationFormPage } from '../pages/automations/AutomationFormPage';
import { EmailAccountsPage } from '../pages/email/EmailAccountsPage';
import { EmailAccountFormPage } from '../pages/email/EmailAccountFormPage';
import { TelegramBotsPage } from '../pages/telegram-crm/TelegramBotsPage';
import { TelegramBotFormPage } from '../pages/telegram-crm/TelegramBotFormPage';

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
        <Route path="/development" element={<DevelopmentPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/api" element={<ApiPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/blog" element={<BlogPage />} />

        {/* ПУБЛИЧНЫЕ РОУТЫ */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/tenant-inactive" element={<TenantInactivePage />} />

        {/* DASHBOARD */}
        <Route
          path="/app/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/forbidden"
          element={
            <ProtectedRoute>
              <AccessDeniedPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ЛИДЫ -------- */}
        <Route
          path="/app/leads"
          element={
            <ProtectedRoute>
              <LeadsListPage />
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
          path="/app/leads/archive"
          element={
            <ProtectedRoute>
              <LeadsArchivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/leads/trash"
          element={
            <ProtectedRoute>
              <LeadsTrashPage />
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
          path="/app/leads/lost"
          element={
            <ProtectedRoute>
              <LostLeadsPage />
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
          path="/app/projects/archive"
          element={
            <ProtectedRoute>
              <ProjectsArchivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/trash"
          element={
            <ProtectedRoute>
              <ProjectsTrashPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/bulk-edit"
          element={
            <ProtectedRoute>
              <ProjectsBulkEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/closed"
          element={
            <ProtectedRoute>
              <ClosedProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/in-progress"
          element={
            <ProtectedRoute>
              <InProgressProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/tasks"
          element={
            <ProtectedRoute>
              <ProjectTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/tasks/overdue"
          element={
            <ProtectedRoute>
              <OverdueTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/analytics"
          element={
            <ProtectedRoute>
              <ProjectsAnalyticsPage />
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
          path="/app/projects/create"
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

        {/* -------- ОТДЕЛЫ -------- */}
        <Route
          path="/app/departments"
          element={
            <ProtectedRoute>
              <DepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/departments/new"
          element={
            <ProtectedRoute>
              <DepartmentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/departments/:id"
          element={
            <ProtectedRoute>
              <DepartmentFormPage />
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
          path="/app/sales/analytics"
          element={
            <ProtectedRoute>
              <SalesAnalyticsPage />
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
          path="/app/marketing/channels"
          element={
            <ProtectedRoute>
              <ChannelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/seo"
          element={
            <ProtectedRoute>
              <SeoPage />
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
        <Route
          path="/app/marketing/email-templates"
          element={
            <ProtectedRoute>
              <EmailTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/email-templates/new"
          element={
            <ProtectedRoute>
              <EmailTemplateFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/marketing/email-templates/:id"
          element={
            <ProtectedRoute>
              <EmailTemplateFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- КОНТАКТЫ -------- */}
        <Route
          path="/app/contacts"
          element={
            <ProtectedRoute>
              <ContactsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/contacts/new"
          element={
            <ProtectedRoute>
              <ContactFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/contacts/:id"
          element={
            <ProtectedRoute>
              <ContactDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/contacts/:id/edit"
          element={
            <ProtectedRoute>
              <ContactFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- КОМПАНИИ -------- */}
        <Route
          path="/app/companies"
          element={
            <ProtectedRoute>
              <CompaniesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/companies/new"
          element={
            <ProtectedRoute>
              <CompanyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/companies/:id"
          element={
            <ProtectedRoute>
              <CompanyDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/companies/:id/edit"
          element={
            <ProtectedRoute>
              <CompanyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/companies/analytics"
          element={
            <ProtectedRoute>
              <CompaniesAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/companies/:companyId/tasks"
          element={
            <ProtectedRoute>
              <CompanyTasksBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/analytics/companies"
          element={
            <ProtectedRoute>
              <CompaniesAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- АВТОМАТИЗАЦИИ (новый модуль) -------- */}
        <Route
          path="/app/automations"
          element={
            <ProtectedRoute>
              <AutomationsPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/automations/new"
          element={
            <ProtectedRoute>
              <AutomationFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/automations/:id"
          element={
            <ProtectedRoute>
              <AutomationFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- EMAIL -------- */}
        <Route
          path="/app/email"
          element={
            <ProtectedRoute>
              <EmailAccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/email/accounts/new"
          element={
            <ProtectedRoute>
              <EmailAccountFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/email/accounts/:id"
          element={
            <ProtectedRoute>
              <EmailAccountFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- TELEGRAM CRM -------- */}
        <Route
          path="/app/telegram"
          element={
            <ProtectedRoute>
              <TelegramBotsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/telegram/bots/new"
          element={
            <ProtectedRoute>
              <TelegramBotFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/telegram/bots/:id"
          element={
            <ProtectedRoute>
              <TelegramBotFormPage />
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
              <OnlineChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/client-accounts"
          element={
            <ProtectedRoute>
              <ClientAccountsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/client-accounts/:clientId"
          element={
            <ProtectedRoute>
              <ClientAccountDetailsPage />
            </ProtectedRoute>
          }
        />

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
