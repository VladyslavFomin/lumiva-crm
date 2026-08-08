// src/marketing-broadcasts/marketing-broadcasts-scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MarketingBroadcastsService } from './marketing-broadcasts.service';

@Injectable()
export class MarketingBroadcastsSchedulerService {
  constructor(private readonly broadcastsService: MarketingBroadcastsService) {}

  // every 2 minutes — activates due `scheduled` broadcasts and advances `running` ones' next step
  @Cron('*/2 * * * *')
  async runDueSteps() {
    await this.broadcastsService.runDueSteps();
  }
}
