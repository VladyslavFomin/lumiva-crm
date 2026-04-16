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
}
