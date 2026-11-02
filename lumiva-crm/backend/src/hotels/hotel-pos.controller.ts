import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelPosService } from './hotel-pos.service';

/** Точки продаж: точки и позиции, гость на номере, чеки, сторно, отчёт */
@Controller('hotels/pos')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelPosController {
  constructor(private readonly pos: HotelPosService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get('outlets')
  outlets(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.pos.listOutlets(user.tenantId, hotelId);
  }

  @Post('outlets')
  @RequirePermission('hotels_manage_reservations', 'write')
  createOutlet(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; name: string; kind?: string }) {
    return this.pos.saveOutlet(user.tenantId, dto || {});
  }

  @Patch('outlets/:id')
  @RequirePermission('hotels_manage_reservations', 'write')
  updateOutlet(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { name?: string; kind?: string; active?: boolean; sortOrder?: number }) {
    return this.pos.saveOutlet(user.tenantId, dto || {}, id);
  }

  @Delete('outlets/:id')
  @RequirePermission('hotels_manage_reservations', 'delete')
  removeOutlet(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pos.removeOutlet(user.tenantId, id);
  }

  @Patch('settings/:hotelId')
  @RequirePermission('hotels_manage_reservations', 'write')
  settings(@CurrentUser() user: CurrentUserPayload, @Param('hotelId', new ParseUUIDPipe()) hotelId: string, @Body() dto: { creditLimit?: number | string | null }) {
    return this.pos.setCreditLimit(user.tenantId, hotelId, dto?.creditLimit ?? null);
  }

  @Get('in-house')
  inHouse(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string, @Query('q') q?: string) {
    return this.pos.inHouse(user.tenantId, hotelId, q || '');
  }

  @Get('checks')
  checks(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId: string; outletId?: string; date?: string }) {
    return this.pos.listChecks(user.tenantId, q);
  }

  @Post('checks')
  @RequirePermission('hotels_manage_reservations', 'write')
  createCheck(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.pos.createCheck(user.tenantId, dto || {}, this.actor(user));
  }

  @Post('checks/:id/void')
  @RequirePermission('hotels_manage_reservations', 'write')
  voidCheck(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { reason: string }) {
    return this.pos.voidCheck(user.tenantId, id, dto?.reason, this.actor(user));
  }

  @Get('report')
  report(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId: string; from: string; to: string }) {
    return this.pos.report(user.tenantId, q);
  }
}
