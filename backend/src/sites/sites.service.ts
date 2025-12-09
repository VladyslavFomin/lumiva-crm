import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Site } from './site.entity';
import { CreateSiteDto } from './dto/create-site.dto';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sitesRepo: Repository<Site>,
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
}
