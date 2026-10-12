// src/rbac/rbac.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RbacService } from './rbac.service';
import type { RoleMatrix, UserPermissionMatrix } from './permission.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StaffUser } from '../staff/staff-user.entity';
import {
  assertCanManageStaff,
  assertRoleMatrixChangeAllowed,
  assertUserMatrixChangeAllowed,
} from '../staff/staff-manage-access';

// Матрицу прав менять может владелец или сотрудник с правом «Сотрудники» — с ограничениями
// (не свою роль/права, не владельца, не выдавать того, чего нет у себя), см.
// staff/staff-manage-access.ts. Раньше POST был открыт любому авторизованному (viewer мог выдать
// себе полный доступ), потом стал owner-only. GET открыт всем авторизованным — MainLayout читает
// его для любой роли, чтобы посчитать видимость пунктов меню.
@Controller('rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    @InjectRepository(StaffUser)
    private readonly staffRepo: Repository<StaffUser>,
  ) {}

  @Get('staff-permissions')
  async getStaffPermissions(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<RoleMatrix> {
    return this.rbacService.getRoleMatrixForTenant(user.tenantId);
  }

  @Post('staff-permissions')
  async saveStaffPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Body() matrix: RoleMatrix,
  ): Promise<RoleMatrix> {
    await assertCanManageStaff(this.rbacService, user);
    const before = await this.rbacService.getRoleMatrixForTenant(user.tenantId);
    await assertRoleMatrixChangeAllowed(this.rbacService, user, before, matrix);
    return this.rbacService.saveRolePermissions(user.tenantId, matrix, {
      actorUserId: user.userId ?? null,
      actorName: user.email ?? null,
    });
  }

  // ===== User-level overrides =====
  @Get('user-permissions')
  async getUserPermissions(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserPermissionMatrix> {
    return this.rbacService.getUserMatrixForTenant(user.tenantId);
  }

  @Post('user-permissions')
  async saveUserPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Body() matrix: UserPermissionMatrix,
  ): Promise<UserPermissionMatrix> {
    await assertCanManageStaff(this.rbacService, user);
    const before = await this.rbacService.getUserMatrixForTenant(user.tenantId);
    await assertUserMatrixChangeAllowed(this.rbacService, user, before, matrix, async (id) => {
      const row = await this.staffRepo.findOne({ where: { tenantId: user.tenantId, id } });
      return row?.role ?? null;
    });
    return this.rbacService.saveUserPermissions(user.tenantId, matrix, {
      actorUserId: user.userId ?? null,
      actorName: user.email ?? null,
    });
  }
}
