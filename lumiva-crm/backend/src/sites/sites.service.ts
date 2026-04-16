import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Site } from './site.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { TenantsService } from '../tenants/tenants.service';
import { MODULE_KEYS, pickSiteModuleOverride } from '../tenants/plan-entitlements';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sitesRepo: Repository<Site>,
    private readonly tenantsService: TenantsService,
  ) {}

  private generateApiToken(): string {
    // 32-символьный hex-токен
    return crypto.randomBytes(24).toString('hex');
  }

  async findAllForTenant(tenantId: string) {
    return this.sitesRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async createForTenant(tenantId: string, dto: CreateSiteDto) {
    const site = this.sitesRepo.create({
      tenantId,
      domain: dto.domain,
      name: dto.name || dto.domain,
      status: 'active',
      apiToken: this.generateApiToken(),
    });

    return this.sitesRepo.save(site);
  }

  async deleteForTenant(tenantId: string, siteId: string) {
    const site = await this.sitesRepo.findOne({
      where: { id: siteId, tenantId },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    await this.sitesRepo.remove(site);
    return { success: true };
  }

  async findByApiToken(apiToken: string): Promise<Site | null> {
    return this.sitesRepo.findOne({ where: { apiToken, status: 'active' } });
  }

  async findActiveByTenantAndApiToken(
    tenantId: string,
    apiToken: string,
  ): Promise<Site | null> {
    return this.sitesRepo.findOne({
      where: { tenantId, apiToken, status: 'active' },
    });
  }

  private mergeSiteEnabledModulesPatch(
    current: Record<string, boolean> | null,
    patch: Record<string, unknown>,
  ): Record<string, boolean> {
    const allowed = new Set<string>(MODULE_KEYS as readonly string[]);
    const next: Record<string, boolean> = { ...(current || {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (!allowed.has(k)) continue;
      if (v === null) {
        delete next[k];
        if (k === 'cf7' || k === 'crm_connector') {
          delete next.cf7;
          delete next.crm_connector;
        }
        continue;
      }
      if (typeof v !== 'boolean') {
        throw new BadRequestException(
          `enabledModules.${k}: ожидается boolean или null (сброс на наследование)`,
        );
      }
      next[k] = v;
      if (k === 'cf7' || k === 'crm_connector') {
        next.cf7 = v;
        next.crm_connector = v;
      }
    }
    return next;
  }

  async updateForTenant(tenantId: string, siteId: string, dto: UpdateSiteDto) {
    const site = await this.sitesRepo.findOne({ where: { id: siteId, tenantId } });
    if (!site) {
      throw new NotFoundException('Site not found');
    }
    if (dto.name !== undefined) {
      site.name = dto.name;
    }
    if (dto.enabledModules !== undefined) {
      const merged = this.mergeSiteEnabledModulesPatch(
        site.enabledModules,
        dto.enabledModules,
      );
      site.enabledModules = Object.keys(merged).length ? merged : null;
    }
    return this.sitesRepo.save(site);
  }

  /**
   * Состояние для UI: настройки компании, переопределения сайта и итог для WordPress.
   */
  async getWordpressModuleStateForSite(tenantId: string, siteId: string) {
    const site = await this.sitesRepo.findOne({ where: { id: siteId, tenantId } });
    if (!site) {
      throw new NotFoundException('Site not found');
    }
    const tenantOnly = await this.tenantsService.getTenantModules(tenantId, null);
    const effective = await this.tenantsService.getTenantModules(tenantId, site);
    const overrides = site.enabledModules || {};
    return MODULE_KEYS.map((key) => {
      const tRow = tenantOnly.find((m) => m.key === key);
      const eRow = effective.find((m) => m.key === key);
      return {
        key,
        tenantEnabled: Boolean(tRow?.enabled),
        siteOverride: pickSiteModuleOverride(key, overrides) ?? null,
        effective: Boolean(eRow?.enabled),
        allowedByPlan: Boolean(tRow?.allowedByPlan),
      };
    });
  }
}
