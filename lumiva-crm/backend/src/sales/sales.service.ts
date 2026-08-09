// src/sales/sales.service.ts
import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  IsNull,
  SelectQueryBuilder,
} from 'typeorm';
import { randomBytes } from 'crypto';

import { Sale } from './sale.entity';
import { Lead } from '../leads/lead.entity';
import { Contact } from '../contacts/contact.entity';
import { SalesChannel } from '../sales-channels/sales-channel.entity';
import { IntegrationConnection } from '../integrations/integration-connection.entity';
import { IntegrationKind } from '../integrations/integration-kind.enum';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import {
  SalesStatsDto,
  SalesByStatusDto,
  SalesByCurrencyDto,
} from './dto/sales-stats.dto';
import { SaleDetailDto } from './dto/sale-detail.dto';
import { SalesAnalyticsQueryDto } from './dto/sales-analytics-query.dto';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { FieldType } from '../custom-fields/custom-field.entity';
import { AnalyticsPreset } from './sales-analytics-preset.entity';
import { SaveAnalyticsPresetDto } from './dto/save-analytics-preset.dto';
import { LeadsService } from '../leads/leads.service';
import { AuditLogService } from '../audit-log/audit-log.service';

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

    @InjectRepository(AnalyticsPreset)
    private readonly presetsRepo: Repository<AnalyticsPreset>,

    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,

    @InjectRepository(Contact)
    private readonly contactsRepo: Repository<Contact>,

    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,

    @Inject(forwardRef(() => LeadsService))
    private readonly leadsService: LeadsService,

    private readonly customFieldsService: CustomFieldsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /* ───────────────────── helpers ───────────────────── */

  private parseIsoDate(value?: string | null) {
    if (!value) return null;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return null;
    return new Date(ts);
  }

  private getMonthKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private parseNumber(value: any): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.');
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private coerceArray(value: any): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v));
    if (value === null || value === undefined) return [];
    const raw = String(value).trim();
    if (!raw) return [];
    if (raw.includes(',')) {
      return raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    return [raw];
  }

  private bucketizeNumbers(values: number[]) {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return [{ label: `${min}`, values }];
    }
    const step = (max - min) / 5;
    const buckets = Array.from({ length: 5 }, (_, idx) => {
      const start = min + step * idx;
      const end = idx === 4 ? max : min + step * (idx + 1);
      return { start, end, values: [] as number[] };
    });
    values.forEach((value) => {
      const index = Math.min(4, Math.floor((value - min) / step));
      buckets[index].values.push(value);
    });
    return buckets.map((bucket) => ({
      label: `${Math.round(bucket.start)}–${Math.round(bucket.end)}`,
      values: bucket.values,
    }));
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
   * Только продажи, привязанные к живому каналу из справочника «Каналы продаж»
   * (не удалённый, не «висящий» без канала).
   */
  private applyListedSalesOnlyJoin(qb: SelectQueryBuilder<Sale>): void {
    qb.innerJoin(
      's.channel',
      'listedSalesChannel',
      'listedSalesChannel.isDeleted = :listedSalesChannelDeleted',
      { listedSalesChannelDeleted: false },
    );
  }

  /** Карточка / PATCH доступны только для таких же продаж, что и в списке. */
  private async assertSaleListedForTenant(
    tenantId: string,
    sale: Sale,
  ): Promise<void> {
    if (!sale.channelId) {
      throw new NotFoundException('Sale not found');
    }
    const ch = await this.channelRepo.findOne({
      where: {
        id: sale.channelId,
        tenantId,
        isDeleted: false,
      } as any,
    });
    if (!ch) {
      throw new NotFoundException('Sale not found');
    }
  }

  private looksLikeUuid(s: string): boolean {
    return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      s.trim(),
    );
  }

  private extractHostnameFromUrl(raw?: string | null): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const t = raw.trim();
    if (!t) return null;
    try {
      const u = t.includes('://') ? new URL(t) : new URL(`https://${t}`);
      const host = u.hostname.replace(/^www\./i, '');
      return host || null;
    } catch {
      return null;
    }
  }

  private siteHostFromIntegration(integ: IntegrationConnection): string | null {
    const rawCfg = (integ as any).configJson;
    if (!rawCfg) return null;
    let cfg: any;
    try {
      cfg = typeof rawCfg === 'string' ? JSON.parse(rawCfg) : rawCfg;
    } catch {
      return null;
    }
    const baseUrl = cfg.baseUrl || cfg.url || cfg.siteUrl;
    return this.extractHostnameFromUrl(baseUrl);
  }

  private integrationKindDisplayLabel(kind: string): string {
    const k = kind.toLowerCase();
    switch (k) {
      case 'woocommerce':
        return 'WooCommerce';
      case 'manual-import':
        return 'Manual import';
      case 'third_party_link':
        return 'Integration';
      case 'other':
        return 'Other';
      default:
        return kind || '';
    }
  }

  /**
   * Ссылка WooCommerce admin + человекочитаемые подписи канала (домен и тип интеграции).
   */
  private async enrichSalesListPayload(
    tenantId: string,
    sales: Sale[],
  ): Promise<void> {
    const channelIds = [
      ...new Set(sales.map((s) => s.channelId).filter(Boolean)),
    ] as string[];
    if (!channelIds.length) return;

    const [integrations, channels] = await Promise.all([
      this.integrationsRepo.find({
        where: {
          tenantId,
          channelId: In(channelIds),
          isDeleted: false,
        } as any,
      }),
      this.channelRepo.find({
        where: {
          tenantId,
          id: In(channelIds),
          isDeleted: false,
        } as any,
      }),
    ]);

    const byChannel = new Map(
      integrations.map((i) => [(i as any).channelId as string, i]),
    );
    const channelById = new Map(channels.map((c) => [c.id, c]));

    for (const sale of sales) {
      if (!sale.channelId) continue;
      const integ = byChannel.get(sale.channelId);
      const ch = channelById.get(sale.channelId);

      if (sale.externalOrderNo && integ) {
        const rawCfg = (integ as any).configJson;
        if (rawCfg) {
          let cfg: any;
          try {
            cfg = typeof rawCfg === 'string' ? JSON.parse(rawCfg) : rawCfg;
          } catch {
            cfg = null;
          }
          if (cfg) {
            const baseUrl: string | undefined =
              cfg.baseUrl || cfg.url || cfg.siteUrl;
            if (baseUrl && typeof baseUrl === 'string') {
              const postId = String(sale.externalOrderNo).trim();
              if (/^\d+$/.test(postId)) {
                const origin = baseUrl.replace(/\/+$/, '');
                (sale as any).wooAdminEditUrl = `${origin}/wp-admin/post.php?post=${encodeURIComponent(postId)}&action=edit`;
              }
            }
          }
        }
      }

      let siteLabel: string | null = null;
      if (integ) {
        siteLabel = this.siteHostFromIntegration(integ);
        const desc = String((integ as any).description || '').trim();
        if (!siteLabel && desc && !this.looksLikeUuid(desc)) {
          siteLabel = desc;
        }
      }
      if (!siteLabel && ch?.name?.trim()) {
        const n = ch.name.trim();
        if (!this.looksLikeUuid(n)) siteLabel = n;
      }

      let integrationLabel: string | null = null;
      if (integ?.kind) {
        integrationLabel = this.integrationKindDisplayLabel(String(integ.kind));
      }
      if (!integrationLabel && ch?.integrationName?.trim()) {
        const n = ch.integrationName.trim();
        if (!this.looksLikeUuid(n)) integrationLabel = n;
      }
      if (!integrationLabel && integ?.name?.trim()) {
        integrationLabel = integ.name.trim();
      }

      (sale as any).channelSiteLabel = siteLabel || null;
      (sale as any).channelIntegrationLabel = integrationLabel || null;
    }
  }

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
      leadId,
    } = query;

    const qb = this.saleRepo.createQueryBuilder('s');
    qb.where('s.tenantId = :tenantId', { tenantId });
    this.applyListedSalesOnlyJoin(qb);

    const leadIdTrimmed = leadId?.trim();
    if (leadIdTrimmed) {
      qb.andWhere('s.leadId = :filterLeadId', {
        filterLeadId: leadIdTrimmed,
      });
    }

    if (from) {
      qb.andWhere('s.saleDate >= :fromDate', {
        fromDate: new Date(from + 'T00:00:00.000Z'),
      });
    }
    if (to) {
      qb.andWhere('s.saleDate <= :toDate', {
        toDate: new Date(to + 'T23:59:59.999Z'),
      });
    }
    if (channelId) {
      qb.andWhere('s.channelId = :channelId', { channelId });
    }
    if (status) {
      qb.andWhere('s.status = :status', { status });
    }
    if (search?.trim()) {
      const pattern = `%${search.trim()}%`;
      qb.andWhere(
        `(CAST(s.id AS TEXT) ILIKE :searchPattern OR s.externalId ILIKE :searchPattern OR s.externalOrderNo ILIKE :searchPattern OR s.guestName ILIKE :searchPattern OR s.agentName ILIKE :searchPattern OR s.hotel ILIKE :searchPattern OR s.market ILIKE :searchPattern)`,
        { searchPattern: pattern },
      );
    }

    qb.orderBy('s.saleDate', 'DESC').addOrderBy('s.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    await this.enrichSalesListPayload(tenantId, items);

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
  async getStats(
    tenantId: string,
    query: ListSalesQueryDto,
  ): Promise<SalesStatsDto> {
    const {
      from,
      to,
      status,
      channelId,
      search,
      currencyMode = 'native',
      displayCurrency = 'EUR',
      rates,
    } = query;

    let rateMap: Record<string, number> = {};
    if (rates) {
      try {
        rateMap = JSON.parse(rates);
      } catch {
        rateMap = {};
      }
    }

    const qb = this.saleRepo.createQueryBuilder('s');

    // 👇 первый фильтр — свой тенант
    qb.where('s."tenantId" = :tenantId', { tenantId });
    this.applyListedSalesOnlyJoin(qb);

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
        '(CAST(s.id AS TEXT) ILIKE :s OR s.externalId ILIKE :s OR s.externalOrderNo ILIKE :s OR s.guestName ILIKE :s OR s.agentName ILIKE :s OR s.hotel ILIKE :s OR s.market ILIKE :s)',
        { s },
      );
    }

    const sales = await qb
      .clone()
      .select(['s.id', 's.status', 's.amount', 's.currency'])
      .getMany();

    const normalizeCurrency = (currency?: string | null) =>
      String(currency || 'EUR').toUpperCase().slice(0, 8) || 'EUR';
    const reportCurrency = normalizeCurrency(displayCurrency);
    const convertAmount = (amountRaw: unknown, currencyRaw: unknown) => {
      const amount = Number(amountRaw) || 0;
      const currency = normalizeCurrency(String(currencyRaw || 'EUR'));
      if (currencyMode !== 'converted') return amount;
      if (currency === reportCurrency) return amount;
      const rate = rateMap[currency];
      return rate && Number.isFinite(rate) && rate > 0 ? amount * rate : 0;
    };

    const totalCount = sales.length;
    const totalAmount = sales.reduce(
      (sum, sale) => sum + convertAmount(sale.amount, sale.currency),
      0,
    );
    const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;

    const byStatusMap = new Map<SaleStatusString, SalesByStatusDto>();
    const byCurrencyMap = new Map<string, SalesByCurrencyDto>();
    for (const sale of sales) {
      const statusKey = (sale.status || 'other') as SaleStatusString;
      const statusRow =
        byStatusMap.get(statusKey) ||
        ({ status: statusKey as any, count: 0, amount: 0 } satisfies SalesByStatusDto);
      statusRow.count += 1;
      statusRow.amount += convertAmount(sale.amount, sale.currency);
      byStatusMap.set(statusKey, statusRow);

      const currencyKey = normalizeCurrency(sale.currency);
      const currencyRow =
        byCurrencyMap.get(currencyKey) ||
        ({ currency: currencyKey, amount: 0 } satisfies SalesByCurrencyDto);
      currencyRow.amount += Number(sale.amount) || 0;
      byCurrencyMap.set(currencyKey, currencyRow);
    }

    const byStatus = Array.from(byStatusMap.values());
    const byCurrency = Array.from(byCurrencyMap.values());

    return {
      totalAmount,
      totalCount,
      avgCheck,
      byStatus,
      byCurrency,
    };
  }

  /* ───────────────────── analytics ───────────────────── */

  async getAnalytics(tenantId: string, query: SalesAnalyticsQueryDto) {
    const {
      from,
      to,
      dateField = 'saleDate',
      channelIds,
      status,
      search,
      currencyMode = 'converted',
      displayCurrency = 'EUR',
      rates,
      sampleLimit = 200,
    } = query;

    const channelIdList = channelIds
      ? channelIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    let rateMap: Record<string, number> = {};
    if (rates) {
      try {
        rateMap = JSON.parse(rates);
      } catch {
        rateMap = {};
      }
    }

    const qb = this.saleRepo.createQueryBuilder('s');
    qb.where('s.\"tenantId\" = :tenantId', { tenantId });
    this.applyListedSalesOnlyJoin(qb);

    if (channelIdList.length > 0) {
      qb.andWhere('s.\"channelId\" IN (:...channelIds)', {
        channelIds: channelIdList,
      });
    }
    if (status) {
      qb.andWhere('s.status = :status', { status });
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      qb.andWhere(
        '(CAST(s.id AS TEXT) ILIKE :s OR s.externalId ILIKE :s OR s.externalOrderNo ILIKE :s OR s.guestName ILIKE :s OR s.agentName ILIKE :s OR s.hotel ILIKE :s OR s.market ILIKE :s)',
        { s },
      );
    }

    qb.select([
      's.id',
      's.channelId',
      's.status',
      's.amount',
      's.currency',
      's.hotel',
      's.market',
      's.managerName',
      's.agentName',
      's.saleDate',
      's.createdAt',
      's.customFields',
      's.guestName',
    ]);

    const sales = await qb.getMany();

    const getSaleDate = (sale: Sale) => {
      const primary = this.parseIsoDate((sale as any)[dateField]);
      if (primary) return primary;
      const fallback = dateField === 'saleDate' ? 'createdAt' : 'saleDate';
      return this.parseIsoDate((sale as any)[fallback]);
    };

    const fromDate = from ? this.parseIsoDate(from + 'T00:00:00.000Z') : null;
    const toDate = to ? this.parseIsoDate(to + 'T23:59:59.999Z') : null;

    const filtered = sales.filter((sale) => {
      const d = getSaleDate(sale);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const convertAmount = (sale: Sale) => {
      if (currencyMode === 'native') {
        return sale.currency === displayCurrency ? sale.amount : 0;
      }
      const rate =
        rateMap[sale.currency] ??
        (sale.currency === displayCurrency ? 1 : 0);
      return rate ? sale.amount * rate : 0;
    };

    const totalCount = filtered.length;
    const totalAmount = filtered.reduce(
      (sum, sale) => sum + convertAmount(sale),
      0,
    );
    const avgCheck = totalCount > 0 ? totalAmount / totalCount : 0;

    const byStatusMap = new Map<string, { status: string; count: number; amount: number }>();
    const byChannelMap = new Map<string, { channelId: string | null; label: string; count: number; amount: number }>();
    const byProductMap = new Map<string, { label: string; count: number; amount: number }>();
    const byMarketMap = new Map<string, { label: string; count: number; amount: number }>();
    const byManagerMap = new Map<string, { label: string; count: number; amount: number }>();
    const byCurrencyMap = new Map<string, { label: string; count: number; amount: number }>();

    const channelIdsUsed = new Set<string>();

    filtered.forEach((sale) => {
      const amount = convertAmount(sale);
      const statusKey = sale.status || 'other';
      const statusRow = byStatusMap.get(statusKey) ?? {
        status: statusKey,
        count: 0,
        amount: 0,
      };
      statusRow.count += 1;
      statusRow.amount += amount;
      byStatusMap.set(statusKey, statusRow);

      const channelKey = sale.channelId || 'unknown';
      if (sale.channelId) {
        channelIdsUsed.add(sale.channelId);
      }
      const channelRow = byChannelMap.get(channelKey) ?? {
        channelId: sale.channelId,
        label: channelKey,
        count: 0,
        amount: 0,
      };
      channelRow.count += 1;
      channelRow.amount += amount;
      byChannelMap.set(channelKey, channelRow);

      const productKey = sale.hotel || '—';
      const productRow = byProductMap.get(productKey) ?? {
        label: productKey,
        count: 0,
        amount: 0,
      };
      productRow.count += 1;
      productRow.amount += amount;
      byProductMap.set(productKey, productRow);

      const marketKey = sale.market || '—';
      const marketRow = byMarketMap.get(marketKey) ?? {
        label: marketKey,
        count: 0,
        amount: 0,
      };
      marketRow.count += 1;
      marketRow.amount += amount;
      byMarketMap.set(marketKey, marketRow);

      const managerKey = sale.managerName || sale.agentName || '—';
      const managerRow = byManagerMap.get(managerKey) ?? {
        label: managerKey,
        count: 0,
        amount: 0,
      };
      managerRow.count += 1;
      managerRow.amount += amount;
      byManagerMap.set(managerKey, managerRow);

      const currencyKey = sale.currency || '—';
      const currencyRow = byCurrencyMap.get(currencyKey) ?? {
        label: currencyKey,
        count: 0,
        amount: 0,
      };
      currencyRow.count += 1;
      currencyRow.amount += sale.amount;
      byCurrencyMap.set(currencyKey, currencyRow);
    });

    const channelMeta = channelIdsUsed.size
      ? await this.channelRepo.find({
          where: { tenantId, id: In(Array.from(channelIdsUsed)) } as any,
        })
      : [];
    const channelNameMap = new Map(
      channelMeta.map((ch) => [ch.id, ch.name]),
    );
    byChannelMap.forEach((row, key) => {
      if (row.channelId && channelNameMap.has(row.channelId)) {
        row.label = channelNameMap.get(row.channelId) as string;
      } else if (key === 'unknown') {
        row.label = '—';
      }
    });

    const limitTop = <T extends { count: number; amount: number }>(
      rows: T[],
      limit = 12,
    ) => {
      if (rows.length <= limit) return rows;
      const sorted = [...rows].sort((a, b) => b.count - a.count);
      const top = sorted.slice(0, limit - 1);
      const rest = sorted.slice(limit - 1);
      const restCount = rest.reduce((sum, item) => sum + item.count, 0);
      const restAmount = rest.reduce((sum, item) => sum + item.amount, 0);
      return [...top, { ...(top[0] as any), label: 'Other', count: restCount, amount: restAmount }];
    };

    const timelineCountMap = new Map<string, Record<string, any>>();
    const timelineAmountMap = new Map<string, Record<string, any>>();

    filtered.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;
      const month = this.getMonthKey(date);
      const channelKey = sale.channelId || 'unknown';

      const countRow = timelineCountMap.get(month) ?? { month };
      countRow[channelKey] = (countRow[channelKey] || 0) + 1;
      timelineCountMap.set(month, countRow);

      const amountRow = timelineAmountMap.get(month) ?? { month };
      amountRow[channelKey] = (amountRow[channelKey] || 0) + convertAmount(sale);
      timelineAmountMap.set(month, amountRow);
    });

    const timelineCount = Array.from(timelineCountMap.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );
    const timelineAmount = Array.from(timelineAmountMap.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month)),
    );

    const customFields = await this.customFieldsService.findByEntityType(
      tenantId,
      'sale',
    );

    const customFieldStats: Record<
      string,
      { key: string; label: string; type: string; items: Array<{ label: string; count: number; amount: number }> }
    > = {};

    customFields.forEach((field) => {
      if (!field.isActive) return;

      if (field.type === FieldType.NUMBER) {
        const numbers = filtered
          .map((sale) => this.parseNumber((sale.customFields || {})[field.key]))
          .filter((v): v is number => v !== null);
        const buckets = this.bucketizeNumbers(numbers);
        const rows = buckets.map((bucket) => ({
          label: bucket.label,
          count: 0,
          amount: 0,
        }));
        filtered.forEach((sale) => {
          const numeric = this.parseNumber((sale.customFields || {})[field.key]);
          if (numeric === null) return;
          const bucketIndex = buckets.findIndex((b) => b.values.includes(numeric));
          if (bucketIndex === -1) return;
          rows[bucketIndex].count += 1;
          rows[bucketIndex].amount += convertAmount(sale);
        });
        customFieldStats[field.key] = {
          key: field.key,
          label: field.label,
          type: field.type,
          items: limitTop(rows, 12),
        };
        return;
      }

      if (field.type === FieldType.DATE || field.type === FieldType.DATETIME) {
        const map = new Map<string, { label: string; count: number; amount: number }>();
        filtered.forEach((sale) => {
          const raw = (sale.customFields || {})[field.key];
          const date = this.parseIsoDate(raw ? String(raw) : null);
          if (!date) return;
          const label = this.getMonthKey(date);
          const row = map.get(label) ?? { label, count: 0, amount: 0 };
          row.count += 1;
          row.amount += convertAmount(sale);
          map.set(label, row);
        });
        const items = Array.from(map.values()).sort((a, b) =>
          a.label.localeCompare(b.label),
        );
        customFieldStats[field.key] = {
          key: field.key,
          label: field.label,
          type: field.type,
          items: limitTop(items, 12),
        };
        return;
      }

      const map = new Map<string, { label: string; count: number; amount: number }>();
      filtered.forEach((sale) => {
        const raw = (sale.customFields || {})[field.key];
        if (raw === undefined || raw === null || raw === '') return;
        const values =
          field.type === FieldType.MULTISELECT
            ? this.coerceArray(raw)
            : [String(raw)];
        values.forEach((value) => {
          const label = value || '—';
          const row = map.get(label) ?? { label, count: 0, amount: 0 };
          row.count += 1;
          row.amount += convertAmount(sale);
          map.set(label, row);
        });
      });
      customFieldStats[field.key] = {
        key: field.key,
        label: field.label,
        type: field.type,
        items: limitTop(Array.from(map.values()), 12),
      };
    });

    const sampleSales = [...filtered]
      .sort((a, b) => {
        const da = getSaleDate(a)?.getTime() ?? 0;
        const db = getSaleDate(b)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, sampleLimit);

    return {
      totalCount,
      totalAmount,
      avgCheck,
      displayCurrency,
      currencyMode,
      byStatus: Array.from(byStatusMap.values()),
      byChannel: limitTop(Array.from(byChannelMap.values()), 12),
      byProduct: limitTop(Array.from(byProductMap.values()), 12),
      byMarket: limitTop(Array.from(byMarketMap.values()), 12),
      byManager: limitTop(Array.from(byManagerMap.values()), 12),
      byCurrency: limitTop(Array.from(byCurrencyMap.values()), 12),
      timeline: {
        count: timelineCount,
        amount: timelineAmount,
      },
      customFields: customFieldStats,
      sampleSales,
    };
  }

  async exportAnalytics(
    tenantId: string,
    query: SalesAnalyticsQueryDto,
    format: 'csv' | 'xls' | 'xlsx' | 'excel' = 'csv',
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const {
      from,
      to,
      dateField = 'saleDate',
      channelIds,
      status,
      search,
      currencyMode = 'converted',
      displayCurrency = 'EUR',
      rates,
    } = query;

    const channelIdList = channelIds
      ? channelIds.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    let rateMap: Record<string, number> = {};
    if (rates) {
      try {
        rateMap = JSON.parse(rates);
      } catch {
        rateMap = {};
      }
    }

    const qb = this.saleRepo.createQueryBuilder('s');
    qb.where('s."tenantId" = :tenantId', { tenantId });
    this.applyListedSalesOnlyJoin(qb);

    if (channelIdList.length > 0) {
      qb.andWhere('s."channelId" IN (:...channelIds)', {
        channelIds: channelIdList,
      });
    }
    if (status) {
      qb.andWhere('s.status = :status', { status });
    }
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      qb.andWhere(
        '(CAST(s.id AS TEXT) ILIKE :s OR s.externalId ILIKE :s OR s.externalOrderNo ILIKE :s OR s.guestName ILIKE :s OR s.agentName ILIKE :s OR s.hotel ILIKE :s OR s.market ILIKE :s)',
        { s },
      );
    }

    const sales = await qb.getMany();

    const getSaleDate = (sale: Sale) => {
      const primary = this.parseIsoDate((sale as any)[dateField]);
      if (primary) return primary;
      const fallback = dateField === 'saleDate' ? 'createdAt' : 'saleDate';
      return this.parseIsoDate((sale as any)[fallback]);
    };

    const fromDate = from ? this.parseIsoDate(from + 'T00:00:00.000Z') : null;
    const toDate = to ? this.parseIsoDate(to + 'T23:59:59.999Z') : null;

    const filtered = sales.filter((sale) => {
      const d = getSaleDate(sale);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const channelMeta = channelIdList.length
      ? await this.channelRepo.find({
          where: { tenantId, id: In(channelIdList) } as any,
        })
      : await this.channelRepo.find({ where: { tenantId } as any });
    const channelNameMap = new Map(channelMeta.map((ch) => [ch.id, ch.name]));

    const customFields = await this.customFieldsService.findByEntityType(
      tenantId,
      'sale',
    );

    const convertAmount = (sale: Sale) => {
      if (currencyMode === 'native') {
        return sale.currency === displayCurrency ? sale.amount : 0;
      }
      const rate =
        rateMap[sale.currency] ??
        (sale.currency === displayCurrency ? 1 : 0);
      return rate ? sale.amount * rate : 0;
    };

    const headers = [
      'id',
      'saleDate',
      'createdAt',
      'channelId',
      'channelName',
      'status',
      'amount',
      'currency',
      'amountConverted',
      'displayCurrency',
      'guestName',
      'managerName',
      'agentName',
      'hotel',
      'market',
      'externalId',
      'externalOrderNo',
      'checkInAt',
      'checkOutAt',
      'notes',
    ];

    customFields.forEach((field) => {
      headers.push(`custom:${field.key}`);
    });

    const escapeCsv = (value: any) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      if (/[\",\n]/.test(text)) {
        return `"${text.replace(/\"/g, '""')}"`;
      }
      return text;
    };

    const lines = [headers.join(',')];

    filtered.forEach((sale) => {
      const row: string[] = [];
      row.push(sale.id);
      row.push(sale.saleDate ? sale.saleDate.toISOString() : '');
      row.push(sale.createdAt ? sale.createdAt.toISOString() : '');
      row.push(sale.channelId || '');
      row.push(
        sale.channelId ? channelNameMap.get(sale.channelId) || '' : '',
      );
      row.push(sale.status || '');
      row.push(String(sale.amount ?? 0));
      row.push(sale.currency || '');
      row.push(String(convertAmount(sale)));
      row.push(displayCurrency);
      row.push(sale.guestName || '');
      row.push(sale.managerName || '');
      row.push(sale.agentName || '');
      row.push(sale.hotel || '');
      row.push(sale.market || '');
      row.push(sale.externalId || '');
      row.push(sale.externalOrderNo || '');
      row.push(sale.checkInAt ? sale.checkInAt.toISOString() : '');
      row.push(sale.checkOutAt ? sale.checkOutAt.toISOString() : '');
      row.push(sale.notes || '');

      const customValues = sale.customFields || {};
      customFields.forEach((field) => {
        const raw = customValues[field.key];
        row.push(
          raw === null || raw === undefined
            ? ''
            : typeof raw === 'object'
              ? JSON.stringify(raw)
              : String(raw),
        );
      });

      lines.push(row.map(escapeCsv).join(','));
    });

    const csv = lines.join('\n');
    const safeFormat = format === 'excel' ? 'xls' : format;
    const extension = safeFormat === 'csv' ? 'csv' : 'xls';
    const contentType =
      extension === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.ms-excel; charset=utf-8';
    const filename = `sales-analytics-export.${extension}`;

    return { filename, contentType, body: csv };
  }

  /* ───────────────────── presets ───────────────────── */

  async getAnalyticsPreset(tenantId: string, userId?: string | null) {
    const where: any = { tenantId, scope: 'sales' };
    where.userId = userId ? userId : IsNull();

    const preset = await this.presetsRepo.findOne({
      where,
    });
    return preset?.payload ?? null;
  }

  async saveAnalyticsPreset(
    tenantId: string,
    userId: string | null,
    dto: SaveAnalyticsPresetDto,
  ) {
    const where: any = { tenantId, scope: 'sales' };
    where.userId = userId ? userId : IsNull();

    let preset = await this.presetsRepo.findOne({
      where,
    });

    if (!preset) {
      preset = this.presetsRepo.create({
        tenantId,
        userId,
        scope: 'sales',
        payload: dto.payload,
      });
    } else {
      preset.payload = dto.payload;
    }

    const saved = await this.presetsRepo.save(preset);
    return { id: saved.id, payload: saved.payload };
  }

  /* ───────────────────── детальная карточка ───────────────────── */
  async findOneDetailed(tenantId: string, id: string): Promise<SaleDetailDto> {
    const sale = await this.saleRepo.findOne({
      where: { id, tenantId } as any,
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    await this.assertSaleListedForTenant(tenantId, sale);

    await this.enrichSalesListPayload(tenantId, [sale]);
    try {
      await this.leadsService.ensureLeadLinkedForSale(sale);
    } catch {
      /* не блокируем карточку при ошибке лида */
    }
    const saleRow =
      (await this.saleRepo.findOne({
        where: { id, tenantId } as any,
      })) ?? sale;
    await this.enrichSalesListPayload(tenantId, [saleRow]);

    let channelShort: SaleDetailDto['channel'] = null;
    let integrationShort: SaleDetailDto['integration'] = null;

    // Канал тоже, скорее всего, мультитенантный
    if (saleRow.channelId) {
      const channel = await this.channelRepo.findOne({
        where: {
          id: saleRow.channelId,
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
          channelId: saleRow.channelId,
          tenantId,
          isDeleted: false,
        } as any,
      });

      if (integration) {
        integrationShort = {
          id: integration.id,
          name: integration.name,
          kind: ((integration as any).kind ?? 'other') as IntegrationKind,
        };
      }
    }

    // metaJson → meta
    let meta: Record<string, any> | null = null;
    const rawMeta = (saleRow as any).metaJson;
    if (rawMeta) {
      try {
        meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      } catch {
        meta = null;
      }
    }

    const plainSale = { ...(saleRow as any) };
    delete plainSale.metaJson;

    return {
      id: saleRow.id,
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
    actorUserId?: string | null,
  ): Promise<Sale> {
    const sale = await this.saleRepo.findOne({
      where: { id, tenantId } as any,
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    await this.assertSaleListedForTenant(tenantId, sale);

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
    if (dto.customFields !== undefined) {
      (sale as any).customFields = dto.customFields;
    }

    const oldStatus = sale.status;
    const saved = await this.saleRepo.save(sale);

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.SALE_UPDATED,
        {
          entityType: 'sale',
          entityId: saved.id,
          sale: saved,
          changes: dto,
        },
      );

      // Если изменился статус, триггерим отдельное событие
      if (dto.status !== undefined && dto.status !== oldStatus) {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.SALE_STATUS_CHANGED,
          {
            entityType: 'sale',
            entityId: saved.id,
            sale: saved,
            oldStatus,
            newStatus: dto.status,
          },
        );
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    // синхронизируем статус с WooCommerce (где это применимо)
    try {
      await this.syncStatusToWoo(saved);
    } catch {
      // не роняем ответ, если внешний сервис упал
    }

    void this.auditLog.log({
      tenantId,
      entityType: 'sale',
      entityId: saved.id,
      entityLabel: saved.guestName || saved.externalOrderNo || saved.hotel,
      action: 'update',
      summary: dto.status !== undefined && dto.status !== oldStatus
        ? `Статус продажи изменён: ${oldStatus} → ${dto.status}`
        : 'Продажа обновлена',
      changes: dto.status !== undefined && dto.status !== oldStatus
        ? [{ field: 'status', oldValue: oldStatus, newValue: dto.status }]
        : null,
      actorUserId: actorUserId ?? null,
    });

    return saved;
  }

  async getRecent(tenantId: string, limit = 10): Promise<{ sales: Array<{ id: string; name: string | null; amount: number | null; currency: string | null; status: string; createdAt: Date }> }> {
    const rows = await this.saleRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 50),
    });
    const sales = rows.map((s) => ({
      id: s.id,
      name: s.guestName || s.agentName || null,
      amount: s.amount ?? null,
      currency: s.currency ?? null,
      status: s.status,
      createdAt: s.createdAt,
    }));
    return { sales };
  }

  /* ---------- публичный тестовый сторфронт (Товары на pl1) ---------- */

  /**
   * Находит Contact по телефону/email (приоритет — телефон), создаёт при отсутствии; затем
   * находит/создаёт Lead, привязанный к контакту. Копия `ReservationsService.resolveLeadAndContact`
   * (bookings/reservations.service.ts) — тот же приём уже намеренно продублирован под Bookings,
   * здесь под Sales по тому же принципу: модули не должны тянуть друг друга за такой мелкий кусок.
   */
  private async resolveLeadAndContactForOrder(
    tenantId: string,
    input: { name?: string | null; phone?: string | null; email?: string | null },
  ): Promise<{ leadId: string; contactId: string }> {
    const phone = input.phone?.trim() || null;
    const email = input.email?.trim().toLowerCase() || null;
    const name = input.name?.trim() || null;

    let contact = phone
      ? await this.contactsRepo.findOne({ where: { tenantId, phone } })
      : null;
    if (!contact && email) {
      contact = await this.contactsRepo.findOne({ where: { tenantId, email } });
    }
    if (!contact) {
      contact = await this.contactsRepo.save(
        this.contactsRepo.create({
          tenantId,
          fullName: name,
          firstName: name,
          phone,
          email,
          status: 'active',
        }),
      );
    }

    let lead = await this.leadsRepo.findOne({
      where: { tenantId, contactId: contact.id },
      order: { createdAt: 'DESC' },
    });
    if (!lead) {
      lead = await this.leadsRepo.save(
        this.leadsRepo.create({
          tenantId,
          contactId: contact.id,
          name: name || contact.fullName,
          phone,
          email,
          status: 'new',
          source: 'storefront',
        }),
      );
    }

    return { leadId: lead.id, contactId: contact.id };
  }

  private async generateOrderCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = `ORD-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.saleRepo.findOne({ where: { externalOrderNo: code } });
      if (!existing) return code;
    }
    throw new Error('Не удалось сгенерировать уникальный код заказа');
  }

  /** Создаёт заказ из тестовой публичной витрины (корзина товаров → Sale). */
  async createFromStorefront(
    tenantId: string,
    dto: {
      items: Array<{ productId: string; sku: string; name: string; qty: number; unitPrice: number }>;
      currency: string;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
    },
  ): Promise<Sale> {
    const amount = dto.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    const { leadId, contactId } = await this.resolveLeadAndContactForOrder(tenantId, {
      name: dto.customerName,
      phone: dto.customerPhone,
      email: dto.customerEmail,
    });
    const externalOrderNo = await this.generateOrderCode();

    const sale = this.saleRepo.create({
      tenantId,
      leadId,
      contactId,
      externalOrderNo,
      guestName: dto.customerName,
      amount,
      currency: dto.currency,
      status: 'new',
      saleDate: new Date(),
      customFields: { items: dto.items, customerEmail: dto.customerEmail ?? null, customerPhone: dto.customerPhone ?? null },
    });
    const saved = await this.saleRepo.save(sale);

    try {
      await this.automationsService.triggerAutomation(tenantId, TriggerEvent.SALE_CREATED, {
        entityType: 'sale',
        entityId: saved.id,
        sale: saved,
      });
    } catch {
      // автоматизации не должны блокировать оформление заказа
    }

    return saved;
  }

  async findStorefrontOrder(tenantId: string, code: string, email: string): Promise<Sale> {
    const sale = await this.saleRepo.findOne({ where: { tenantId, externalOrderNo: code } });
    const orderEmail = (sale?.customFields as any)?.customerEmail?.toLowerCase?.();
    if (!sale || !orderEmail || orderEmail !== email.trim().toLowerCase()) {
      throw new NotFoundException('Заказ не найден');
    }
    return sale;
  }
}
