import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SeoAiService } from './seo-ai.service';

/**
 * Еженедельный отчёт ИИ-SEO-ассистента: раз в час проверяем, у кого в его часовом поясе
 * наступили выбранные день недели и час. Прогоны идут по очереди — каждый ходит в Google и к ИИ.
 */
@Injectable()
export class SeoAiScheduler {
  private readonly log = new Logger(SeoAiScheduler.name);
  private running = false;

  constructor(private readonly seoAi: SeoAiService) {}

  @Cron('7 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // ежедневная лёгкая проверка (сигналы) — до недельных отчётов, она быстрая
      await this.seoAi.runDailyChecks().catch((e) => this.log.warn(`SEO daily checks failed: ${(e as Error)?.message}`));
      const due = await this.seoAi.listDueAgents();
      for (const agent of due) {
        try {
          await this.seoAi.runScheduled(agent);
        } catch (e) {
          this.log.warn(`Weekly SEO report failed for tenant ${agent.tenantId}: ${(e as Error)?.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
