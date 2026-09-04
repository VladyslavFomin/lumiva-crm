// src/deduplication/deduplication-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeduplicationService } from './deduplication.service';

/** Opt-in only — see DeduplicationService.runNightlyAutoMerge for what it actually does and why
 * it's restricted to contact/lead exact matches. */
@Injectable()
export class DeduplicationSchedulerService {
  private readonly log = new Logger(DeduplicationSchedulerService.name);

  constructor(private readonly dedup: DeduplicationService) {}

  @Cron('0 4 * * *')
  async handleNightlyAutoMerge(): Promise<void> {
    try {
      const result = await this.dedup.runNightlyAutoMerge();
      if (result.merged > 0) {
        this.log.log(`Nightly auto-merge: ${result.merged} records merged across ${result.tenantsProcessed} tenant(s).`);
      }
    } catch (e) {
      this.log.warn(`runNightlyAutoMerge: ${(e as Error).message}`);
    }
  }
}
