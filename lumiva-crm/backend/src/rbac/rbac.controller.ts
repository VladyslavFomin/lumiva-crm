// src/rbac/rbac.controller.ts
import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import type { RoleMatrix, UserPermissionMatrix } from './permission.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

// Матрицу прав менять может только владелец аккаунта — раньше POST-эндпоинты были защищены
// только JwtAuthGuard (любой авторизованный сотрудник, включая роль viewer, мог переписать
// матрицу прав всех ролей, то есть выдать самому себе полный доступ). Тот же принцип, что и
// assertOwnerForInvites() в staff-users.service.ts. GET остаётся открытым для всех
// авторизованных сотрудников — MainLayout читает его для любой роли, чтобы посчитать видимость
// пунктов меню (см. usages в MainLayout.tsx), а сама матрица не более чувствительна, чем то,
// что она уже определяет.
function assertOwner(user: CurrentUserPayload): void {
  if ((user.role || '').toLowerCase() !== 'owner') {
    throw new ForbiddenException('Права доступа может изменять только владелец компании');
  }
}

@Controller('rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

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
    assertOwner(user);
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
    assertOwner(user);
    return this.rbacService.saveUserPermissions(user.tenantId, matrix, {
      actorUserId: user.userId ?? null,
      actorName: user.email ?? null,
    });
  }
}
