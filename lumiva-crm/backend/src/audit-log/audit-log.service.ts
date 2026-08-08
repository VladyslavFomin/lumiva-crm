// src/audit-log/audit-log.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditLogAction, AuditLogChange, AuditLogEntityType } from './audit-log.entity';

interface LogParams {
  tenantId: string;
  entityType: AuditLogEntityType;
  entityId: string;
  entityLabel?: string | null;
  action: AuditLogAction;
  summary?: string | null;
  changes?: AuditLogChange[] | null;
  actorUserId?: string | null;
  actorName?: string | null;
}

export interface AuditLogQuery {
  entityType?: AuditLogEntityType;
  entityId?: string;
  action?: AuditLogAction;
  actorUserId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Best-effort write — never lets an audit-log failure break the caller's transaction. */
  async log(params: LogParams): Promise<void> {
    try {
      const row = this.repo.create({
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel ?? null,
        action: params.action,
        summary: params.summary ?? null,
        changes: params.changes ?? null,
        actorUserId: params.actorUserId ?? null,
        actorName: params.actorName ?? null,
      });
      await this.repo.save(row);
    } catch (e) {
      this.logger.warn(`Failed to write audit log entry: ${(e as Error)?.message}`);
    }
  }

  async findGlobal(tenantId: string, query: AuditLogQuery): Promise<{ items: AuditLog[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));

    const qb = this.repo.createQueryBuilder('a').where('a.tenantId = :tenantId', { tenantId });

    if (query.entityType) qb.andWhere('a.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId) qb.andWhere('a.entityId = :entityId', { entityId: query.entityId });
    if (query.action) qb.andWhere('a.action = :action', { action: query.action });
    if (query.actorUserId) qb.andWhere('a.actorUserId = :actorUserId', { actorUserId: query.actorUserId });
    if (query.from) qb.andWhere('a."createdAt" >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('a."createdAt" <= :to', { to: new Date(query.to) });
    if (query.search) {
      qb.andWhere('(a.summary ILIKE :search OR a.entityLabel ILIKE :search OR a.actorName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
