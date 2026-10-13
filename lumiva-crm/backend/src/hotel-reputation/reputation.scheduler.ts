import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReputationSyncService } from './reputation-sync.service';
import { ReputationReviewsService } from './reputation-reviews.service';
import { ReputationAlertsService } from './reputation-alerts.service';
import { ReputationAnalyticsService } from './reputation-analytics.service';
import { ReputationSettingsService } from './reputation-settings.service';

/** Расписание модуля отзывов. Каждая задача — со своим флагом «уже идёт», чтобы не наслаивались. */
@Injectable()
export class ReputationScheduler {
  private readonly log = new Logger(ReputationScheduler.name);
  private readonly busy = new Set<string>();

  constructor(
    private readonly sync: ReputationSyncService,
    private readonly reviews: ReputationReviewsService,
    private readonly alerts: ReputationAlertsService,
    private readonly analytics: ReputationAnalyticsService,
    private readonly settings: ReputationSettingsService,
  ) {}

  private async once(name: string, fn: () => Promise<unknown>) {
    if (this.busy.has(name)) return;
    this.busy.add(name);
    try {
      await fn();
    } catch (e) {
      this.log.warn(`reputation ${name}: ${(e as Error).message}`);
    } finally {
      this.busy.delete(name);
    }
  }

  /** Очередь ответов (лимит Google 10/мин) и опрос запущенных скрейперов. */
  @Cron('* * * * *')
  minute() {
    void this.once('replies', () => this.reviews.processQueue());
    void this.once('apify-poll', () => this.sync.pollApifyRuns());
  }

  /** Запуск скрейперов, у которых подошёл срок или ждущих в очереди (лимит параллельных запусков Apify). */
  @Cron('*/2 * * * *')
  twoMinutes() {
    void this.once('schedule', () => this.sync.scheduleDue());
  }

  /** ИИ-разбор хвоста. */
  @Cron('*/5 * * * *')
  fiveMinutes() {
    void this.once('ai', () => this.sync.analyzeBacklog());
  }

  /** Алерты: без ответа, повторяющиеся жалобы — раз в час; падение средней и «тихий» скрейпер — тоже. */
  @Cron('7 * * * *')
  hourly() {
    void this.once('alerts', async () => {
      for (const tenantId of await this.settings.tenantsWithModule()) {
        const cfg = await this.settings.config(tenantId);
        await this.alerts.checkNoReply(tenantId, cfg);
        await this.alerts.checkTopicSpike(tenantId, cfg);
      }
    });
  }

  /** Ночная сверка Google (последние 30 дней + счётчик), «тихие» источники, падение средней. */
  @Cron('20 3 * * *')
  nightly() {
    void this.once('nightly', async () => {
      await this.sync.nightlyGoogle();
      await this.sync.checkStale();
      for (const tenantId of await this.settings.tenantsWithModule()) {
        await this.alerts.checkAvgDrop(tenantId, await this.settings.config(tenantId));
      }
      await this.sync.cleanupOldRuns();
    });
  }

  /** 1-го числа в 08:00 — отчёт по брендам за прошлый месяц. */
  @Cron('0 8 1 * *')
  monthly() {
    void this.once('monthly', () => this.analytics.sendMonthlyReports());
  }
}
