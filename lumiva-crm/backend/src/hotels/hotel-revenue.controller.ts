import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelRevenueRuleInput, HotelRevenueService } from './hotel-revenue.service';

/** Рекомендации цены: правила, рекомендации по датам, применение поправок, настройки автоприменения */
@Controller('hotels/revenue')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelRevenueController {
  constructor(private readonly rm: HotelRevenueService) {}

  @Get()
  recommendations(@CurrentUser() user: CurrentUserPayload, @Query() q: { hotelId: string; from?: string; days?: string }) {
    return this.rm.recommendations(user.tenantId, q.hotelId, { from: q.from, days: Number(q.days) || undefined });
  }

  @Get('rules')
  rules(@CurrentUser() user: CurrentUserPayload, @Query('hotelId', new ParseUUIDPipe()) hotelId: string) {
    return this.rm.listRules(user.tenantId, hotelId);
  }

  @Post('rules')
  @RequirePermission('hotels_manage_pricing', 'write')
  createRule(@CurrentUser() user: CurrentUserPayload, @Body() dto: HotelRevenueRuleInput & { hotelId?: string }) {
    return this.rm.createRule(user.tenantId, dto || {});
  }

  @Patch('rules/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateRule(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: HotelRevenueRuleInput) {
    return this.rm.updateRule(user.tenantId, id, dto || {});
  }

  @Delete('rules/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removeRule(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.rm.removeRule(user.tenantId, id);
  }

  @Post('apply')
  @RequirePermission('hotels_manage_pricing', 'write')
  apply(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; items: Array<{ roomTypeId: string; date: string; pct: number; ruleId?: string | null }> }) {
    return this.rm.apply(user.tenantId, dto?.hotelId, dto?.items || []);
  }

  @Post('range')
  @RequirePermission('hotels_manage_pricing', 'write')
  range(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; roomTypeIds: string[]; from: string; to: string; pct: number }) {
    return this.rm.setRange(user.tenantId, dto?.hotelId, dto);
  }

  @Patch('settings/:hotelId')
  @RequirePermission('hotels_manage_pricing', 'write')
  settings(@CurrentUser() user: CurrentUserPayload, @Param('hotelId', new ParseUUIDPipe()) hotelId: string, @Body() dto: { revenueAutoApply?: boolean; revenueHorizon?: number; revenueMaxPct?: number }) {
    return this.rm.settings(user.tenantId, hotelId, dto || {});
  }
}
