// src/audit-log/audit-log.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AuditLogService } from './audit-log.service';
import type { AuditLogAction, AuditLogEntityType } from './audit-log.entity';

@Controller('audit-log')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('settings', 'read')
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('entityType') entityType?: AuditLogEntityType,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditLogAction,
    @Query('actorUserId') actorUserId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findGlobal(user.tenantId, {
      entityType,
      entityId,
      action,
      actorUserId,
      search,
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
