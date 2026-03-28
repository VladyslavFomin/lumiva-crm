import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketingService } from './marketing.service';

@Injectable()
export class MarketingSyncService {
  constructor(private readonly marketing: MarketingService) {}

  /** Ежедневно подтягиваем Google Ads (REST v23) для всех активных интеграций. */
  @Cron('20 3 * * *')
  async syncGoogleAdsDaily() {
    await this.marketing.syncAllActiveGoogleAds();
  }

  /** Яндекс.Метрика + GA4 → marketing_traffic. */
  @Cron('35 3 * * *')
  async syncAnalyticsDaily() {
    await this.marketing.syncAllActiveAnalyticsIntegrations();
  }
}
