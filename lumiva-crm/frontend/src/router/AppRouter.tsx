// src/router/AppRouter.tsx
import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { LoginPage } from '../pages/LoginPage';
import { BillingPage } from '../pages/BillingPage';
import { DashboardPage } from '../pages/DashboardPage';
import LandingPage from "../pages/LandingPage";
import DevelopmentPage from '../pages/public/DevelopmentPage';
import ScenariosPage from '../pages/public/ScenariosPage';
import ApiPage from '../pages/public/ApiPage';
import IntegrationsPage from '../pages/public/IntegrationsPage';
import SolutionsPage from '../pages/public/SolutionsPage';
import AnalyticsPage from '../pages/public/AnalyticsPage';
import MarketingPage from '../pages/public/MarketingPage';
import SalesSolutionsPage from '../pages/public/SalesSolutionsPage';
import WarehouseSolutionsPage from '../pages/public/WarehouseSolutionsPage';
import ClientAccountsSolutionsPage from '../pages/public/ClientAccountsSolutionsPage';
import InventorySolutionsPage from '../pages/public/InventorySolutionsPage';
import PrivacyPage from '../pages/public/PrivacyPage';
import BlogPage from '../pages/public/BlogPage';
import PricingPage from '../pages/public/PricingPage';
import FeaturesPage from '../pages/public/FeaturesPage';
import AboutPage from '../pages/public/AboutPage';
import ContactPage from '../pages/public/ContactPage';
import FaqPage from '../pages/public/FaqPage';
import TermsPage from '../pages/public/TermsPage';
import ChangelogPage from '../pages/public/ChangelogPage';
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
import { SalesAnalyticsPage } from '../pages/sales/SalesAnalyticsPageV2';
import { SalesChannelsPage } from '../pages/sales/SalesChannelsPage';
import { SalesIntegrationsPage } from '../pages/sales/SalesIntegrationsPage';
import { SalesImportPage } from '../pages/sales/SalesImportPage';
import { SalesIntegrationNewPage } from '../pages/sales/SalesIntegrationNewPage';
import { SaleDetailsPage } from '../pages/sales/SaleDetailsPage';

// SETTINGS
import { SettingsCompanyPage } from '../pages/settings/SettingsCompanyPage';
import { SettingsApiPage } from '../pages/settings/SettingsApiPage';

// PROFILE / ACCOUNT
import { AccountCenterLayout } from '../pages/account/AccountCenterLayout';
import { AccountOverviewTab } from '../pages/account/tabs/AccountOverviewTab';
import { AccountPersonalTab } from '../pages/account/tabs/AccountPersonalTab';
import { AccountSecurityTab } from '../pages/account/tabs/AccountSecurityTab';
import { AccountPreferencesTab } from '../pages/account/tabs/AccountPreferencesTab';

// Лиды
import { LeadsBoardPage } from '../pages/leads/LeadsBoardPage';
import { LeadsListPage } from '../pages/leads/LeadsListPage';
import { LeadsCalendarPage } from '../pages/leads/LeadsCalendarPage';
import { LeadFormPage } from '../pages/leads/LeadFormPage';
import { LeadsAnalyticsPage } from '../pages/analytics/LeadsAnalyticsPageV2';
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
import { ProjectFormPage } from '../pages/projects/ProjectFormPage';
import { ClosedProjectsPage } from '../pages/projects/ClosedProjectsPage';
import { InProgressProjectsPage } from '../pages/projects/InProgressProjectsPage';
import { ProjectTasksPage } from '../pages/projects/ProjectTasksPage';
import { OverdueTasksPage } from '../pages/projects/OverdueTasksPage';
import { ProjectsAnalyticsPage } from '../pages/projects/ProjectsAnalyticsPage';
import { ProjectsCalendarPage } from '../pages/projects/ProjectsCalendarPage';

// CCP
import ClientAccountsPage from '../pages/client-accounts/ClientAccountsPage';
import ClientAccountDetailsPage from '../pages/client-accounts/ClientAccountDetailsPage';
import ClientAccountAnalyticsPage from '../pages/client-accounts/ClientAccountAnalyticsPage';
import ClientAccountSitesPage from '../pages/client-accounts/ClientAccountSitesPage';
import ClientFinancialOperationsPage from '../pages/client-accounts/ClientFinancialOperationsPage';

// MARKETING
import { TrafficPage } from '../pages/marketing/TrafficPage';
import { CampaignsPage } from '../pages/marketing/CampaignsPage';
import { UtmsPage } from '../pages/marketing/UtmsPage';
import { SegmentsPage } from '../pages/marketing/SegmentsPage';
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
import { ProductsListPage } from '../pages/products/ProductsListPage';
import { ProductFormPage } from '../pages/products/ProductFormPage';
import { ProductDetailPage } from '../pages/products/ProductDetailPage';
import { ProductAttributesPage } from '../pages/products/ProductAttributesPage';
import { ProductCategoriesPage } from '../pages/products/ProductCategoriesPage';
import { ProductFieldTypesPage } from '../pages/products/ProductFieldTypesPage';
import { ProductStockPage } from '../pages/products/ProductStockPage';
import { ProductLocationsPage } from '../pages/products/ProductLocationsPage';
import { ProductFeedsPage } from '../pages/products/ProductFeedsPage';
import { ProductWebhooksPage } from '../pages/products/ProductWebhooksPage';
import { ProductModerationQueuePage } from '../pages/products/ProductModerationQueuePage';
import { ProductsAnalyticsPage } from '../pages/products/ProductsAnalyticsPage';
import { ProductImportPage } from '../pages/products/ProductImportPage';
import { ProductLabelsPrintPage } from '../pages/products/ProductLabelsPrintPage';
import { BookingOverviewPage } from '../pages/bookings/BookingOverviewPage';
import { ReservationsPage } from '../pages/bookings/ReservationsPage';
import { ReservationDetailPage } from '../pages/bookings/ReservationDetailPage';
import { ReservationsImportPage } from '../pages/bookings/ReservationsImportPage';
import { BookingLocationsPage } from '../pages/bookings/BookingLocationsPage';
import { BookingServicesPage } from '../pages/bookings/BookingServicesPage';
import { BookingResourcesPage } from '../pages/bookings/BookingResourcesPage';
import { BookingAvailabilityPage } from '../pages/bookings/BookingAvailabilityPage';
import { BookingSettingsPage } from '../pages/bookings/BookingSettingsPage';
import { BookingWaitlistPage } from '../pages/bookings/BookingWaitlistPage';
import { BookingAnalyticsPage } from '../pages/bookings/BookingAnalyticsPage';
import { BookingTemplatesPage } from '../pages/bookings/BookingTemplatesPage';
import { BookingLogsPage } from '../pages/bookings/BookingLogsPage';
import { HotelsOverviewPage } from '../pages/hotels/HotelsOverviewPage';
import { HotelsListPage } from '../pages/hotels/HotelsListPage';
import { HotelDetailPage } from '../pages/hotels/HotelDetailPage';
import { HotelReservationsPage } from '../pages/hotels/HotelReservationsPage';
import { HotelPricingPage } from '../pages/hotels/HotelPricingPage';
import { HotelCalendarPage } from '../pages/hotels/HotelCalendarPage';
import { HotelRoomPricingPage } from '../pages/hotels/HotelRoomPricingPage';
import { HotelAnalyticsPage } from '../pages/hotels/HotelAnalyticsPage';
import { AutomationsPage as AutomationsPageNew } from '../pages/automations/AutomationsPage';
import { IntegrationsHubPage } from '../pages/integrations/IntegrationsHubPage';
import { AutomationFormPage } from '../pages/automations/AutomationFormPage';
import { EmailAccountsPage } from '../pages/email/EmailAccountsPage';
import { EmailAccountFormPage } from '../pages/email/EmailAccountFormPage';
import { EmailInboxPage } from '../pages/email/EmailInboxPage';
import { TelegramBotsPage } from '../pages/telegram-crm/TelegramBotsPage';
import { TelegramBotFormPage } from '../pages/telegram-crm/TelegramBotFormPage';
import { SmsPage } from '../pages/sms/SmsPage';
import { SmsSettingsPage } from '../pages/sms/SmsSettingsPage';
import { DuplicatesPage } from '../pages/deduplication/DuplicatesPage';
import { WorkspaceTablesPage } from '../pages/workspace/WorkspaceTablesPage';
import { WorkspaceNewTablePage } from '../pages/workspace/WorkspaceNewTablePage';
import { WorkspaceTableViewPage } from '../pages/workspace/WorkspaceTableViewPage';
import { WorkspaceKanbanViewPage } from '../pages/workspace/WorkspaceKanbanViewPage';
import { WorkspaceCalendarViewPage } from '../pages/workspace/WorkspaceCalendarViewPage';
import { WorkspaceAnalyticsPage } from '../pages/workspace/WorkspaceAnalyticsPage';
import { WorkspaceSettingsPage } from '../pages/workspace/WorkspaceSettingsPage';
import { WorkspaceImportPage } from '../pages/workspace/WorkspaceImportPage';
import { WorkspaceAreaHomePage } from '../pages/workspace/WorkspaceAreaHomePage';
import { WorkspaceGanttViewPage } from '../pages/workspace/WorkspaceGanttViewPage';
import { WebFormsListPage } from '../pages/web-forms/WebFormsListPage';
import { WebFormEditorPage } from '../pages/web-forms/WebFormEditorPage';
import { PublicEmbedFormPage } from '../pages/public-embed/PublicEmbedFormPage';
import {
  AiEmployeeProfilePage,
  AiEmployeesPage,
} from '../pages/ai-employees/AiEmployeesPage';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const LegacyAppRedirect: React.FC = () => {
  const location = useLocation();
  const nextPath =
    location.pathname === '/app' || location.pathname === '/app/'
      ? '/dashboard'
      : location.pathname.replace(/^\/app/, '') || '/dashboard';
  return (
    <Navigate
      to={`${nextPath}${location.search}${location.hash}`}
      replace
    />
  );
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичный лендинг CRM на корне */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/development" element={<DevelopmentPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/api-integration" element={<ApiPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/solutions/analytics" element={<AnalyticsPage />} />
        <Route path="/solutions/marketing" element={<MarketingPage />} />
        <Route path="/solutions/sales" element={<SalesSolutionsPage />} />
        <Route path="/solutions/warehouse" element={<WarehouseSolutionsPage />} />
        <Route path="/solutions/client-accounts" element={<ClientAccountsSolutionsPage />} />
        <Route path="/solutions/inventory" element={<InventorySolutionsPage />} />
        <Route path="/analytics" element={<Navigate to="/solutions/analytics" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy"   element={<PrivacyPage />} />
        <Route path="/blog"      element={<BlogPage />} />
        <Route path="/features"  element={<FeaturesPage />} />
        <Route path="/about"     element={<AboutPage />} />
        <Route path="/contact"   element={<ContactPage />} />
        <Route path="/faq"       element={<FaqPage />} />
        <Route path="/terms"     element={<TermsPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />

        {/* ПУБЛИЧНЫЕ РОУТЫ */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/tenant-inactive" element={<TenantInactivePage />} />

        {/* Публичная встраиваемая форма (iframe на сторонних сайтах) */}
        <Route path="/embed/:publicId" element={<PublicEmbedFormPage />} />

        {/* DASHBOARD */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <BillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/forbidden"
          element={
            <ProtectedRoute>
              <AccessDeniedPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ЛИДЫ -------- */}
        <Route
          path="/leads"
          element={
            <ProtectedRoute>
              <LeadsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/board"
          element={
            <ProtectedRoute>
              <LeadsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/list"
          element={
            <ProtectedRoute>
              <LeadsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/calendar"
          element={
            <ProtectedRoute>
              <LeadsCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/archive"
          element={
            <ProtectedRoute>
              <LeadsArchivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/trash"
          element={
            <ProtectedRoute>
              <LeadsTrashPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/new"
          element={
            <ProtectedRoute>
              <LeadFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/analytics"
          element={
            <ProtectedRoute>
              <LeadsAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/lost"
          element={
            <ProtectedRoute>
              <LostLeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/roi"
          element={
            <ProtectedRoute>
              <LeadsRoiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads/:id"
          element={
            <ProtectedRoute>
              <LeadFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОЕКТЫ -------- */}
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/archive"
          element={
            <ProtectedRoute>
              <ProjectsArchivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/trash"
          element={
            <ProtectedRoute>
              <ProjectsTrashPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/closed"
          element={
            <ProtectedRoute>
              <ClosedProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/in-progress"
          element={
            <ProtectedRoute>
              <InProgressProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/tasks"
          element={
            <ProtectedRoute>
              <ProjectTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/tasks/overdue"
          element={
            <ProtectedRoute>
              <OverdueTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/analytics"
          element={
            <ProtectedRoute>
              <ProjectsAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/board"
          element={
            <ProtectedRoute>
              <ProjectsBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/calendar"
          element={
            <ProtectedRoute>
              <ProjectsCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/new"
          element={
            <ProtectedRoute>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/create"
          element={
            <ProtectedRoute>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- Глобальная аналитика -------- */}
        <Route
          path="/analytics/leads"
          element={<Navigate to="/leads/analytics" replace />}
        />
        <Route
          path="/analytics/roi"
          element={
            <ProtectedRoute>
              <LeadsRoiPage />
            </ProtectedRoute>
          }
        />

        {/* -------- СОТРУДНИКИ -------- */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <StaffListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id/profile"
          element={
            <ProtectedRoute>
              <StaffProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <StaffDetailPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ОТДЕЛЫ -------- */}
        <Route
          path="/departments"
          element={
            <ProtectedRoute>
              <DepartmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments/new"
          element={
            <ProtectedRoute>
              <DepartmentFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments/:id"
          element={
            <ProtectedRoute>
              <DepartmentFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- АККАУНТ / ПРОФИЛЬ -------- */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AccountCenterLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<AccountOverviewTab />} />
          <Route path="personal" element={<AccountPersonalTab />} />
          <Route path="security" element={<AccountSecurityTab />} />
          <Route path="preferences" element={<AccountPreferencesTab />} />
        </Route>

        {/* -------- НАСТРОЙКИ -------- */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsCompanyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/api"
          element={
            <ProtectedRoute>
              <SettingsApiPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРАВА ДОСТУПА -------- */}
        <Route
          path="/staff/permissions"
          element={
            <ProtectedRoute>
              <StaffPermissionsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОДАЖИ -------- */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/analytics"
          element={
            <ProtectedRoute>
              <SalesAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/:id"
          element={
            <ProtectedRoute>
              <SaleDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/channels"
          element={
            <ProtectedRoute>
              <SalesChannelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/integrations"
          element={
            <ProtectedRoute>
              <SalesIntegrationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/integrations/new"
          element={
            <ProtectedRoute>
              <SalesIntegrationNewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/import"
          element={
            <ProtectedRoute>
              <SalesImportPage />
            </ProtectedRoute>
          }
        />

        {/* -------- МАРКЕТИНГ -------- */}

        {/* корень маркетинга: /marketing → сразу на трафик */}
        <Route
          path="/marketing"
          element={
            <ProtectedRoute>
              <Navigate to="/marketing/traffic" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/marketing/traffic"
          element={
            <ProtectedRoute>
              <TrafficPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/campaigns"
          element={
            <ProtectedRoute>
              <CampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/smm"
          element={
            <ProtectedRoute>
              <SmmPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/utms"
          element={
            <ProtectedRoute>
              <UtmsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/segments"
          element={
            <ProtectedRoute>
              <SegmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/channels"
          element={
            <ProtectedRoute>
              <ChannelsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/seo"
          element={
            <ProtectedRoute>
              <SeoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/integrations"
          element={
            <ProtectedRoute>
              <Navigate to="/integrations-hub?tab=marketing" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/email-templates"
          element={
            <ProtectedRoute>
              <EmailTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/email-templates/new"
          element={
            <ProtectedRoute>
              <EmailTemplateFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/email-templates/:id"
          element={
            <ProtectedRoute>
              <EmailTemplateFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- КОНТАКТЫ -------- */}
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <ContactsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/new"
          element={
            <ProtectedRoute>
              <ContactFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:id"
          element={
            <ProtectedRoute>
              <ContactDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:id/edit"
          element={
            <ProtectedRoute>
              <ContactFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- КОМПАНИИ -------- */}
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <CompaniesListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/new"
          element={
            <ProtectedRoute>
              <CompanyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id"
          element={
            <ProtectedRoute>
              <CompanyDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id/edit"
          element={
            <ProtectedRoute>
              <CompanyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/analytics"
          element={
            <ProtectedRoute>
              <CompaniesAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:companyId/tasks"
          element={
            <ProtectedRoute>
              <CompanyTasksBoardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/companies"
          element={
            <ProtectedRoute>
              <CompaniesAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ТОВАРЫ -------- */}
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/new"
          element={
            <ProtectedRoute>
              <ProductFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/categories"
          element={
            <ProtectedRoute>
              <ProductCategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/attributes"
          element={
            <ProtectedRoute>
              <ProductAttributesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/field-types"
          element={
            <ProtectedRoute>
              <ProductFieldTypesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/stock"
          element={
            <ProtectedRoute>
              <ProductStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/locations"
          element={
            <ProtectedRoute>
              <ProductLocationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/feeds"
          element={
            <ProtectedRoute>
              <ProductFeedsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/webhooks"
          element={
            <ProtectedRoute>
              <ProductWebhooksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/moderation"
          element={
            <ProtectedRoute>
              <ProductModerationQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/analytics"
          element={
            <ProtectedRoute>
              <ProductsAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/import"
          element={
            <ProtectedRoute>
              <ProductImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/print-labels"
          element={
            <ProtectedRoute>
              <ProductLabelsPrintPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute>
              <ProductDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id/edit"
          element={
            <ProtectedRoute>
              <ProductFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- БРОНИРОВАНИЯ -------- */}
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <BookingOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/reservations"
          element={
            <ProtectedRoute>
              <ReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/reservations/import"
          element={
            <ProtectedRoute>
              <ReservationsImportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/reservations/:id"
          element={
            <ProtectedRoute>
              <ReservationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/locations"
          element={
            <ProtectedRoute>
              <BookingLocationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/services"
          element={
            <ProtectedRoute>
              <BookingServicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/resources"
          element={
            <ProtectedRoute>
              <BookingResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/availability"
          element={
            <ProtectedRoute>
              <BookingAvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/settings"
          element={
            <ProtectedRoute>
              <BookingSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/waitlist"
          element={
            <ProtectedRoute>
              <BookingWaitlistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/analytics"
          element={
            <ProtectedRoute>
              <BookingAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/templates"
          element={
            <ProtectedRoute>
              <BookingTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bookings/logs"
          element={
            <ProtectedRoute>
              <BookingLogsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ОТЕЛИ (Система резервации) -------- */}
        <Route
          path="/hotels"
          element={
            <ProtectedRoute>
              <HotelsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/list"
          element={
            <ProtectedRoute>
              <HotelsListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/reservations"
          element={
            <ProtectedRoute>
              <HotelReservationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/pricing"
          element={
            <ProtectedRoute>
              <HotelPricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/calendar"
          element={
            <ProtectedRoute>
              <HotelCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/room-types/:roomTypeId/pricing"
          element={
            <ProtectedRoute>
              <HotelRoomPricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/analytics"
          element={
            <ProtectedRoute>
              <HotelAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotels/:id"
          element={
            <ProtectedRoute>
              <HotelDetailPage />
            </ProtectedRoute>
          }
        />

        {/* -------- АВТОМАТИЗАЦИИ (новый модуль) -------- */}
        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <AutomationsPageNew />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/new"
          element={
            <ProtectedRoute>
              <AutomationFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:id"
          element={
            <ProtectedRoute>
              <AutomationFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- AI EMPLOYEES -------- */}
        <Route
          path="/ai-employees"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/choose"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="choose" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/new"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="create" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/approvals"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="approvals" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/logs"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="logs" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/reports"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="reports" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/:id/edit"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="edit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/:id"
          element={
            <ProtectedRoute>
              <AiEmployeeProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/integrations-hub"
          element={
            <ProtectedRoute>
              <IntegrationsHubPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ФОРМЫ ДЛЯ САЙТА -------- */}
        <Route
          path="/web-forms"
          element={
            <ProtectedRoute>
              <WebFormsListPage />
            </ProtectedRoute>
          }
        />
        {/*
          Не делаем отдельный /web-forms/new: при статическом пути :formId в useParams() нет,
          редактор думает, что id отсутствует, и показывает «Форма не найдена».
          Один сегмент :formId покрывает и «new», и uuid.
        */}
        <Route
          path="/web-forms/:formId"
          element={
            <ProtectedRoute>
              <WebFormEditorPage />
            </ProtectedRoute>
          }
        />

        {/* -------- EMAIL -------- */}
        <Route
          path="/email/inbox"
          element={
            <ProtectedRoute>
              <EmailInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email"
          element={
            <ProtectedRoute>
              <EmailAccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email/accounts/new"
          element={
            <ProtectedRoute>
              <EmailAccountFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email/accounts/:id"
          element={
            <ProtectedRoute>
              <EmailAccountFormPage />
            </ProtectedRoute>
          }
        />

        {/* -------- TELEGRAM CRM -------- */}
        <Route
          path="/telegram"
          element={
            <ProtectedRoute>
              <TelegramBotsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telegram/bots/new"
          element={
            <ProtectedRoute>
              <TelegramBotFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telegram/bots/:id"
          element={
            <ProtectedRoute>
              <TelegramBotFormPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sms"
          element={
            <ProtectedRoute>
              <SmsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sms/settings"
          element={
            <ProtectedRoute>
              <SmsSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/duplicates"
          element={
            <ProtectedRoute>
              <DuplicatesPage />
            </ProtectedRoute>
          }
        />

        {/* -------- ПРОЧЕЕ -------- */}
        <Route path="/tools" element={<Navigate to="/web-forms" replace />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <OnlineChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-accounts"
          element={
            <ProtectedRoute>
              <ClientAccountsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/client-accounts/sites"
          element={
            <ProtectedRoute>
              <ClientAccountSitesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/client-accounts/operations"
          element={
            <ProtectedRoute>
              <ClientFinancialOperationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/client-accounts/:clientId/analytics"
          element={
            <ProtectedRoute>
              <ClientAccountAnalyticsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/client-accounts/:clientId"
          element={
            <ProtectedRoute>
              <ClientAccountDetailsPage />
            </ProtectedRoute>
          }
        />

        {/* -------- WORKSPACE (NO-CODE) -------- */}
        <Route
          path="/workspace/areas/:areaId"
          element={
            <ProtectedRoute>
              <WorkspaceAreaHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <WorkspaceTablesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/new"
          element={
            <ProtectedRoute>
              <WorkspaceNewTablePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/table"
          element={
            <ProtectedRoute>
              <WorkspaceTableViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/kanban"
          element={
            <ProtectedRoute>
              <WorkspaceKanbanViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/calendar"
          element={
            <ProtectedRoute>
              <WorkspaceCalendarViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/gantt"
          element={
            <ProtectedRoute>
              <WorkspaceGanttViewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/analytics"
          element={
            <ProtectedRoute>
              <WorkspaceAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/settings"
          element={
            <ProtectedRoute>
              <WorkspaceSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:objectId/import"
          element={
            <ProtectedRoute>
              <WorkspaceImportPage />
            </ProtectedRoute>
          }
        />

        {/* Legacy prefix compatibility: /app/* -> clean paths */}
        <Route path="/app/*" element={<LegacyAppRedirect />} />

        {/* CATCH-ALL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
