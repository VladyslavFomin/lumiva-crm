// src/router/AppRouter.tsx
import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom';

const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const BillingPage = lazy(() => import('../pages/BillingPage').then((m) => ({ default: m.BillingPage })));
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BiDashboardPage = lazy(() => import('../pages/analytics/BiDashboardPage').then((m) => ({ default: m.BiDashboardPage })));
const LandingPage = lazy(() => import('../pages/LandingPage'));
const DevelopmentPage = lazy(() => import('../pages/public/DevelopmentPage'));
const ScenariosPage = lazy(() => import('../pages/public/ScenariosPage'));
const ApiPage = lazy(() => import('../pages/public/ApiPage'));
const ApiDocsPage = lazy(() => import('../pages/public/ApiDocsPage'));
const IntegrationsPage = lazy(() => import('../pages/public/IntegrationsPage'));
const PaymentResultPage = lazy(() => import('../pages/public/PaymentResultPage').then((m) => ({ default: m.PaymentResultPage })));
const SolutionsPage = lazy(() => import('../pages/public/SolutionsPage'));
const AnalyticsPage = lazy(() => import('../pages/public/AnalyticsPage'));
const MarketingPage = lazy(() => import('../pages/public/MarketingPage'));
const SalesSolutionsPage = lazy(() => import('../pages/public/SalesSolutionsPage'));
const WarehouseSolutionsPage = lazy(() => import('../pages/public/WarehouseSolutionsPage'));
const ClientAccountsSolutionsPage = lazy(() => import('../pages/public/ClientAccountsSolutionsPage'));
const ProductsSolutionsPage = lazy(() => import('../pages/public/ProductsSolutionsPage'));
const BookingSolutionsPage = lazy(() => import('../pages/public/BookingSolutionsPage'));
const HotelSolutionsPage = lazy(() => import('../pages/public/HotelSolutionsPage'));
const SecurityPage = lazy(() => import('../pages/public/SecurityPage'));
const ComparePage = lazy(() => import('../pages/public/ComparePage'));
const PrivacyPage = lazy(() => import('../pages/public/PrivacyPage'));
const BlogPage = lazy(() => import('../pages/public/BlogPage'));
const BlogPostPage = lazy(() => import('../pages/public/BlogPostPage'));
const PricingPage = lazy(() => import('../pages/public/PricingPage'));
const FeaturesPage = lazy(() => import('../pages/public/FeaturesPage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const ContactPage = lazy(() => import('../pages/public/ContactPage'));
const FaqPage = lazy(() => import('../pages/public/FaqPage'));
const TermsPage = lazy(() => import('../pages/public/TermsPage'));
const ChangelogPage = lazy(() => import('../pages/public/ChangelogPage'));
const AccessDeniedPage = lazy(() => import('../pages/AccessDeniedPage').then((m) => ({ default: m.AccessDeniedPage })));
const TenantInactivePage = lazy(() => import('../pages/TenantInactivePage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));

// STAFF
const StaffDetailPage = lazy(() => import('../pages/staff/StaffDetailPage').then((m) => ({ default: m.StaffDetailPage })));
const StaffListPage = lazy(() => import('../pages/staff/StaffListPage').then((m) => ({ default: m.StaffListPage })));
const StaffProfilePage = lazy(() => import('../pages/staff/StaffProfilePage').then((m) => ({ default: m.StaffProfilePage })));
const StaffPermissionsPage = lazy(() => import('../pages/staff/StaffPermissionsPage').then((m) => ({ default: m.StaffPermissionsPage })));

// DEPARTMENTS
const DepartmentsPage = lazy(() => import('../pages/departments/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const DepartmentFormPage = lazy(() => import('../pages/departments/DepartmentFormPage').then((m) => ({ default: m.DepartmentFormPage })));

// SALES
const SalesPage = lazy(() => import('../pages/sales/SalesPage').then((m) => ({ default: m.SalesPage })));
const SalesAnalyticsPage = lazy(() => import('../pages/sales/SalesAnalyticsPageV2').then((m) => ({ default: m.SalesAnalyticsPage })));
const SalesChannelsPage = lazy(() => import('../pages/sales/SalesChannelsPage').then((m) => ({ default: m.SalesChannelsPage })));
const SalesPaymentsPage = lazy(() => import('../pages/sales/SalesPaymentsPage').then((m) => ({ default: m.SalesPaymentsPage })));
const SalesIntegrationsPage = lazy(() => import('../pages/sales/SalesIntegrationsPage').then((m) => ({ default: m.SalesIntegrationsPage })));
const SalesImportPage = lazy(() => import('../pages/sales/SalesImportPage').then((m) => ({ default: m.SalesImportPage })));
const SalesIntegrationNewPage = lazy(() => import('../pages/sales/SalesIntegrationNewPage').then((m) => ({ default: m.SalesIntegrationNewPage })));
const SaleDetailsPage = lazy(() => import('../pages/sales/SaleDetailsPage').then((m) => ({ default: m.SaleDetailsPage })));

// SETTINGS
const SettingsCompanyPage = lazy(() => import('../pages/settings/SettingsCompanyPage').then((m) => ({ default: m.SettingsCompanyPage })));
const SettingsApiPage = lazy(() => import('../pages/settings/SettingsApiPage').then((m) => ({ default: m.SettingsApiPage })));

// PROFILE / ACCOUNT
const AccountCenterLayout = lazy(() => import('../pages/account/AccountCenterLayout').then((m) => ({ default: m.AccountCenterLayout })));
const AccountOverviewTab = lazy(() => import('../pages/account/tabs/AccountOverviewTab').then((m) => ({ default: m.AccountOverviewTab })));
const AccountPersonalTab = lazy(() => import('../pages/account/tabs/AccountPersonalTab').then((m) => ({ default: m.AccountPersonalTab })));
const AccountSecurityTab = lazy(() => import('../pages/account/tabs/AccountSecurityTab').then((m) => ({ default: m.AccountSecurityTab })));
const AccountPreferencesTab = lazy(() => import('../pages/account/tabs/AccountPreferencesTab').then((m) => ({ default: m.AccountPreferencesTab })));

// Лиды
const LeadsBoardPage = lazy(() => import('../pages/leads/LeadsBoardPage').then((m) => ({ default: m.LeadsBoardPage })));
const LeadsListPage = lazy(() => import('../pages/leads/LeadsListPage').then((m) => ({ default: m.LeadsListPage })));
const LeadsCalendarPage = lazy(() => import('../pages/leads/LeadsCalendarPage').then((m) => ({ default: m.LeadsCalendarPage })));
const LeadAccessSettingsPage = lazy(() => import('../pages/leads/LeadAccessSettingsPage').then((m) => ({ default: m.LeadAccessSettingsPage })));
const LeadFormPage = lazy(() => import('../pages/leads/LeadFormPage').then((m) => ({ default: m.LeadFormPage })));
const LeadsAnalyticsPage = lazy(() => import('../pages/analytics/LeadsAnalyticsPageV2').then((m) => ({ default: m.LeadsAnalyticsPage })));
const LeadsRoiPage = lazy(() => import('../pages/analytics/LeadsRoiPage').then((m) => ({ default: m.LeadsRoiPage })));
const CompaniesAnalyticsPage = lazy(() => import('../pages/analytics/CompaniesAnalyticsPage').then((m) => ({ default: m.CompaniesAnalyticsPage })));
const LostLeadsPage = lazy(() => import('../pages/leads/LostLeadsPage').then((m) => ({ default: m.LostLeadsPage })));
const LeadsArchivePage = lazy(() => import('../pages/leads/LeadsArchivePage').then((m) => ({ default: m.LeadsArchivePage })));
const LeadsTrashPage = lazy(() => import('../pages/leads/LeadsTrashPage').then((m) => ({ default: m.LeadsTrashPage })));

// Проекты
const ProjectsListPage = lazy(() => import('../pages/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const ProjectsBoardPage = lazy(() => import('../pages/projects/ProjectsBoardPage').then((m) => ({ default: m.ProjectsBoardPage })));
const ProjectsArchivePage = lazy(() => import('../pages/projects/ProjectsArchivePage').then((m) => ({ default: m.ProjectsArchivePage })));
const ProjectsTrashPage = lazy(() => import('../pages/projects/ProjectsTrashPage').then((m) => ({ default: m.ProjectsTrashPage })));
const ProjectFormPage = lazy(() => import('../pages/projects/ProjectFormPage').then((m) => ({ default: m.ProjectFormPage })));
const ClosedProjectsPage = lazy(() => import('../pages/projects/ClosedProjectsPage').then((m) => ({ default: m.ClosedProjectsPage })));
const InProgressProjectsPage = lazy(() => import('../pages/projects/InProgressProjectsPage').then((m) => ({ default: m.InProgressProjectsPage })));
const ProjectTasksPage = lazy(() => import('../pages/projects/ProjectTasksPage').then((m) => ({ default: m.ProjectTasksPage })));
const OverdueTasksPage = lazy(() => import('../pages/projects/OverdueTasksPage').then((m) => ({ default: m.OverdueTasksPage })));
const ProjectsAnalyticsPage = lazy(() => import('../pages/projects/ProjectsAnalyticsPage').then((m) => ({ default: m.ProjectsAnalyticsPage })));
const ProjectsCalendarPage = lazy(() => import('../pages/projects/ProjectsCalendarPage').then((m) => ({ default: m.ProjectsCalendarPage })));

// CCP
const ClientAccountsPage = lazy(() => import('../pages/client-accounts/ClientAccountsPage'));
const ClientAccountDetailsPage = lazy(() => import('../pages/client-accounts/ClientAccountDetailsPage'));
const ClientAccountAnalyticsPage = lazy(() => import('../pages/client-accounts/ClientAccountAnalyticsPage'));
const ClientAccountSitesPage = lazy(() => import('../pages/client-accounts/ClientAccountSitesPage'));
const ClientFinancialOperationsPage = lazy(() => import('../pages/client-accounts/ClientFinancialOperationsPage'));

// MARKETING
const TrafficPage = lazy(() => import('../pages/marketing/TrafficPage').then((m) => ({ default: m.TrafficPage })));
const CampaignsPage = lazy(() => import('../pages/marketing/CampaignsPage').then((m) => ({ default: m.CampaignsPage })));
const RoiPage = lazy(() => import('../pages/marketing/RoiPage').then((m) => ({ default: m.RoiPage })));
const BroadcastsPage = lazy(() => import('../pages/marketing/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })));
const BroadcastFormPage = lazy(() => import('../pages/marketing/BroadcastFormPage').then((m) => ({ default: m.BroadcastFormPage })));
const UtmsPage = lazy(() => import('../pages/marketing/UtmsPage').then((m) => ({ default: m.UtmsPage })));
const UtmLinksPage = lazy(() => import('../pages/marketing/UtmLinksPage').then((m) => ({ default: m.UtmLinksPage })));
const SegmentsPage = lazy(() => import('../pages/marketing/SegmentsPage').then((m) => ({ default: m.SegmentsPage })));
const SmmPage = lazy(() => import('../pages/marketing/SmmPage').then((m) => ({ default: m.SmmPage })));
const ChannelsPage = lazy(() => import('../pages/marketing/ChannelsPage').then((m) => ({ default: m.ChannelsPage })));
const SeoPage = lazy(() => import('../pages/marketing/SeoPage').then((m) => ({ default: m.SeoPage })));
const ReviewsPage = lazy(() => import('../pages/marketing/ReviewsPage').then((m) => ({ default: m.ReviewsPage })));
const EmailTemplatesPage = lazy(() => import('../pages/marketing/EmailTemplatesPage').then((m) => ({ default: m.EmailTemplatesPage })));
const EmailTemplateFormPage = lazy(() => import('../pages/marketing/EmailTemplateFormPage').then((m) => ({ default: m.EmailTemplateFormPage })));
import  OnlineChatPage  from '../pages/online-chat/OnlineChatPage'; // или default export
import { LumivaSupportChat } from '../components/support/LumivaSupportChat';
import { getAccessToken, isBillingLocked } from '../auth/session';
const SetPasswordPage = lazy(() => import('../pages/SetPasswordPage'));
const OnboardingWizardPage = lazy(() => import('../pages/onboarding/OnboardingWizardPage').then((m) => ({ default: m.OnboardingWizardPage })));
import { fetchOnboardingState } from '../api/onboarding';
const TeamCalendarPage = lazy(() => import('../pages/calendar/TeamCalendarPage').then((m) => ({ default: m.TeamCalendarPage })));
const PortalLoginPage = lazy(() => import('../pages/portal/PortalLoginPage').then((m) => ({ default: m.PortalLoginPage })));
const PortalVerifyPage = lazy(() => import('../pages/portal/PortalVerifyPage').then((m) => ({ default: m.PortalVerifyPage })));
const PortalDashboardPage = lazy(() => import('../pages/portal/PortalDashboardPage').then((m) => ({ default: m.PortalDashboardPage })));
const PortalProtectedRoute = lazy(() => import('../pages/portal/PortalProtectedRoute').then((m) => ({ default: m.PortalProtectedRoute })));
const PortalTicketsPage = lazy(() => import('../pages/portal/PortalTicketsPage').then((m) => ({ default: m.PortalTicketsPage })));
const PortalTicketDetailPage = lazy(() => import('../pages/portal/PortalTicketDetailPage').then((m) => ({ default: m.PortalTicketDetailPage })));
const HelpdeskPage = lazy(() => import('../pages/helpdesk/HelpdeskPage').then((m) => ({ default: m.HelpdeskPage })));
const EsignPage = lazy(() => import('../pages/esign/EsignPage').then((m) => ({ default: m.EsignPage })));
const EsignPublicPage = lazy(() => import('../pages/esign/EsignPublicPage').then((m) => ({ default: m.EsignPublicPage })));

// NEW MODULES
const ContactsListPage = lazy(() => import('../pages/contacts/ContactsListPage').then((m) => ({ default: m.ContactsListPage })));
const ContactCardPage = lazy(() => import('../pages/contacts/ContactPage').then((m) => ({ default: m.ContactPage })));
const CompaniesListPage = lazy(() => import('../pages/companies/CompaniesListPage').then((m) => ({ default: m.CompaniesListPage })));
const CompanyPage = lazy(() => import('../pages/companies/CompanyPage').then((m) => ({ default: m.CompanyPage })));
const ProductsListPage = lazy(() => import('../pages/products/ProductsListPage').then((m) => ({ default: m.ProductsListPage })));
const ProductFormPage = lazy(() => import('../pages/products/ProductFormPage').then((m) => ({ default: m.ProductFormPage })));
const ProductDetailPage = lazy(() => import('../pages/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const ProductAttributesPage = lazy(() => import('../pages/products/ProductAttributesPage').then((m) => ({ default: m.ProductAttributesPage })));
const ProductCategoriesPage = lazy(() => import('../pages/products/ProductCategoriesPage').then((m) => ({ default: m.ProductCategoriesPage })));
const ProductFieldTypesPage = lazy(() => import('../pages/products/ProductFieldTypesPage').then((m) => ({ default: m.ProductFieldTypesPage })));
const ProductStockPage = lazy(() => import('../pages/products/ProductStockPage').then((m) => ({ default: m.ProductStockPage })));
const ProductLocationsPage = lazy(() => import('../pages/products/ProductLocationsPage').then((m) => ({ default: m.ProductLocationsPage })));
const ProductFeedsPage = lazy(() => import('../pages/products/ProductFeedsPage').then((m) => ({ default: m.ProductFeedsPage })));
const ProductWebhooksPage = lazy(() => import('../pages/products/ProductWebhooksPage').then((m) => ({ default: m.ProductWebhooksPage })));
const ProductModerationQueuePage = lazy(() => import('../pages/products/ProductModerationQueuePage').then((m) => ({ default: m.ProductModerationQueuePage })));
const ProductsAnalyticsPage = lazy(() => import('../pages/products/ProductsAnalyticsPage').then((m) => ({ default: m.ProductsAnalyticsPage })));
const ProductImportPage = lazy(() => import('../pages/products/ProductImportPage').then((m) => ({ default: m.ProductImportPage })));
const ProductLabelsPrintPage = lazy(() => import('../pages/products/ProductLabelsPrintPage').then((m) => ({ default: m.ProductLabelsPrintPage })));
const BookingOverviewPage = lazy(() => import('../pages/bookings/BookingOverviewPage').then((m) => ({ default: m.BookingOverviewPage })));
const ReservationsPage = lazy(() => import('../pages/bookings/ReservationsPage').then((m) => ({ default: m.ReservationsPage })));
const ReservationDetailPage = lazy(() => import('../pages/bookings/ReservationDetailPage').then((m) => ({ default: m.ReservationDetailPage })));
const ReservationsImportPage = lazy(() => import('../pages/bookings/ReservationsImportPage').then((m) => ({ default: m.ReservationsImportPage })));
const BookingLocationsPage = lazy(() => import('../pages/bookings/BookingLocationsPage').then((m) => ({ default: m.BookingLocationsPage })));
const BookingServicesPage = lazy(() => import('../pages/bookings/BookingServicesPage').then((m) => ({ default: m.BookingServicesPage })));
const BookingResourcesPage = lazy(() => import('../pages/bookings/BookingResourcesPage').then((m) => ({ default: m.BookingResourcesPage })));
const BookingAvailabilityPage = lazy(() => import('../pages/bookings/BookingAvailabilityPage').then((m) => ({ default: m.BookingAvailabilityPage })));
const BookingSettingsPage = lazy(() => import('../pages/bookings/BookingSettingsPage').then((m) => ({ default: m.BookingSettingsPage })));
const BookingWaitlistPage = lazy(() => import('../pages/bookings/BookingWaitlistPage').then((m) => ({ default: m.BookingWaitlistPage })));
const BookingAnalyticsPage = lazy(() => import('../pages/bookings/BookingAnalyticsPage').then((m) => ({ default: m.BookingAnalyticsPage })));
const BookingLogsPage = lazy(() => import('../pages/bookings/BookingLogsPage').then((m) => ({ default: m.BookingLogsPage })));
const HotelsOverviewPage = lazy(() => import('../pages/hotels/HotelsOverviewPage').then((m) => ({ default: m.HotelsOverviewPage })));
const HotelsListPage = lazy(() => import('../pages/hotels/HotelsListPage').then((m) => ({ default: m.HotelsListPage })));
const HotelDetailPage = lazy(() => import('../pages/hotels/HotelDetailPage').then((m) => ({ default: m.HotelDetailPage })));
const HotelReservationsPage = lazy(() => import('../pages/hotels/HotelReservationsPage').then((m) => ({ default: m.HotelReservationsPage })));
const HotelFrontDeskPage = lazy(() => import('../pages/hotels/HotelFrontDeskPage').then((m) => ({ default: m.HotelFrontDeskPage })));
const HotelPricingPage = lazy(() => import('../pages/hotels/HotelPricingPage').then((m) => ({ default: m.HotelPricingPage })));
const HotelCalendarPage = lazy(() => import('../pages/hotels/HotelCalendarPage').then((m) => ({ default: m.HotelCalendarPage })));
const HotelRoomPricingPage = lazy(() => import('../pages/hotels/HotelRoomPricingPage').then((m) => ({ default: m.HotelRoomPricingPage })));
const HotelAnalyticsPage = lazy(() => import('../pages/hotels/HotelAnalyticsPage').then((m) => ({ default: m.HotelAnalyticsPage })));
const AutomationsPageNew = lazy(() => import('../pages/automations/AutomationsPage').then((m) => ({ default: m.AutomationsPage })));
const IntegrationsHubPage = lazy(() => import('../pages/integrations/IntegrationsHubPage').then((m) => ({ default: m.IntegrationsHubPage })));
const AutomationFormPage = lazy(() => import('../pages/automations/AutomationFormPage').then((m) => ({ default: m.AutomationFormPage })));
const PendingApprovalsPage = lazy(() => import('../pages/automations/PendingApprovalsPage').then((m) => ({ default: m.PendingApprovalsPage })));
const EmailAccountsPage = lazy(() => import('../pages/email/EmailAccountsPage').then((m) => ({ default: m.EmailAccountsPage })));
const EmailAccountFormPage = lazy(() => import('../pages/email/EmailAccountFormPage').then((m) => ({ default: m.EmailAccountFormPage })));
const EmailInboxPage = lazy(() => import('../pages/email/EmailInboxPage').then((m) => ({ default: m.EmailInboxPage })));
const TelegramPage = lazy(() => import('../pages/telegram/TelegramPage').then((m) => ({ default: m.TelegramPage })));
const TelegramInboxPage = lazy(() => import('../pages/telegram-crm/TelegramInboxPage'));
const WhatsappInboxPage = lazy(() => import('../pages/whatsapp-crm/WhatsappInboxPage'));
const TelephonyPage = lazy(() => import('../pages/telephony/TelephonyPage').then((m) => ({ default: m.TelephonyPage })));
const TelephonySmsPage = lazy(() => import('../pages/telephony/TelephonySmsPage').then((m) => ({ default: m.TelephonySmsPage })));
const TelephonyAnalyticsPage = lazy(() => import('../pages/telephony/TelephonyAnalyticsPage').then((m) => ({ default: m.TelephonyAnalyticsPage })));
const TelephonySettingsPage = lazy(() => import('../pages/telephony/TelephonySettingsPage').then((m) => ({ default: m.TelephonySettingsPage })));
const DuplicatesPage = lazy(() => import('../pages/deduplication/DuplicatesPage').then((m) => ({ default: m.DuplicatesPage })));
const AuditLogPage = lazy(() => import('../pages/settings/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const ExportBackupPage = lazy(() => import('../pages/settings/ExportBackupPage').then((m) => ({ default: m.ExportBackupPage })));
const ApiTokensPage = lazy(() => import('../pages/settings/ApiTokensPage').then((m) => ({ default: m.ApiTokensPage })));
const WorkspaceTablesPage = lazy(() => import('../pages/workspace/WorkspaceTablesPage').then((m) => ({ default: m.WorkspaceTablesPage })));
const WorkspaceNewTablePage = lazy(() => import('../pages/workspace/WorkspaceNewTablePage').then((m) => ({ default: m.WorkspaceNewTablePage })));
const WorkspaceTableViewPage = lazy(() => import('../pages/workspace/WorkspaceTableViewPage').then((m) => ({ default: m.WorkspaceTableViewPage })));
const WorkspaceKanbanViewPage = lazy(() => import('../pages/workspace/WorkspaceKanbanViewPage').then((m) => ({ default: m.WorkspaceKanbanViewPage })));
const WorkspaceCalendarViewPage = lazy(() => import('../pages/workspace/WorkspaceCalendarViewPage').then((m) => ({ default: m.WorkspaceCalendarViewPage })));
const WorkspaceAnalyticsPage = lazy(() => import('../pages/workspace/WorkspaceAnalyticsPage').then((m) => ({ default: m.WorkspaceAnalyticsPage })));
const PublicWorkspaceAnalyticsPage = lazy(() => import('../pages/workspace/PublicWorkspaceAnalyticsPage').then((m) => ({ default: m.PublicWorkspaceAnalyticsPage })));
const WorkspaceSettingsPage = lazy(() => import('../pages/workspace/WorkspaceSettingsPage').then((m) => ({ default: m.WorkspaceSettingsPage })));
const WorkspaceImportPage = lazy(() => import('../pages/workspace/WorkspaceImportPage').then((m) => ({ default: m.WorkspaceImportPage })));
const WorkspaceAreaHomePage = lazy(() => import('../pages/workspace/WorkspaceAreaHomePage').then((m) => ({ default: m.WorkspaceAreaHomePage })));
const WorkspaceAreasListPage = lazy(() => import('../pages/workspace/WorkspaceAreasListPage').then((m) => ({ default: m.WorkspaceAreasListPage })));
const WorkspaceAreaSettingsPage = lazy(() => import('../pages/workspace/WorkspaceAreaSettingsPage').then((m) => ({ default: m.WorkspaceAreaSettingsPage })));
const WorkspaceGanttViewPage = lazy(() => import('../pages/workspace/WorkspaceGanttViewPage').then((m) => ({ default: m.WorkspaceGanttViewPage })));
const WebFormsListPage = lazy(() => import('../pages/web-forms/WebFormsListPage').then((m) => ({ default: m.WebFormsListPage })));
const WebFormEditorPage = lazy(() => import('../pages/web-forms/WebFormEditorPage').then((m) => ({ default: m.WebFormEditorPage })));
const WebFormsSettingsPage = lazy(() => import('../pages/web-forms/WebFormsSettingsPage').then((m) => ({ default: m.WebFormsSettingsPage })));
const PublicEmbedFormPage = lazy(() => import('../pages/public-embed/PublicEmbedFormPage').then((m) => ({ default: m.PublicEmbedFormPage })));
const AiEmployeeProfilePage = lazy(() => import('../pages/ai-employees/AiEmployeesPage').then((m) => ({ default: m.AiEmployeeProfilePage })));
const AiEmployeesPage = lazy(() => import('../pages/ai-employees/AiEmployeesPage').then((m) => ({ default: m.AiEmployeesPage })));

// Routes where the onboarding overlay must not appear on top of the page (billing/error pages
// the user may be sent to regardless of onboarding state).
const ONBOARDING_EXEMPT_PATHS = new Set([
  '/app/billing',
  '/billing',
  '/forbidden',
  '/tenant-inactive',
]);

// Fetched once per page load (not per navigation) and cached at module scope.
let onboardingCheckPromise: Promise<boolean> | null = null;
function needsOnboardingOnce(): Promise<boolean> {
  if (!onboardingCheckPromise) {
    onboardingCheckPromise = fetchOnboardingState()
      .then((s) => !s.onboardingCompletedAt)
      // Fail open — a broken/slow check must never trap a user outside the app.
      .catch(() => false);
  }
  return onboardingCheckPromise;
}

// Called once the wizard reports done (finished or skipped) so any later ProtectedRoute mount
// (client-side navigation to another route) doesn't show the overlay again this page load.
function markOnboardingComplete() {
  onboardingCheckPromise = Promise.resolve(false);
}

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const token = getAccessToken();
  const location = useLocation();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    needsOnboardingOnce().then((v) => {
      if (alive) setNeedsOnboarding(v);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const showOnboarding =
    needsOnboarding &&
    !ONBOARDING_EXEMPT_PATHS.has(location.pathname) &&
    !isBillingLocked();

  return (
    <>
      {children}
      {showOnboarding && (
        <OnboardingWizardPage
          onComplete={() => {
            markOnboardingComplete();
            setNeedsOnboarding(false);
          }}
        />
      )}
    </>
  );
};

// Отдельного канбана «задач компании» больше нет: все задачи живут в проектах/лидах, а вкладка
// «Задачи» карточки компании их агрегирует. Старые ссылки ведут на эту вкладку.
const CompanyTasksRedirect: React.FC = () => {
  const { companyId } = useParams();
  return <Navigate to={`/companies/${companyId}?tab=tasks`} replace />;
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

/** Пока догружается код страницы (страницы грузятся лениво — отдельными файлами). */
const RouteLoadingFallback: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-400">…</div>
);

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <LumivaSupportChat />
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Публичный лендинг CRM на корне */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/development" element={<DevelopmentPage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/api-integration" element={<ApiPage />} />
        <Route path="/api-integration/docs" element={<ApiDocsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/pay/result" element={<PaymentResultPage />} />
        <Route path="/solutions" element={<SolutionsPage />} />
        <Route path="/solutions/analytics" element={<AnalyticsPage />} />
        <Route path="/solutions/marketing" element={<MarketingPage />} />
        <Route path="/solutions/sales" element={<SalesSolutionsPage />} />
        <Route path="/solutions/warehouse" element={<WarehouseSolutionsPage />} />
        <Route path="/solutions/client-accounts" element={<ClientAccountsSolutionsPage />} />
        <Route path="/solutions/products" element={<ProductsSolutionsPage />} />
        <Route path="/solutions/inventory" element={<Navigate to="/solutions/products" replace />} />
        <Route path="/solutions/booking" element={<BookingSolutionsPage />} />
        <Route path="/solutions/hotels" element={<HotelSolutionsPage />} />
        <Route path="/analytics" element={<Navigate to="/solutions/analytics" replace />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/privacy"   element={<PrivacyPage />} />
        <Route path="/security"  element={<SecurityPage />} />
        <Route path="/compare"   element={<ComparePage />} />
        <Route path="/blog"      element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
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

        {/* Личный кабинет клиента (self-service portal) — отдельная от staff-логина авторизация */}
        <Route path="/portal/:clientKey/login" element={<PortalLoginPage />} />
        <Route path="/portal/:clientKey/verify" element={<PortalVerifyPage />} />
        <Route
          path="/portal/:clientKey/dashboard"
          element={
            <PortalProtectedRoute>
              <PortalDashboardPage />
            </PortalProtectedRoute>
          }
        />
        <Route
          path="/portal/:clientKey/tickets"
          element={
            <PortalProtectedRoute>
              <PortalTicketsPage />
            </PortalProtectedRoute>
          }
        />
        <Route
          path="/portal/:clientKey/tickets/:ticketId"
          element={
            <PortalProtectedRoute>
              <PortalTicketDetailPage />
            </PortalProtectedRoute>
          }
        />

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

        {/* Больше не отдельная страница — визард теперь оверлей поверх CRM (см. ProtectedRoute). */}
        <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <TeamCalendarPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/helpdesk"
          element={
            <ProtectedRoute>
              <HelpdeskPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/esign"
          element={
            <ProtectedRoute>
              <EsignPage />
            </ProtectedRoute>
          }
        />
        <Route path="/esign/:token" element={<EsignPublicPage />} />

        <Route
          path="/bi"
          element={
            <ProtectedRoute>
              <BiDashboardPage />
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
          path="/leads/access"
          element={
            <ProtectedRoute>
              <LeadAccessSettingsPage />
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
          path="/sales/payments"
          element={
            <ProtectedRoute>
              <SalesPaymentsPage />
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
          path="/marketing/roi"
          element={
            <ProtectedRoute>
              <RoiPage />
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
          path="/marketing/broadcasts"
          element={
            <ProtectedRoute>
              <BroadcastsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketing/broadcasts/:id"
          element={
            <ProtectedRoute>
              <BroadcastFormPage />
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
          path="/marketing/utm-links"
          element={
            <ProtectedRoute>
              <UtmLinksPage />
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
          path="/marketing/reviews"
          element={
            <ProtectedRoute>
              <ReviewsPage />
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
              <ContactCardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:id"
          element={
            <ProtectedRoute>
              <ContactCardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:id/edit"
          element={
            <ProtectedRoute>
              <ContactCardPage />
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
              <CompanyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id"
          element={
            <ProtectedRoute>
              <CompanyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id/edit"
          element={
            <ProtectedRoute>
              <CompanyPage />
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
              <CompanyTasksRedirect />
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
          path="/hotels/frontdesk"
          element={
            <ProtectedRoute>
              <HotelFrontDeskPage />
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
          path="/automations/pending-approvals"
          element={
            <ProtectedRoute>
              <PendingApprovalsPage />
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
          path="/ai-employees/knowledge"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="knowledge" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-employees/insights"
          element={
            <ProtectedRoute>
              <AiEmployeesPage view="insights" />
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
        <Route
          path="/web-forms/settings"
          element={
            <ProtectedRoute>
              <WebFormsSettingsPage />
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
              <TelegramPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telegram/inbox"
          element={
            <ProtectedRoute>
              <TelegramInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp/inbox"
          element={
            <ProtectedRoute>
              <WhatsappInboxPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telephony"
          element={
            <ProtectedRoute>
              <TelephonyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telephony/sms"
          element={
            <ProtectedRoute>
              <TelephonySmsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telephony/analytics"
          element={
            <ProtectedRoute>
              <TelephonyAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/telephony/settings"
          element={
            <ProtectedRoute>
              <TelephonySettingsPage />
            </ProtectedRoute>
          }
        />

        {/* SMS and Telephony merged into one "SMS и телефония" section 2026-08-04 — old URLs redirect */}
        <Route path="/sms" element={<Navigate to="/telephony/sms" replace />} />
        <Route path="/sms/settings" element={<Navigate to="/telephony/settings" replace />} />
        <Route
          path="/contacts/duplicates"
          element={
            <ProtectedRoute>
              <DuplicatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/audit-log"
          element={
            <ProtectedRoute>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/export"
          element={
            <ProtectedRoute>
              <ExportBackupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/api-tokens"
          element={
            <ProtectedRoute>
              <ApiTokensPage />
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
          path="/workspace/areas"
          element={
            <ProtectedRoute>
              <WorkspaceAreasListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/areas/:areaId"
          element={
            <ProtectedRoute>
              <WorkspaceAreaHomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/areas/:areaId/settings"
          element={
            <ProtectedRoute>
              <WorkspaceAreaSettingsPage />
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
        {/* Публичная ссылка «только аналитика» — без авторизации и без меню CRM */}
        <Route path="/workspace/:clientKey/:objectId/analytics" element={<PublicWorkspaceAnalyticsPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
};
