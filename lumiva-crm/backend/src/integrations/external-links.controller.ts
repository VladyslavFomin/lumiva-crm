import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Lead } from '../leads/lead.entity';
import { IntegrationConnection } from './integration-connection.entity';

export type ExternalLinkInfo = {
  provider: 'bitrix' | 'amocrm' | 'hubspot';
  id: string;
  label: string;
  url: string | null;
};

/**
 * Бейджи "куда ещё привязана эта запись" для Bitrix24/amoCRM/HubSpot — те же плоские ключи
 * meta.bitrixLeadId / meta.amocrmLeadId / meta.hubspotObjectId, что пишут исходящие действия
 * автоматизаций (см. automations.service.ts) и — для amoCRM/Bitrix24 — входящие вебхуки.
 * Пока только для лидов: именно туда эти три интеграции сейчас и привязывают результат.
 */
@Controller('integrations/external-links')
@UseGuards(JwtAuthGuard)
export class ExternalLinksController {
  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(IntegrationConnection)
    private readonly connectionRepo: Repository<IntegrationConnection>,
  ) {}

  private async findConnectionUrl(tenantId: string, catalogId: string): Promise<string | null> {
    const rows = await this.connectionRepo.find({
      where: { tenantId, kind: 'third_party_link', isEnabled: true, isDeleted: false } as any,
    });
    for (const row of rows) {
      if (!row.configJson) continue;
      try {
        const cfg = JSON.parse(row.configJson) as { catalogId?: string; webhookUrl?: string };
        if (cfg.catalogId === catalogId && cfg.webhookUrl) {
          return cfg.webhookUrl.trim();
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  @Get(':entityType/:entityId')
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<ExternalLinkInfo[]> {
    if (entityType !== 'lead') return [];
    const lead = await this.leadRepo.findOne({
      where: { id: entityId, tenantId: user.tenantId } as any,
    });
    const meta = (lead?.meta || {}) as Record<string, unknown>;
    const links: ExternalLinkInfo[] = [];

    const bitrixId = meta.bitrixLeadId != null ? String(meta.bitrixLeadId) : '';
    if (bitrixId) {
      const base = await this.findConnectionUrl(user.tenantId, 'bitrix');
      const portal = base ? base.replace(/\/rest\/.*$/i, '') : null;
      links.push({
        provider: 'bitrix',
        id: bitrixId,
        label: `Bitrix24 #${bitrixId}`,
        url: portal ? `${portal}/crm/lead/details/${bitrixId}/` : null,
      });
    }

    const amoId = meta.amocrmLeadId != null ? String(meta.amocrmLeadId) : '';
    if (amoId) {
      const base = await this.findConnectionUrl(user.tenantId, 'amocrm');
      links.push({
        provider: 'amocrm',
        id: amoId,
        label: `amoCRM #${amoId}`,
        url: base ? `${base.replace(/\/$/, '')}/leads/detail/${amoId}` : null,
      });
    }

    const hubspotId = meta.hubspotObjectId != null ? String(meta.hubspotObjectId) : '';
    if (hubspotId) {
      links.push({
        provider: 'hubspot',
        id: hubspotId,
        label: `HubSpot #${hubspotId}`,
        url: null,
      });
    }

    return links;
  }
}
