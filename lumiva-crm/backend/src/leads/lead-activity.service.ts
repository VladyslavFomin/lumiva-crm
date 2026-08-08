// src/leads/lead-activity.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadActivity, LeadActivityType } from './lead-activity.entity';
import { Lead } from './lead.entity';
import { AuditLogService } from '../audit-log/audit-log.service';

interface CreateActivityParams {
  tenantId: string;
  leadId: string;
  type: LeadActivityType;
  userId?: string | null;
  comment?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
}

const TYPE_SUMMARY: Record<LeadActivityType, string> = {
  created: 'Лид создан',
  status_changed: 'Статус изменён',
  assignee_changed: 'Исполнитель изменён',
  comment: 'Добавлен комментарий',
};

@Injectable()
export class LeadActivityService {
  constructor(
    @InjectRepository(LeadActivity)
    private readonly repo: Repository<LeadActivity>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    private readonly auditLog: AuditLogService,
  ) {}

  async add(params: CreateActivityParams): Promise<LeadActivity> {
    const row = this.repo.create({
      tenantId: params.tenantId,
      leadId: params.leadId,
      type: params.type,
      comment: params.comment ?? null,
      fromValue: params.fromValue ?? null,
      toValue: params.toValue ?? null,
      userId: params.userId ?? null,
    });

    const saved = await this.repo.save(row);

    const lead = await this.leadRepo.findOne({ where: { id: params.leadId }, select: ['id', 'name', 'phone', 'email'] });
    void this.auditLog.log({
      tenantId: params.tenantId,
      entityType: 'lead',
      entityId: params.leadId,
      entityLabel: lead?.name || lead?.phone || lead?.email || null,
      action: params.type === 'created' ? 'create' : 'update',
      summary: TYPE_SUMMARY[params.type] + (params.fromValue && params.toValue ? `: ${params.fromValue} → ${params.toValue}` : ''),
      changes: params.fromValue != null || params.toValue != null
        ? [{ field: params.type, oldValue: params.fromValue ?? null, newValue: params.toValue ?? null }]
        : null,
      actorUserId: params.userId ?? null,
    });

    return saved;
  }

  // ВАЖНО: сначала leadId, потом tenantId — удобно и совпадает с контроллером
  async getHistory(leadId: string, tenantId: string): Promise<LeadActivity[]> {
    return this.repo.find({
      where: { tenantId, leadId },
      order: { createdAt: 'ASC' },
      // relations убираем, используем userEmail / userName из самой таблицы
    });
  }
}