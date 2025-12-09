// src/rbac/rbac.controller.ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import type { RoleMatrix } from './permission.types';
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
}