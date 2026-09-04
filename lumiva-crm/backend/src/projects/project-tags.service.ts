import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTagDefinition } from './project-tag.entity';
import { Project } from './project.entity';
import { CreateProjectTagDto } from './dto/create-project-tag.dto';
import { UpdateProjectTagDto } from './dto/update-project-tag.dto';
import { ReorderProjectTagsDto } from './dto/reorder-project-tags.dto';

export const BUILT_IN_PROJECT_TAGS: Array<{ value: string; color: string }> = [
  { value: 'CRM', color: '#1769d1' },
  { value: 'IT', color: '#3b6cb6' },
  { value: 'WEB', color: '#1f8a5e' },
  { value: 'SEO', color: '#c08319' },
  { value: 'SMM', color: '#8a4fbb' },
  { value: 'ADS', color: '#cc2f47' },
];

@Injectable()
export class ProjectTagsService {
  constructor(
    @InjectRepository(ProjectTagDefinition)
    private readonly repo: Repository<ProjectTagDefinition>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  private async ensureSeeded(tenantId: string): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = BUILT_IN_PROJECT_TAGS.map((s, idx) =>
      this.repo.create({ tenantId, value: s.value, color: s.color, order: idx }),
    );
    await this.repo.save(rows);
  }

  async findAll(tenantId: string): Promise<ProjectTagDefinition[]> {
    await this.ensureSeeded(tenantId);
    return this.repo.find({ where: { tenantId }, order: { order: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<ProjectTagDefinition> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Tag not found');
    return row;
  }

  async create(tenantId: string, dto: CreateProjectTagDto): Promise<ProjectTagDefinition> {
    const value = dto.value.trim();
    if (!value) throw new BadRequestException('Value is required');
    const existing = await this.repo.findOne({ where: { tenantId, value } });
    if (existing) {
      throw new BadRequestException(`Tag "${value}" already exists`);
    }
    const maxOrder = await this.repo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .select('COALESCE(MAX(t.order), -1)', 'max')
      .getRawOne<{ max: number }>();
    const row = this.repo.create({
      tenantId,
      value,
      color: dto.color || '#777777',
      order: (maxOrder?.max ?? -1) + 1,
    });
    return this.repo.save(row);
  }

  async update(tenantId: string, id: string, dto: UpdateProjectTagDto): Promise<ProjectTagDefinition> {
    const row = await this.findOne(tenantId, id);
    if (dto.value !== undefined && dto.value.trim() !== row.value) {
      const value = dto.value.trim();
      if (!value) throw new BadRequestException('Value is required');
      const existing = await this.repo.findOne({ where: { tenantId, value } });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Tag "${value}" already exists`);
      }
      const oldValue = row.value;
      row.value = value;
      // Project.tags — simple-array (текст, разделённый запятыми через TypeORM), а не ссылка
      // на это определение. Тем же паттерном, что уже применён для статусов/валют: переносим
      // тег во всех проектах, где он есть, иначе после переименования он перестаёт совпадать
      // ни с одним определением и молча выпадает из фильтрации/цветовой раскраски по тегам.
      // Точное совпадение элемента массива (не substring вроде "CRM" внутри "CRM-EU") надёжнее
      // делать в JS, чем текстовым LIKE по сырой comma-separated колонке — тег-переименование
      // редкая admin-операция, полная выборка проектов тенанта в память не проблема.
      const projects = await this.projectRepo.find({ where: { tenantId } });
      const toSave = projects
        .filter((p) => Array.isArray(p.tags) && p.tags.includes(oldValue))
        .map((p) => {
          p.tags = (p.tags as string[]).map((t) => (t === oldValue ? value : t));
          return p;
        });
      if (toSave.length) await this.projectRepo.save(toSave);
    }
    if (dto.color !== undefined) row.color = dto.color;
    if (dto.order !== undefined) row.order = dto.order;
    return this.repo.save(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }

  async reorder(tenantId: string, dto: ReorderProjectTagsDto): Promise<ProjectTagDefinition[]> {
    const rows = await this.repo.find({ where: { tenantId } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    dto.orderedIds.forEach((id, idx) => {
      const row = byId.get(id);
      if (row) row.order = idx;
    });
    await this.repo.save(Array.from(byId.values()));
    return this.repo.find({ where: { tenantId }, order: { order: 'ASC' } });
  }
}
