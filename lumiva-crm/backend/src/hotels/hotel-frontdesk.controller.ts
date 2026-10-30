import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelFrontDeskService } from './hotel-frontdesk.service';
import { HotelRackService } from './hotel-rack.service';
import { HotelReservationsService } from './hotel-reservations.service';

@Controller('hotels/frontdesk')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelFrontDeskController {
  constructor(
    private readonly frontDesk: HotelFrontDeskService,
    private readonly rackService: HotelRackService,
    private readonly reservations: HotelReservationsService,
  ) {}

  @Get('today')
  today(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date?: string,
    @Query('hotelId') hotelId?: string,
  ) {
    return this.frontDesk.today(user.tenantId, date, hotelId);
  }

  /** Шахматка: номера × дни одного отеля, окно from + days (до 62) */
  @Get('rack')
  rack(
    @CurrentUser() user: CurrentUserPayload,
    @Query('hotelId') hotelId: string,
    @Query('from') from: string,
    @Query('days') days?: string,
  ) {
    return this.rackService.rack(user.tenantId, hotelId, from, Number(days) || 14);
  }

  /** Walk-in: бронь на сегодня + заселение одним действием */
  @Post('walk-in')
  @RequirePermission('hotels_manage_reservations', 'write')
  walkIn(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.reservations.walkIn(user.tenantId, dto || {}, user.userId ?? user.id ?? user.sub);
  }

  /** Массовая отметка no-show */
  @Post('no-show')
  @RequirePermission('hotels_manage_reservations', 'write')
  bulkNoShow(@CurrentUser() user: CurrentUserPayload, @Body() dto: { ids?: string[]; feeMode?: 'none' | 'first_night' }) {
    return this.reservations.bulkNoShow(user.tenantId, Array.isArray(dto?.ids) ? dto.ids : [], dto?.feeMode === 'none' ? 'none' : 'first_night', user.userId ?? user.id ?? user.sub);
  }
}
