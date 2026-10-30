import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelChannelsService } from './hotel-channels.service';

/** Менеджер каналов: подключение (ключ API), сопоставления, выгрузка цен/наличия, загрузка броней, журнал */
@Controller('hotels/channels')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelChannelsController {
  constructor(private readonly channels: HotelChannelsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId?: string) {
    return this.channels.list(user.tenantId, hotelId || undefined);
  }

  @Post()
  @RequirePermission('hotels_manage_pricing', 'write')
  connect(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.channels.connect(user.tenantId, dto || {});
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_pricing', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.channels.update(user.tenantId, id, dto || {});
  }

  @Delete(':id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.channels.remove(user.tenantId, id);
  }

  @Get(':id/remote')
  @RequirePermission('hotels_manage_pricing', 'write')
  remote(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.channels.remote(user.tenantId, id);
  }

  @Put(':id/mappings')
  @RequirePermission('hotels_manage_pricing', 'write')
  mappings(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.channels.saveMappings(user.tenantId, id, dto?.mappings || []);
  }

  @Post(':id/push')
  @RequirePermission('hotels_manage_pricing', 'write')
  push(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.channels.push(user.tenantId, id);
  }

  @Post(':id/pull')
  @RequirePermission('hotels_manage_reservations', 'write')
  pull(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.channels.pull(user.tenantId, id);
  }

  @Get(':id/logs')
  logs(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.channels.logsOf(user.tenantId, id);
  }
}
