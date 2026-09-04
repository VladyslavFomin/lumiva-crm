// src/sales-channels/sales-channels.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SalesChannel } from './sales-channel.entity';
import { SalesChannelDto } from './dto/sales-channel.dto';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { Sale } from '../sales/sale.entity';

@Injectable()
export class SalesChannelsService {
  constructor(
    @InjectRepository(SalesChannel)
    private readonly repo: Repository<SalesChannel>,

    @InjectRepository(IntegrationConnection)
    private readonly integrationsRepo: Repository<IntegrationConnection>,

    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
  ) {}

  // ─────────────────────────────────────────────
  // Маппер SalesChannel → DTO
  // ─────────────────────────────────────────────
  private toDto(
    ch: SalesChannel,
    integration?: IntegrationConnection | null,
    salesAgg?: { count: number; amount: number; currency: string | null } | null,
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

      // Продажи считаем напрямую по таблице sales (channel_id), а не только
      // по кэшу integration_connections — у direct-каналов (витрина/формы
      // сайта) связанной интеграции нет вовсе, и кэш там всегда пустой.
      totalSalesCount: salesAgg?.count ?? integration?.totalSalesCount ?? 0,
      totalSalesAmount: salesAgg?.amount ?? integration?.totalSalesAmount ?? 0,
      currency:
        salesAgg?.currency ?? integration?.currency ?? (ch as any).currency ?? 'EUR',

      lastSyncAt: integration?.lastSyncAt ?? null,
      lastSyncStatus: integration?.lastSyncStatus ?? 'never',
      lastError: integration?.lastError ?? null,

      apiKeyTail,  // ←🔥 Новое поле
    };
  }

  // ─────────────────────────────────────────────
  // Живые агрегаты продаж по каналам (COUNT/SUM из sales)
  // ─────────────────────────────────────────────
  private async loadSalesAggregates(
    tenantId: string,
    channelIds: string[],
  ): Promise<Map<string, { count: number; amount: number; currency: string | null }>> {
    const map = new Map<string, { count: number; amount: number; currency: string | null }>();
    if (!channelIds.length) return map;

    const rows = await this.saleRepo
      .createQueryBuilder('s')
      .select('s.channel_id', 'channelId')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(s.amount),0)', 'sum')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.channel_id IN (:...channelIds)', { channelIds })
      .groupBy('s.channel_id')
      .getRawMany<{ channelId: string; cnt: string; sum: string }>();

    for (const row of rows) {
      map.set(row.channelId, {
        count: Number(row.cnt ?? 0),
        amount: Number(row.sum ?? 0),
        currency: null,
      });
    }
    return map;
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

  const salesAggByChannel = await this.loadSalesAggregates(
    tenantId,
    channels.map((ch) => ch.id),
  );

  return channels.map((ch) => {
    const integration =
      (ch.integrationId && byIntegrationId.get(ch.integrationId)) ||
      byChannelId.get(ch.id) ||
      null;

    return this.toDto(ch, integration, salesAggByChannel.get(ch.id) ?? null);
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
  const salesAgg = await this.loadSalesAggregates(tenantId, [saved.id]);
  return this.toDto(saved, integration, salesAgg.get(saved.id) ?? null);
}

async softDeleteForTenant(tenantId: string, id: string): Promise<void> {
  const ch = await this.repo.findOne({ where: { id, tenantId } as any });
  if (!ch) return;

  // Не трогаем Sale-записи по этому каналу — isDeleted уже исключает их из всех списков
  // (inner join на канал), а физическое удаление раньше безвозвратно стирало историю продаж.
  ch.isDeleted = true;
  ch.isEnabled = false;
  await this.repo.save(ch);
}
}