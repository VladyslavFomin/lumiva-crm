import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ProjectTablesService } from './project-tables.service';
import { ProjectTableMembersService } from './project-table-members.service';
import { CreateProjectTableDto } from './dto/create-project-table.dto';
import { UpdateProjectTableDto } from './dto/update-project-table.dto';
import { CreateProjectTableMemberDto } from './dto/create-project-table-member.dto';
import { UpdateProjectTableMemberDto } from './dto/update-project-table-member.dto';
import type { ProjectTableRole } from './project-table-role';

@Controller('project-tables')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('projects', 'read')
export class ProjectTablesController {
  constructor(
    private readonly service: ProjectTablesService,
    private readonly membersService: ProjectTableMembersService,
  ) {}

  private async currentStaffId(user: CurrentUserPayload): Promise<string | null> {
    return this.membersService.resolveStaffUserId(user.tenantId, {
      loginUserId: (user as any).userId ?? (user as any).id ?? (user as any).sub,
      email: (user as any).email,
    });
  }

  /** Приватные (не основные) таблицы видны/управляемы только явным участникам — без
   * tenant-owner bypass, по решению пользователя. Основная таблица ("Таблица") доступна
   * всем с базовым правом 'projects', как и раньше. */
  private async assertTableRole(
    tenantId: string,
    tableId: string,
    user: CurrentUserPayload,
    allowed: ProjectTableRole[],
  ): Promise<void> {
    const table = await this.service.getOne(tenantId, tableId);
    if (table.slug === 'main') return;

    const staffId = await this.currentStaffId(user);
    if (!staffId) {
      throw new ForbiddenException('Нет доступа к этой таблице');
    }
    const role = await this.membersService.resolveEffectiveRole(tenantId, tableId, staffId);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('Недостаточно прав в этой таблице');
    }
  }

  @Get()
  async list(@CurrentUser() user: CurrentUserPayload) {
    const staffId = await this.currentStaffId(user);
    return this.service.listForStaff(user.tenantId, staffId);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner', 'editor', 'reader']);
    return this.service.getOne(user.tenantId, id);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateProjectTableDto,
  ) {
    const staffId = await this.currentStaffId(user);
    return this.service.create(user.tenantId, dto, staffId);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProjectTableDto,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner', 'editor']);
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner']);
    await this.service.remove(user.tenantId, id);
    return { ok: true };
  }

  @Get(':id/members')
  async listMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner', 'editor', 'reader']);
    return this.membersService.listMembers(user.tenantId, id);
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateProjectTableMemberDto,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner']);
    const staffId = await this.currentStaffId(user);
    return this.membersService.createMember(user.tenantId, id, dto, staffId);
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() dto: UpdateProjectTableMemberDto,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner']);
    return this.membersService.updateMemberRole(user.tenantId, id, memberId, dto.role);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    await this.assertTableRole(user.tenantId, id, user, ['owner']);
    await this.membersService.removeMember(user.tenantId, id, memberId);
    return { ok: true };
  }
}
