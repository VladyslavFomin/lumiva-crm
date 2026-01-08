// src/rbac/rbac.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import type { RoleMatrix, UserPermissionMatrix } from './permission.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('rbac')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('staff-permissions')
  async getStaffPermissions(
    @CurrentUser() user: any, // без отдельного типа
  ): Promise<RoleMatrix> {
    return this.rbacService.getRoleMatrixForTenant(user.tenantId);
  }

  @Post('staff-permissions')
  async saveStaffPermissions(
    @CurrentUser() user: any,
    @Body() matrix: RoleMatrix,
  ): Promise<RoleMatrix> {
    return this.rbacService.saveRolePermissions(user.tenantId, matrix);
  }

  // ===== User-level overrides =====
  @Get('user-permissions')
  async getUserPermissions(
    @CurrentUser() user: any,
  ): Promise<UserPermissionMatrix> {
    return this.rbacService.getUserMatrixForTenant(user.tenantId);
  }

  @Post('user-permissions')
  async saveUserPermissions(
    @CurrentUser() user: any,
    @Body() matrix: UserPermissionMatrix,
  ): Promise<UserPermissionMatrix> {
    return this.rbacService.saveUserPermissions(user.tenantId, matrix);
  }
}
