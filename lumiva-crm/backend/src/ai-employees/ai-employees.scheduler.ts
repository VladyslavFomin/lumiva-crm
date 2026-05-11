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
}
