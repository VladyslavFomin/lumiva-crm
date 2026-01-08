// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// --- Модули ---
import { SitesModule } from './sites/sites.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { ProjectsModule } from './projects/projects.module';
import { StaffUsersModule } from './staff/staff-users.module';
import { RbacModule } from './rbac/rbac.module';
import { SalesModule } from './sales/sales.module';
import { SalesChannelsModule } from './sales-channels/sales-channels.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { MarketingModule } from './marketing/marketing.module';
import { SmmModule } from './smm/smm.module';
import { PublicModule } from './public/public.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { DemoRequestsModule } from './demo-requests/demo-requests.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { TelegramModule } from './telegram/telegram.module';

// --- CCP
import { CcpModule } from './modules/ccp/ccp.module';

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
import { Project } from './projects/project.entity';
import { StaffUser } from './staff/staff-user.entity';
import { StaffRolePermission } from './rbac/staff-role-permission.entity';
import { Sale } from './sales/sale.entity';
import { SalesChannel } from './sales-channels/sales-channel.entity';
import { IntegrationConnection } from './integrations/integration-connection.entity';
import { ApiToken } from './api-tokens/api-token.entity';
import { TenantLog } from './tenants/tenant-log.entity';

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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),

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
        Project,
        StaffUser,
        StaffRolePermission,
        Sale,
        SalesChannel,
        IntegrationConnection,
        ApiToken,
        TenantLog,
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
      ],
      synchronize: true, // в проде лучше false + миграции
    }),

    HealthModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    LeadsModule,
    SitesModule,
    ProjectsModule,
    StaffUsersModule,
    RbacModule,
    SalesModule,
    SalesChannelsModule,
    IntegrationsModule,
    MarketingModule,
    ApiTokensModule,
    SmmModule,
    PublicModule,
    PlatformAdminModule,
    DemoRequestsModule,
    PlatformSettingsModule,
    TelegramModule,
    OnlineChatModule,
    CcpModule,
    MailModule,
  ],
})
export class AppModule {}
