import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { BookingsTemplatesService } from './bookings-templates.service';

@Controller('bookings/templates')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings_manage_settings', 'read')
export class BookingTemplatesController {
  constructor(private readonly service: BookingsTemplatesService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.service.list(user.tenantId);
  }

  @Post()
  @RequirePermission('bookings_manage_settings', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('bookings_manage_settings', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('bookings_manage_settings', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
