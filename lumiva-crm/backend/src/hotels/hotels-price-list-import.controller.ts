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

  /** Рыночный лист (другая группа рынков): предпросмотр */
  @Post('market/preview')
  @UseInterceptors(FileInterceptor('file'))
  previewMarket(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file: any, @Body() dto: { hotelId: string; sheet?: string; groupId?: string }) {
    return this.importService.previewMarket(user.tenantId, dto.hotelId, file, dto.sheet || null, dto.groupId || null);
  }

  @Post('market/apply')
  @UseInterceptors(FileInterceptor('file'))
  applyMarket(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file: any,
    @Body() dto: { hotelId: string; sheet?: string; groupId?: string; newGroupName?: string; fxRate?: string; importPromotions?: string },
  ) {
    return this.importService.applyMarket(user.tenantId, dto.hotelId, file, {
      sheet: dto.sheet || null,
      groupId: dto.groupId || null,
      newGroupName: dto.newGroupName || null,
      fxRate: dto.fxRate ? Number(String(dto.fxRate).replace(',', '.')) : null,
      importPromotions: flag(dto.importPromotions),
    });
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
