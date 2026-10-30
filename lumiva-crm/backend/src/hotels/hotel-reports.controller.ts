import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelReportsService } from './hotel-reports.service';

/** Отчёты PMS: показатели, прогноз on-the-books, pickup */
@Controller('hotels/reports')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelReportsController {
  constructor(private readonly reports: HotelReportsService) {}

  @Get('performance')
  performance(@CurrentUser() user: CurrentUserPayload, @Query() q: any) {
    return this.reports.performance(user.tenantId, q);
  }

  @Get('performance.xlsx')
  async performanceXlsx(@CurrentUser() user: CurrentUserPayload, @Query() q: any, @Res() res: Response) {
    const buf = await this.reports.performanceXlsx(user.tenantId, q);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="hotel-performance-${q.from}-${q.to}.xlsx"`);
    res.send(buf);
  }

  @Get('forecast')
  forecast(@CurrentUser() user: CurrentUserPayload, @Query() q: any) {
    return this.reports.forecast(user.tenantId, q);
  }

  @Get('pickup')
  pickup(@CurrentUser() user: CurrentUserPayload, @Query() q: any) {
    return this.reports.pickup(user.tenantId, q);
  }
}
