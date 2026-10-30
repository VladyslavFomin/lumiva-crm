import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelNightAuditService } from './hotel-night-audit.service';

/** Жизненный цикл броней отеля: автоснятие просроченных опционов (PMS-024). */
@Injectable()
export class HotelLifecycleScheduler {
  private readonly log = new Logger(HotelLifecycleScheduler.name);
  private busy = false;
  private auditBusy = false;

  constructor(
    private readonly reservations: HotelReservationsService,
    private readonly nightAudit: HotelNightAuditService,
  ) {}

  @Cron('*/10 * * * *')
  async expireOptions() {
    if (this.busy) return;
    this.busy = true;
    try {
      const n = await this.reservations.expireOptions();
      if (n) this.log.log(`hotel options expired: ${n}`);
    } catch (e) {
      this.log.warn(`expireOptions: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  /** Автоматический ночной аудит (PMS-090): по времени отеля, если включён в настройках */
  @Cron('*/10 * * * *')
  async autoNightAudit() {
    if (this.auditBusy) return;
    this.auditBusy = true;
    try {
      const n = await this.nightAudit.runDue();
      if (n) this.log.log(`night audits completed: ${n}`);
    } catch (e) {
      this.log.warn(`night audit cron: ${(e as Error).message}`);
    } finally {
      this.auditBusy = false;
    }
  }
}
