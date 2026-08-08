// src/bi-dashboard/bi-dashboard.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { BiDashboardService } from './bi-dashboard.service';

@Controller('bi-dashboard')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('analytics', 'read')
export class BiDashboardController {
  constructor(private readonly service: BiDashboardService) {}

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.service.getSummary(user.tenantId, days ? Number(days) : undefined);
  }
}
