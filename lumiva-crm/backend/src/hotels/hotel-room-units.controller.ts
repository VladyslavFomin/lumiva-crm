import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelRoomUnitsService } from './hotel-room-units.service';
import type { HotelRoomUnitHousekeepingStatus } from './hotel-room-unit.entity';

// Flat route (hotels/room-units), same reasoning as HotelReservationsController: keeps this
// entirely clear of the hotels/:id catch-all ordering gotcha.
@Controller('hotels/room-units')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelRoomUnitsController {
  constructor(private readonly roomUnits: HotelRoomUnitsService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('hotelId') hotelId?: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.roomUnits.list(user.tenantId, { hotelId, roomTypeId });
  }

  @Post()
  @RequirePermission('hotels', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: { roomTypeId: string; label: string; note?: string }) {
    return this.roomUnits.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermission('hotels', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Partial<{ label: string; note: string | null; active: boolean }>,
  ) {
    return this.roomUnits.update(user.tenantId, id, dto);
  }

  // Flipping housekeeping status is a daily front-desk/housekeeping action, not inventory
  // management — gated under the reservations-tier key rather than the base 'hotels' write key.
  @Patch(':id/housekeeping')
  @RequirePermission('hotels_manage_reservations', 'write')
  updateHousekeeping(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { housekeepingStatus: HotelRoomUnitHousekeepingStatus },
  ) {
    return this.roomUnits.updateHousekeeping(user.tenantId, id, dto.housekeepingStatus);
  }

  @Delete(':id')
  @RequirePermission('hotels', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomUnits.remove(user.tenantId, id);
  }
}
