// src/leads/leads.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';

import { Lead } from './lead.entity';
import { Site } from '../sites/site.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Sale } from '../sales/sale.entity';
import { Project } from '../projects/project.entity';
import { AutomationsService } from '../automations/automations.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TriggerEvent } from '../automations/automation.entity';

// Типы для статистики (форма ответа под фронт)
export interface LeadStatusStat {
  status: string;
  count: number;
}

export interface LeadSourceStat {
  source: string;
  count: number;
}

export interface LeadCountryStat {
  country: string;
  count: number;
}

export interface LeadManagerStat {
  manager: string; // assignedTo или "Без ответственного"
  total: number;
  won: number;
  lost: number;
}

export interface LeadStats {
  total: number;
  byStatus: LeadStatusStat[];
  bySource: LeadSourceStat[];
  byCountry: LeadCountryStat[];
  byManager: LeadManagerStat[];
}

// ===== ROI по лидам (используется и для продаж, и для проектов) =====
export interface LeadRoiRow {
  leadId: string;
  leadName: string | null;
  status: string | null;

  manager: string | null; // assignedTo
  channel: string | null; // source

  totalRevenue: number;
  dealsCount: number;

  firstDealAt: string | null;
  lastDealAt: string | null;

  currency: string;
}

export interface LeadsRoiStats {
  currency: string;          // базовая валюта отчёта
  totalRevenue: number;      // total по всем лидам
  leadsWithRevenue: number;  // кол-во лидов, давших деньги
  dealsCount: number;        // всего сделок/проектов
  avgCheck: number;          // средний чек (сделка/проект)
  from?: string | null;
  to?: string | null;
  items: LeadRoiRow[];
}

// ===== Утраты (lost) =====
export interface LostLeadManagerStat {
  manager: string;
  lost: number;
  amount: number;
}

export interface LostLeadItem {
  leadId: string;
  leadName: string | null;
  manager: string | null;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface LostLeadsStats {
  totalLost: number;
  totalAmount: number;
  currency: string;
  byManager: LostLeadManagerStat[];
  items: LostLeadItem[];
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadsRepo: Repository<Lead>,

    @InjectRepository(Site)
    private readonly sitesRepo: Repository<Site>,

    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,

    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,

    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,

    @Inject(forwardRef(() => IntegrationsService))
    private readonly integrationsService: IntegrationsService,
  ) {}

  /** meta.deleted — корзина; не участвует в агрегатах и ROI */
  private isLeadMetaDeleted(lead: Pick<Lead, 'meta'>): boolean {
    const m = lead.meta as { deleted?: boolean } | null | undefined;
    return Boolean(m?.deleted);
  }

  /** meta.deleted | meta.archived — как операционный список без архива */
  private isLeadOmittedFromDashboardStats(lead: Pick<Lead, 'meta'>): boolean {
    const m = lead.meta as { deleted?: boolean; archived?: boolean } | null | undefined;
    return Boolean(m?.deleted || m?.archived);
  }

  // ====== PRIVATE (CRM) ======

  private normalizeAssignees(dto: {
    assignedUserId?: string | null;
    assignedUserIds?: string[] | null;
    assignedTo?: string | null;
    assignedToList?: string[] | null;
  }) {
    const idsFromList = Array.isArray(dto.assignedUserIds)
      ? dto.assignedUserIds.filter(Boolean)
      : [];
    const namesFromList = Array.isArray(dto.assignedToList)
      ? dto.assignedToList.filter(Boolean)
      : [];
    const ids = idsFromList.length
      ? idsFromList
      : dto.assignedUserId
        ? [dto.assignedUserId]
        : [];
    const names = namesFromList.length
      ? namesFromList
      : dto.assignedTo
        ? [dto.assignedTo]
        : [];
    return {
      assignedUserIds: ids.length ? ids : null,
      assignedToList: names.length ? names : null,
      assignedUserId: ids.length ? ids[0] : dto.assignedUserId ?? null,
      assignedTo: names.length ? names.join(', ') : dto.assignedTo ?? null,
    };
  }

  async listForTenant(tenantId: string): Promise<Lead[]> {
    return this.leadsRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForTenant(tenantId: string, id: string): Promise<Lead> {
    const lead = await this.leadsRepo.findOne({
      where: { id, tenantId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  async getLeadWithProjects(
    tenantId: string,
    id: string,
  ): Promise<Lead | null> {
    return this.leadsRepo.findOne({
      where: { id, tenantId },
      relations: ['projects'],
    });
  }

  async createForTenant(
    tenantId: string,
    dto: CreateLeadDto,
  ): Promise<Lead> {
    const normalizedAssignees = this.normalizeAssignees(dto);
    const lead = this.leadsRepo.create({
      tenantId,
      siteId: dto.siteId ?? null,

      name: dto.name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      country: dto.country ?? null,

      status: dto.status ?? 'new',
      source: dto.source ?? 'crm',

      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmContent: dto.utmContent ?? null,
      utmTerm: dto.utmTerm ?? null,

      // ответственный
      assignedUserId: normalizedAssignees.assignedUserId,
      assignedUserIds: normalizedAssignees.assignedUserIds,
      assignedTo: normalizedAssignees.assignedTo,
      assignedToList: normalizedAssignees.assignedToList,

      // связи
      contactId: dto.contactId ?? null,
      companyId: dto.companyId ?? null,

      meta: dto.meta ?? null,
      customFields: dto.customFields ?? null,
    });

    const saved = await this.leadsRepo.save(lead);

    try {
      const m = (saved.meta as { meetings?: unknown[] } | null)?.meetings;
      if (Array.isArray(m) && m.length > 0) {
        void this.integrationsService
          .onLeadMeetingsChanged(tenantId, saved, null)
          .catch(() => undefined);
      }
    } catch {
      /* ignore calendar sync */
    }

    // Триггерим автоматизацию
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.LEAD_CREATED,
        {
          entityType: 'lead',
          entityId: saved.id,
          lead: saved,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    return saved;
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateLeadDto,
  ): Promise<Lead> {
    const lead = await this.findOneForTenant(tenantId, id);
    const previousMeetings = Array.isArray((lead.meta as { meetings?: unknown[] })?.meetings)
      ? JSON.parse(
          JSON.stringify((lead.meta as { meetings?: unknown[] }).meetings),
        )
      : null;

    // базовые поля
    if (dto.name !== undefined) lead.name = dto.name;
    if (dto.phone !== undefined) lead.phone = dto.phone;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.country !== undefined) lead.country = dto.country;
    if (dto.status !== undefined) lead.status = dto.status;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.utmSource !== undefined) lead.utmSource = dto.utmSource;
    if (dto.utmMedium !== undefined) lead.utmMedium = dto.utmMedium;
    if (dto.utmCampaign !== undefined) lead.utmCampaign = dto.utmCampaign;
    if (dto.utmContent !== undefined) lead.utmContent = dto.utmContent;
    if (dto.utmTerm !== undefined) lead.utmTerm = dto.utmTerm;
    if (dto.meta !== undefined) lead.meta = dto.meta;
    if (dto.customFields !== undefined) lead.customFields = dto.customFields;
    if (dto.siteId !== undefined) lead.siteId = dto.siteId;
    if (dto.contactId !== undefined) lead.contactId = dto.contactId ?? null;
    if (dto.companyId !== undefined) lead.companyId = dto.companyId ?? null;

    // ответственный
    const shouldUpdateAssignees =
      dto.assignedUserId !== undefined ||
      dto.assignedUserIds !== undefined ||
      dto.assignedTo !== undefined ||
      dto.assignedToList !== undefined;
    if (shouldUpdateAssignees) {
      const normalizedAssignees = this.normalizeAssignees(dto);
      lead.assignedUserId = normalizedAssignees.assignedUserId;
      lead.assignedUserIds = normalizedAssignees.assignedUserIds;
      lead.assignedTo = normalizedAssignees.assignedTo;
      lead.assignedToList = normalizedAssignees.assignedToList;
    }

    const oldStatus = lead.status;
    const saved = await this.leadsRepo.save(lead);

    // Триггерим автоматизацию для обновления
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.LEAD_UPDATED,
        {
          entityType: 'lead',
          entityId: saved.id,
          lead: saved,
          changes: dto,
        },
      );

      // Если изменился статус, триггерим отдельное событие
      if (dto.status !== undefined && dto.status !== oldStatus) {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.LEAD_STATUS_CHANGED,
          {
            entityType: 'lead',
            entityId: saved.id,
            lead: saved,
            oldStatus,
            newStatus: dto.status,
          },
        );
      }

      // Если изменился ответственный
      if (
        dto.assignedUserId !== undefined ||
        dto.assignedUserIds !== undefined ||
        dto.assignedTo !== undefined ||
        dto.assignedToList !== undefined
      ) {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.LEAD_ASSIGNED,
          {
            entityType: 'lead',
            entityId: saved.id,
            lead: saved,
          },
        );
      }
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }

    try {
      if (dto.meta !== undefined) {
        void this.integrationsService
          .onLeadMeetingsChanged(tenantId, saved, previousMeetings)
          .catch(() => undefined);
      }
    } catch {
      /* ignore calendar sync */
    }

    return saved;
  }

  async removeForTenant(tenantId: string, id: string): Promise<void> {
  const lead = await this.findOneForTenant(tenantId, id);

  // ⛔ защита от FK-ошибок: не удаляем если привязаны продажи/проекты
  const salesCount = await this.salesRepo.count({ where: { leadId: lead.id } as any });
  const projectsCount = await this.projectsRepo.count({ where: { leadId: lead.id } as any });

  if (salesCount > 0 || projectsCount > 0) {
    throw new BadRequestException(
      `Нельзя удалить лид: есть связи (sales=${salesCount}, projects=${projectsCount}). Сначала отвяжи/удали продажи или проекты.`,
    );
  }

  await this.leadsRepo.remove(lead);
  }

  // ====== PUBLIC (сайты, формы, WP / CF7) ======

  /**
   * Создание лида из публичного API `/v1/public/leads`.
   * Ожидаем либо apiToken (предпочтительно), либо tenantId+siteId.
   */
  async createFromPublic(dto: any, referer?: string | null): Promise<Lead> {
    let tenantId: string;
    let siteId: string | null = null;

    // 1) Основной путь — сайт присылает apiToken
    if (dto.apiToken) {
      const site = await this.sitesRepo.findOne({
        where: { apiToken: dto.apiToken },
      });

      if (!site) {
        throw new BadRequestException('Invalid apiToken');
      }

      tenantId = site.tenantId;
      siteId = site.id;
    }
    // 2) Запасной вариант — прямой вызов с tenantId
    else if (dto.tenantId) {
      tenantId = dto.tenantId;
      siteId = dto.siteId ?? null;
    } else {
      throw new BadRequestException('apiToken or tenantId is required');
    }

    const meta = {
      ...(dto.meta || {}),
      message: dto.message ?? dto.meta?.message ?? undefined,
      channel: dto.channel ?? dto.source ?? 'cf7',
    };

    const {
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    } = this.extractUtm(dto, referer);

    const lead = this.leadsRepo.create({
      tenantId,
      siteId,

      name: dto.name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      country: dto.country ?? null,

      status: dto.status ?? 'new',
      source: dto.source ?? dto.channel ?? 'web',

      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,

      // из публичных форм обычно ответственный не проставляется
      assignedUserId: null,
      assignedUserIds: null,
      assignedTo: null,
      assignedToList: null,

      meta,
    });

    return this.leadsRepo.save(lead);
  }

  private extractUtm(dto: any, referer?: string | null) {
    const utm = dto?.utm || dto?.meta?.utm || {};
    let utmSource =
      dto.utmSource ??
      dto.utm_source ??
      dto?.meta?.utmSource ??
      dto?.meta?.utm_source ??
      utm.utmSource ??
      utm.utm_source ??
      null;
    let utmMedium =
      dto.utmMedium ??
      dto.utm_medium ??
      dto?.meta?.utmMedium ??
      dto?.meta?.utm_medium ??
      utm.utmMedium ??
      utm.utm_medium ??
      null;
    let utmCampaign =
      dto.utmCampaign ??
      dto.utm_campaign ??
      dto?.meta?.utmCampaign ??
      dto?.meta?.utm_campaign ??
      utm.utmCampaign ??
      utm.utm_campaign ??
      null;
    let utmContent =
      dto.utmContent ??
      dto.utm_content ??
      dto?.meta?.utmContent ??
      dto?.meta?.utm_content ??
      utm.utmContent ??
      utm.utm_content ??
      null;
    let utmTerm =
      dto.utmTerm ??
      dto.utm_term ??
      dto?.meta?.utmTerm ??
      dto?.meta?.utm_term ??
      utm.utmTerm ??
      utm.utm_term ??
      null;

    const candidates = [
      dto.pageUrl,
      dto.page_url,
      dto.url,
      dto.page,
      dto.referrer,
      dto.referer,
      dto?.meta?.pageUrl,
      dto?.meta?.page_url,
      dto?.meta?.url,
      dto?.meta?.page,
      dto?.meta?.referrer,
      dto?.meta?.referer,
      referer,
    ];

    for (const candidate of candidates) {
      if (
        utmSource &&
        utmMedium &&
        utmCampaign &&
        utmContent &&
        utmTerm
      ) {
        break;
      }
      const parsed = this.parseUtmFromUrl(candidate);
      if (!utmSource && parsed.utmSource) utmSource = parsed.utmSource;
      if (!utmMedium && parsed.utmMedium) utmMedium = parsed.utmMedium;
      if (!utmCampaign && parsed.utmCampaign) utmCampaign = parsed.utmCampaign;
      if (!utmContent && parsed.utmContent) utmContent = parsed.utmContent;
      if (!utmTerm && parsed.utmTerm) utmTerm = parsed.utmTerm;
    }

    return { utmSource, utmMedium, utmCampaign, utmContent, utmTerm };
  }

  private parseUtmFromUrl(value?: string | null) {
    if (!value) return {};
    try {
      const url = value.startsWith('http')
        ? new URL(value)
        : new URL(value, 'https://example.com');
      return {
        utmSource: url.searchParams.get('utm_source') || null,
        utmMedium: url.searchParams.get('utm_medium') || null,
        utmCampaign: url.searchParams.get('utm_campaign') || null,
        utmContent: url.searchParams.get('utm_content') || null,
        utmTerm: url.searchParams.get('utm_term') || null,
      };
    } catch {
      return {};
    }
  }

  // ====== SEARCH ДЛЯ ПРИВЯЗКИ ЗАКАЗОВ К ЛИДАМ ======
  async searchForTenant(
    tenantId: string,
    q: string,
    limit = 10,
  ): Promise<Lead[]> {
    const term = q.trim();
    if (!term) return [];

    return this.leadsRepo.find({
      where: [
        { tenantId, name: ILike(`%${term}%`) },
        { tenantId, email: ILike(`%${term}%`) },
        { tenantId, phone: ILike(`%${term}%`) },
      ],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ====== СТАТИСТИКА ДЛЯ ДАШБОРДА ======
  async getStatsForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<LeadStats> {
    // БЕЗ QueryBuilder — чтобы не ловить alias-ошибки
    const all = (await this.listForTenant(tenantId)).filter(
      (l) => !this.isLeadOmittedFromDashboardStats(l),
    );

    let leads = all;

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;

      // включительно по "to" до конца дня
      let toEnd: Date | null = null;
      if (toDate) {
        toEnd = new Date(toDate);
        toEnd.setHours(23, 59, 59, 999);
      }

      leads = all.filter((l) => {
        const created =
          l.createdAt instanceof Date
            ? l.createdAt
            : new Date((l as any).createdAt);

        if (fromDate && created < fromDate) return false;
        if (toEnd && created > toEnd) return false;
        return true;
      });
    }

    const total = leads.length;

    const byStatusMap = new Map<string, number>();
    const bySourceMap = new Map<string, number>();
    const byCountryMap = new Map<string, number>();
    const byManagerMap = new Map<
      string,
      { total: number; won: number; lost: number }
    >();

    for (const lead of leads) {
      const status = (lead.status as string) || 'unknown';
      byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);

      const source = (lead.source as string) || 'unknown';
      bySourceMap.set(source, (bySourceMap.get(source) ?? 0) + 1);

      const country = (lead.country as string) || '';
      byCountryMap.set(country, (byCountryMap.get(country) ?? 0) + 1);

      const managerKey = lead.assignedTo?.trim() || 'Без ответственного';
      const row =
        byManagerMap.get(managerKey) ?? { total: 0, won: 0, lost: 0 };

      row.total += 1;
      if (lead.status === 'won') row.won += 1;
      if (lead.status === 'lost') row.lost += 1;

      byManagerMap.set(managerKey, row);
    }

    const byStatus: LeadStatusStat[] = Array.from(
      byStatusMap.entries(),
    ).map(([status, count]) => ({ status, count }));

    const bySource: LeadSourceStat[] = Array.from(
      bySourceMap.entries(),
    ).map(([source, count]) => ({ source, count }));

    const byCountry: LeadCountryStat[] = Array.from(
      byCountryMap.entries(),
    ).map(([country, count]) => ({ country, count }));

    const byManager: LeadManagerStat[] = Array.from(
      byManagerMap.entries(),
    ).map(([manager, row]) => ({
      manager,
      total: row.total,
      won: row.won,
      lost: row.lost,
    }));

    return {
      total,
      byStatus,
      bySource,
      byCountry,
      byManager,
    };
  }

    // ====== helper: конструируем LeadsRoiStats из сырых рядов + лидов ======
  private buildRoiStats(
    raw: {
      leadId: string;
      totalRevenue: string;
      dealsCount: string;
      firstDealAt: string | null;
      lastDealAt: string | null;
      currency: string | null;
    }[],
    leads: Lead[],
  ): LeadsRoiStats {
    if (!raw.length) {
      return {
        currency: 'EUR',
        totalRevenue: 0,
        avgCheck: 0,
        leadsWithRevenue: 0,
        dealsCount: 0,
        items: [],
      };
    }

    const leadMap = new Map<string, Lead>();
    for (const l of leads) {
      if (!this.isLeadMetaDeleted(l)) leadMap.set(l.id, l);
    }

    const rawActive = raw.filter((r) => leadMap.has(r.leadId));

    if (!rawActive.length) {
      return {
        currency: 'EUR',
        totalRevenue: 0,
        avgCheck: 0,
        leadsWithRevenue: 0,
        dealsCount: 0,
        items: [],
      };
    }

    const items: LeadRoiRow[] = rawActive.map((r) => {
      const lead = leadMap.get(r.leadId);

      return {
        leadId: r.leadId,
        leadName: lead?.name ?? null,
        status: (lead?.status as string) ?? null,
        manager: lead?.assignedTo ?? null,
        channel: (lead?.source as string) ?? null,

        totalRevenue: Number(r.totalRevenue) || 0,
        dealsCount: Number(r.dealsCount) || 0,

        firstDealAt: r.firstDealAt
          ? new Date(r.firstDealAt).toISOString()
          : null,
        lastDealAt: r.lastDealAt
          ? new Date(r.lastDealAt).toISOString()
          : null,

        currency: r.currency || 'EUR',
      };
    });

    const totalRevenue = items.reduce(
      (sum, row) => sum + row.totalRevenue,
      0,
    );
    const dealsCount = items.reduce(
      (sum, row) => sum + row.dealsCount,
      0,
    );
    const leadsWithRevenue = items.length;
    const avgCheck = dealsCount > 0 ? totalRevenue / dealsCount : 0;
    const currency = items[0]?.currency || 'EUR';

    return {
      currency,
      totalRevenue,
      avgCheck,
      leadsWithRevenue,
      dealsCount,
      items,
    };
  }

  // ====== УТРАЧЕННЫЕ ЛИДЫ: количество и сумма проектов по lost ======
  async getLostStatsForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<LostLeadsStats> {
    const allLost = (
      await this.leadsRepo.find({
        where: { tenantId, status: 'lost' },
        order: { createdAt: 'DESC' },
      })
    ).filter((l) => !this.isLeadMetaDeleted(l));

    let leads = allLost;

    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      let toEnd: Date | null = null;
      if (toDate) {
        toEnd = new Date(toDate);
        toEnd.setHours(23, 59, 59, 999);
      }

      leads = allLost.filter((l) => {
        const created =
          l.createdAt instanceof Date
            ? l.createdAt
            : new Date((l as any).createdAt);
        if (fromDate && created < fromDate) return false;
        if (toEnd && created > toEnd) return false;
        return true;
      });
    }

    const totalLost = leads.length;
    if (!totalLost) {
      return {
        totalLost: 0,
        totalAmount: 0,
        currency: 'EUR',
        byManager: [],
        items: [],
      };
    }

    const leadIds = leads.map((l) => l.id);

    // Суммируем по проектам, привязанным к утраченным лидам
    const projects = leadIds.length
      ? await this.projectsRepo.find({
          where: {
            tenantId,
            leadId: In(leadIds),
            isDeleted: false as any,
          },
        })
      : [];

    const byLeadAmount = new Map<string, number>();
    let currency = 'EUR';

    for (const p of projects) {
      const amount = Number(p.amount) || 0;
      const leadId = p.leadId || '';
      currency = p.currency || currency;
      byLeadAmount.set(leadId, (byLeadAmount.get(leadId) ?? 0) + amount);
    }

    const byManagerMap = new Map<string, { lost: number; amount: number }>();
    const items: LostLeadItem[] = [];

    for (const lead of leads) {
      const manager = lead.assignedTo?.trim() || 'Без ответственного';
      const leadAmount = byLeadAmount.get(lead.id) ?? 0;

      const row = byManagerMap.get(manager) ?? { lost: 0, amount: 0 };
      row.lost += 1;
      row.amount += leadAmount;

      byManagerMap.set(manager, row);

      items.push({
        leadId: lead.id,
        leadName: lead.name ?? null,
        manager: lead.assignedTo ?? null,
        amount: leadAmount,
        currency,
        createdAt:
          lead.createdAt instanceof Date
            ? lead.createdAt.toISOString()
            : new Date((lead as any).createdAt).toISOString(),
      });
    }

    // сортируем по сумме убыв., потом по дате
    items.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const byManager: LostLeadManagerStat[] = Array.from(
      byManagerMap.entries(),
    ).map(([manager, row]) => ({
      manager,
      lost: row.lost,
      amount: row.amount,
    }));

    const totalAmount = Array.from(byLeadAmount.values()).reduce(
      (sum, v) => sum + v,
      0,
    );

    return {
      totalLost,
      totalAmount,
      currency,
      byManager,
      items,
    };
  }

  // ====== ПУБЛИЧНЫЙ метод ROI (переключатель sales / projects) ======
  async getRoiForTenant(
    tenantId: string,
    opts?: { from?: string; to?: string; source?: 'sales' | 'projects' },
  ): Promise<LeadsRoiStats> {
    const { from, to, source } = opts || {};

    console.log('ROI service: source =', source, 'from =', from, 'to =', to);

    if (source === 'projects') {
      return this.getProjectsRoiForTenantInternal(tenantId, from, to);
    }
    console.log('ROI service: USING SALES');
    // по умолчанию считаем по продажам
    return this.getSalesRoiForTenantInternal(tenantId, from, to);
  }

  // ====== ROI ДЛЯ ЛИДОВ ПО ПРОДАЖАМ (sales) ======
  private async getSalesRoiForTenantInternal(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<LeadsRoiStats> {
    const qb = this.salesRepo
      .createQueryBuilder('s')
      .innerJoin(Lead, 'l', 'l.id = s.lead_id')
      .select('s.lead_id', 'leadId')
      .addSelect('SUM(s.amount)', 'totalRevenue')
      .addSelect('COUNT(*)', 'dealsCount')
      .addSelect('MIN(s."createdAt")', 'firstDealAt')
      .addSelect('MAX(s."createdAt")', 'lastDealAt')
      .addSelect('MIN(s.currency)', 'currency')
      .where('l."tenantId" = :tenantId', { tenantId })
      .andWhere('s.lead_id IS NOT NULL');

    if (from) {
      qb.andWhere('s."createdAt" >= :from', { from });
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('s."createdAt" <= :to', { to: toDate.toISOString() });
    }

    qb.groupBy('s.lead_id');

    const raw = await qb.getRawMany<{
      leadId: string;
      totalRevenue: string;
      dealsCount: string;
      firstDealAt: string | null;
      lastDealAt: string | null;
      currency: string | null;
    }>();

    const leadIds = raw.map((r) => r.leadId);
    const leads = leadIds.length
      ? await this.leadsRepo.find({
          where: { tenantId, id: In(leadIds) },
        })
      : [];

    return this.buildRoiStats(raw, leads);
  }

  // ====== ROI ДЛЯ ЛИДОВ ПО ПРОЕКТАМ (projects) ======
private async getProjectsRoiForTenantInternal(
  tenantId: string,
  from?: string,
  to?: string,
): Promise<LeadsRoiStats> {
  const qb = this.projectsRepo
    .createQueryBuilder('p')
    .innerJoin(Lead, 'l', 'l.id = p.lead_id')
    .select('p.lead_id', 'leadId')
    .addSelect('SUM(p.amount)', 'totalRevenue')
    .addSelect('COUNT(*)', 'dealsCount')
    // дата проекта — имя колонки в БД: created_at
    .addSelect('MIN(p."created_at")', 'firstDealAt')
    .addSelect('MAX(p."created_at")', 'lastDealAt')
    .addSelect('MIN(p.currency)', 'currency')
    .where('l."tenantId" = :tenantId', { tenantId })
    .andWhere('p.lead_id IS NOT NULL')
    // 👇 здесь была ошибка: isDeleted vs is_deleted
    .andWhere('p."is_deleted" = false');

  if (from) {
    qb.andWhere('p."created_at" >= :from', { from });
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    qb.andWhere('p."created_at" <= :to', { to: toDate.toISOString() });
  }

  qb.groupBy('p.lead_id');

  const raw = await qb.getRawMany<{
    leadId: string;
    totalRevenue: string;
    dealsCount: string;
    firstDealAt: string | null;
    lastDealAt: string | null;
    currency: string | null;
  }>();

  const leadIds = raw.map((r) => r.leadId);
  const leads = leadIds.length
    ? await this.leadsRepo.find({
        where: { tenantId, id: In(leadIds) },
      })
    : [];

  return this.buildRoiStats(raw, leads);
}
}
