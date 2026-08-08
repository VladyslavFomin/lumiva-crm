import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ProductWebhooksService } from './product-webhooks.service';

@Controller('products/webhooks')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('products_manage_fields', 'read')
export class ProductWebhooksController {
  constructor(private readonly service: ProductWebhooksService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.tenantId);
  }

  @Post()
  @RequirePermission('products_manage_fields', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('products_manage_fields', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Post(':id/regenerate-secret')
  @RequirePermission('products_manage_fields', 'write')
  regenerateSecret(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.regenerateSecret(user.tenantId, id);
  }

  @Get(':id/deliveries')
  listDeliveries(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.listDeliveries(user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermission('products_manage_fields', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
