import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelGroupInput, HotelGroupRoomLine, HotelGroupsService } from './hotel-groups.service';

/** Групповые брони и rooming list */
@Controller('hotels/groups')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelGroupsController {
  constructor(private readonly groups: HotelGroupsService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId?: string; status?: string; period?: 'upcoming' | 'past' | 'all' }) {
    return this.groups.list(user.tenantId, q || {});
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.groups.get(user.tenantId, id);
  }

  @Post()
  @RequirePermission('hotels_manage_reservations', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelGroupInput) {
    return this.groups.create(user.tenantId, dto || {}, this.actor(user));
  }

  @Patch(':id')
  @RequirePermission('hotels_manage_reservations', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelGroupInput) {
    return this.groups.update(user.tenantId, id, dto || {}, this.actor(user));
  }

  @Post(':id/rooms')
  @RequirePermission('hotels_manage_reservations', 'write')
  addRooms(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { rooms: HotelGroupRoomLine[] }) {
    return this.groups.addRooms(user.tenantId, id, dto?.rooms || [], this.actor(user));
  }

  @Post(':id/dates')
  @RequirePermission('hotels_manage_reservations', 'write')
  changeDates(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { checkIn: string; checkOut: string; reservationIds?: string[] }) {
    return this.groups.changeDates(user.tenantId, id, dto, this.actor(user));
  }

  @Post(':id/assign-rooms')
  @RequirePermission('hotels_manage_reservations', 'write')
  assignRooms(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.groups.assignRooms(user.tenantId, id, this.actor(user));
  }

  @Post(':id/rooming/preview')
  @RequirePermission('hotels_manage_reservations', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  roomingPreview(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: any) {
    return this.groups.roomingPreview(user.tenantId, id, file);
  }

  @Post(':id/rooming/apply')
  @RequirePermission('hotels_manage_reservations', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  roomingApply(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: any, @Body() dto: { addMissing?: string }) {
    return this.groups.roomingApply(user.tenantId, id, file, { addMissing: dto?.addMissing === 'true' }, this.actor(user));
  }

  @Post(':id/pay')
  @RequirePermission('hotels_manage_reservations', 'write')
  pay(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { amount: string; method: string; date?: string; note?: string; folio?: 'guest' | 'partner' }) {
    return this.groups.pay(user.tenantId, id, dto, this.actor(user));
  }

  @Post(':id/cancel-rooms')
  @RequirePermission('hotels_manage_reservations', 'write')
  cancelRooms(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { reservationIds?: string[]; reason: string; fee: 'policy' | 'none'; note?: string }) {
    return this.groups.cancelRooms(user.tenantId, id, dto, this.actor(user));
  }

  @Post(':id/stay')
  @RequirePermission('hotels_manage_reservations', 'write')
  stay(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { action: 'check_in' | 'check_out' }) {
    return this.groups.bulkStay(user.tenantId, id, dto?.action === 'check_out' ? 'check_out' : 'check_in', this.actor(user));
  }
}
