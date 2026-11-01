import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelAriService, AriBulkPatch } from './hotel-ari.service';
import { HotelChannelsService } from './hotel-channels.service';
import { HotelRoomTypesService } from './hotel-room-types.service';

/**
 * Календарь ограничений: наличие, цена и ограничения продаж по дням (стоп, закрыто на заезд / выезд, мин. / макс. ночей).
 * Правка сразу помечает отель для менеджера каналов — изменения уходят в течение минуты.
 */
@Controller('hotels')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelAriController {
  constructor(
    private readonly ari: HotelAriService,
    private readonly channels: HotelChannelsService,
    private readonly roomTypes: HotelRoomTypesService,
  ) {}

  @Get('ari/grid')
  grid(
    @CurrentUser() user: CurrentUserPayload,
    @Query('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query('from') from?: string,
    @Query('days') days?: string,
    @Query('adults') adults?: string,
    @Query('marketGroupId') marketGroupId?: string,
  ) {
    return this.ari.grid(user.tenantId, hotelId, { from, days: Number(days) || undefined, adults: Number(adults) || undefined, marketGroupId: marketGroupId || null });
  }

  @Post('ari/bulk')
  @RequirePermission('hotels_manage_pricing', 'write')
  async bulk(@CurrentUser() user: CurrentUserPayload, @Body() dto: AriBulkPatch) {
    const res = await this.ari.bulk(user.tenantId, dto || ({} as AriBulkPatch));
    const rt = await this.roomTypes.get(user.tenantId, dto.roomTypeIds[0]);
    this.channels.markRatesDirty(user.tenantId, rt.hotelId);
    return res;
  }

  /** Одна дата одного типа номера (старый путь календаря цен) — с проверками bulk */
  @Post('room-types/:roomTypeId/date-overrides/:date')
  @RequirePermission('hotels_manage_pricing', 'write')
  async upsertDateOverride(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Param('date') date: string,
    @Body() dto: Omit<AriBulkPatch, 'roomTypeIds' | 'from' | 'to' | 'weekdays'> & { blocked?: boolean },
  ) {
    const rt = await this.roomTypes.get(user.tenantId, roomTypeId);
    const row = await this.ari.upsertOne(user.tenantId, roomTypeId, date, dto || {});
    this.channels.markRatesDirty(user.tenantId, rt.hotelId);
    return row;
  }
}
