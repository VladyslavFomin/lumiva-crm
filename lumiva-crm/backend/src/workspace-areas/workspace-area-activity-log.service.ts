import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkspaceAreaActivityLog,
  type WorkspaceAreaActivityKind,
} from './workspace-area-activity-log.entity';

@Injectable()
export class WorkspaceAreaActivityLogService {
  private readonly logger = new Logger(WorkspaceAreaActivityLogService.name);

  constructor(
    @InjectRepository(WorkspaceAreaActivityLog)
    private readonly repo: Repository<WorkspaceAreaActivityLog>,
  ) {}

  /** Никогда не бросает — сбой логирования не должен ронять операцию, которую логируем. */
  async log(
    tenantId: string,
    workspaceAreaId: string | null | undefined,
    kind: WorkspaceAreaActivityKind,
    title: string,
    detail?: string | null,
    opts?: { relatedObjectId?: string | null; actorUserId?: string | null },
  ): Promise<void> {
    if (!workspaceAreaId) return;
    try {
      await this.repo.save(
        this.repo.create({
          tenantId,
          workspaceAreaId,
          kind,
          title,
          detail: detail ?? null,
          relatedObjectId: opts?.relatedObjectId ?? null,
          actorUserId: opts?.actorUserId ?? null,
        }),
      );
    } catch (e) {
      this.logger.warn(`Failed to write activity log: ${(e as Error)?.message || e}`);
    }
  }

  async list(tenantId: string, workspaceAreaId: string, limit = 50) {
    return this.repo.find({
      where: { tenantId, workspaceAreaId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}
