// src/projects/project-statuses.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectStatusDefinition } from './project-status.entity';
import { Project } from './project.entity';
import { CreateProjectStatusDto } from './dto/create-project-status.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ReorderProjectStatusesDto } from './dto/reorder-project-statuses.dto';

export const BUILT_IN_PROJECT_STATUSES: Array<{ value: string; color: string }> = [
  { value: 'Новый', color: '#1769d1' },
  { value: 'В работе', color: '#3b6cb6' },
  { value: 'На проверке', color: '#c08319' },
  { value: 'Заморожен', color: '#777777' },
  { value: 'Закрыт', color: '#9a9a9a' },
  { value: 'Выиграно', color: '#1f8a5e' },
  { value: 'Проиграно', color: '#cc2f47' },
];

@Injectable()
export class ProjectStatusesService {
  constructor(
    @InjectRepository(ProjectStatusDefinition)
    private readonly repo: Repository<ProjectStatusDefinition>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  /** Гарантирует, что у тенанта есть хотя бы базовый набор статусов (ленивый сид на случай,
   * если тенант создан до появления этой таблицы, или сидирующая миграция его не застала). */
  private async ensureSeeded(tenantId: string): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = BUILT_IN_PROJECT_STATUSES.map((s, idx) =>
      this.repo.create({
        tenantId,
        value: s.value,
        color: s.color,
        order: idx,
        isBuiltIn: true,
      }),
    );
    await this.repo.save(rows);
  }

  async findAll(tenantId: string): Promise<ProjectStatusDefinition[]> {
    await this.ensureSeeded(tenantId);
    return this.repo.find({ where: { tenantId }, order: { order: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<ProjectStatusDefinition> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Status not found');
    return row;
  }

  async create(tenantId: string, dto: CreateProjectStatusDto): Promise<ProjectStatusDefinition> {
    const value = dto.value.trim();
    if (!value) throw new BadRequestException('Value is required');
    const existing = await this.repo.findOne({ where: { tenantId, value } });
    if (existing) {
      throw new BadRequestException(`Status "${value}" already exists`);
    }
    const maxOrder = await this.repo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .select('COALESCE(MAX(s.order), -1)', 'max')
      .getRawOne<{ max: number }>();
    const row = this.repo.create({
      tenantId,
      value,
      color: dto.color || '#777777',
      order: (maxOrder?.max ?? -1) + 1,
      isBuiltIn: false,
    });
    return this.repo.save(row);
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProjectStatusDto,
  ): Promise<ProjectStatusDefinition> {
    const row = await this.findOne(tenantId, id);
    if (dto.value !== undefined && dto.value.trim() !== row.value) {
      const value = dto.value.trim();
      if (!value) throw new BadRequestException('Value is required');
      const existing = await this.repo.findOne({ where: { tenantId, value } });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Status "${value}" already exists`);
      }
      const oldValue = row.value;
      row.value = value;
      const saved = await this.repo.save(row);
      // Project.status хранит literal-строку, а не ссылку на этот id — переносим существующие
      // проекты на новое имя, иначе они "потеряются" (не будут матчиться ни на одну колонку/статус).
      await this.projectRepo
        .createQueryBuilder()
        .update(Project)
        .set({ status: value as any })
        .where('tenantId = :tenantId', { tenantId })
        .andWhere('status = :oldValue', { oldValue })
        .execute();
      if (dto.color !== undefined) saved.color = dto.color;
      if (dto.order !== undefined) saved.order = dto.order;
      return this.repo.save(saved);
    }
    if (dto.color !== undefined) row.color = dto.color;
    if (dto.order !== undefined) row.order = dto.order;
    return this.repo.save(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    if (row.isBuiltIn) {
      throw new BadRequestException('Cannot delete a built-in status');
    }
    await this.repo.remove(row);
  }

  async reorder(tenantId: string, dto: ReorderProjectStatusesDto): Promise<ProjectStatusDefinition[]> {
    const rows = await this.repo.find({ where: { tenantId } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    dto.orderedIds.forEach((id, idx) => {
      const row = byId.get(id);
      if (row) row.order = idx;
    });
    await this.repo.save(Array.from(byId.values()));
    return this.repo.find({ where: { tenantId }, order: { order: 'ASC' } });
  }

  /** Используется projects.service.ts для валидации значения статуса при создании/обновлении проекта. */
  async isValidValue(tenantId: string, value: string): Promise<boolean> {
    await this.ensureSeeded(tenantId);
    const row = await this.repo.findOne({ where: { tenantId, value } });
    return !!row;
  }
}
