// src/export/export.controller.ts
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ExportService } from './export.service';

@Controller('export')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('settings', 'read')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('backup')
  async backup(@CurrentUser() user: CurrentUserPayload, @Res() res: Response) {
    const data = await this.exportService.buildBackup(user.tenantId);
    const clientKey = data.tenant?.clientKey || 'tenant';
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${clientKey}-backup-${dateStamp}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
