// backend/src/staff/staff-users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StaffUsersService } from './staff-users.service';
import { StaffRole } from './staff-user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacService } from '../rbac/rbac.service';
import { assertCanManageStaff, assertStaffTargetAllowed, canManageStaff } from './staff-manage-access';

// Изменяющие эндпоинты раньше не проверяли роль вообще (privilege-escalation через
// PATCH :id/role), потом стали owner-only. Теперь: владелец или сотрудник с правом «Сотрудники»,
// с ограничениями из staff-manage-access.ts (не трогать владельца, не менять себе роль и т.д.).
// GET остаётся открытым для всех авторизованных — список сотрудников читают MainLayout и
// пикеры «ответственный» по всему приложению.
@UseGuards(JwtAuthGuard)
@Controller('staff-users')
export class StaffUsersController {
  constructor(
    private readonly service: StaffUsersService,
    private readonly rbac: RbacService,
  ) {}

  /** Общая проверка + проверка цели. Возвращает текущую запись сотрудника. */
  private async guardTarget(req: any, id: string, opts: { newRole?: string | null; selfForbidden?: boolean } = {}) {
    await assertCanManageStaff(this.rbac, req.user);
    const target = await this.service.getOneForTenant(req.user.tenantId, id);
    assertStaffTargetAllowed(req.user, target, opts);
    return target;
  }

  @Get()
  async list(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.service.listForTenant(tenantId);
  }

  @Post('invite')
  async invite(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId;
    if (body.role === 'owner') assertStaffTargetAllowed(req.user, { id: '', role: '' }, { newRole: 'owner' });
    return this.service.inviteStaffMember(tenantId, await canManageStaff(this.rbac, req.user), {
      email: String(body.email || ''),
      fullName: String(body.fullName || ''),
      role: body.role as StaffRole,
      departmentId:
        body.departmentId === undefined || body.departmentId === ''
          ? null
          : body.departmentId,
    });
  }

  @Post(':id/resend-invite')
  async resendInvite(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    return this.service.resendStaffInvite(tenantId, await canManageStaff(this.rbac, req.user), id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    await assertCanManageStaff(this.rbac, req.user);
    assertStaffTargetAllowed(req.user, { id: '', role: '' }, { newRole: body.role });
    const tenantId = req.user.tenantId;
    return this.service.createForTenant(tenantId, {
      email: body.email,
      fullName: body.fullName,
      role: body.role as StaffRole,
      department: body.department ?? null,
      departmentId: body.departmentId ?? null,
      avatarUrl: body.avatarUrl ?? null,
      externalId: body.externalId ?? null,
    });
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const row = await this.service.getOneForTenant(tenantId, id);
    return this.service.toPublicStaff(row);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    await this.guardTarget(req, id, {
      newRole: body?.role,
      // смена своей роли — нет; своё имя/аватар — можно
      selfForbidden: body?.role !== undefined || body?.isActive !== undefined,
    });
    const tenantId = req.user.tenantId;
    return this.service.updateForTenant(tenantId, id, body);
  }

  @Patch(':id/deactivate')
  async deactivate(@Req() req: any, @Param('id') id: string) {
    await this.guardTarget(req, id, { selfForbidden: true });
    const tenantId = req.user.tenantId;
    return this.service.deactivateForTenant(tenantId, id);
  }

  @Patch(':id/activate')
  async activate(@Req() req: any, @Param('id') id: string) {
    await this.guardTarget(req, id, { selfForbidden: true });
    const tenantId = req.user.tenantId;
    return this.service.activateForTenant(tenantId, id);
  }

  @Patch(':id/role')
  async updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { role: StaffRole },
  ) {
    await this.guardTarget(req, id, { newRole: body?.role, selfForbidden: true });
    const tenantId = req.user.tenantId;
    return this.service.updateRoleForTenant(tenantId, id, body.role);
  }

  @Patch(':id/department')
  async updateDepartment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { department: string | null },
  ) {
    await this.guardTarget(req, id);
    const tenantId = req.user.tenantId;
    return this.service.updateDepartmentForTenant(
      tenantId,
      id,
      body.department ?? null,
    );
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.guardTarget(req, id, { selfForbidden: true });
    const tenantId = req.user.tenantId;
    await this.service.deleteForTenant(tenantId, id);
    return { success: true };
  }
}