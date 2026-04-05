import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketingService } from './marketing.service';

@Injectable()
export class MarketingSyncService {
  private readonly log = new Logger(MarketingSyncService.name);

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

  /** Раз в час обновляем кэш курсов маркетинга (EUR/GBP/TRY/RUB) для всех вариантов отображения. */
  @Cron('0 * * * *')
  async refreshMarketingFxHourly() {
    for (const d of ['EUR', 'GBP', 'TRY', 'RUB'] as const) {
      try {
        await this.marketing.getMarketingFxRates(d, { force: true });
      } catch (e: unknown) {
        this.log.warn(
          `FX hourly prefetch ${d}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
