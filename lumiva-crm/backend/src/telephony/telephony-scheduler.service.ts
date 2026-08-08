// src/telephony/telephony-scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TelephonyService } from './telephony.service';

@Injectable()
export class TelephonySchedulerService {
  constructor(private readonly telephony: TelephonyService) {}

  // once a day — enforces the advertised 3-year call/recording retention
  @Cron('30 3 * * *')
  async runRetention() {
    await this.telephony.enforceRetention();
  }
}
