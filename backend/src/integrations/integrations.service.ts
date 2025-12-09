// src/integrations/integrations.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { IntegrationConnection } from './integration-connection.entity';
import { CreateIntegrationConnectionDto } from './dto/create-integration-connection.dto';
import { UpdateIntegrationConnectionDto } from './dto/update-integration-connection.dto';
import { IntegrationRegistryService } from './integration-registry.service';

import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { Sale } from '../sales/sale.entity';

import type { IntegrationKind } from './integration-kind.enum';
import type {
  TestConnectionResult,
  SyncResult,
} from './sales-integration.adapter';

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
        // ignore JSON errors
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
   * КАНАЛ ДЛЯ ИНТЕГРАЦИИ
   * ============================================================ */
  private async ensureChannel(entity: IntegrationConnection): Promise<SalesChannel> {
    // Если интеграция уже привязана к каналу
    if (entity.channelId) {
      const existing = await this.channelsRepo.findOne({
        where: { id: entity.channelId },
      });

      if (existing && !existing.isDeleted) {
        // Обновляем обратную ссылку и имя интеграции в канале
        let dirty = false;

        if (existing.integrationId !== entity.id) {
          existing.integrationId = entity.id;
          dirty = true;
        }
        if (existing.integrationName !== entity.name) {
          existing.integrationName = entity.name;
          dirty = true;
        }

        if (dirty) {
          await this.channelsRepo.save(existing);
        }

        return existing;
      }
    }

    // Создаём новый канал, если нет действующего
    const channel = this.channelsRepo.create({
      name: entity.name,
      type: 'other',
      integrationId: entity.id,
      integrationName: entity.name,
      currency: entity.currency || 'EUR',
      isEnabled: true,
      isDeleted: false,
    });

    const saved = await this.channelsRepo.save(channel);

    // Привязываем канал к интеграции
    entity.channelId = saved.id;
    await this.repo.save(entity);

    return saved;
  }

  /* ============================================================
   * CRUD
   * ============================================================ */
  async findAll(): Promise<IntegrationConnectionDto[]> {
    const list = await this.repo.find({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });
    return list.map((e) => this.toDto(e));
  }

  async findOne(id: string): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({
      where: { id, isDeleted: false },
    });
    if (!entity) {
      throw new NotFoundException('Интеграция не найдена');
    }
    return this.toDto(entity);
  }

  async create(
    dto: CreateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    const entity = this.repo.create({
      name: dto.name,
      kind: dto.kind,
      description: dto.description ?? null,
      configJson: dto.config ? JSON.stringify(dto.config) : null,
      isEnabled: dto.isEnabled ?? true,
      isDeleted: false,
      lastSyncStatus: 'never',
      channelId: dto.channelId ?? null,
    });

    const saved = await this.repo.save(entity);

    // Создаём или привязываем канал
    await this.ensureChannel(saved);

    return this.toDto(saved);
  }

  async update(
    id: string,
    dto: UpdateIntegrationConnectionDto,
  ): Promise<IntegrationConnectionDto> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Интеграция не найдена');
    }

    // Обновляем поля, которые пришли
    if (dto.name !== undefined) {
      entity.name = dto.name;
    }
    if (dto.kind !== undefined) {
      entity.kind = dto.kind as IntegrationKind;
    }
    if (dto.channelId !== undefined) {
      entity.channelId = dto.channelId;
    }
    if (dto.description !== undefined) {
      entity.description = dto.description;
    }
    if (dto.isEnabled !== undefined) {
      entity.isEnabled = dto.isEnabled;
    }
    if (dto.isDeleted !== undefined) {
      entity.isDeleted = dto.isDeleted;
    }
    if (dto.config !== undefined) {
      entity.configJson =
        dto.config === null ? null : JSON.stringify(dto.config);
    }

    const saved = await this.repo.save(entity);

    // Гарантируем, что канал существует и привязан
    await this.ensureChannel(saved);

    return this.toDto(saved);
  }

  async softDelete(id: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Интеграция не найдена');
    }
    entity.isDeleted = true;
    await this.repo.save(entity);
  }

  /* ============================================================
   * ТЕСТ ПОДКЛЮЧЕНИЯ
   * ============================================================ */
  async testConnection(id: string): Promise<TestConnectionResult> {
    const entity = await this.repo.findOne({
      where: { id, isDeleted: false },
    });
    if (!entity) {
      throw new NotFoundException('Интеграция не найдена');
    }

    const adapter = this.registry.getAdapter(entity.kind);
    if (!adapter) {
      return { ok: false, message: `Адаптер ${entity.kind} не найден` };
    }

    return adapter.testConnection(entity);
  }

  /* ============================================================
   * АГРЕГАТЫ ПО ПРОДАЖАМ
   * ============================================================ */
  private async refreshAggregates(entity: IntegrationConnection): Promise<void> {
    if (!entity.channelId) return;

    const agg = await this.salesRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'cnt')
      .addSelect('COALESCE(SUM(s.amount),0)', 'sum')
      .where('s.channelId = :cid', { cid: entity.channelId })
      .getRawOne<{ cnt: string; sum: string }>();

    const count = Number(agg?.cnt ?? 0);
    const sum = Number(agg?.sum ?? 0);

    entity.totalSalesCount = count;
    entity.totalSalesAmount = sum;

    // валюта по самой популярной валюте
    const byCurrency = await this.salesRepo
      .createQueryBuilder('s')
      .select('s.currency', 'currency')
      .addSelect('COUNT(*)', 'cnt')
      .where('s.channelId = :cid', { cid: entity.channelId })
      .groupBy('s.currency')
      .orderBy('cnt', 'DESC')
      .limit(1)
      .getRawMany<{ currency: string; cnt: string }>();

    if (byCurrency.length) {
      entity.currency = byCurrency[0].currency;
    }
  }

  /* ============================================================
   * СИНХРОНИЗАЦИЯ ПРОДАЖ
   * ============================================================ */
  async sync(id: string): Promise<SyncResult> {
    const entity = await this.repo.findOne({
      where: { id, isDeleted: false },
    });
    if (!entity) {
      throw new NotFoundException('Интеграция не найдена');
    }

    // Создаём/восстанавливаем канал
    await this.ensureChannel(entity);

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

      await this.refreshAggregates(entity);

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