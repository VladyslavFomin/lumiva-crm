import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelAnalyticsService } from './hotel-analytics.service';
import { HotelAnalyticsQueryDto } from './dto/hotel-analytics-query.dto';

@Controller('hotels/analytics')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelAnalyticsController {
  constructor(private readonly analytics: HotelAnalyticsService) {}

  @Get()
  getSummary(@CurrentUser() user: CurrentUserPayload, @Query() q: HotelAnalyticsQueryDto) {
    return this.analytics.getSummary(user.tenantId, q);
  }

  @Get('arrivals')
  getArrivals(@CurrentUser() user: CurrentUserPayload, @Query() q: HotelAnalyticsQueryDto) {
    return this.analytics.getArrivals(user.tenantId, q);
  }

  @Get('pacing-targets')
  getPacingTargets(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    return this.analytics.getPacingTargets(user.tenantId, hotelId);
  }

  @Patch('pacing-targets/:hotelId')
  @RequirePermission('hotels', 'write')
  updatePacingTargets(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId') hotelId: string,
    @Body() dto: { daysBeforeArrival: number; targetPct: number }[],
  ) {
    return this.analytics.upsertPacingTargets(user.tenantId, hotelId, dto);
  }
}
