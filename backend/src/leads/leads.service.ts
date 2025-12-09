// src/leads/leads.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In } from 'typeorm';

import { Lead } from './lead.entity';
import { Site } from '../sites/site.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { Sale } from '../sales/sale.entity';
import { Project } from '../projects/project.entity';

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
  ) {}

  // ====== PRIVATE (CRM) ======

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
    const lead = this.leadsRepo.create({
      tenantId,
      siteId: dto.siteId ?? null,

      name: dto.name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      country: dto.country ?? null,

      status: dto.status ?? 'new',
      source: dto.source ?? 'crm',

      // ответственный
      assignedUserId: dto.assignedUserId ?? null,
      assignedTo: dto.assignedTo ?? null,

      meta: dto.meta ?? null,
    });

    return this.leadsRepo.save(lead);
  }

  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateLeadDto,
  ): Promise<Lead> {
    const lead = await this.findOneForTenant(tenantId, id);

    // базовые поля
    if (dto.name !== undefined) lead.name = dto.name;
    if (dto.phone !== undefined) lead.phone = dto.phone;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.country !== undefined) lead.country = dto.country;
    if (dto.status !== undefined) lead.status = dto.status;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.meta !== undefined) lead.meta = dto.meta;
    if (dto.siteId !== undefined) lead.siteId = dto.siteId;

    // ответственный
    if (dto.assignedUserId !== undefined) {
      lead.assignedUserId = dto.assignedUserId;
    }
    if (dto.assignedTo !== undefined) {
      lead.assignedTo = dto.assignedTo;
    }

    return this.leadsRepo.save(lead);
  }

  async removeForTenant(tenantId: string, id: string): Promise<void> {
    const lead = await this.findOneForTenant(tenantId, id);
    await this.leadsRepo.remove(lead);
  }

  // ====== PUBLIC (сайты, формы, WP / CF7) ======

  /**
   * Создание лида из публичного API `/v1/public/leads`.
   * Ожидаем либо apiToken (предпочтительно), либо tenantId+siteId.
   */
  async createFromPublic(dto: any): Promise<Lead> {
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

    const lead = this.leadsRepo.create({
      tenantId,
      siteId,

      name: dto.name ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      country: dto.country ?? null,

      status: dto.status ?? 'new',
      source: dto.source ?? dto.channel ?? 'web',

      // из публичных форм обычно ответственный не проставляется
      assignedUserId: null,
      assignedTo: null,

      meta,
    });

    return this.leadsRepo.save(lead);
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
    const all = await this.listForTenant(tenantId);

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
      leadMap.set(l.id, l);
    }

    const items: LeadRoiRow[] = raw.map((r) => {
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