// backend/src/projects/projects.service.ts
import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Project, ProjectStatus } from './project.entity';
import { ProjectActivity } from './project-activity.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Lead } from '../leads/lead.entity';
import { AutomationsService } from '../automations/automations.service';
import { TriggerEvent } from '../automations/automation.entity';

const normalizeTasks = (tasks?: any[]) => {
  if (!Array.isArray(tasks)) return null;
  const normalized = tasks
    .map((task) => {
      if (!task || typeof task !== 'object' || Array.isArray(task)) return null;
      const checklist = Array.isArray(task.checklist) ? task.checklist : [];
      return {
        id: task.id ?? undefined,
        title: task.title ?? '',
        assignees: Array.isArray(task.assignees) ? task.assignees : [],
        status: task.status ?? 'К выполнению',
        priority: task.priority ?? 'Обычный',
        deadline: task.deadline ?? null,
        checklist: checklist.map((item: any) => ({
          id: item?.id ?? undefined,
          title: item?.title ?? '',
          done: Boolean(item?.done),
          doneBy: item?.doneBy ?? undefined,
          doneAt: item?.doneAt ?? undefined,
        })),
      };
    })
    .filter(Boolean) as any[];
  return normalized;
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
    @InjectRepository(ProjectActivity)
    private readonly activityRepo: Repository<ProjectActivity>,
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @Inject(forwardRef(() => AutomationsService))
    private readonly automationsService: AutomationsService,
  ) {}

  async createActivity(params: {
    tenantId: string;
    projectId: string;
    action: string;
    actor?: { userId?: string; email?: string; name?: string };
    payload?: Record<string, any> | null;
  }) {
    const { tenantId, projectId, action, actor, payload } = params;
    const entity = this.activityRepo.create({
      tenantId,
      projectId,
      action,
      actorUserId: actor?.userId ?? null,
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
      payload: payload ?? null,
    });
    return this.activityRepo.save(entity);
  }

  async listActivitiesForTenant(tenantId: string, projectId: string) {
    return this.activityRepo.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  // ===== Список проектов арендатора с фильтрами =====
  async findAllForTenant(options: {
    tenantId: string;
    status?: ProjectStatus;
    leadId?: string;
    companyId?: string;
    contactId?: string;
    q?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
    onlyArchived?: boolean;
    onlyDeleted?: boolean;
  }) {
    const {
      tenantId,
      status,
      leadId,
      companyId,
      contactId,
      q,
      limit = 50,
      offset = 0,
      includeArchived = false,
      onlyArchived = false,
      onlyDeleted = false,
    } = options;

    const where: any = {
      tenantId,
    };

    if (onlyDeleted) {
      where.isDeleted = true;
    } else {
      where.isDeleted = false;
      if (onlyArchived) {
        where.isArchived = true;
      } else if (!includeArchived) {
        where.isArchived = false;
      }
    }

    if (status) {
      where.status = status;
    }
    if (leadId) {
      where.leadId = leadId;
    }
    if (companyId) {
      where.companyId = companyId;
    }
    if (contactId) {
      where.contactId = contactId;
    }
    if (q) {
      where.name = ILike(`%${q}%`);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return { total, items };
  }

  // ===== Один проект арендатора =====
  async findOneForTenant(tenantId: string, id: string) {
    const project = await this.repo.findOne({
      where: { id, tenantId, isDeleted: false },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  // ===== Создать проект =====
  async createForTenant(
    tenantId: string,
    dto: CreateProjectDto,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const tagsArray =
      dto.tags && dto.tags.trim().length
        ? dto.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : null;

    // Если указан leadId, но не указаны companyId/contactId, пытаемся взять их из лида
    let companyId = dto.companyId ?? null;
    let contactId = dto.contactId ?? null;

    if (dto.leadId && (!companyId || !contactId)) {
      const lead = await this.leadRepo.findOne({
        where: { id: dto.leadId, tenantId },
      });
      if (lead) {
        if (!companyId && lead.companyId) {
          companyId = lead.companyId;
        }
        if (!contactId && lead.contactId) {
          contactId = lead.contactId;
        }
      }
    }

    const ownerUserIds =
      Array.isArray(dto.ownerUserIds) && dto.ownerUserIds.length
        ? dto.ownerUserIds.filter(Boolean)
        : dto.ownerUserId
          ? [dto.ownerUserId]
          : null;
    const project = this.repo.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      amount: dto.amount ?? 0,
      currency: dto.currency || 'EUR',
      status: dto.status ?? 'Новый',
      category: dto.category ?? null,
      tags: tagsArray,
      ownerName: dto.ownerName ?? null,
      ownerUserId: ownerUserIds?.[0] ?? dto.ownerUserId ?? null,
      ownerUserIds,
      leadId: dto.leadId ?? null,
      companyId,
      contactId,
      relatedProjectIds: dto.relatedProjectIds ?? null,
      briefFileName: dto.briefFileName ?? null,
      briefFileUrl: dto.briefFileUrl ?? null,
      tasks: normalizeTasks(dto.tasks) ?? [],
      comments: dto.comments ?? [],
      customFields: dto.customFields ?? null,
      isArchived: dto.isArchived ?? false,
      archivedAt: dto.isArchived ? new Date() : null,
    });

    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'create',
      actor,
      payload: { name: saved.name, status: saved.status },
    });

    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.PROJECT_CREATED,
        {
          entityType: 'project',
          entityId: saved.id,
          project: saved,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return saved;
  }

  // ===== Обновить проект =====
  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateProjectDto,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    const before = { ...project };

    // ---- Теги: строка → массив ----
    if (dto.tags !== undefined) {
      project.tags =
        dto.tags && dto.tags.trim().length
          ? dto.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : null;
    }

    // ---- Базовые поля ----
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.amount !== undefined) project.amount = dto.amount;
    if (dto.currency !== undefined) project.currency = dto.currency;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.category !== undefined) project.category = dto.category;
    if (dto.companyId !== undefined) project.companyId = dto.companyId ?? null;
    if (dto.contactId !== undefined) project.contactId = dto.contactId ?? null;

    // Если обновляется leadId, синхронизируем companyId/contactId из лида
    if (dto.leadId !== undefined) {
      project.leadId = dto.leadId ?? null;
      if (dto.leadId) {
        const lead = await this.leadRepo.findOne({
          where: { id: dto.leadId, tenantId },
        });
        if (lead) {
          if (dto.companyId === undefined && lead.companyId) {
            project.companyId = lead.companyId;
          }
          if (dto.contactId === undefined && lead.contactId) {
            project.contactId = lead.contactId;
          }
        }
      }
    }

    // ---- Ответственный / владелец проекта ----
    // если поле пришло в DTO – работаем с ним, если нет – вообще не трогаем
    const shouldUpdateOwners =
      Object.prototype.hasOwnProperty.call(dto, 'ownerUserId') ||
      Object.prototype.hasOwnProperty.call(dto, 'ownerUserIds') ||
      Object.prototype.hasOwnProperty.call(dto, 'ownerName');
    if (shouldUpdateOwners) {
      const ownerIds =
        Array.isArray(dto.ownerUserIds) && dto.ownerUserIds.length
          ? dto.ownerUserIds.filter(Boolean)
          : Object.prototype.hasOwnProperty.call(dto, 'ownerUserId') &&
              dto.ownerUserId
            ? [dto.ownerUserId]
            : null;
      if (Object.prototype.hasOwnProperty.call(dto, 'ownerUserIds')) {
        project.ownerUserIds = ownerIds;
      }
      if (Object.prototype.hasOwnProperty.call(dto, 'ownerUserId')) {
        project.ownerUserId = ownerIds?.[0] ?? dto.ownerUserId ?? null;
      } else if (ownerIds?.length) {
        project.ownerUserId = ownerIds[0];
      }
      if (Object.prototype.hasOwnProperty.call(dto, 'ownerName')) {
        project.ownerName = dto.ownerName ?? null;
      }
    }

    // ---- Связанный лид ----
    if (Object.prototype.hasOwnProperty.call(dto, 'leadId')) {
      project.leadId = dto.leadId ?? null;
    }

    // ---- Связанные проекты ----
    if (dto.relatedProjectIds !== undefined) {
      project.relatedProjectIds = dto.relatedProjectIds;
    }

    // ---- Бриф ----
    if (dto.briefFileName !== undefined) {
      project.briefFileName = dto.briefFileName;
    }
    if (dto.briefFileUrl !== undefined) {
      project.briefFileUrl = dto.briefFileUrl;
    }

    // ---- Задачи и комментарии ----
    if (dto.tasks !== undefined) {
      const normalized = normalizeTasks(dto.tasks);
      project.tasks = normalized ?? [];
    }
    if (dto.comments !== undefined) {
      project.comments = dto.comments;
    }
    if (dto.customFields !== undefined) {
      project.customFields = dto.customFields;
    }
    if (dto.isArchived !== undefined) {
      project.isArchived = dto.isArchived;
      project.archivedAt = dto.isArchived ? new Date() : null;
    }

    const saved = await this.repo.save(project);
    const statusChanged = before.status !== saved.status;
    const changes: Array<{ field: string; from: any; to: any }> = [];
    const pushChange = (field: keyof Project) => {
      if ((before as any)[field] !== (saved as any)[field]) {
        changes.push({
          field,
          from: (before as any)[field],
          to: (saved as any)[field],
        });
      }
    };
    [
      'name',
      'description',
      'amount',
      'currency',
      'status',
      'category',
      'ownerName',
      'ownerUserId',
      'ownerUserIds',
      'leadId',
      'companyId',
      'contactId',
      'briefFileName',
      'briefFileUrl',
      'isArchived',
    ].forEach((field) => pushChange(field as keyof Project));
    if (dto.tags !== undefined) {
      changes.push({
        field: 'tags',
        from: before.tags,
        to: saved.tags,
      });
    }
    if (dto.tasks !== undefined) {
      changes.push({
        field: 'tasks',
        from: Array.isArray(before.tasks) ? before.tasks.length : 0,
        to: Array.isArray(saved.tasks) ? saved.tasks.length : 0,
      });
    }
    if (changes.length) {
      await this.createActivity({
        tenantId,
        projectId: saved.id,
        action: 'update',
        actor,
        payload: { changes },
      });
    }

    if (statusChanged) {
      try {
        await this.automationsService.triggerAutomation(
          tenantId,
          TriggerEvent.PROJECT_STATUS_CHANGED,
          {
            entityType: 'project',
            entityId: saved.id,
            project: saved,
            oldStatus: before.status,
            newStatus: saved.status,
          },
        );
      } catch (error) {
        console.error('Failed to trigger automation:', error);
      }
    }
    return saved;
  }

  // ===== Архивировать проект =====
  async archiveForTenant(
    tenantId: string,
    id: string,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    project.isArchived = true;
    project.archivedAt = new Date();
    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'archive',
      actor,
    });
    return saved;
  }

  // ===== Разархивировать проект =====
  async unarchiveForTenant(
    tenantId: string,
    id: string,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    project.isArchived = false;
    project.archivedAt = null;
    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'unarchive',
      actor,
    });
    return saved;
  }

  // ===== Сменить статус =====
  async changeStatusForTenant(
    tenantId: string,
    id: string,
    status: ProjectStatus,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    const before = project.status;
    project.status = status;
    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'status_change',
      actor,
      payload: { from: before, to: status },
    });
    try {
      await this.automationsService.triggerAutomation(
        tenantId,
        TriggerEvent.PROJECT_STATUS_CHANGED,
        {
          entityType: 'project',
          entityId: saved.id,
          project: saved,
          oldStatus: before,
          newStatus: status,
        },
      );
    } catch (error) {
      console.error('Failed to trigger automation:', error);
    }
    return saved;
  }

  // ===== Мягкое удаление =====
  async softDeleteForTenant(
    tenantId: string,
    id: string,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    project.isDeleted = true;
    project.deletedAt = new Date();
    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'delete',
      actor,
    });
    return saved;
  }

  // ===== Восстановить из корзины =====
  async restoreForTenant(
    tenantId: string,
    id: string,
    actor?: { userId?: string; email?: string; name?: string },
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    project.isDeleted = false;
    project.deletedAt = null;
    const saved = await this.repo.save(project);
    await this.createActivity({
      tenantId,
      projectId: saved.id,
      action: 'restore',
      actor,
    });
    return saved;
  }
}
