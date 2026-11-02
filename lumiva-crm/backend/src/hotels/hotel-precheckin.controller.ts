import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelPrecheckinService } from './hotel-precheckin.service';

/** Онлайн-регистрация и допродажи — для персонала */
@Controller('hotels/precheckin')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelPrecheckinController {
  constructor(private readonly pre: HotelPrecheckinService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId: string; from?: string; to?: string }) {
    return this.pre.list(user.tenantId, q);
  }

  @Get('requests')
  requests(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId: string; status?: string }) {
    return this.pre.requests(user.tenantId, q);
  }

  @Post('requests/:id/approve')
  @RequirePermission('hotels_manage_reservations', 'write')
  approve(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { note?: string }) {
    return this.pre.decide(user.tenantId, id, true, this.actor(user), dto?.note);
  }

  @Post('requests/:id/decline')
  @RequirePermission('hotels_manage_reservations', 'write')
  decline(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { note?: string }) {
    return this.pre.decide(user.tenantId, id, false, this.actor(user), dto?.note);
  }

  @Patch('settings/:hotelId')
  @RequirePermission('hotels_manage_reservations', 'write')
  settings(@CurrentUser() user: CurrentUserPayload, @Param('hotelId', new ParseUUIDPipe()) hotelId: string, @Body() dto: { precheckinUpgrades?: boolean }) {
    return this.pre.settings(user.tenantId, hotelId, dto || {});
  }

  @Post(':reservationId/link')
  @RequirePermission('hotels_manage_reservations', 'write')
  link(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.pre.link(user.tenantId, reservationId);
  }

  @Post(':reservationId/send')
  @RequirePermission('hotels_manage_reservations', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.pre.send(user.tenantId, reservationId);
  }
}

/** Публичная онлайн-регистрация по ссылке из письма — без входа, только своя бронь */
@Controller('public/hotel-precheckin')
export class HotelPrecheckinPublicController {
  constructor(private readonly pre: HotelPrecheckinService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('token') token: string) {
    return this.pre.publicGet(token);
  }

  @Post(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(@Param('token') token: string, @Body() dto: any) {
    return this.pre.publicSubmit(token, dto || {});
  }

  @Delete(':token/requests/:id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cancelRequest(@Param('token') token: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pre.publicCancelRequest(token, id);
  }

  @Post(':token/scan')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  scan(@Param('token') token: string, @UploadedFile() file: any, @Query('lang') lang?: string) {
    return this.pre.publicScan(token, file, String(lang || 'en').slice(0, 2));
  }
}
