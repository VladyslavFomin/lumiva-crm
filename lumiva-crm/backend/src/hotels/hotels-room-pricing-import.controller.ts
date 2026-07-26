import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsRoomPricingImportService } from './hotels-room-pricing-import.service';

@Controller('hotels/room-pricing-import')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels_manage_pricing', 'write')
export class HotelsRoomPricingImportController {
  constructor(private readonly importService: HotelsRoomPricingImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any) {
    return this.importService.previewImport(user.tenantId, file);
  }

  @Post('apply')
  applyImport(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: { importId: string; hotelId: string; roomTypeId: string },
  ) {
    return this.importService.applyImport(user.tenantId, dto);
  }
}
