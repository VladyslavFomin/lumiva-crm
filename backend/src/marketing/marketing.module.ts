// src/marketing/marketing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

import { MarketingTraffic } from './marketing-traffic.entity';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { SeoSettings } from './seo-settings.entity';
import { SeoGscMetric } from './seo-gsc-metric.entity';
import { SeoPageSpeedMetric } from './seo-pagespeed-metric.entity';
import { SeoGscDaily } from './seo-gsc-daily.entity';

import { ApiToken } from '../api-tokens/api-token.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketingTraffic,
        MarketingUtmTemplate,
        MarketingIntegration,
        MarketingAutomation,
        SeoSettings,
        SeoGscMetric,
        SeoPageSpeedMetric,
        SeoGscDaily,
        ApiToken, // <- репозиторий для ApiTokenGuard
      ]),
    ApiTokensModule, // <- чтобы не ломать существующий /api-tokens/*
    TenantsModule,   // -> TenantLogsService для ApiTokenGuard
    PlatformSettingsModule,
  ],
  controllers: [MarketingController],
  providers: [MarketingService, ApiTokenGuard],
  exports: [MarketingService],
})
export class MarketingModule {}
