// src/sales-channels/sales-channels.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SalesChannel } from './sales-channel.entity';
import { SalesChannelDto } from './dto/sales-channel.dto';
import { IntegrationConnection } from '../integrations/integration-connection.entity';

@Injectable()
export class SalesChannelsService {
  constructor(
    @InjectRepository(SalesChannel)
    private readonly repo: Repository<SalesChannel>,

    @InjectRepository(IntegrationConnection)
    private readonly integrationsRepo: Repository<IntegrationConnection>,
  ) {}

  // ─────────────────────────────────────────────
  // Маппер SalesChannel → DTO
  // ─────────────────────────────────────────────
  private toDto(
    ch: SalesChannel,
    integration?: IntegrationConnection | null,
  ): SalesChannelDto {

    // API KEY TAIL — хвост consumerKey
    let apiKeyTail: string | null = null;

    try {
      if (integration?.configJson) {
        const config = JSON.parse(integration.configJson);
        if (config.consumerKey) {
          apiKeyTail = config.consumerKey.slice(-4);
        }
      }
    } catch {}

    return {
      id: ch.id,
      name: ch.name,
      type: ch.type,

      integrationId: ch.integrationId ?? integration?.id ?? null,
      integrationName:
        ch.integrationName ??
        integration?.name ??
        null,

      connectedAt: ch.connectedAt,

      isEnabled: ch.isEnabled,
      isDeleted: ch.isDeleted,

      totalSalesCount: integration?.totalSalesCount ?? 0,
      totalSalesAmount: integration?.totalSalesAmount ?? 0,
      currency: integration?.currency ?? (ch as any).currency ?? 'EUR',

      lastSyncAt: integration?.lastSyncAt ?? null,
      lastSyncStatus: integration?.lastSyncStatus ?? 'never',
      lastError: integration?.lastError ?? null,

      apiKeyTail,  // ←🔥 Новое поле
    };
  }

  // маленький хелпер для одного канала
  private async findIntegrationForChannel(
  ch: SalesChannel,
  tenantId: string,
): Promise<IntegrationConnection | null> {
  if (ch.integrationId) {
    const byIntegrationId = await this.integrationsRepo.findOne({
      where: { id: ch.integrationId, tenantId, isDeleted: false } as any,
    });
    if (byIntegrationId) return byIntegrationId;
  }

  const byChannelId = await this.integrationsRepo.findOne({
    where: { channelId: ch.id, tenantId, isDeleted: false } as any,
  });

  return byChannelId ?? null;
}
  // ✅ Список каналов ТОЛЬКО для tenant
async findAllForTenant(tenantId: string): Promise<SalesChannelDto[]> {
  const channels = await this.repo.find({
    where: { tenantId, isDeleted: false } as any,
    order: { connectedAt: 'DESC' },
  });

  if (!channels.length) return [];

  const integrations = await this.integrationsRepo.find({
    where: { tenantId, isDeleted: false } as any,
  });

  const byChannelId = new Map<string, IntegrationConnection>();
  const byIntegrationId = new Map<string, IntegrationConnection>();

  for (const integ of integrations) {
    if (integ.channelId) byChannelId.set(integ.channelId, integ);
    byIntegrationId.set(integ.id, integ);
  }

  return channels.map((ch) => {
    const integration =
      (ch.integrationId && byIntegrationId.get(ch.integrationId)) ||
      byChannelId.get(ch.id) ||
      null;

    return this.toDto(ch, integration);
  });
}

async toggleEnabledForTenant(
  tenantId: string,
  id: string,
  isEnabled: boolean,
): Promise<SalesChannelDto> {
  const ch = await this.repo.findOne({ where: { id, tenantId } as any });
  if (!ch) throw new NotFoundException('Channel not found');

  ch.isEnabled = isEnabled;
  const saved = await this.repo.save(ch);

  const integration = await this.findIntegrationForChannel(saved, tenantId);
  return this.toDto(saved, integration);
}

async softDeleteForTenant(tenantId: string, id: string): Promise<void> {
  const ch = await this.repo.findOne({ where: { id, tenantId } as any });
  if (!ch) return;

  ch.isDeleted = true;
  ch.isEnabled = false;
  await this.repo.save(ch);
  }
}