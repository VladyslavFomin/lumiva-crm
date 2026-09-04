import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceAreaMember } from './workspace-area-member.entity';
import { StaffUser } from '../staff/staff-user.entity';
import type { WorkspaceAreaRole } from './workspace-area-role';
import type { CreateWorkspaceAreaMemberDto } from './dto/create-workspace-area-member.dto';

@Injectable()
export class WorkspaceAreaMembersService {
  constructor(
    @InjectRepository(WorkspaceAreaMember)
    private readonly repo: Repository<WorkspaceAreaMember>,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  async listMembers(tenantId: string, workspaceAreaId: string) {
    return this.repo.find({
      where: { tenantId, workspaceAreaId },
      relations: ['staffUser'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Прямое добавление (используется при создании области / бэкофисной логике) — без DTO-валидации. */
  async addMember(
    tenantId: string,
    workspaceAreaId: string,
    staffUserId: string,
    role: WorkspaceAreaRole,
    invitedByUserId?: string | null,
  ): Promise<WorkspaceAreaMember> {
    const existing = await this.repo.findOne({
      where: { tenantId, workspaceAreaId, staffUserId },
    });
    if (existing) {
      existing.role = role;
      return this.repo.save(existing);
    }
    return this.repo.save(
      this.repo.create({
        tenantId,
        workspaceAreaId,
        staffUserId,
        role,
        invitedByUserId: invitedByUserId ?? null,
      }),
    );
  }

  /** Добавление через контроллер — по staffUserId или по e-mail существующего сотрудника тенанта. */
  async createMember(
    tenantId: string,
    workspaceAreaId: string,
    dto: CreateWorkspaceAreaMemberDto,
    invitedByUserId: string | null,
  ): Promise<WorkspaceAreaMember> {
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
    return this.addMember(tenantId, workspaceAreaId, staffUserId, dto.role, invitedByUserId);
  }

  async updateMemberRole(
    tenantId: string,
    workspaceAreaId: string,
    memberId: string,
    role: WorkspaceAreaRole,
  ): Promise<WorkspaceAreaMember> {
    const row = await this.repo.findOne({
      where: { id: memberId, tenantId, workspaceAreaId },
    });
    if (!row) throw new NotFoundException('Участник не найден');
    row.role = role;
    return this.repo.save(row);
  }

  async removeMember(tenantId: string, workspaceAreaId: string, memberId: string): Promise<void> {
    const row = await this.repo.findOne({
      where: { id: memberId, tenantId, workspaceAreaId },
    });
    if (!row) throw new NotFoundException('Участник не найден');
    await this.repo.remove(row);
  }

  async countMembers(tenantId: string, workspaceAreaId: string): Promise<number> {
    return this.repo.count({ where: { tenantId, workspaceAreaId } });
  }

  /** JWT identity (`sub`) is `users.id` — a login/auth record, NOT `staff_users.id`. Same
   * pattern as `ReservationsService.findActingStaffUserId`: match by `externalId` (the
   * documented users.id link on StaffUser) first, falling back to email. Returns null for
   * logins with no matching staff directory row (e.g. an owner who never got a StaffUser row) —
   * callers must handle that (tenant-global owner bypasses area checks entirely upstream). */
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

  /** Эффективная роль сотрудника в области: tenant-глобальный owner всегда владелец,
   * иначе — явное членство, иначе null (нет доступа). */
  async resolveEffectiveRole(
    tenantId: string,
    workspaceAreaId: string,
    staffUserId: string,
    tenantGlobalRole: string | undefined,
  ): Promise<WorkspaceAreaRole | null> {
    if (tenantGlobalRole === 'owner') return 'owner';
    const row = await this.repo.findOne({
      where: { tenantId, workspaceAreaId, staffUserId },
    });
    return row?.role ?? null;
  }
}
