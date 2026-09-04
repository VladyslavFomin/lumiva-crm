// src/automations/scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomationsService } from './automations.service';

@Injectable()
export class AutomationsSchedulerService {
  constructor(private readonly automationsService: AutomationsService) {}

  // every minute
  @Cron('* * * * *')
  async runScheduledReports() {
    await this.automationsService.runScheduledReports();
  }

  // once a day at 08:00 UTC — stale lead/deal digest
  @Cron('0 8 * * *')
  async runStaleEntityChecks() {
    await this.automationsService.runStaleEntityChecks();
  }

  // every minute — resumes automations paused on a `_delayMinutes` step whose wait has elapsed
  @Cron('* * * * *')
  async resumeDueExecutions() {
    await this.automationsService.resumeDueExecutions();
  }

  // every 5 minutes — closes out executions left in 'pending' by a crashed process
  @Cron('*/5 * * * *')
  async cleanupStuckPendingExecutions() {
    await this.automationsService.cleanupStuckPendingExecutions();
  }
}
