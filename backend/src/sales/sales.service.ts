// src/sales/sales.service.ts
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { Sale } from './sale.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { IntegrationKind } from '../integrations/integration-kind.enum';

import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import {
  SalesStatsDto,
  SalesByStatusDto,
  SalesByCurrencyDto,
} from './dto/sales-stats.dto';
import { SaleDetailDto } from './dto/sale-detail.dto';

// строковый тип статуса из сущности
type SaleStatusString = Sale['status'];

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,

    @InjectRepository(SalesChannel)
    private readonly channelRepo: Repository<SalesChannel>,

    @InjectRepository(IntegrationConnection)
    private readonly integrationsRepo: Repository<IntegrationConnection>,
  ) {}

  /* ───────────────────── helpers ───────────────────── */

  private buildDateRange(from?: string, to?: string) {
    if (!from && !to) return undefined;

    const start = from ? new Date(from + 'T00:00:00.000Z') : undefined;
    const end = to ? new Date(to + 'T23:59:59.999Z') : undefined;

    if (start && end) return Between(start, end);
    if (start) return MoreThanOrEqual(start);
    if (end) return LessThanOrEqual(end);
    return undefined;
  }

  // маппинг наших статусов → WooCommerce
  private mapStatusToWoo(status: SaleStatusString): string {
    switch (status) {
      case 'refunded':
        return 'refunded';
      case 'cancelled':
        return 'cancelled';
      case 'confirmed':
        return 'completed';
      case 'pending':
        return 'processing';
      case 'new':
      default:
        return 'pending';
    }
  }

  /**
   * Отправка статуса в WooCommerce
   * (best-effort: если нет интеграции / настроек — тихо выходим)
   */
  private async syncStatusToWoo(sale: Sale): Promise<void> {
    // без externalOrderNo обновлять нечего
    if (!sale.externalOrderNo) return;
    if (!sale.channelId) return;

    // ищем интеграцию по channelId
    const integration = await this.integrationsRepo.findOne({
    where: {
    channelId: sale.channelId,
    tenantId: sale.tenantId,
    isDeleted: false,
     } as any,
    });
    if (!integration) return;

    const integAny: any = integration;

    // проверяем, что это WooCommerce (по kind или любому твоему маркеру)
    const kind: any = integAny.kind;
    if (
      kind &&
      typeof kind === 'string' &&
      !kind.toLowerCase().includes('woo')
    ) {
      return;
    }

    const cfgRaw = integAny.configJson || integAny.settingsJson;
    if (!cfgRaw) return;

    let cfg: any;
    try {
      cfg = typeof cfgRaw === 'string' ? JSON.parse(cfgRaw) : cfgRaw;
    } catch {
      return;
    }

    const baseUrl: string | undefined =
      cfg.baseUrl || cfg.url || cfg.siteUrl;
    const consumerKey: string | undefined = cfg.consumerKey;
    const consumerSecret: string | undefined = cfg.consumerSecret;

    if (!baseUrl || !consumerKey || !consumerSecret) return;

    const wpStatus = this.mapStatusToWoo(sale.status);
    const urlBase = baseUrl.replace(/\/+$/, '');
    const url =
      `${urlBase}/wp-json/wc/v3/orders/${sale.externalOrderNo}` +
      `?consumer_key=${encodeURIComponent(consumerKey)}` +
      `&consumer_secret=${encodeURIComponent(consumerSecret)}`;

    try {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: wpStatus }),
      });
    } catch {
      // логирование можно добавить позже
    }
  }

  /* ───────────────────── list / stats ───────────────────── */

  /**
   * Список продаж конкретного арендатора
   */
async list(tenantId: string, query: ListSalesQueryDto) {
  const {
    page = 1,
    pageSize = 25,
    from,
    to,
    status,
    channelId,
    search,
  } = query;

  // базовый фильтр: только свой тенант
  const where: any = {
    tenantId,
  };

  const dateRange = this.buildDateRange(from, to);
  if (dateRange) {
    where.saleDate = dateRange;
  }

  if (channelId) {
    where.channelId = channelId;
  }

  if (status) {
    where.status = status;
  }

  const searchConditions: any[] = [];
  if (search && search.trim()) {
    const s = search.trim();
    searchConditions.push(
      { ...where, id: ILike(`%${s}%`) },
      { ...where, externalId: ILike(`%${s}%`) },
      { ...where, agentName: ILike(`%${s}%`) },
      { ...where, hotel: ILike(`%${s}%`) },
      { ...where, market: ILike(`%${s}%`) },
    );
  }

  const [items, total] = await this.saleRepo.findAndCount({
    where: searchConditions.length ? searchConditions : where,
    order: { saleDate: 'DESC', createdAt: 'DESC' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items,
    total,
    page,
    pageSize,
  };
}

  /**
   * Статистика по продажам арендатора
   */
async getStats(tenantId: string, query: ListSalesQueryDto): Promise<SalesStatsDto> {
  const { from, to, status, channelId, search } = query;

  const qb = this.saleRepo.createQueryBuilder('s');

  // 👇 первый фильтр — свой тенант
  qb.where('s."tenantId" = :tenantId', { tenantId });

  if (from) {
    qb.andWhere('s.saleDate >= :from', {
      from: from + 'T00:00:00.000Z',
    });
  }
  if (to) {
    qb.andWhere('s.saleDate <= :to', {
      to: to + 'T23:59:59.999Z',
    });
  }
  if (channelId) {
    qb.andWhere('s.channelId = :channelId', { channelId });
  }
  if (status) {
    qb.andWhere('s.status = :status', { status });
  }
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    qb.andWhere(
      '(s.id ILIKE :s OR s.externalId ILIKE :s OR s.agentName ILIKE :s OR s.hotel ILIKE :s OR s.market ILIKE :s)',
      { s },
    );
  }

    // total + avg
    const baseAgg = await qb
      .clone()
      .select('COUNT(*)', 'totalCount')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'totalAmount')
      .getRawOne<{ totalCount: string; totalAmount: string }>();

    const totalCount = Number(baseAgg?.totalCount || 0);
    const totalAmount = Number(baseAgg?.totalAmount || 0);
    const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;

    // по статусам
    const byStatusRaw = await qb
      .clone()
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'amount')
      .groupBy('s.status')
      .getRawMany<{
        status: SaleStatusString;
        count: string;
        amount: string;
      }>();

    const byStatus: SalesByStatusDto[] = byStatusRaw.map((r) => ({
      status: r.status as any,
      count: Number(r.count || 0),
      amount: Number(r.amount || 0),
    }));

    // по валютам
    const byCurrencyRaw = await qb
      .clone()
      .select('s.currency', 'currency')
      .addSelect('COALESCE(SUM(s.amount), 0)', 'amount')
      .groupBy('s.currency')
      .getRawMany<{ currency: string; amount: string }>();

    const byCurrency: SalesByCurrencyDto[] = byCurrencyRaw.map((r) => ({
      currency: r.currency,
      amount: Number(r.amount || 0),
    }));

    return {
      totalAmount,
      totalCount,
      avgCheck,
      byStatus,
      byCurrency,
    };
  }

  /* ───────────────────── детальная карточка ───────────────────── */
  async findOneDetailed(tenantId: string, id: string): Promise<SaleDetailDto> {
  const sale = await this.saleRepo.findOne({
    where: { id, tenantId } as any,
  });
  if (!sale) {
    throw new NotFoundException('Sale not found');
  }

  let channelShort: SaleDetailDto['channel'] = null;
  let integrationShort: SaleDetailDto['integration'] = null;

  // Канал тоже, скорее всего, мультитенантный
  if (sale.channelId) {
    const channel = await this.channelRepo.findOne({
      where: {
        id: sale.channelId,
        tenantId,
        isDeleted: false,
      } as any,
    });

    if (channel) {
      channelShort = {
        id: channel.id,
        name: channel.name,
        type: (channel as any).type ?? 'other',
      };
    }

      // Интеграция по channelId
      const integration = await this.integrationsRepo.findOne({
        where: {
          channelId: sale.channelId,
          tenantId,
          isDeleted: false,
        } as any,
      });

      if (integration) {
        integrationShort = {
          id: integration.id,
          name: integration.name,
          kind: ((integration as any).kind ??
            'other') as IntegrationKind,
        };
      }
    }

    // metaJson → meta
    let meta: Record<string, any> | null = null;
    const rawMeta = (sale as any).metaJson;
    if (rawMeta) {
      try {
        meta =
          typeof rawMeta === 'string'
            ? JSON.parse(rawMeta)
            : rawMeta;
      } catch {
        meta = null;
      }
    }

    const plainSale = { ...(sale as any) };
    delete plainSale.metaJson;

    return {
      id: sale.id,
      channel: channelShort,
      integration: integrationShort,
      sale: plainSale,
      meta,
    };
  }

  /* ───────────────────── update ───────────────────── */

  async update(
    tenantId: string,
    id: string,
    dto: UpdateSaleDto,
  ): Promise<Sale> {
  const sale = await this.saleRepo.findOne({
    where: { id, tenantId } as any,
  });
  if (!sale) {
    throw new NotFoundException('Sale not found');
  }

    if (dto.status !== undefined) {
      // DTO использует enum, в сущности — строка; берём raw значение
      sale.status = dto.status as any;
    }
    if (dto.managerName !== undefined) {
      sale.managerName = dto.managerName;
    }
    if (dto.notes !== undefined) {
      sale.notes = dto.notes;
    }
    if (dto.leadId !== undefined) {
      // можно хранить как UUID либо null
      (sale as any).leadId = dto.leadId || null;
    }

    const saved = await this.saleRepo.save(sale);

    // синхронизируем статус с WooCommerce (где это применимо)
    try {
      await this.syncStatusToWoo(saved);
    } catch {
      // не роняем ответ, если внешний сервис упал
    }

    return saved;
  }
}