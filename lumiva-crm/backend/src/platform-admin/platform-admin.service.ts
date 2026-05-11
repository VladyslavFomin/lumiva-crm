// src/platform-admin/platform-admin.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import {
  applyTenantModuleToggle,
  COMPONENT_KEYS,
  isComponentAllowedByPlan,
  isModuleAllowedByPlan,
  isTenantModuleEnabled,
  MODULE_KEYS,
  normalizeTenantPlan,
} from '../tenants/plan-entitlements';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async listTenants() {
    const list = await this.tenantsRepo.find({
      order: { createdAt: 'DESC' as any },
    });
    return list.map((t) => ({ ...t, plan: normalizeTenantPlan(t.plan) }));
  }

  async setStatus(id: string, status: 'active' | 'blocked') {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    tenant.status = status;
    return this.tenantsRepo.save(tenant);
  }

  async setApiEnabled(id: string, enabled: boolean) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    (tenant as any).apiEnabled = enabled;
    return this.tenantsRepo.save(tenant);
  }

  async getTenantModules(id: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const enabledModules = tenant.enabledModules || {};

    return MODULE_KEYS.map((key) => {
      const allowedByPlan = isModuleAllowedByPlan(key, tenant.plan);
      const explicit = enabledModules[key];
      const enabled = typeof explicit === 'boolean' ? explicit : allowedByPlan;
      return { key, enabled, allowedByPlan, plan: normalizeTenantPlan(tenant.plan) };
    });
  }

  async toggleTenantModule(
    id: string,
    moduleKey: string,
    enabled: boolean,
  ) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (enabled && !isModuleAllowedByPlan(moduleKey, tenant.plan)) {
      throw new BadRequestException(
        `Module "${moduleKey}" is not available on current plan "${normalizeTenantPlan(tenant.plan)}"`,
      );
    }
    const enabledModules = { ...(tenant.enabledModules || {}) };
    applyTenantModuleToggle(moduleKey, enabled, enabledModules);
    tenant.enabledModules = enabledModules;

    await this.tenantsRepo.save(tenant);

    return {
      key: moduleKey,
      enabled,
      allowedByPlan: isModuleAllowedByPlan(moduleKey, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    };
  }

  async getTenantComponents(id: string) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const enabledComponents = tenant.enabledComponents || {};

    return COMPONENT_KEYS.map((key) => {
      const allowedByPlan = isComponentAllowedByPlan(key, tenant.plan);
      const explicit = enabledComponents[key];
      const enabled = typeof explicit === 'boolean' ? explicit : allowedByPlan;
      return { key, enabled, allowedByPlan, plan: normalizeTenantPlan(tenant.plan) };
    });
  }

  async toggleTenantComponent(
    id: string,
    componentKey: string,
    enabled: boolean,
  ) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (enabled && !isComponentAllowedByPlan(componentKey, tenant.plan)) {
      throw new BadRequestException(
        `Component "${componentKey}" is not available on current plan "${normalizeTenantPlan(tenant.plan)}"`,
      );
    }
    tenant.enabledComponents = { ...(tenant.enabledComponents || {}), [componentKey]: enabled };

    await this.tenantsRepo.save(tenant);

    return {
      key: componentKey,
      enabled,
      allowedByPlan: isComponentAllowedByPlan(componentKey, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    };
  }
}
