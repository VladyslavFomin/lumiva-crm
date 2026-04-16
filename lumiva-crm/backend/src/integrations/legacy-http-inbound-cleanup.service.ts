import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';

const REMOVED_CATALOG_IDS = new Set(['http_lead', 'http_sale']);

const LAST_ERROR_RU =
  'Подключение снято: тип http_lead / http_sale больше не поддерживается. Создайте Mailchimp, Microsoft Teams, почту или другую интеграцию из каталога. Если в сценариях было выбрано это подключение — замените его на новое.';

/**
 * Однократно при старте помечает удалёнными устаревшие inbound HTTP-подключения,
 * чтобы они не «висели» в UI с невалидным catalogId.
 */
@Injectable()
export class LegacyHttpInboundCleanupService implements OnModuleInit {
  private readonly log = new Logger(LegacyHttpInboundCleanupService.name);

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly repo: Repository<IntegrationConnection>,
    @InjectRepository(SalesChannel)
    private readonly channelsRepo: Repository<SalesChannel>,
  ) {}

  async onModuleInit(): Promise<void> {
    const skip = (process.env.LUMIVA_SKIP_LEGACY_INTEGRATION_CLEANUP || '')
      .trim()
      .toLowerCase();
    if (skip === '1' || skip === 'true' || skip === 'yes') {
      this.log.log('Пропуск очистки http_lead/http_sale (LUMIVA_SKIP_LEGACY_INTEGRATION_CLEANUP)');
      return;
    }
    try {
      const n = await this.retireLegacyHttpInboundConnections();
      if (n > 0) {
        this.log.warn(
          `Автоочистка: помечено удалёнными подключений third_party_link (http_lead/http_sale): ${n}`,
        );
      }
    } catch (e) {
      this.log.error(
        `Очистка http_lead/http_sale не выполнена: ${(e as Error).message}`,
      );
    }
  }

  private parseCatalogId(configJson: string | null): string | null {
    if (!configJson || !configJson.trim()) return null;
    try {
      const cfg = JSON.parse(configJson) as { catalogId?: string };
      const id = cfg?.catalogId != null ? String(cfg.catalogId).trim() : '';
      return id || null;
    } catch {
      return null;
    }
  }

  /** @returns количество обновлённых строк */
  async retireLegacyHttpInboundConnections(): Promise<number> {
    const candidates = await this.repo.find({
      where: { kind: 'third_party_link', isDeleted: false } as any,
      select: ['id', 'tenantId', 'name', 'configJson', 'channelId'],
    });

    let updated = 0;
    for (const row of candidates) {
      const catalogId = this.parseCatalogId(row.configJson ?? null);
      if (!catalogId || !REMOVED_CATALOG_IDS.has(catalogId)) continue;

      row.isDeleted = true;
      row.isEnabled = false;
      row.channelId = null;
      row.lastError = LAST_ERROR_RU;
      row.lastSyncStatus = 'never';
      await this.repo.save(row);
      await this.channelsRepo.update(
        { integrationId: row.id } as any,
        { integrationId: null, integrationName: null },
      );
      updated++;
    }
    return updated;
  }
}
