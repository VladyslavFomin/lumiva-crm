import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelNightAuditService } from './hotel-night-audit.service';

/** Ночной аудит: статус и проверки — всем с доступом к отелям, закрытие дня и настройки — право hotels_night_audit */
@Controller('hotels/night-audit')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelNightAuditController {
  constructor(private readonly audit: HotelNightAuditService) {}

  @Get('status')
  status(@CurrentUser() user: CurrentUserPayload, @Query('hotelId') hotelId: string) {
    return this.audit.status(user.tenantId, hotelId);
  }

  @Post('run')
  @RequirePermission('hotels_night_audit', 'write')
  run(@CurrentUser() user: CurrentUserPayload, @Body() dto: { hotelId: string; autoNoShow?: boolean; noShowFee?: 'none' | 'first_night'; ignoreDepartures?: boolean; ignoreOpenShift?: boolean }) {
    return this.audit.run(user.tenantId, dto?.hotelId, dto || {}, (user.userId ?? (user as any).id ?? (user as any).sub ?? null) as string | null);
  }

  @Patch('settings')
  @RequirePermission('hotels_night_audit', 'write')
  settings(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.audit.saveSettings(user.tenantId, dto || {});
  }

  @Get('audits/:id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.audit.getAudit(user.tenantId, id);
  }

  @Get('audits/:id/report.pdf')
  async pdf(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string, @Query('lang') lang: string | undefined, @Res() res: Response) {
    const buf = await this.audit.reportPdf(user.tenantId, id, lang === 'en' || lang === 'tr' ? lang : 'ru');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="night-audit-${id}.pdf"`);
    res.send(buf);
  }

  @Post('audits/:id/send')
  @RequirePermission('hotels_night_audit', 'write')
  send(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.audit.sendReport(user.tenantId, id);
  }
}
