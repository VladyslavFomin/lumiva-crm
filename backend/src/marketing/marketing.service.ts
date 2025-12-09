import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { MarketingTraffic } from './marketing-traffic.entity';
import { ImportTrafficDto } from './dto/import-traffic.dto';
import { MarketingUtmTemplate } from './marketing-utm-template.entity';
import { MarketingIntegration } from './marketing-integration.entity';
import { MarketingAutomation } from './marketing-automation.entity';
import { CreateUtmTemplateDto } from './dto/utm-template.dto';
import { CreateMarketingIntegrationDto } from './dto/create-marketing-integration.dto';
import { CreateAutomationDto } from './dto/create-automation.dto';

export interface MarketingTrafficRow {
  date: string; // YYYY-MM-DD
  source: string | null;
  medium: string | null;
  campaign: string | null;

  sessions: number;
  clicks: number;
  leads: number;

  cost: number;
  revenue: number;
  currency: string;
}

export interface MarketingTrafficStats {
  currency: string;
  totalSessions: number;
  totalLeads: number;
  totalRevenue: number;
  totalCost: number;
  items: MarketingTrafficRow[];
}

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingTraffic)
    private readonly trafficRepo: Repository<MarketingTraffic>,

    @InjectRepository(MarketingUtmTemplate)
    private readonly utmRepo: Repository<MarketingUtmTemplate>,

    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,

    @InjectRepository(MarketingAutomation)
    private readonly automationRepo: Repository<MarketingAutomation>,
  ) {}

  // ===== ТРАФИК =====
  async getTrafficForTenant(
    tenantId: string,
    from?: string,
    to?: string,
  ): Promise<MarketingTrafficStats> {
    const where: FindOptionsWhere<MarketingTraffic> = { tenantId };

    if (from && to) {
      where.date = Between(from, to);
    } else if (from) {
      where.date = Between(from, from);
    } else if (to) {
      where.date = Between(to, to);
    }

    const rows = await this.trafficRepo.find({
      where,
      order: { date: 'ASC' },
    });

    if (!rows.length) {
      return {
        currency: 'EUR',
        totalSessions: 0,
        totalLeads: 0,
        totalRevenue: 0,
        totalCost: 0,
        items: [],
      };
    }

    const items: MarketingTrafficRow[] = rows.map((r) => ({
      date: r.date,
      source: r.source,
      medium: r.medium,
      campaign: r.campaign,
      sessions: r.sessions || 0,
      clicks: r.clicks || 0,
      leads: r.leads || 0,
      cost: Number(r.cost) || 0,
      revenue: Number(r.revenue) || 0,
      currency: r.currency || 'EUR',
    }));

    const totalSessions = items.reduce((s, r) => s + r.sessions, 0);
    const totalLeads = items.reduce((s, r) => s + r.leads, 0);
    const totalRevenue = items.reduce((s, r) => s + r.revenue, 0);
    const totalCost = items.reduce((s, r) => s + r.cost, 0);
    const currency = items[0]?.currency || 'EUR';

    return {
      currency,
      totalSessions,
      totalLeads,
      totalRevenue,
      totalCost,
      items,
    };
  }

  async importTraffic(tenantId: string, dto: ImportTrafficDto): Promise<void> {
    for (const item of dto.items) {
      const key: Partial<MarketingTraffic> = {
        tenantId,
        date: item.date,
        source: item.source ?? null,
        medium: item.medium ?? null,
        campaign: item.campaign ?? null,
      };

      const where: FindOptionsWhere<MarketingTraffic> = {
        tenantId: key.tenantId!,
        date: key.date!,
        source: key.source ?? undefined,
        medium: key.medium ?? undefined,
        campaign: key.campaign ?? undefined,
      };

      const existing = await this.trafficRepo.findOne({ where });

      const base: Partial<MarketingTraffic> = {
        ...key,
        sessions: item.sessions ?? 0,
        clicks: item.clicks ?? 0,
        leads: item.leads ?? 0,
        cost: String(item.cost ?? 0),
        revenue: String(item.revenue ?? 0),
        currency: item.currency || 'EUR',
      };

      if (existing) {
        await this.trafficRepo.save({ ...existing, ...base });
      } else {
        const row = this.trafficRepo.create(base);
        await this.trafficRepo.save(row);
      }
    }
  }

  // ===== UTM ТЕМПЛЕЙТЫ =====
  async listUtmTemplates(tenantId: string): Promise<MarketingUtmTemplate[]> {
    return this.utmRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createUtmTemplate(
    tenantId: string,
    dto: CreateUtmTemplateDto,
  ): Promise<MarketingUtmTemplate> {
    const entity = this.utmRepo.create({
      tenantId,
      name: dto.name,
      baseUrl: dto.baseUrl ?? null,
      channelType: dto.channelType ?? null,
      utmSource: dto.utmSource ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmContent: dto.utmContent ?? null,
      utmTerm: dto.utmTerm ?? null,
    });

    return this.utmRepo.save(entity);
  }

  async deleteUtmTemplate(tenantId: string, id: string): Promise<void> {
    await this.utmRepo.delete({ id, tenantId });
  }

  // ===== ИНТЕГРАЦИИ =====
  async listIntegrations(tenantId: string): Promise<MarketingIntegration[]> {
    return this.integrationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createIntegration(
    tenantId: string,
    dto: CreateMarketingIntegrationDto,
  ): Promise<MarketingIntegration> {
    const entity = this.integrationRepo.create({
      tenantId,
      provider: dto.provider,
      kind: dto.kind ?? 'analytics',
      name: dto.name,
      isActive: dto.isActive ?? true,
      primaryId: dto.primaryId ?? null,
      settings: dto.settings ?? null,
    });

    return this.integrationRepo.save(entity);
  }

  async updateIntegration(
    tenantId: string,
    id: string,
    dto: Partial<CreateMarketingIntegrationDto>,
  ): Promise<MarketingIntegration> {
    const prev = await this.integrationRepo.findOne({
      where: { id, tenantId },
    });
    if (!prev) {
      throw new Error('Integration not found');
    }

    const merged = {
      ...prev,
      ...dto,
      primaryId: dto.primaryId ?? prev.primaryId,
      settings: dto.settings ?? prev.settings,
    };

    return this.integrationRepo.save(merged);
  }

  async deleteIntegration(tenantId: string, id: string): Promise<void> {
    await this.integrationRepo.delete({ id, tenantId });
  }

  // ===== АВТОМАТИЗАЦИИ (n8n) =====
  async listAutomations(tenantId: string): Promise<MarketingAutomation[]> {
    return this.automationRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createAutomation(
    tenantId: string,
    dto: CreateAutomationDto,
  ): Promise<MarketingAutomation> {
    const entity = this.automationRepo.create({
      tenantId,
      name: dto.name,
      type: dto.type ?? 'n8n_webhook',
      webhookUrl: dto.webhookUrl ?? null,
      isActive: dto.isActive ?? true,
      meta: dto.meta ?? null,
    });

    return this.automationRepo.save(entity);
  }

  async updateAutomation(
    tenantId: string,
    id: string,
    dto: Partial<CreateAutomationDto>,
  ): Promise<MarketingAutomation> {
    const prev = await this.automationRepo.findOne({
      where: { id, tenantId },
    });
    if (!prev) throw new Error('Automation not found');

    const merged = {
      ...prev,
      ...dto,
      webhookUrl: dto.webhookUrl ?? prev.webhookUrl,
      meta: dto.meta ?? prev.meta,
    };

    return this.automationRepo.save(merged);
  }

  async deleteAutomation(tenantId: string, id: string): Promise<void> {
    await this.automationRepo.delete({ id, tenantId });
  }

  // ===== СЕГМЕНТЫ (пока заглушки, чтобы не ломать UI) =====
  async getSegmentsForTenant(_tenantId: string): Promise<any[]> {
    return [];
  }
}