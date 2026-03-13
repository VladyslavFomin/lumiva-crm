// backend/src/projects/projects.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

import { User } from '../users/user.entity';
import { StaffUser } from '../staff/staff-user.entity';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private readonly projectsService: ProjectsService,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  /** Находим staff-профиль для текущего JWT пользователя */
  private async getCurrentStaff(
    user: CurrentUserPayload,
  ): Promise<StaffUser | null> {
    this.logger.debug(`getCurrentStaff.user = ${JSON.stringify(user)}`);

    const { userId, tenantId, email } = user as any;

    // 1) Пытаемся найти сотрудника ПО EMAIL ИЗ JWT
    if (email) {
      const staffByEmail = await this.staffRepo.findOne({
        where: { tenantId, email },
      });
      if (staffByEmail) {
        this.logger.debug(
          `getCurrentStaff -> staff by email ${email}: ${staffByEmail.id}`,
        );
        return staffByEmail;
      }
    }

    // 2) Если по email не нашли — пробуем через таблицу users
    if (userId) {
      const authUser = await this.userRepo.findOne({
        where: { id: userId, tenantId },
      });
      this.logger.debug(
        `getCurrentStaff.authUser = ${
          authUser
            ? JSON.stringify({ id: authUser.id, email: authUser.email })
            : 'null'
        }`,
      );

      if (!authUser) return null;

      const staffViaUser = await this.staffRepo.findOne({
        where: { tenantId, email: authUser.email },
      });
      this.logger.debug(
        `getCurrentStaff.staff (via user email) = ${
          staffViaUser
            ? JSON.stringify({ id: staffViaUser.id, email: staffViaUser.email })
            : 'null'
        }`,
      );

      return staffViaUser ?? null;
    }

    return null;
  }

  /** Проверяем, является ли сотрудник владельцем проекта */
  private isProjectMine(project: any, staff: StaffUser | null): boolean {
    if (!staff) return false;

    const staffId = staff.id;
    const fullName = staff.fullName?.trim();

    const mineByIds =
      Array.isArray(project.ownerUserIds) &&
      project.ownerUserIds.includes(staffId);
    const mineById = project.ownerUserId && project.ownerUserId === staffId;
    const mineByName =
      fullName &&
      project.ownerName &&
      project.ownerName.trim() === fullName;

    this.logger.debug(
      `isProjectMine = ${JSON.stringify({
        projectId: project.id,
        projectOwnerUserId: project.ownerUserId ?? null,
        projectOwnerName: project.ownerName ?? null,
        staffId,
        staffFullName: fullName ?? null,
        mineByIds,
        mineById,
        mineByName,
      })}`,
    );

    return Boolean(mineByIds || mineById || mineByName);
  }

  // ================== GET /projects ==================
  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query('leadId') leadId?: string,
    @Query('q') q?: string,
    @Query('archived') archived?: string,
    @Query('deleted') deleted?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const { tenantId, role } = user;

    const raw = await this.projectsService.findAllForTenant({
      tenantId,
      status: status as any,
      leadId,
      q,
      includeArchived: archived === '1' || archived === 'true',
      onlyArchived: archived === '1' || archived === 'true',
      onlyDeleted: deleted === '1' || deleted === 'true',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    // owner видит всё
    if (role === 'owner') {
      return raw;
    }

    // остальные – только свои проекты
    const staff = await this.getCurrentStaff(user);
    if (!staff) {
      this.logger.debug('list: staff not found for current user');
      return { total: 0, items: [] };
    }

    const items = raw.items.filter((p) => this.isProjectMine(p, staff));
    return { total: items.length, items };
  }

  // ================== GET /projects/:id ==================
  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;

    const project = await this.projectsService.findOneForTenant(tenantId, id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (role === 'owner') {
      return project;
    }

    const staff = await this.getCurrentStaff(user);
    if (!this.isProjectMine(project, staff)) {
      throw new ForbiddenException('Недостаточно прав для просмотра проекта');
    }

    return project;
  }

  // ================== POST /projects ==================
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectDto,
  ) {
    const { tenantId, role } = user;
    const canCreateRoles = ['owner', 'manager', 'sales'];

    if (!canCreateRoles.includes(role as any)) {
      throw new ForbiddenException('Недостаточно прав для создания проекта');
    }

    this.logger.debug(
      `create.dto.before = ${JSON.stringify(dto, null, 2)}`,
    );

    const staff = await this.getCurrentStaff(user);

    if (role === 'owner') {
      // Владельцу разрешаем явно задавать ответственного.
      // Если не задан – ставим его самого (если есть staff-профиль).
      if (
        (!dto.ownerUserIds || !dto.ownerUserIds.length) &&
        (!dto.ownerUserId || !dto.ownerName) &&
        staff
      ) {
        dto.ownerUserIds = [staff.id];
        dto.ownerUserId = staff.id;
        dto.ownerName = staff.fullName;
      }
    } else {
      // manager / sales – ВСЕГДА становятся владельцами проекта,
      // даже если фронт прислал другие ownerUserId/ownerName.
      if (staff) {
        dto.ownerUserIds = [staff.id];
        dto.ownerUserId = staff.id;
        dto.ownerName = staff.fullName;
      }
    }

    this.logger.debug(
      `create.dto.after = ${JSON.stringify(dto, null, 2)}`,
    );

    return this.projectsService.createForTenant(tenantId, dto, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
  }

  // ================== PATCH /projects/:id ==================
  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const { tenantId, role } = user;
    const canEditRoles = ['owner', 'manager', 'sales'];

    if (!canEditRoles.includes(role as any)) {
      throw new ForbiddenException('Недостаточно прав для изменения проекта');
    }

    const project = await this.projectsService.findOneForTenant(tenantId, id);

    if (role === 'owner') {
      // владелец может менять всё, включая владельца проекта
      return this.projectsService.updateForTenant(tenantId, id, dto, {
        userId: (user as any).userId,
        email: (user as any).email,
        name: (user as any).name ?? (user as any).email,
      });
    }

    // manager / sales – только свои проекты
    const staff = await this.getCurrentStaff(user);
    if (!this.isProjectMine(project, staff)) {
      throw new ForbiddenException('Можно изменять только свои проекты');
    }

    // и не можем перепривязывать проект на кого-то другого
    if (dto.ownerUserId !== undefined) {
      delete (dto as any).ownerUserId;
    }
    if (dto.ownerUserIds !== undefined) {
      delete (dto as any).ownerUserIds;
    }
    if (dto.ownerName !== undefined) {
      delete (dto as any).ownerName;
    }

    return this.projectsService.updateForTenant(tenantId, id, dto, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
  }

  // ================== PATCH /projects/:id/status ==================
  @Patch(':id/status')
  async changeStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ChangeStatusDto,
  ) {
    const { tenantId, role } = user;
    const canEditRoles = ['owner', 'manager', 'sales'];

    if (!canEditRoles.includes(role as any)) {
      throw new ForbiddenException('Недостаточно прав для изменения статуса');
    }

    const project = await this.projectsService.findOneForTenant(tenantId, id);

    if (role !== 'owner') {
      const staff = await this.getCurrentStaff(user);
      if (!this.isProjectMine(project, staff)) {
        throw new ForbiddenException(
          'Можно менять статус только своих проектов',
        );
      }
    }

    return this.projectsService.changeStatusForTenant(
      tenantId,
      id,
      dto.status,
      {
        userId: (user as any).userId,
        email: (user as any).email,
        name: (user as any).name ?? (user as any).email,
      },
    );
  }

  // ================== PATCH /projects/:id/archive ==================
  @Patch(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;
    const canEditRoles = ['owner', 'manager', 'sales'];

    if (!canEditRoles.includes(role as any)) {
      throw new ForbiddenException('Недостаточно прав для архивирования проекта');
    }

    const project = await this.projectsService.findOneForTenant(tenantId, id);

    if (role !== 'owner') {
      const staff = await this.getCurrentStaff(user);
      if (!this.isProjectMine(project, staff)) {
        throw new ForbiddenException(
          'Можно архивировать только свои проекты',
        );
      }
    }

    return this.projectsService.archiveForTenant(tenantId, id, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
  }

  // ================== PATCH /projects/:id/unarchive ==================
  @Patch(':id/unarchive')
  async unarchive(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;
    const canEditRoles = ['owner', 'manager', 'sales'];

    if (!canEditRoles.includes(role as any)) {
      throw new ForbiddenException('Недостаточно прав для разархивирования проекта');
    }

    const project = await this.projectsService.findOneForTenant(tenantId, id);

    if (role !== 'owner') {
      const staff = await this.getCurrentStaff(user);
      if (!this.isProjectMine(project, staff)) {
        throw new ForbiddenException(
          'Можно разархивировать только свои проекты',
        );
      }
    }

    return this.projectsService.unarchiveForTenant(tenantId, id, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
  }

  // ================== DELETE /projects/:id ==================
  @Delete(':id')
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;

    if (role !== 'owner') {
      throw new ForbiddenException('Удалять проекты может только владелец');
    }

    await this.projectsService.softDeleteForTenant(tenantId, id, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
    return { ok: true };
  }

  // ================== PATCH /projects/:id/restore ==================
  @Patch(':id/restore')
  async restore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;

    if (role !== 'owner') {
      throw new ForbiddenException('Восстанавливать проекты может только владелец');
    }

    return this.projectsService.restoreForTenant(tenantId, id, {
      userId: (user as any).userId,
      email: (user as any).email,
      name: (user as any).name ?? (user as any).email,
    });
  }

  // ================== GET /projects/:id/activities ==================
  @Get(':id/activities')
  async activities(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const { tenantId, role } = user;
    const project = await this.projectsService.findOneForTenant(tenantId, id);
    if (role !== 'owner') {
      const staff = await this.getCurrentStaff(user);
      if (!this.isProjectMine(project, staff)) {
        throw new ForbiddenException('Недостаточно прав для просмотра истории');
      }
    }
    return this.projectsService.listActivitiesForTenant(tenantId, id);
  }
}