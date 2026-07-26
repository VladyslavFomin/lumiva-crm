import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { BookingsAnalyticsService } from './bookings-analytics.service';

@Controller('bookings/analytics')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('bookings', 'read')
export class BookingAnalyticsController {
  constructor(private readonly service: BookingsAnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getSummary(user.tenantId, from, to);
  }

  @Get('daily-trend')
  dailyTrend(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getDailyTrend(user.tenantId, from, to);
  }

  @Get('heatmap')
  heatmap(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getHeatmap(user.tenantId, from, to);
  }

  @Get('top-services')
  topServices(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getTopServices(user.tenantId, from, to);
  }

  @Get('staff-utilization')
  staffUtilization(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getStaffUtilization(user.tenantId, from, to);
  }

  @Get('sources')
  sources(@CurrentUser() user: CurrentUserPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getSourceBreakdown(user.tenantId, from, to);
  }

  @Get('at-risk-customers')
  atRiskCustomers(@CurrentUser() user: CurrentUserPayload, @Query('days') days?: string) {
    return this.service.getAtRiskCustomers(user.tenantId, days ? Number(days) : undefined);
  }

  @Get('locations')
  locationStats(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getLocationStats(user.tenantId);
  }

  @Get('resources')
  resourceStats(@CurrentUser() user: CurrentUserPayload) {
    return this.service.getResourceStats(user.tenantId);
  }
}
