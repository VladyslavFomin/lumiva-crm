import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationConnection } from '../integration-connection.entity';
import { IntegrationsService } from '../integrations.service';

/**
 * Двусторонняя синхронизация встреч с Google Calendar раньше шла только по кнопке «Синхр.» —
 * встречу, перенесённую в Google, CRM не видела. Теперь каждые 30 минут для всех включённых
 * подключений; статус и ошибка пишутся в подключение (баннер «Интеграций», уведомление владельцу).
 */
@Injectable()
export class GoogleCalendarSyncScheduler {
  private readonly log = new Logger(GoogleCalendarSyncScheduler.name);
  private running = false;

  constructor(
    @InjectRepository(IntegrationConnection) private readonly repo: Repository<IntegrationConnection>,
    private readonly integrations: IntegrationsService,
  ) {}

  @Cron('7,37 * * * *')
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.repo.find({ where: { kind: 'third_party_link', isEnabled: true, isDeleted: false } });
      for (const row of rows) {
        let catalogId = '';
        try {
          catalogId = String((JSON.parse(row.configJson || '{}') as { catalogId?: string }).catalogId || '');
        } catch {
          continue;
        }
        if (catalogId !== 'google_calendar') continue;
        try {
          const r = await this.integrations.syncForTenant(row.tenantId, row.id);
          if (!r.ok) this.log.warn(`Google Calendar sync ${row.id}: ${r.message}`);
        } catch (e) {
          this.log.warn(`Google Calendar sync ${row.id} failed: ${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
