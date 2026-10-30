import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelFolioService, businessDateOf } from './hotel-folio.service';
import { normalizeNumericInput } from './hotel-number.util';

const actor = (u: CurrentUserPayload) => (u.userId ?? (u as any).id ?? (u as any).sub ?? null) as string | null;

/** Касса отеля: смены (PMS-087), каталог доп. услуг, сборы за ранний заезд / поздний выезд */
@Controller('hotels/cashier')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelCashierController {
  constructor(private readonly folio: HotelFolioService) {}

  @Get('settings')
  async settings(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    const h = await this.folio.hotelOf(user.tenantId, hotelId);
    return { earlyCheckInFeePct: h.earlyCheckInFeePct, lateCheckOutFeePct: h.lateCheckOutFeePct, currency: h.currency, businessDate: businessDateOf(h), lastAuditDate: h.lastAuditDate };
  }

  @Patch('settings')
  @RequirePermission('hotels_manage_pricing', 'write')
  async saveSettings(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; earlyCheckInFeePct?: string; lateCheckOutFeePct?: string }) {
    const h = await this.folio.hotelOf(user.tenantId, dto?.hotelId);
    const clamp = (v: string) => String(Math.min(100, Math.max(0, Number(normalizeNumericInput(v)) || 0)));
    if (dto.earlyCheckInFeePct !== undefined) h.earlyCheckInFeePct = clamp(dto.earlyCheckInFeePct);
    if (dto.lateCheckOutFeePct !== undefined) h.lateCheckOutFeePct = clamp(dto.lateCheckOutFeePct);
    await this.folio.hotels.save(h);
    return { earlyCheckInFeePct: h.earlyCheckInFeePct, lateCheckOutFeePct: h.lateCheckOutFeePct };
  }

  @Get('extras')
  extras(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string, @Query('all') all?: string) {
    return this.folio.listExtras(user.tenantId, hotelId, all === '1');
  }

  @Post('extras')
  @RequirePermission('hotels_manage_pricing', 'write')
  createExtra(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.folio.saveExtra(user.tenantId, dto || {});
  }

  @Patch('extras/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateExtra(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.folio.saveExtra(user.tenantId, dto || {}, id);
  }

  @Delete('extras/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  removeExtra(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.folio.removeExtra(user.tenantId, id);
  }

  @Get('shift')
  shift(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    return this.folio.currentShift(user.tenantId, hotelId);
  }

  @Post('shift/open')
  @RequirePermission('hotels_manage_reservations', 'write')
  open(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; openingCash?: string }) {
    return this.folio.openShift(user.tenantId, dto?.hotelId, dto?.openingCash ?? '0', actor(user));
  }

  @Post('shift/close')
  @RequirePermission('hotels_manage_reservations', 'write')
  close(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; countedCash?: string; note?: string }) {
    return this.folio.closeShift(user.tenantId, dto?.hotelId, dto?.countedCash, dto?.note, actor(user));
  }

  @Get('shifts')
  shifts(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    return this.folio.listShifts(user.tenantId, hotelId);
  }

  @Get('shifts/:id')
  shiftDetail(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.folio.shiftDetail(user.tenantId, id);
  }
}
