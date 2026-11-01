import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HotelChannelsService } from './hotel-channels.service';

/**
 * Обмен с менеджером каналов: каждую минуту — изменения ARI (наличие сразу после броней, цены и ограничения — после
 * правки или раз в 5 минут, полная выгрузка — раз в сутки ночью по времени отеля); брони — раз в 5 минут
 * (основной путь — вебхук канала).
 */
@Injectable()
export class HotelChannelsScheduler {
  private readonly log = new Logger(HotelChannelsScheduler.name);
  private busy = { tick: false, pull: false };

  constructor(private readonly channels: HotelChannelsService) {}

  private async once(key: keyof HotelChannelsScheduler['busy'], fn: () => Promise<unknown>) {
    if (this.busy[key]) return;
    this.busy[key] = true;
    try {
      await fn();
    } catch (e) {
      this.log.warn(`${key}: ${(e as Error).message}`);
    } finally {
      this.busy[key] = false;
    }
  }

  @Cron('* * * * *')
  tick() {
    return this.once('tick', () => this.channels.tick());
  }

  @Cron('*/5 * * * *')
  pull() {
    return this.once('pull', async () => {
      await this.channels.pullAllDue();
      await this.channels.cleanupLogs();
    });
  }
}
