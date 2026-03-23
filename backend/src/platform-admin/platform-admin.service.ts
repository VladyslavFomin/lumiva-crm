// src/platform-admin/platform-admin.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import {
  isComponentAllowedByPlan,
  isModuleAllowedByPlan,
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

    const availableModules = [
      'chat',
      'marketing',
      'analytics',
      'woo',
      'reputation',
      'smm',
      'clientcabinet',
      'crm_connector',
      'crm_dashboard',
      'diagnostics',
      'email_branding',
      'polylang_ai',
      'site_checker',
      'crm_bridge',
      'crm',
    ];

    const enabledModules = tenant.enabledModules || {};

    return availableModules.map((key) => ({
      key,
      enabled: enabledModules[key] === true,
      allowedByPlan: isModuleAllowedByPlan(key, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    }));
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
    const enabledModules = tenant.enabledModules || {};
    enabledModules[moduleKey] = enabled;
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

    const availableComponents = [
      'leads',
      'projects',
      'projects_analytics',
      'projects_kanban',
      'projects_calendar',
      'sales',
      'sales_pipeline',
      'sales_analytics',
      'marketing',
      'marketing_campaigns',
      'marketing_analytics',
      'tools',
      'tools_integrations',
      'tools_automation',
      'tools_settings',
      'custom_objects',
      'chat',
      'client_accounts',
    ];

    const enabledComponents = tenant.enabledComponents || {};

    return availableComponents.map((key) => ({
      key,
      enabled: enabledComponents[key] === true,
      allowedByPlan: isComponentAllowedByPlan(key, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    }));
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
    const enabledComponents = tenant.enabledComponents || {};
    enabledComponents[componentKey] = enabled;
    tenant.enabledComponents = enabledComponents;

    await this.tenantsRepo.save(tenant);

    return {
      key: componentKey,
      enabled,
      allowedByPlan: isComponentAllowedByPlan(componentKey, tenant.plan),
      plan: normalizeTenantPlan(tenant.plan),
    };
  }
}
