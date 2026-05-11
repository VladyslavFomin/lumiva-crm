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

  /** Раз в час подтягиваем курс Frankfurter (прогрев сырого кэша через EUR как валюту отчёта). */
  @Cron('0 * * * *')
  async refreshMarketingFxHourly() {
    try {
      await this.marketing.getMarketingFxRates('EUR', { force: true });
    } catch (e: unknown) {
      this.log.warn(
        `FX hourly prefetch EUR: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    for (const d of ['USD', 'GBP', 'TRY', 'RUB', 'PLN', 'CHF'] as const) {
      try {
        await this.marketing.getMarketingFxRates(d, { force: false });
      } catch (e: unknown) {
        this.log.warn(`FX hourly prefetch ${d}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
}
