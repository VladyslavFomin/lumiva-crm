// src/marketing/marketing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

import { MarketingTraffic } from './marketing-traffic.entity';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';

import { ApiToken } from '../api-tokens/api-token.entity';
import { ApiTokenGuard } from '../api-tokens/api-token.guard';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketingTraffic,
      MarketingUtmTemplate,
      MarketingIntegration,
      MarketingAutomation,
      ApiToken, // <- репозиторий для ApiTokenGuard
    ]),
    ApiTokensModule, // <- чтобы не ломать существующий /api-tokens/*
  ],
  controllers: [MarketingController],
  providers: [MarketingService, ApiTokenGuard],
  exports: [MarketingService],
})
export class MarketingModule {}