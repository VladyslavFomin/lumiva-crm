// backend/src/projects/projects.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Project, ProjectStatus } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  // ===== Список проектов арендатора с фильтрами =====
  async findAllForTenant(options: {
    tenantId: string;
    status?: ProjectStatus;
    leadId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const { tenantId, status, leadId, q, limit = 50, offset = 0 } = options;

    const where: any = {
      tenantId,
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }
    if (leadId) {
      where.leadId = leadId;
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
  async createForTenant(tenantId: string, dto: CreateProjectDto) {
    const tagsArray =
      dto.tags && dto.tags.trim().length
        ? dto.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
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
      ownerUserId: dto.ownerUserId ?? null,
      leadId: dto.leadId ?? null,
      relatedProjectIds: dto.relatedProjectIds ?? null,
      briefFileName: dto.briefFileName ?? null,
      briefFileUrl: dto.briefFileUrl ?? null,
      tasks: dto.tasks ?? [],
      comments: dto.comments ?? [],
    });

    return this.repo.save(project);
  }

  // ===== Обновить проект =====
  async updateForTenant(
    tenantId: string,
    id: string,
    dto: UpdateProjectDto,
  ) {
    const project = await this.findOneForTenant(tenantId, id);

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

    // ---- Ответственный / владелец проекта ----
    // если поле пришло в DTO – работаем с ним, если нет – вообще не трогаем
    if (Object.prototype.hasOwnProperty.call(dto, 'ownerUserId')) {
      project.ownerUserId = dto.ownerUserId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'ownerName')) {
      project.ownerName = dto.ownerName ?? null;
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
      project.tasks = dto.tasks;
    }
    if (dto.comments !== undefined) {
      project.comments = dto.comments;
    }

    return this.repo.save(project);
  }

  // ===== Сменить статус =====
  async changeStatusForTenant(
    tenantId: string,
    id: string,
    status: ProjectStatus,
  ) {
    const project = await this.findOneForTenant(tenantId, id);
    project.status = status;
    return this.repo.save(project);
  }

  // ===== Мягкое удаление =====
  async softDeleteForTenant(tenantId: string, id: string) {
    const project = await this.findOneForTenant(tenantId, id);
    project.isDeleted = true;
    project.deletedAt = new Date();
    return this.repo.save(project);
  }
}