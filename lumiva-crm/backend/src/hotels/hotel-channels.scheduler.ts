import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HotelChannelsService } from './hotel-channels.service';

/** Обмен с менеджером каналов: наличие после изменений — раз в минуту, брони — раз в 5 минут, цены целиком — раз в 30 минут */
@Injectable()
export class HotelChannelsScheduler {
  private readonly log = new Logger(HotelChannelsScheduler.name);
  private busy = { dirty: false, pull: false, full: false };

  constructor(private readonly channels: HotelChannelsService) {}

  private async once(key: keyof HotelChannelsScheduler['busy'], fn: () => Promise<unknown>) {
    if (this.busy[key]) return;
    this.busy[key] = true;
    try { await fn(); } catch (e) { this.log.warn(`${key}: ${(e as Error).message}`); } finally { this.busy[key] = false; }
  }

  @Cron('* * * * *')
  pushDirty() { return this.once('dirty', () => this.channels.pushDirty()); }

  @Cron('*/5 * * * *')
  pull() { return this.once('pull', () => this.channels.pullAllDue()); }

  @Cron('*/30 * * * *')
  pushFull() { return this.once('full', async () => { await this.channels.pushAllFull(); await this.channels.cleanupLogs(); }); }
}
