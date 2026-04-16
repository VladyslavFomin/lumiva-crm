// src/marketing/marketing.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { MarketingSyncService } from './marketing-sync.service';

import { MarketingTraffic } from './marketing-traffic.entity';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { MarketingSegment } from './marketing-segment.entity';
import { SeoSettings } from './seo-settings.entity';
import { SeoGscMetric } from './seo-gsc-metric.entity';
import { SeoPageSpeedMetric } from './seo-pagespeed-metric.entity';
import { SeoGscDaily } from './seo-gsc-daily.entity';

import { ApiToken } from '../api-tokens/api-token.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { Lead } from '../leads/lead.entity';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketingTraffic,
        MarketingUtmTemplate,
        MarketingIntegration,
        MarketingAutomation,
        MarketingSegment,
        SeoSettings,
        SeoGscMetric,
        SeoPageSpeedMetric,
        SeoGscDaily,
        Lead,
        ApiToken, // <- репозиторий для ApiTokenGuard
      ]),
    ApiTokensModule, // <- чтобы не ломать существующий /api-tokens/*
    TenantsModule,   // -> TenantLogsService для ApiTokenGuard
    PlatformSettingsModule,
    forwardRef(() => LeadsModule),
  ],
  controllers: [MarketingController],
  providers: [MarketingService, MarketingSyncService, ApiTokenGuard],
  exports: [MarketingService],
})
export class MarketingModule {}
