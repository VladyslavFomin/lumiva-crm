import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsPricingImportService } from './hotels-pricing-import.service';

@Controller('hotels/pricing-import')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels_manage_pricing', 'write')
export class HotelsPricingImportController {
  constructor(private readonly importService: HotelsPricingImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.importService.previewImport(user.tenantId, file);
  }

  @Post('apply')
  applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: { importId: string; hotelId: string; roomTypeId: string; dateColumn?: string },
  ) {
    return this.importService.applyImport(user.tenantId, dto);
  }
}
