// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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

// --- Entities маркетинга ---
import { MarketingTraffic } from './marketing/marketing-traffic.entity';
import { MarketingSegment } from './marketing/marketing-segment.entity';
import { MarketingUtmTemplate } from './marketing/marketing-utm-template.entity';
import { MarketingIntegration } from './marketing/marketing-integration.entity';
import { MarketingAutomation } from './marketing/marketing-automation.entity';
import { MarketingCost } from './marketing/marketing-cost.entity';

// SMM
import { SmmProfile } from './smm/smm-profile.entity';
import { SmmProfileStat } from './smm/smm-profile-stat.entity';

// Platform admin
import { PlatformAdminUser } from './platform-admin/admin-user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
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
        SmmProfile,
        SmmProfileStat,

        // маркетинг
        MarketingTraffic,
        MarketingSegment,
        MarketingUtmTemplate,
        MarketingIntegration,
        MarketingAutomation,
        MarketingCost,

        // platform admin
        PlatformAdminUser,
      ],
      synchronize: true,
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
  ],
})
export class AppModule {}