import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelGuestJourneyService } from './hotel-guest-journey.service';

/** Путь гостя для «Автоматизаций»: готовые сценарии, проверка на брони, прогноз, отчёт */
@Controller('hotels/guest-journey')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('tools_automation', 'read')
export class HotelGuestJourneyController {
  constructor(private readonly journey: HotelGuestJourneyService) {}

  @Get('presets')
  presets(@Query('lang') lang?: string) {
    return this.journey.presetList(String(lang || 'ru'));
  }

  @Post('presets/install')
  @RequirePermission('tools_automation', 'write')
  install(@CurrentUser() user: CurrentUserPayload, @Body() dto: { lang?: string; keys?: string[] }) {
    return this.journey.installPresets(user.tenantId, String(dto?.lang || 'ru'), Array.isArray(dto?.keys) ? dto.keys : undefined);
  }

  @Get('preview/:automationId')
  preview(@CurrentUser() user: CurrentUserPayload, @Param('automationId', new ParseUUIDPipe()) automationId: string) {
    return this.journey.preview(user.tenantId, automationId);
  }

  @Post('test')
  @RequirePermission('tools_automation', 'write')
  test(@CurrentUser() user: CurrentUserPayload, @Body() dto: { automationId: string; reservationId: string }) {
    return this.journey.test(user.tenantId, dto?.automationId, dto?.reservationId);
  }

  @Get('report')
  report(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.journey.report(user.tenantId, Number(days) || 30);
  }
}

/** Опрос гостя по ссылке из письма автоматизации — без входа, только свой опрос */
@Controller('public/hotel-feedback')
export class HotelGuestFeedbackPublicController {
  constructor(private readonly journey: HotelGuestJourneyService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  get(@Param('token') token: string) {
    return this.journey.publicGet(token);
  }

  @Post(':token')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  submit(@Param('token') token: string, @Body() dto: any) {
    return this.journey.publicSubmit(token, dto || {});
  }

  @Post(':token/review')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  review(@Param('token') token: string, @Body() dto: { platform?: string }) {
    return this.journey.publicReview(token, String(dto?.platform || ''));
  }
}
