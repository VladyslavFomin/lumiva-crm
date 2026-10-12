import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectTable } from './project-table.entity';
import { ProjectTableMember } from './project-table-member.entity';
import { Project } from '../projects/project.entity';
import { ProjectTableMembersService } from './project-table-members.service';
import { CreateProjectTableDto } from './dto/create-project-table.dto';
import { UpdateProjectTableDto } from './dto/update-project-table.dto';

@Injectable()
export class ProjectTablesService {
  constructor(
    @InjectRepository(ProjectTable)
    private readonly tableRepo: Repository<ProjectTable>,
    @InjectRepository(ProjectTableMember)
    private readonly memberRepo: Repository<ProjectTableMember>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly members: ProjectTableMembersService,
  ) {}

  private slugify(input: string) {
    return (
      String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180) || 'table'
    );
  }

  private async uniqueSlug(tenantId: string, base: string, excludeId?: string) {
    let candidate = this.slugify(base);
    if (candidate === 'main') candidate = `${candidate}-1`;
    let i = 1;
    for (;;) {
      const found = await this.tableRepo.findOne({ where: { tenantId, slug: candidate } });
      if (!found || found.id === excludeId) return candidate;
      candidate = `${this.slugify(base)}-${i++}`;
    }
  }

  /** Первая загрузка: создаём основную таблицу и привязываем к ней проекты без таблицы
   * (существующие данные тенанта до появления этой функциональности). */
  async ensureDefaultTable(tenantId: string): Promise<ProjectTable> {
    const existing = await this.tableRepo.findOne({ where: { tenantId, slug: 'main' } });
    if (existing) return existing;

    // Атомарно (ON CONFLICT по tenantId+slug): параллельные первые запросы не падают на
    // duplicate key — проигравший берёт таблицу, созданную выигравшим.
    const inserted = await this.tableRepo
      .createQueryBuilder()
      .insert()
      .into(ProjectTable)
      .values({ tenantId, name: 'Таблица', slug: 'main', createdByStaffId: null, sortOrder: 0 })
      .orIgnore()
      .returning(['id'])
      .execute();
    const insertedId = (inserted.raw as Array<{ id: string }>)[0]?.id;
    const main = await this.tableRepo.findOne({ where: { tenantId, slug: 'main' } });
    if (!main) throw new Error('Default project table was not created');
    if (!insertedId) return main;

    await this.projectRepo
      .createQueryBuilder()
      .update(Project)
      .set({ tableId: main.id })
      .where('tenantId = :tid', { tid: tenantId })
      .andWhere('tableId IS NULL')
      .execute();

    return main;
  }

  /** Таблицы, видимые сотруднику: основная (видна всем) + те, где он явный участник.
   * Владелец компании — все таблицы. */
  async listForStaff(tenantId: string, staffUserId: string | null, isTenantOwner = false): Promise<ProjectTable[]> {
    const main = await this.ensureDefaultTable(tenantId);
    if (isTenantOwner) {
      // владелец компании видит все таблицы, включая приватные без приглашения
      const all = await this.tableRepo.find({ where: { tenantId } });
      return all.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
    }
    if (!staffUserId) return [main];

    const memberships = await this.memberRepo.find({ where: { tenantId, staffUserId } });
    const extraIds = memberships
      .map((m) => m.projectTableId)
      .filter((id) => id !== main.id);
    const extra = extraIds.length
      ? await this.tableRepo.find({ where: { id: In(extraIds), tenantId } })
      : [];

    return [main, ...extra].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  async getOne(tenantId: string, id: string): Promise<ProjectTable> {
    await this.ensureDefaultTable(tenantId);
    const row = await this.tableRepo.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Table not found');
    return row;
  }

  async create(
    tenantId: string,
    dto: CreateProjectTableDto,
    creatorStaffUserId: string | null,
  ): Promise<ProjectTable> {
    await this.ensureDefaultTable(tenantId);
    const slug = await this.uniqueSlug(tenantId, dto.name);
    const saved = await this.tableRepo.save(
      this.tableRepo.create({
        tenantId,
        name: dto.name.trim(),
        slug,
        createdByStaffId: creatorStaffUserId,
        sortOrder: 0,
      }),
    );
    if (creatorStaffUserId) {
      await this.members.addMember(tenantId, saved.id, creatorStaffUserId, 'owner', creatorStaffUserId);
    }
    return saved;
  }

  async update(tenantId: string, id: string, dto: UpdateProjectTableDto): Promise<ProjectTable> {
    const row = await this.getOne(tenantId, id);
    if (dto.name != null) row.name = dto.name.trim();
    if (dto.sortOrder != null) row.sortOrder = dto.sortOrder;
    return this.tableRepo.save(row);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.getOne(tenantId, id);
    if (row.slug === 'main') {
      throw new BadRequestException('Нельзя удалить основную таблицу');
    }

    const main = await this.tableRepo.findOne({ where: { tenantId, slug: 'main' } });
    if (!main) {
      throw new BadRequestException('Не найдена основная таблица');
    }

    await this.projectRepo
      .createQueryBuilder()
      .update(Project)
      .set({ tableId: main.id })
      .where('tenantId = :tid', { tid: tenantId })
      .andWhere('tableId = :id', { id })
      .execute();

    await this.memberRepo.delete({ tenantId, projectTableId: id });
    await this.tableRepo.delete({ id, tenantId });
  }
}
