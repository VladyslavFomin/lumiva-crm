// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { RedisThrottlerStorage } from './common/redis-throttler.storage';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

// --- Модули ---
import { SitesModule } from './sites/sites.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { ContactsModule } from './contacts/contacts.module';
import { CompaniesModule } from './companies/companies.module';
import { NotesModule } from './notes/notes.module';
import { EmailModule } from './email/email.module';
import { TelegramCrmModule } from './telegram-crm/telegram-crm.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { AutomationsModule } from './automations/automations.module';
import { ProjectsModule } from './projects/projects.module';
import { StaffUsersModule } from './staff/staff-users.module';
import { DepartmentsModule } from './departments/departments.module';
import { RbacModule } from './rbac/rbac.module';
import { SalesModule } from './sales/sales.module';
import { SalesChannelsModule } from './sales-channels/sales-channels.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WhatsappWebhookModule } from './integrations/whatsapp/whatsapp-webhook.module';
import { WhatsappCrmModule } from './whatsapp-crm/whatsapp-crm.module';
import { TelephonyModule } from './telephony/telephony.module';
import { AmocrmInboundWebhookModule } from './integrations/amocrm/amocrm-inbound-webhook.module';
import { WordpressCf7InboundWebhookModule } from './integrations/wordpress-cf7/wordpress-cf7-inbound-webhook.module';
import { ZapierMakeInboundModule } from './integrations/zapier-make/zapier-make-inbound.module';
import { SlackInboundModule } from './integrations/slack/slack-inbound.module';
import { SapInboundModule } from './integrations/sap/sap-inbound.module';
import { JiraInboundModule } from './integrations/jira/jira-inbound.module';
import { ShopifyInboundModule } from './integrations/shopify/shopify-inbound.module';
import { WooCommerceInboundModule } from './integrations/woocommerce/woocommerce-inbound.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { MarketingModule } from './marketing/marketing.module';
import { MarketingBroadcastsModule } from './marketing-broadcasts/marketing-broadcasts.module';
import { SmmModule } from './smm/smm.module';
import { CustomObjectsModule } from './custom-objects/custom-objects.module';
import { WorkspaceAreasModule } from './workspace-areas/workspace-areas.module';
import { ProductsModule } from './products/products.module';
import { BookingsModule } from './bookings/bookings.module';
import { HotelsModule } from './hotels/hotels.module';
import { PublicModule } from './public/public.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { DemoRequestsModule } from './demo-requests/demo-requests.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { TelegramModule } from './telegram/telegram.module';
import { BillingModule } from './billing/billing.module';
import { AiModule } from './ai/ai.module';
import { AiEmployeesModule } from './ai-employees/ai-employees.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BiDashboardModule } from './bi-dashboard/bi-dashboard.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CalendarModule } from './calendar/calendar.module';
import { ExportModule } from './export/export.module';
import { PortalModule } from './portal/portal.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
import { EsignModule } from './esign/esign.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SmsModule } from './sms/sms.module';
import { DeduplicationModule } from './deduplication/deduplication.module';

// --- CCP
import { CcpModule } from './modules/ccp/ccp.module';
import { EmbedFormsModule } from './embed-forms/embed-forms.module';

// --- Chat ---
import { OnlineChatModule } from './online-chat/online-chat.module';
import { ChatSession } from './online-chat/chat-session.entity';
import { ChatMessage } from './online-chat/chat-message.entity';

// --- Entities (основные) ---
import { Tenant } from './tenants/tenant.entity';
import { User } from './users/user.entity';
import { Site } from './sites/site.entity';
import { Lead } from './leads/lead.entity';
import { LeadActivity } from './leads/lead-activity.entity';
import { Contact } from './contacts/contact.entity';
import { Company } from './companies/company.entity';
import { CompanyTask } from './companies/company-task.entity';
import { Note } from './notes/note.entity';
import { EmailAccount } from './email/email-account.entity';
import { EmailMessage } from './email/email-message.entity';
import { EmailTemplate } from './email/email-template.entity';
import { TelegramBot } from './telegram-crm/telegram-bot.entity';
import { TelegramContact } from './telegram-crm/telegram-contact.entity';
import { TelegramMessage } from './telegram-crm/telegram-message.entity';
import { CustomField } from './custom-fields/custom-field.entity';
import { Automation } from './automations/automation.entity';
import { AutomationExecution } from './automations/automation-execution.entity';
import { Project } from './projects/project.entity';
import { StaffUser } from './staff/staff-user.entity';
import { Department } from './departments/department.entity';
import { StaffRolePermission } from './rbac/staff-role-permission.entity';
import { Sale } from './sales/sale.entity';
import { SalesChannel } from './sales-channels/sales-channel.entity';
import { IntegrationConnection } from './integrations/integration-connection.entity';
import { IntegrationGoogleSheetSyncState } from './integrations/google-sheets/integration-google-sheet-sync-state.entity';
import { IntegrationGoogleSheetSyncJob } from './integrations/google-sheets/integration-google-sheet-sync-job.entity';
import { ApiToken } from './api-tokens/api-token.entity';
import { TenantLog } from './tenants/tenant-log.entity';
import { CustomObject } from './custom-objects/custom-object.entity';
import { CustomObjectField } from './custom-objects/custom-object-field.entity';
import { CustomObjectRecord } from './custom-objects/custom-object-record.entity';
import { CustomObjectView } from './custom-objects/custom-object-view.entity';
import { CustomObjectImportSession } from './custom-objects/custom-object-import-session.entity';
import { WorkspaceArea } from './workspace-areas/workspace-area.entity';

// --- Entities маркетинга ---
import { MarketingTraffic } from './marketing/marketing-traffic.entity';
import { MarketingSegment } from './marketing/marketing-segment.entity';
import { MarketingUtmTemplate } from './marketing/marketing-utm-template.entity';
import { MarketingIntegration } from './marketing/marketing-integration.entity';
import { MarketingAutomation } from './marketing/marketing-automation.entity';
import { MarketingCost } from './marketing/marketing-cost.entity';
import { SeoSettings } from './marketing/seo-settings.entity';
import { SeoGscMetric } from './marketing/seo-gsc-metric.entity';
import { SeoPageSpeedMetric } from './marketing/seo-pagespeed-metric.entity';
import { SeoGscDaily } from './marketing/seo-gsc-daily.entity';

// SMM
import { SmmProfile } from './smm/smm-profile.entity';
import { SmmProfileStat } from './smm/smm-profile-stat.entity';
import { SmmIntegration } from './smm/smm-integration.entity';

// Platform admin
import { PlatformAdminUser } from './platform-admin/admin-user.entity';
import { MailModule } from './mail/mail.module';
import { DemoRequest } from './demo-requests/demo-request.entity';
import { PlatformSettings } from './platform-settings/platform-settings.entity';
import { UserSession } from './auth/user-session.entity';
import { TenantStorageFile } from './tenants/tenant-storage-file.entity';
import { EmbedForm } from './embed-forms/embed-form.entity';
import { EmbedFormUpload } from './embed-forms/embed-form-upload.entity';
import { AiUsageLog } from './ai/ai-usage-log.entity';
import { AiMemoryChunk } from './ai/ai-memory-chunk.entity';
import { AiChatSession } from './ai/ai-chat-session.entity';
import { AiChatMessage } from './ai/ai-chat-message.entity';
import { AiAgent } from './ai-employees/ai-agent.entity';
import { AiAgentPermission } from './ai-employees/ai-agent-permission.entity';
import { AiAgentApprovalRule } from './ai-employees/ai-agent-approval-rule.entity';
import { AiAgentAction } from './ai-employees/ai-agent-action.entity';
import { AiAgentLog } from './ai-employees/ai-agent-log.entity';
import { AiAgentReport } from './ai-employees/ai-agent-report.entity';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

    ...(process.env.REDIS_URL
      ? [BullModule.forRoot({ connection: new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null }) })]
      : []),

    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 20 },
        { name: 'medium', ttl: 10000, limit: 100 },
        { name: 'long', ttl: 60000, limit: 400 },
      ],
      storage: new RedisThrottlerStorage(),
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,

      // ✅ ВАЖНО: подхватит entity из TypeOrmModule.forFeature() во всех модулях (включая CCP)
      autoLoadEntities: true,

      entities: [
        Tenant,
        User,
        Site,
        Lead,
        LeadActivity,
        Contact,
        Company,
        CompanyTask,
        Note,
        EmailAccount,
        EmailMessage,
        EmailTemplate,
        TelegramBot,
        TelegramContact,
        TelegramMessage,
        CustomField,
        Automation,
        AutomationExecution,
        Project,
        StaffUser,
        Department,
        StaffRolePermission,
        Sale,
        SalesChannel,
        IntegrationConnection,
        IntegrationGoogleSheetSyncState,
        IntegrationGoogleSheetSyncJob,
        ApiToken,
        TenantLog,
        CustomObject,
        CustomObjectField,
        CustomObjectRecord,
        CustomObjectView,
        CustomObjectImportSession,
        WorkspaceArea,
        SmmProfile,
        SmmProfileStat,
        SmmIntegration,

        // маркетинг
        MarketingTraffic,
        MarketingSegment,
        MarketingUtmTemplate,
        MarketingIntegration,
        MarketingAutomation,
        MarketingCost,
        SeoSettings,
        SeoGscMetric,
        SeoPageSpeedMetric,
        SeoGscDaily,

        // platform admin
        PlatformAdminUser,
        DemoRequest,
        PlatformSettings,

        // online chat
        ChatSession,
        ChatMessage,
        UserSession,
        TenantStorageFile,
        AiUsageLog,
        AiMemoryChunk,
        AiChatSession,
        AiChatMessage,
        AiAgent,
        AiAgentPermission,
        AiAgentApprovalRule,
        AiAgentAction,
        AiAgentLog,
        AiAgentReport,
        EmbedForm,
        EmbedFormUpload,
      ],
      synchronize: false,
    }),

    HealthModule,
    TenantsModule,
    UsersModule,
    DashboardModule,
    BiDashboardModule,
    OnboardingModule,
    CalendarModule,
    ExportModule,
    PortalModule,
    HelpdeskModule,
    EsignModule,
    AuditLogModule,
    AuthModule,
    LeadsModule,
    ContactsModule,
    CompaniesModule,
    NotesModule,
    EmailModule,
    TelegramCrmModule,
    CustomFieldsModule,
    AutomationsModule,
    SitesModule,
    ProjectsModule,
    StaffUsersModule,
    DepartmentsModule,
    RbacModule,
    SalesModule,
    SalesChannelsModule,
    IntegrationsModule,
    WhatsappCrmModule,
    TelephonyModule,
    WhatsappWebhookModule,
    AmocrmInboundWebhookModule,
    WordpressCf7InboundWebhookModule,
    ZapierMakeInboundModule,
    SlackInboundModule,
    SapInboundModule,
    JiraInboundModule,
    ShopifyInboundModule,
    WooCommerceInboundModule,
    CustomObjectsModule,
    ProductsModule,
    BookingsModule,
    HotelsModule,
    WorkspaceAreasModule,
    MarketingModule,
    MarketingBroadcastsModule,
    ApiTokensModule,
    SmmModule,
    PublicModule,
    PlatformAdminModule,
    DemoRequestsModule,
    PlatformSettingsModule,
    TelegramModule,
    BillingModule,
    AiModule,
    AiEmployeesModule,
    OnlineChatModule,
    CcpModule,
    MailModule,
    EmbedFormsModule,
    NotificationsModule,
    SmsModule,
    DeduplicationModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
