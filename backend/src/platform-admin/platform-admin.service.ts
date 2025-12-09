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
}