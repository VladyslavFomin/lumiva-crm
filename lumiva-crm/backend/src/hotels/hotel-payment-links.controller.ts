import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { getClientIp } from '../common/client-ip.util';
import { HotelPaymentLinksService } from './hotel-payment-links.service';

/** Запросы оплаты брони (ссылка на онлайн-оплату): создать, отправить гостю, отменить */
@Controller('hotels/payment-requests')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelPaymentLinksController {
  constructor(private readonly links: HotelPaymentLinksService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload, @Query('reservationId') reservationId?: string, @Query('hotelId') hotelId?: string, @Query('status') status?: string) {
    return this.links.list(user.tenantId, { reservationId, hotelId, status });
  }

  @Get('suggest/:reservationId')
  suggest(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.links.suggest(user.tenantId, reservationId);
  }

  @Post()
  @RequirePermission('hotels_manage_reservations', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.links.create(user.tenantId, dto || {}, this.actor(user));
  }

  @Post(':id/send')
  @RequirePermission('hotels_manage_reservations', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.links.send(user.tenantId, id);
  }

  @Post(':id/cancel')
  @RequirePermission('hotels_manage_reservations', 'write')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.links.cancel(user.tenantId, id);
  }
}

/** Публичная страница оплаты брони по ссылке — без входа, только свой запрос */
@Controller('public/hotel-pay')
export class HotelPaymentLinksPublicController {
  constructor(private readonly links: HotelPaymentLinksService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('token') token: string) {
    return this.links.publicGet(token);
  }

  @Post(':token/checkout')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@Param('token') token: string, @Body() dto: any, @Req() req: Request) {
    return this.links.publicCheckout(token, dto || {}, getClientIp(req) || '0.0.0.0');
  }
}
