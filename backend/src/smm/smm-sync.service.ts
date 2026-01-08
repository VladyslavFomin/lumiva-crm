// src/smm/smm-sync.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SmmService } from './smm.service';

@Injectable()
export class SmmSyncService {
  constructor(private readonly smmService: SmmService) {}

  // daily sync at 03:10 UTC
  @Cron('10 3 * * *')
  async syncDailyMetaProfiles() {
    await this.smmService.syncAllMetaProfiles();
  }

  @Cron('25 3 * * *')
  async syncDailyVkProfiles() {
    await this.smmService.syncAllVkProfiles();
  }
}
