import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsPriceListImportService } from './hotels-price-list-import.service';

const flag = (v: unknown) => !(v === false || v === 'false' || v === '0');

@Controller('hotels/price-list-import')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels_manage_pricing', 'write')
export class HotelsPriceListImportController {
  constructor(private readonly importService: HotelsPriceListImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  preview(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any, @Body() dto: { hotelId: string; sheet?: string }) {
    return this.importService.preview(user.tenantId, dto.hotelId, file, dto.sheet || null);
  }

  @Post('apply')
  @UseInterceptors(FileInterceptor('file'))
  apply(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: any,
    @Body() dto: { hotelId: string; replacePeriods?: string; clearDaily?: string; sheet?: string; importPromotions?: string; promoMarketGroupIds?: string },
  ) {
    // группы рынков акций приходят строкой через запятую (multipart)
    const promoMarketGroupIds = String(dto.promoMarketGroupIds || '').split(',').map((x) => x.trim()).filter(Boolean);
    return this.importService.apply(user.tenantId, dto.hotelId, file, {
      replacePeriods: flag(dto.replacePeriods),
      clearDaily: flag(dto.clearDaily),
      sheet: dto.sheet || null,
      importPromotions: flag(dto.importPromotions),
      promoMarketGroupIds,
    });
  }
}
