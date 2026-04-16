// backend/src/tenants/tenant-logs.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TenantLog } from './tenant-log.entity';

export interface TenantLogInput {
  tenantId: string;
  type: string;
  statusCode?: number | null;
  method?: string | null;
  path?: string | null;
  message?: string | null;
  meta?: Record<string, any> | null;
}

@Injectable()
export class TenantLogsService {
  private readonly logger = new Logger(TenantLogsService.name);

  constructor(
    @InjectRepository(TenantLog)
    private readonly repo: Repository<TenantLog>,
  ) {}

  async record(entry: TenantLogInput): Promise<void> {
    try {
      const log = this.repo.create({
        ...entry,
        statusCode: entry.statusCode ?? null,
        method: entry.method ?? null,
        path: entry.path ?? null,
        message: entry.message ?? null,
        meta: entry.meta ?? null,
      });
      await this.repo.save(log);
    } catch (err) {
      this.logger.error(
        `Failed to write tenant log ${entry.type} for ${entry.tenantId}`,
        (err as any)?.stack || String(err),
      );
    }
  }

  async findRecent(
    tenantId: string,
    limit = 50,
  ): Promise<TenantLog[]> {
    return this.repo.find({
      where: { tenantId } as any,
      order: { createdAt: 'DESC' as any },
      take: limit,
    });
  }

  async findRecentAll(
    params?: { tenantId?: string; limit?: number },
  ): Promise<TenantLog[]> {
    const { tenantId, limit = 200 } = params || {};
    const where = tenantId ? ({ tenantId } as any) : {};
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' as any },
      take: limit,
    });
  }
}
