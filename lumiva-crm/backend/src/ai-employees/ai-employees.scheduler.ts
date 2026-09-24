import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiEmployeesService } from './ai-employees.service';

/**
 * Background cycles for AI Employees when schedule_mode is not manual-only:
 * proactive operational runs + optional daily Markdown reports at daily_report_time.
 */
@Injectable()
export class AiEmployeesSchedulerService {
  private readonly log = new Logger(AiEmployeesSchedulerService.name);

  constructor(private readonly aiEmployees: AiEmployeesService) {}

  @Cron('*/10 * * * *')
  async handleProactiveAssistants(): Promise<void> {
    try {
      await this.aiEmployees.tickProactiveAssistants();
    } catch (e) {
      this.log.warn(`tickProactiveAssistants: ${(e as Error).message}`);
    }
  }

  /** Контроль скорости: клиент ждёт ответа / просрочены задачи ИИ (см. AiEmployeesService.checkSla). */
  @Cron('*/5 * * * *')
  async handleSla(): Promise<void> {
    try {
      await this.aiEmployees.tickSla();
    } catch (e) {
      this.log.warn(`tickSla: ${(e as Error).message}`);
    }
  }

  /** Утренний план команды (время — по настройке сотрудника, UTC). */
  @Cron('*/10 * * * *')
  async handleDailyPlans(): Promise<void> {
    try {
      await this.aiEmployees.tickDailyPlans();
    } catch (e) {
      this.log.warn(`tickDailyPlans: ${(e as Error).message}`);
    }
  }

  /** Одно сообщение «Итоги дня» владельцам (см. AiEmployeesService.tickDailyDigest). */
  @Cron('*/10 * * * *')
  async handleDailyDigest(): Promise<void> {
    try {
      await this.aiEmployees.tickDailyDigest();
    } catch (e) {
      this.log.warn(`tickDailyDigest: ${(e as Error).message}`);
    }
  }
}
