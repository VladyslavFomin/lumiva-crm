import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectCurrencyDefinition } from './project-currency.entity';
import { Project } from './project.entity';
import { CreateProjectCurrencyDto } from './dto/create-project-currency.dto';
import { UpdateProjectCurrencyDto } from './dto/update-project-currency.dto';
import { ReorderProjectCurrenciesDto } from './dto/reorder-project-currencies.dto';

export const BUILT_IN_PROJECT_CURRENCIES: Array<{ code: string; isDefault?: boolean }> = [
  { code: 'EUR', isDefault: true },
  { code: 'USD' },
  { code: 'TRY' },
];

@Injectable()
export class ProjectCurrenciesService {
  constructor(
    @InjectRepository(ProjectCurrencyDefinition)
    private readonly repo: Repository<ProjectCurrencyDefinition>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  private async ensureSeeded(tenantId: string): Promise<void> {
    const count = await this.repo.count({ where: { tenantId } });
    if (count > 0) return;
    const rows = BUILT_IN_PROJECT_CURRENCIES.map((c, idx) =>
      this.repo.create({
        tenantId,
        code: c.code,
        isDefault: Boolean(c.isDefault),
        order: idx,
      }),
    );
    await this.repo.save(rows);
  }

  async findAll(tenantId: string): Promise<ProjectCurrencyDefinition[]> {
    await this.ensureSeeded(tenantId);
    return this.repo.find({ where: { tenantId }, order: { order: 'ASC' } });
  }

  async findOne(tenantId: string, id: string): Promise<ProjectCurrencyDefinition> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Currency not found');
    return row;
  }

  private async clearDefault(tenantId: string, exceptId?: string): Promise<void> {
    const qb = this.repo
      .createQueryBuilder()
      .update(ProjectCurrencyDefinition)
      .set({ isDefault: false })
      .where('tenantId = :tenantId', { tenantId });
    if (exceptId) qb.andWhere('id != :exceptId', { exceptId });
    await qb.execute();
  }

  async create(tenantId: string, dto: CreateProjectCurrencyDto): Promise<ProjectCurrencyDefinition> {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Code is required');
    const existing = await this.repo.findOne({ where: { tenantId, code } });
    if (existing) {
      throw new BadRequestException(`Currency "${code}" already exists`);
    }
    const maxOrder = await this.repo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .select('COALESCE(MAX(c.order), -1)', 'max')
      .getRawOne<{ max: number }>();
    const row = this.repo.create({
      tenantId,
      code,
      label: dto.label?.trim() || null,
      isDefault: Boolean(dto.isDefault),
      order: (maxOrder?.max ?? -1) + 1,
    });
    const saved = await this.repo.save(row);
    if (saved.isDefault) {
      await this.clearDefault(tenantId, saved.id);
    }
    return saved;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateProjectCurrencyDto,
  ): Promise<ProjectCurrencyDefinition> {
    const row = await this.findOne(tenantId, id);
    if (dto.code !== undefined && dto.code.trim().toUpperCase() !== row.code) {
      const code = dto.code.trim().toUpperCase();
      if (!code) throw new BadRequestException('Code is required');
      const existing = await this.repo.findOne({ where: { tenantId, code } });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`Currency "${code}" already exists`);
      }
      const oldCode = row.code;
      row.code = code;
      // Project.currency хранит literal-код, а не ссылку на это определение — тем же
      // паттерном, что уже применён для статусов, переносим существующие проекты на новый
      // код, иначе они молча остаются со старым, ничему больше не соответствующим значением.
      await this.projectRepo
        .createQueryBuilder()
        .update(Project)
        .set({ currency: code as any })
        .where('tenantId = :tenantId', { tenantId })
        .andWhere('currency = :oldCode', { oldCode })
        .execute();
    }
    if (dto.label !== undefined) row.label = dto.label?.trim() || null;
    if (dto.order !== undefined) row.order = dto.order;
    if (dto.isDefault !== undefined) row.isDefault = dto.isDefault;
    const saved = await this.repo.save(row);
    if (saved.isDefault) {
      await this.clearDefault(tenantId, saved.id);
    }
    return saved;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const row = await this.findOne(tenantId, id);
    await this.repo.remove(row);
  }

  async reorder(tenantId: string, dto: ReorderProjectCurrenciesDto): Promise<ProjectCurrencyDefinition[]> {
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
