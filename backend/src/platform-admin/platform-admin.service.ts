// src/platform-admin/platform-admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class PlatformAdminService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async listTenants() {
    return this.tenantsRepo.find({
      order: { createdAt: 'DESC' as any },
    });
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
    }));
  }

  async toggleTenantModule(
    id: string,
    moduleKey: string,
    enabled: boolean,
  ) {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const enabledModules = tenant.enabledModules || {};
    enabledModules[moduleKey] = enabled;
    tenant.enabledModules = enabledModules;

    await this.tenantsRepo.save(tenant);

    return {
      key: moduleKey,
      enabled,
    };
  }
}