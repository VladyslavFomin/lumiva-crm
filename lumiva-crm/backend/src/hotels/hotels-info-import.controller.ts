import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsInfoImportService } from './hotels-info-import.service';

@Controller('hotels/info-import')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'write')
export class HotelsInfoImportController {
  constructor(private readonly importService: HotelsInfoImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.importService.previewImport(user.tenantId, file);
  }

  @Post('apply')
  applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: { importId: string; hotelId: string },
  ) {
    return this.importService.applyImport(user.tenantId, dto);
  }

  @Get('export/:hotelId')
  @RequirePermission('hotels', 'read')
  async exportHotelInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } = await this.importService.exportHotelInfo(user.tenantId, hotelId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
