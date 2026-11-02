import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelLoyaltyService } from './hotel-loyalty.service';

/** Лояльность: программы (область, уровни, баллы, взаиморасчёты), участники, стойка (скидка, оплата баллами) */
@Controller('hotels/loyalty')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelLoyaltyController {
  constructor(private readonly loyalty: HotelLoyaltyService) {}

  private actor(user: CurrentUserPayload) {
    return String((user as any).userId ?? (user as any).id ?? (user as any).sub ?? '') || null;
  }

  @Get('programs')
  programs(@CurrentUser() user: CurrentUserPayload) {
    return this.loyalty.listPrograms(user.tenantId);
  }

  @Post('programs')
  @RequirePermission('hotels_manage_pricing', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.loyalty.saveProgram(user.tenantId, dto || {});
  }

  @Patch('programs/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.loyalty.saveProgram(user.tenantId, dto || {}, id);
  }

  @Get('programs/:id/overview')
  overview(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query('days') days?: string) {
    return this.loyalty.overview(user.tenantId, id, Number(days) || 90);
  }

  @Get('programs/:id/settlement')
  @RequirePermission('hotels_manage_pricing', 'read')
  settlement(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query('from') from: string, @Query('to') to: string) {
    return this.loyalty.settlement(user.tenantId, id, from, to);
  }

  @Get('members')
  members(@CurrentUser() user: CurrentUserPayload, @Query('programId') programId?: string, @Query('search') search?: string, @Query('tier') tier?: string, @Query('page') page?: string) {
    return this.loyalty.listMembers(user.tenantId, { programId, search, tier, page: Number(page) || 1 });
  }

  @Get('members/:id')
  member(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.loyalty.memberDetail(user.tenantId, id);
  }

  @Post('members')
  @RequirePermission('hotels_manage_reservations', 'write')
  enroll(@CurrentUser() user: CurrentUserPayload, @Body() dto: { programId: string; profileId: string }) {
    return this.loyalty.enroll(user.tenantId, dto?.programId, dto?.profileId);
  }

  @Post('members/:id/adjust')
  @RequirePermission('hotels_manage_pricing', 'write')
  adjust(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: any) {
    return this.loyalty.adjust(user.tenantId, id, dto || {}, this.actor(user));
  }

  @Post('members/:id/status')
  @RequirePermission('hotels_manage_pricing', 'write')
  status(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: { status: string }) {
    return this.loyalty.setStatus(user.tenantId, id, dto?.status);
  }

  @Get('card/:reservationId')
  card(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.loyalty.card(user.tenantId, reservationId);
  }

  @Post('card/:reservationId/discount')
  @RequirePermission('hotels_manage_reservations', 'write')
  discount(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string) {
    return this.loyalty.applyDiscount(user.tenantId, reservationId, this.actor(user));
  }

  @Post('card/:reservationId/redeem')
  @RequirePermission('hotels_manage_reservations', 'write')
  redeem(@CurrentUser() user: CurrentUserPayload, @Param('reservationId', new ParseUUIDPipe()) reservationId: string, @Body() dto: { points: number }) {
    return this.loyalty.redeem(user.tenantId, reservationId, dto?.points, this.actor(user));
  }

  @Post('tx/:id/cancel')
  @RequirePermission('hotels_manage_reservations', 'write')
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.loyalty.cancelRedeem(user.tenantId, id, this.actor(user));
  }
}

/** Карта участника по ссылке из письма — без входа */
@Controller('public/hotel-loyalty')
export class HotelLoyaltyPublicController {
  constructor(private readonly loyalty: HotelLoyaltyService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('token') token: string) {
    return this.loyalty.publicGet(token);
  }
}
