import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoogleSheetsSyncService } from './google-sheets-sync.service';

@Injectable()
export class GoogleSheetsSyncScheduler {
  private readonly log = new Logger(GoogleSheetsSyncScheduler.name);

  constructor(private readonly sheetsSync: GoogleSheetsSyncService) {}

  @Cron('*/2 * * * *')
  async processSheetJobs(): Promise<void> {
    try {
      const n = await this.sheetsSync.processPendingJobs(8);
      if (n > 0) {
        this.log.debug(`Google Sheets sync: обработано заданий: ${n}`);
      }
    } catch (e) {
      this.log.warn(`Google Sheets sync scheduler: ${(e as Error).message}`);
    }
  }
}
