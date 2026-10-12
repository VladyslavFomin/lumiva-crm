import { createHash } from 'crypto';
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
  /** entityId — колонка uuid, но часть сущностей адресуется именем (роль 'manager' в rbac_role).
   * Такие ключи переводим в детерминированный uuid из «тип:имя» — одинаково при записи и чтении,
   * иначе запись молча не сохранялась, а фильтр по ней падал с 500. */
  static entityUuid(entityType: string, entityId: string): string {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) return entityId;
    const h = createHash('md5').update(`${entityType}:${entityId}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }

  async log(params: LogParams): Promise<void> {
    try {
      const row = this.repo.create({
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: AuditLogService.entityUuid(params.entityType, String(params.entityId)),
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
    if (query.entityId) {
      qb.andWhere('a.entityId = :entityId', { entityId: AuditLogService.entityUuid(query.entityType || '', query.entityId) });
    }
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
