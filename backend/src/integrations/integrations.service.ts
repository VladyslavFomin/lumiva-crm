// src/integrations/integrations.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';
import { IntegrationRegistryService } from './integration-registry.service';

import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { Sale } from '../sales/sale.entity';

import type { IntegrationKind } from './integration-kind.enum';
import type { TestConnectionResult, SyncResult } from './sales-integration.adapter';

export interface IntegrationConnectionDto {
  id: string;
  name: string;
  kind: IntegrationKind;
  channelId: string | null;
  description: string | null;
  isEnabled: boolean;
  isDeleted: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string;
  lastError: string | null;
  totalSalesCount: number;
  totalSalesAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  configSnippet?: string | null;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly repo: Repository<IntegrationConnection>,

    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,

    @InjectRepository(SalesChannel)
    private readonly channelsRepo: Repository<SalesChannel>,

    private readonly registry: IntegrationRegistryService,
  ) {}

  /* ============================================================
   * DTO
   * ============================================================ */
  private toDto(entity: IntegrationConnection): IntegrationConnectionDto {
    let snippet: string | null = null;

    if (entity.configJson) {
      try {
        const cfg = JSON.parse(entity.configJson);
        if (cfg.consumerKey) snippet = '…' + String(cfg.consumerKey).slice(-4);
        if (cfg.apiKey) snippet = '…' + String(cfg.apiKey).slice(-4);
      } catch {
        // ignore
      }
    }

    return {
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      channelId: entity.channelId ?? null,
      description: entity.description ?? null,
      isEnabled: entity.isEnabled,
      isDeleted: entity.isDeleted,
      lastSyncAt: entity.lastSyncAt,
      lastSyncStatus: entity.lastSyncStatus,
      lastError: entity.lastError,
      totalSalesAmount: entity.totalSalesAmount,
      totalSalesCount: entity.totalSalesCount,
      currency: entity.currency,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      configSnippet: snippet,
    };
  }

  /* ============================================================
   * КАНАЛ ДЛЯ ИНТЕГРАЦИИ (tenant-safe)
   * ============================================================ */
  private async ensureChannel(
    tenantId: string,
    entity: IntegrationConnection,
  ): Promise<SalesChannel> {
    if (entity.tenantId && entity.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied');
    }

    // 1) Если интеграция уже привязана к каналу — проверим, что канал НАШЕГО tenant
    if (entity.channelId) {
      const existing = await this.channelsRepo.findOne({
        where: { id: entity.channelId, tenantId, isDeleted: false } as any,
      });

      if (existing) {
        let dirty = false;

        if (existing.integrationId !== entity.id) {
          existing.integrationId = entity.id;
          dirty = true;
        }
        if (existing.integrationName !== entity.name) {
          existing.integrationName = entity.name;
          dirty = true;
        }
        if ((existing as any).currency !== (entity.currency || 'EUR')) {
          (existing as any).currency = entity.currency || 'EUR';
          dirty = true;
        }

        if (dirty) await this.channelsRepo.save(existing);
        return existing;
      }

      // channelId указывает на чужой tenant или удалённый канал — отвязываем
      entity.channelId = null;
      await this.repo.save(entity);
    }

    // 2) Создаём новый канал
    // ВАЖНО: TypeORM typings иногда выбирают overload массива -> TS думает, что это SalesChannel[]
    // Поэтому приводим через unknown.
    const channel = (this.channelsRepo.create({
      name: entity.name,
      type: 'other',
      integrationId: entity.id,
      integrationName: entity.name,
      currency: entity.currency || 'EUR',
      isEnabled: true,
      isDeleted: false,
      tenantId,
    } as any) as unknown) as SalesChannel;

    const savedChannel = ((await this.channelsRepo.save(channel)) as unknown) as SalesChannel;

    // 3) Привязка канала к интеграции
    entity.channelId = savedChannel.id;
    entity.tenantId = tenantId;
    await this.repo.save(entity);

    return savedChannel;
  }

  /* ============================================================
   * CRUD (tenant-safe)
   * ============================================================ */

  async findAllForTenant(tenantId: string): Promise<IntegrationConnectionDto[]> {
    const list = await this.repo.find({
      where: { tenantId, isDeleted: false } as any,
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toDto(e));
  }

  async findOneForTenant(
    tenantId: string,
    id: string,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');
    return this.toDto(entity);
  }

  async createForTenant(
    tenantId: string,
    dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    // Аналогично: typings иногда выбирают overload массива -> TS думает, что это IntegrationConnection[]
    const entity = (this.repo.create({
      tenantId,
      name: dto.name,
      kind: dto.kind as any,
      description: dto.description ?? null,
      configJson: dto.config ? JSON.stringify(dto.config) : null,
      isEnabled: dto.isEnabled ?? true,
      isDeleted: false,
      lastSyncStatus: 'never',
      channelId: dto.channelId ?? null,
    } as any) as unknown) as IntegrationConnection;

    const saved = ((await this.repo.save(entity)) as unknown) as IntegrationConnection;

    await this.ensureChannel(tenantId, saved);
    return this.toDto(saved);
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({ where: { id, tenantId } as any });
    if (!entity || entity.isDeleted) {
      throw new NotFoundException('Интеграция не найдена');
    }

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.kind !== undefined) entity.kind = dto.kind as any;
    if (dto.channelId !== undefined) entity.channelId = dto.channelId;
    if (dto.description !== undefined) entity.description = dto.description;
    if (dto.isEnabled !== undefined) entity.isEnabled = dto.isEnabled;
    if (dto.isDeleted !== undefined) entity.isDeleted = dto.isDeleted;
    if (dto.config !== undefined) {
      entity.configJson = dto.config === null ? null : JSON.stringify(dto.config);
    }

    const saved = ((await this.repo.save(entity)) as unknown) as IntegrationConnection;

    await this.ensureChannel(tenantId, saved);
    return this.toDto(saved);
  }

  async softDeleteForTenant(tenantId: string, id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id, tenantId } as any });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    entity.isDeleted = true;
    await this.repo.save(entity);
  }

  /* ============================================================
   * ТЕСТ ПОДКЛЮЧЕНИЯ (tenant-safe)
   * ============================================================ */
  async testConnectionForTenant(
    tenantId: string,
    id: string,
  ): Promise<TestConnectionResult> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    const adapter = this.registry.getAdapter(entity.kind);
    if (!adapter) {
      return { ok: false, message: `Адаптер ${entity.kind} не найден` };
    }

    return adapter.testConnection(entity);
  }

  /* ============================================================
   * АГРЕГАТЫ ПО ПРОДАЖАМ (tenant-safe)
   * ============================================================ */
  private async refreshAggregates(
  tenantId: string,
  entity: IntegrationConnection,
  ): Promise<void> {
  if (!entity.channelId) return;

  const agg = await this.salesRepo
    .createQueryBuilder('s')
    .select('COUNT(*)', 'cnt')
    .addSelect('COALESCE(SUM(s.amount),0)', 'sum')
    // ВАЖНО: колонка в БД = channel_id
    .where('s.channel_id = :cid', { cid: entity.channelId })
    .getRawOne<{ cnt: string; sum: string }>();

  entity.totalSalesCount = Number(agg?.cnt ?? 0);
  entity.totalSalesAmount = Number(agg?.sum ?? 0);

  const byCurrency = await this.salesRepo
    .createQueryBuilder('s')
    .select('s.currency', 'currency')
    .addSelect('COUNT(*)', 'cnt')
    .where('s.channel_id = :cid', { cid: entity.channelId })
    .groupBy('s.currency')
    .orderBy('cnt', 'DESC')
    .limit(1)
    .getRawMany<{ currency: string; cnt: string }>();

  if (byCurrency.length) entity.currency = byCurrency[0].currency;
  }

  /* ============================================================
   * СИНХРОНИЗАЦИЯ (tenant-safe)
   * ============================================================ */
  async syncForTenant(tenantId: string, id: string): Promise<SyncResult> {
    const entity = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false } as any,
    });
    if (!entity) throw new NotFoundException('Интеграция не найдена');

    await this.ensureChannel(tenantId, entity);

    const adapter = this.registry.getAdapter(entity.kind);
    if (!adapter) {
      const msg = `Адаптер ${entity.kind} не найден`;
      entity.lastError = msg;
      entity.lastSyncAt = new Date();
      entity.lastSyncStatus = 'error';
      await this.repo.save(entity);
      return { ok: false, created: 0, updated: 0, skipped: 0, message: msg };
    }

    const startedAt = new Date();

    try {
      const result = await adapter.syncSales(entity);

      await this.refreshAggregates(tenantId, entity);

      entity.lastSyncAt = startedAt;
      entity.lastSyncStatus = result.ok ? 'ok' : 'error';
      entity.lastError = result.ok ? null : result.message ?? null;

      await this.repo.save(entity);
      return result;
    } catch (e) {
      const msg = (e as Error).message ?? 'Неизвестная ошибка';

      entity.lastSyncAt = startedAt;
      entity.lastSyncStatus = 'error';
      entity.lastError = msg;
      await this.repo.save(entity);

      return { ok: false, created: 0, updated: 0, skipped: 0, message: msg };
    }
  }
}