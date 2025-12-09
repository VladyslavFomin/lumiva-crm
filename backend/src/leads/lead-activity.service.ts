// src/leads/lead-activity.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadActivity, LeadActivityType } from './lead-activity.entity';

interface CreateActivityParams {
  tenantId: string;
  leadId: string;
  type: LeadActivityType;
  userId?: string | null;
  comment?: string | null;
  fromValue?: string | null;
  toValue?: string | null;
}

@Injectable()
export class LeadActivityService {
  constructor(
    @InjectRepository(LeadActivity)
    private readonly repo: Repository<LeadActivity>,
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

    return this.repo.save(row);
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