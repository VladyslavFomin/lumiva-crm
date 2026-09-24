import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkspaceSyncService } from './workspace-sync.service';

/**
 * Каждые 15 минут обновляет источники синхронизации таблиц рабочей области, которым пора:
 * marketing_* — раз в сутки после 04:30 (после ночной синхронизации кабинетов в
 * MarketingSyncService: Google Ads 03:20, остальные 03:35), integration_import — по интервалу.
 */
@Injectable()
export class WorkspaceSyncScheduler {
  private readonly log = new Logger(WorkspaceSyncScheduler.name);
  private busy = false;

  constructor(private readonly sync: WorkspaceSyncService) {}

  @Cron('*/15 * * * *')
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const r = await this.sync.refreshAllDue();
      if (r.checked) {
        this.log.log(`Автообновление таблиц: обновлено ${r.ok}/${r.checked}, ошибок ${r.failed}`);
      }
    } catch (e: unknown) {
      this.log.warn(`Автообновление таблиц не выполнено: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.busy = false;
    }
  }
}
