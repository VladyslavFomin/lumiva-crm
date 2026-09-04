import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Lead } from '../../leads/lead.entity';
import { Sale } from '../../sales/sale.entity';
import { Project } from '../../projects/project.entity';
import { NotesService } from '../../notes/notes.service';
import { EntityType, NoteType } from '../../notes/dto/create-note.dto';

export type JiraLinkEntityType = 'lead' | 'sale' | 'project';

export type JiraLinkInfo = {
  key: string;
  url: string;
  status: string | null;
  connectionId: string;
  linkedAt: string;
};

/**
 * Привязка Jira issue к лиду/сделке/проекту. Своего join-таблицы нет — как и Note/EsignDocument/
 * HelpdeskTicket, храним запись в jsonb-поле самой записи (Lead.meta / Sale.customFields /
 * Project.customFields), ключ `jira`. Прямой доступ к репозиториям Lead/Sale/Project (не через
 * их сервисы) — чтобы не тянуть их модули и не плодить циклические зависимости с IntegrationsModule.
 */
@Injectable()
export class JiraLinkService {
  private readonly log = new Logger(JiraLinkService.name);

  constructor(
    @InjectRepository(Lead) private readonly leadRepo: Repository<Lead>,
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    private readonly notesService: NotesService,
  ) {}

  private noteEntityType(t: JiraLinkEntityType): EntityType {
    if (t === 'lead') return EntityType.LEAD;
    if (t === 'sale') return EntityType.SALE;
    return EntityType.PROJECT;
  }

  async getLinkedIssue(
    tenantId: string,
    entityType: JiraLinkEntityType,
    entityId: string,
  ): Promise<JiraLinkInfo | null> {
    if (entityType === 'lead') {
      const e = await this.leadRepo.findOne({ where: { id: entityId, tenantId } as any });
      return (e?.meta?.jira as JiraLinkInfo) || null;
    }
    if (entityType === 'sale') {
      const e = await this.saleRepo.findOne({ where: { id: entityId, tenantId } as any });
      return (e?.customFields?.jira as JiraLinkInfo) || null;
    }
    const e = await this.projectRepo.findOne({ where: { id: entityId, tenantId } as any });
    return (e?.customFields?.jira as JiraLinkInfo) || null;
  }

  /** Записывает ссылку на issue в саму запись (Lead/Sale/Project) + добавляет заметку. */
  async attach(
    tenantId: string,
    entityType: JiraLinkEntityType,
    entityId: string,
    issue: { key: string; url: string; connectionId: string; status?: string | null },
    noteContent?: string,
  ): Promise<boolean> {
    const jira: JiraLinkInfo = {
      key: issue.key,
      url: issue.url,
      status: issue.status ?? null,
      connectionId: issue.connectionId,
      linkedAt: new Date().toISOString(),
    };
    let ok = false;
    if (entityType === 'lead') {
      const e = await this.leadRepo.findOne({ where: { id: entityId, tenantId } as any });
      if (e) {
        e.meta = { ...(e.meta || {}), jira };
        await this.leadRepo.save(e);
        ok = true;
      }
    } else if (entityType === 'sale') {
      const e = await this.saleRepo.findOne({ where: { id: entityId, tenantId } as any });
      if (e) {
        e.customFields = { ...(e.customFields || {}), jira };
        await this.saleRepo.save(e);
        ok = true;
      }
    } else {
      const e = await this.projectRepo.findOne({ where: { id: entityId, tenantId } as any });
      if (e) {
        e.customFields = { ...(e.customFields || {}), jira };
        await this.projectRepo.save(e);
        ok = true;
      }
    }
    if (ok) {
      await this.writeNote(
        entityType,
        entityId,
        tenantId,
        noteContent || `Создана задача Jira: ${issue.key}\n${issue.url}`,
        `Jira: ${issue.key}`,
      );
    }
    return ok;
  }

  /**
   * Ищет лид/сделку/проект, уже привязанные к этому issueKey (по jsonb-полю jira.key), и
   * обновляет статус + пишет заметку. Используется входящим вебхуком Jira, чтобы обновления
   * уже существующей задачи не плодили новые лиды.
   */
  async findAndUpdateStatus(
    tenantId: string,
    issueKey: string,
    patch: { status?: string; note: string; noteTitle: string },
  ): Promise<{ entityType: JiraLinkEntityType; entityId: string } | null> {
    const lead = await this.leadRepo
      .createQueryBuilder('e')
      .where('e."tenantId" = :tenantId', { tenantId })
      .andWhere(`e."meta"->'jira'->>'key' = :key`, { key: issueKey })
      .getOne();
    if (lead) {
      if (patch.status !== undefined) {
        lead.meta = { ...(lead.meta || {}), jira: { ...(lead.meta?.jira || {}), status: patch.status } };
        await this.leadRepo.save(lead);
      }
      await this.writeNote('lead', lead.id, tenantId, patch.note, patch.noteTitle);
      return { entityType: 'lead', entityId: lead.id };
    }
    const sale = await this.saleRepo
      .createQueryBuilder('e')
      .where('e."tenantId" = :tenantId', { tenantId })
      .andWhere(`e."customFields"->'jira'->>'key' = :key`, { key: issueKey })
      .getOne();
    if (sale) {
      if (patch.status !== undefined) {
        sale.customFields = {
          ...(sale.customFields || {}),
          jira: { ...(sale.customFields?.jira || {}), status: patch.status },
        };
        await this.saleRepo.save(sale);
      }
      await this.writeNote('sale', sale.id, tenantId, patch.note, patch.noteTitle);
      return { entityType: 'sale', entityId: sale.id };
    }
    const project = await this.projectRepo
      .createQueryBuilder('e')
      .where('e."tenantId" = :tenantId', { tenantId })
      .andWhere(`e."customFields"->'jira'->>'key' = :key`, { key: issueKey })
      .getOne();
    if (project) {
      if (patch.status !== undefined) {
        project.customFields = {
          ...(project.customFields || {}),
          jira: { ...(project.customFields?.jira || {}), status: patch.status },
        };
        await this.projectRepo.save(project);
      }
      await this.writeNote('project', project.id, tenantId, patch.note, patch.noteTitle);
      return { entityType: 'project', entityId: project.id };
    }
    return null;
  }

  private async writeNote(
    entityType: JiraLinkEntityType,
    entityId: string,
    tenantId: string,
    content: string,
    title: string,
  ): Promise<void> {
    try {
      await this.notesService.create(
        tenantId,
        {
          entityType: this.noteEntityType(entityType),
          entityId,
          content,
          title,
          type: NoteType.NOTE,
        },
        undefined,
        'integration:jira',
      );
    } catch (e) {
      this.log.warn(`Jira link note failed: ${(e as Error).message}`);
    }
  }
}
