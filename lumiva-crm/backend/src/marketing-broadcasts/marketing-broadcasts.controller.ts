// src/marketing-broadcasts/marketing-broadcasts.controller.ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { MarketingBroadcastsService, type CreateBroadcastDto } from './marketing-broadcasts.service';

@Controller('marketing/broadcasts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MarketingBroadcastsController {
  constructor(private readonly service: MarketingBroadcastsService) {}

  @Get()
  @RequirePermission('marketing', 'read')
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.tenantId);
  }

  @Get(':id')
  @RequirePermission('marketing', 'read')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @RequirePermission('marketing', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateBroadcastDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('marketing', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Partial<CreateBroadcastDto>,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing', 'write')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post(':id/schedule')
  @RequirePermission('marketing', 'write')
  schedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { scheduledAt?: string | null },
  ) {
    return this.service.schedule(user.tenantId, id, body?.scheduledAt ?? null);
  }

  @Post(':id/cancel')
  @RequirePermission('marketing', 'write')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancel(user.tenantId, id);
  }
}
