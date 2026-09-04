import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectTableMember } from './project-table-member.entity';
import { StaffUser } from '../staff/staff-user.entity';
import type { ProjectTableRole } from './project-table-role';
import type { CreateProjectTableMemberDto } from './dto/create-project-table-member.dto';

@Injectable()
export class ProjectTableMembersService {
  constructor(
    @InjectRepository(ProjectTableMember)
    private readonly repo: Repository<ProjectTableMember>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async listMembers(tenantId: string, projectTableId: string) {
    return this.repo.find({
      where: { tenantId, projectTableId },
      relations: ['staffUser'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Прямое добавление (используется при создании таблицы) — без DTO-валидации. */
  async addMember(
    tenantId: string,
    projectTableId: string,
    staffUserId: string,
    role: ProjectTableRole,
    invitedByUserId?: string | null,
  ): Promise<ProjectTableMember> {
    const existing = await this.repo.findOne({
      where: { tenantId, projectTableId, staffUserId },
    });
    if (existing) {
      existing.role = role;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        tenantId,
        projectTableId,
        staffUserId,
        role,
        invitedByUserId: invitedByUserId ?? null,
      }),
    );
  }

  /** Добавление через контроллер — по staffUserId или по e-mail существующего сотрудника тенанта. */
  async createMember(
    tenantId: string,
    projectTableId: string,
    dto: CreateProjectTableMemberDto,
    invitedByUserId: string | null,
  ): Promise<ProjectTableMember> {
    let staffUserId = dto.staffUserId;
    if (!staffUserId) {
      const email = dto.email?.trim().toLowerCase();
      if (!email) {
        throw new BadRequestException('Укажите staffUserId или email сотрудника');
      }
      const staff = await this.staffRepo.findOne({ where: { tenantId, email } });
      if (!staff) {
        throw new BadRequestException(
          'Сотрудник с таким e-mail ещё не приглашён в компанию — сначала добавьте его в Настройки → Сотрудники',
        );
      }
      staffUserId = staff.id;
    }
    return this.addMember(tenantId, projectTableId, staffUserId, dto.role, invitedByUserId);
  }

  async updateMemberRole(
    tenantId: string,
    projectTableId: string,
    memberId: string,
    role: ProjectTableRole,
  ): Promise<ProjectTableMember> {
    const row = await this.repo.findOne({
      where: { id: memberId, tenantId, projectTableId },
    });
    if (!row) throw new NotFoundException('Участник не найден');
    row.role = role;
    return this.repo.save(row);
  }

  async removeMember(tenantId: string, projectTableId: string, memberId: string): Promise<void> {
    const row = await this.repo.findOne({
      where: { id: memberId, tenantId, projectTableId },
    });
    if (!row) throw new NotFoundException('Участник не найден');
    await this.repo.remove(row);
  }

  async countMembers(tenantId: string, projectTableId: string): Promise<number> {
    return this.repo.count({ where: { tenantId, projectTableId } });
  }

  /** JWT identity (`sub`) is `users.id`, not `staff_users.id` — match by `externalId` first,
   * falling back to email. Same idiom as WorkspaceAreaMembersService.resolveStaffUserId. */
  async resolveStaffUserId(
    tenantId: string,
    identity: { loginUserId?: string | null; email?: string | null },
  ): Promise<string | null> {
    const loginUserId = identity.loginUserId?.trim();
    if (loginUserId) {
      const byExternalId = await this.staffRepo.findOne({
        where: { tenantId, externalId: loginUserId },
      });
      if (byExternalId) return byExternalId.id;
    }
    const email = identity.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await this.staffRepo.findOne({ where: { tenantId, email } });
      if (byEmail) return byEmail.id;
    }
    return null;
  }

  /** Эффективная роль на НЕосновной (приватной) таблице: только явное членство —
   * в отличие от рабочих областей, tenant-глобальный owner здесь НЕ обходит проверку:
   * приватные таблицы видны только тем, кого явно пригласили. */
  async resolveEffectiveRole(
    tenantId: string,
    projectTableId: string,
    staffUserId: string,
  ): Promise<ProjectTableRole | null> {
    const row = await this.repo.findOne({
      where: { tenantId, projectTableId, staffUserId },
    });
    return row?.role ?? null;
  }
}
