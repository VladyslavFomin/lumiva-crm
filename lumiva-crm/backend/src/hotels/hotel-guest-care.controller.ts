import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelGuestCareService } from './hotel-guest-care.service';

const uid = (u: CurrentUserPayload) => u.userId ?? u.id ?? u.sub ?? null;

/** Guest Care для персонала: заявки гостей, QR-коды номеров */
@Controller('hotels/guest-care')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels_housekeeping', 'read')
export class HotelGuestCareController {
  constructor(private readonly care: HotelGuestCareService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId?: string, @Query('status') status?: string, @Query('days') days?: string) {
    return this.care.list(user.tenantId, { hotelId, status, days: Number(days) || 7 });
  }

  @Get('my')
  mine(@CurrentUser() user: CurrentUserPayload) {
    return this.care.mine(user.tenantId, uid(user) || '');
  }

  @Post()
  @RequirePermission('hotels_housekeeping', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.care.staffCreate(user.tenantId, dto || {});
  }

  @Patch(':id')
  @RequirePermission('hotels_housekeeping', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.care.update(user.tenantId, id, dto || {}, uid(user));
  }

  @Get('qr/:hotelId')
  @RequirePermission('hotels_manage_reservations', 'read')
  qr(@CurrentUser() user: CurrentUserPayload, @Param('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.care.qrLinks(user.tenantId, hotelId);
  }

  @Post('qr/rotate/:roomUnitId')
  @RequirePermission('hotels_manage_reservations', 'write')
  rotate(@CurrentUser() user: CurrentUserPayload, @Param('roomUnitId', new ParseUUIDPipe()) roomUnitId: string) {
    return this.care.rotateToken(user.tenantId, roomUnitId);
  }
}

/** Публичная страница «Заявка гостя» по QR-коду номера — без входа, только отель и номер, без данных гостя */
@Controller('public/hotel-guest')
export class HotelGuestCarePublicController {
  constructor(private readonly care: HotelGuestCareService) {}

  @Get(':token')
  info(@Param('token') token: string) {
    return this.care.publicInfo(token);
  }

  @Post(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Param('token') token: string, @Body() dto: any) {
    return this.care.publicCreate(token, dto || {});
  }
}
