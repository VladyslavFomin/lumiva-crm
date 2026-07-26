import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { getUploadsRoot } from '../common/uploads-root.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsService } from './hotels.service';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelsPricingService } from './hotels-pricing.service';
import { HotelsAgenciesService } from './hotels-agencies.service';
import { HotelsGalleryService } from './hotels-gallery.service';
import { HotelsFactsheetService } from './hotels-factsheet.service';

const IMAGE_ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const imageFileFilter = (_req: any, file: any, cb: any) => {
  if (/^image\/(png|jpeg|gif|webp)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Разрешены только изображения PNG, JPEG, GIF или WebP'), false);
  }
};

@Controller('hotels')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly roomTypes: HotelRoomTypesService,
    private readonly pricing: HotelsPricingService,
    private readonly agencies: HotelsAgenciesService,
    private readonly gallery: HotelsGalleryService,
    private readonly factsheet: HotelsFactsheetService,
  ) {}

  /* ---------- fixed literal routes — must come before hotels/:id ---------- */

  @Get('overview-kpis')
  getOverviewKpis(@CurrentUser() user: CurrentUserPayload) {
    return this.hotels.getOverviewKpis(user.tenantId);
  }

  @Get('agencies')
  listAgencies(@CurrentUser() user: CurrentUserPayload) {
    return this.agencies.listOrSeed(user.tenantId);
  }

  @Post('agencies')
  @RequirePermission('hotels_manage_pricing', 'write')
  createAgency(@CurrentUser() user: CurrentUserPayload, @Body() dto: { name: string }) {
    return this.agencies.create(user.tenantId, dto.name);
  }

  @Delete('agencies/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removeAgency(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.agencies.remove(user.tenantId, id);
  }

  /* ---------- room types (global by id) ---------- */

  @Get('room-types/:id')
  getRoomType(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomTypes.get(user.tenantId, id);
  }

  @Patch('room-types/:id')
  @RequirePermission('hotels', 'write')
  updateRoomType(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.roomTypes.update(user.tenantId, id, dto);
  }

  @Delete('room-types/:id')
  @RequirePermission('hotels', 'delete')
  removeRoomType(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomTypes.remove(user.tenantId, id);
  }

  @Patch('room-types/:id/info')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateRoomTypeInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Record<string, string | boolean>,
  ) {
    return this.roomTypes.updateInfoFields(user.tenantId, id, dto);
  }

  @Post('room-types/:id/cover')
  @RequirePermission('hotels', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          const roomTypeId = (req.params as any)?.id as string | undefined;
          if (!tenantId || !roomTypeId) {
            cb(new BadRequestException('Missing tenant or room type'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'hotels', tenantId, 'room-types', roomTypeId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const e = IMAGE_ALLOWED_EXT.includes(ext) ? ext : '.jpg';
          cb(null, `cover-${Date.now()}${e}`);
        },
      }),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadRoomTypeCover(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    return this.roomTypes.setCoverFromUpload(user.tenantId, id, file.filename);
  }

  @Get('room-types/:roomTypeId/market-prices')
  listMarketPrices(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
  ) {
    return this.roomTypes.listMarketPrices(user.tenantId, roomTypeId);
  }

  @Post('room-types/:roomTypeId/market-prices/:marketId')
  @RequirePermission('hotels_manage_pricing', 'write')
  upsertMarketPrice(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Param('marketId', new ParseUUIDPipe()) marketId: string,
    @Body() dto: { price: string },
  ) {
    return this.roomTypes.upsertMarketPrice(user.tenantId, roomTypeId, marketId, dto.price);
  }

  @Get('room-types/:roomTypeId/date-overrides')
  listDateOverrides(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.roomTypes.listDateOverrides(user.tenantId, roomTypeId, from, to);
  }

  @Post('room-types/:roomTypeId/date-overrides/:date')
  @RequirePermission('hotels_manage_pricing', 'write')
  upsertDateOverride(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Param('date') date: string,
    @Body() dto: { price?: string | null; blocked?: boolean; discountPct?: string; minNights?: number },
  ) {
    return this.roomTypes.upsertDateOverride(user.tenantId, roomTypeId, date, dto);
  }

  @Get('room-types/:roomTypeId/month-fill')
  getMonthFill(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.roomTypes.getMonthFillStats(user.tenantId, roomTypeId, Number(year), Number(month));
  }

  @Get('room-types/:roomTypeId/occupancy-types')
  listOccupancyTypes(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
  ) {
    return this.roomTypes.listOccupancyTypes(user.tenantId, roomTypeId);
  }

  @Post('room-types/:roomTypeId/occupancy-types')
  @RequirePermission('hotels_manage_pricing', 'write')
  createOccupancyType(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Body() dto: any,
  ) {
    return this.roomTypes.createOccupancyType(user.tenantId, roomTypeId, dto);
  }

  @Patch('occupancy-types/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateOccupancyType(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.roomTypes.updateOccupancyType(user.tenantId, id, dto);
  }

  @Delete('occupancy-types/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removeOccupancyType(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomTypes.removeOccupancyType(user.tenantId, id);
  }

  @Post('occupancy-types/:id/period-overrides/:periodId')
  @RequirePermission('hotels_manage_pricing', 'write')
  setOccupancyOverride(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('periodId', new ParseUUIDPipe()) periodId: string,
    @Body() dto: { price: string | null },
  ) {
    return this.roomTypes.setOccupancyOverride(user.tenantId, id, periodId, dto.price);
  }

  @Get('room-types/:roomTypeId/daily-rates')
  getDailyRates(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Query('dates') dates: string,
  ) {
    const list = (dates || '').split(',').filter(Boolean);
    return this.pricing.getDailyRates(user.tenantId, roomTypeId, list);
  }

  @Post('room-types/:roomTypeId/daily-rates/:marketGroupId/:date')
  @RequirePermission('hotels_manage_pricing', 'write')
  upsertDailyRate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Param('marketGroupId', new ParseUUIDPipe()) marketGroupId: string,
    @Param('date') date: string,
    @Body() dto: { budgetPP?: string; ppAvg?: string; grossPP?: string; discountPct?: string },
  ) {
    return this.pricing.upsertDailyRate(user.tenantId, roomTypeId, marketGroupId, date, dto);
  }

  @Get('room-types/:roomTypeId/stop-sale-dates')
  listStopSaleDates(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Query('dates') dates: string,
  ) {
    const list = (dates || '').split(',').filter(Boolean);
    return this.pricing.listStopSaleDates(user.tenantId, roomTypeId, list);
  }

  @Post('room-types/:roomTypeId/stop-sale-dates/:date')
  @RequirePermission('hotels_manage_pricing', 'write')
  setStopSaleDate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
    @Param('date') date: string,
    @Body() dto: { stopped: boolean },
  ) {
    return this.pricing.setStopSaleDate(user.tenantId, roomTypeId, date, dto.stopped);
  }

  /* ---------- markets (flat, global by id) ---------- */

  @Patch('markets/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateMarket(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { code?: string; name?: string },
  ) {
    return this.roomTypes.updateMarket(user.tenantId, id, dto);
  }

  @Delete('markets/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removeMarket(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roomTypes.removeMarket(user.tenantId, id);
  }

  /* ---------- market groups (global by id) ---------- */

  @Patch('market-groups/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updateMarketGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { name: string },
  ) {
    return this.pricing.updateMarketGroup(user.tenantId, id, dto.name);
  }

  @Delete('market-groups/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removeMarketGroup(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pricing.removeMarketGroup(user.tenantId, id);
  }

  /* ---------- pricing periods (global by id) ---------- */

  @Patch('pricing-periods/:id')
  @RequirePermission('hotels_manage_pricing', 'write')
  updatePeriod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { startDate?: string; endDate?: string },
  ) {
    return this.pricing.updatePeriod(user.tenantId, id, dto);
  }

  @Delete('pricing-periods/:id')
  @RequirePermission('hotels_manage_pricing', 'delete')
  removePeriod(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pricing.removePeriod(user.tenantId, id);
  }

  /* ---------- gallery categories/photos (global by id) ---------- */

  @Patch('gallery-categories/:id')
  @RequirePermission('hotels', 'write')
  renameGalleryCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { name: string },
  ) {
    return this.gallery.renameCategory(user.tenantId, id, dto.name);
  }

  @Delete('gallery-categories/:id')
  @RequirePermission('hotels', 'delete')
  removeGalleryCategory(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.gallery.removeCategory(user.tenantId, id);
  }

  @Delete('gallery-photos/:id')
  @RequirePermission('hotels', 'delete')
  removeGalleryPhoto(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.gallery.removePhoto(user.tenantId, id);
  }

  /* ---------- factsheet items — restaurants/bars/pools/mini-club/services (global by id) ---------- */

  @Patch('factsheet-items/:id')
  @RequirePermission('hotels', 'write')
  updateFactsheetItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.factsheet.updateItem(user.tenantId, id, dto);
  }

  @Delete('factsheet-items/:id')
  @RequirePermission('hotels', 'delete')
  removeFactsheetItem(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.factsheet.removeItem(user.tenantId, id);
  }

  /* ---------- per-hotel nested resources ---------- */

  @Get(':hotelId/room-types')
  listRoomTypes(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ) {
    return this.roomTypes.list(user.tenantId, hotelId);
  }

  @Post(':hotelId/room-types')
  @RequirePermission('hotels', 'write')
  createRoomType(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: any,
  ) {
    return this.roomTypes.create(user.tenantId, hotelId, dto);
  }

  @Get(':hotelId/room-types/:roomTypeId/room-pricing')
  getRoomPricing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Param('roomTypeId', new ParseUUIDPipe()) roomTypeId: string,
  ) {
    return this.pricing.getRoomPricing(user.tenantId, hotelId, roomTypeId);
  }

  @Get(':hotelId/markets')
  listMarkets(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ) {
    return this.roomTypes.listMarkets(user.tenantId, hotelId);
  }

  @Post(':hotelId/markets')
  @RequirePermission('hotels_manage_pricing', 'write')
  createMarket(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: { code: string; name: string },
  ) {
    return this.roomTypes.createMarket(user.tenantId, hotelId, dto);
  }

  @Get(':hotelId/market-groups')
  listMarketGroups(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ) {
    return this.pricing.listMarketGroups(user.tenantId, hotelId);
  }

  @Post(':hotelId/market-groups')
  @RequirePermission('hotels_manage_pricing', 'write')
  createMarketGroup(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: { name: string },
  ) {
    return this.pricing.createMarketGroup(user.tenantId, hotelId, dto.name);
  }

  @Get(':hotelId/pricing-periods')
  listPeriods(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ) {
    return this.pricing.listPeriods(user.tenantId, hotelId);
  }

  @Post(':hotelId/pricing-periods')
  @RequirePermission('hotels_manage_pricing', 'write')
  createPeriod(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: { startDate: string; endDate: string },
  ) {
    return this.pricing.createPeriod(user.tenantId, hotelId, dto);
  }

  @Get(':hotelId/gallery/categories')
  listGalleryCategories(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ) {
    return this.gallery.listCategories(user.tenantId, hotelId);
  }

  @Post(':hotelId/gallery/categories')
  @RequirePermission('hotels', 'write')
  createGalleryCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: { name: string },
  ) {
    return this.gallery.createCategory(user.tenantId, hotelId, dto.name);
  }

  @Get(':hotelId/gallery/photos')
  listGalleryPhotos(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.gallery.listPhotos(user.tenantId, hotelId, categoryId);
  }

  @Post(':hotelId/gallery/photos/upload')
  @RequirePermission('hotels', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          const hotelId = (req.params as any)?.hotelId as string | undefined;
          if (!tenantId || !hotelId) {
            cb(new BadRequestException('Missing tenant or hotel'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'hotels', tenantId, hotelId, 'gallery');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const e = IMAGE_ALLOWED_EXT.includes(ext) ? ext : '.jpg';
          cb(null, `${randomUUID()}${e}`);
        },
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadGalleryPhoto(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query('categoryId') categoryId: string | undefined,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    return this.gallery.createPhotoFromUpload(user.tenantId, hotelId, categoryId || null, file.filename);
  }

  @Get(':hotelId/factsheet-items')
  listFactsheetItems(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query('kind') kind?: string,
  ) {
    return this.factsheet.listItems(user.tenantId, hotelId, kind as any);
  }

  @Post(':hotelId/factsheet-items')
  @RequirePermission('hotels', 'write')
  createFactsheetItem(
    @CurrentUser() user: CurrentUserPayload,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: any,
  ) {
    return this.factsheet.createItem(user.tenantId, hotelId, dto);
  }

  /* ---------- hotel CRUD (catch-all :id — must stay last) ---------- */

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.hotels.list(user.tenantId);
  }

  @Post()
  @RequirePermission('hotels', 'write')
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: any) {
    return this.hotels.create(user.tenantId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hotels.get(user.tenantId, id);
  }

  @Patch(':id')
  @RequirePermission('hotels', 'write')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: any,
  ) {
    return this.hotels.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('hotels', 'delete')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.hotels.remove(user.tenantId, id);
  }

  @Patch(':id/info')
  @RequirePermission('hotels', 'write')
  updateHotelInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: Record<string, string | boolean>,
  ) {
    return this.hotels.updateInfoFields(user.tenantId, id, dto);
  }

  @Post(':id/cover')
  @RequirePermission('hotels', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tenantId = (req as any).user?.tenantId as string | undefined;
          const hotelId = (req.params as any)?.id as string | undefined;
          if (!tenantId || !hotelId) {
            cb(new BadRequestException('Missing tenant or hotel'), '');
            return;
          }
          const dir = join(getUploadsRoot(), 'hotels', tenantId, hotelId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const e = IMAGE_ALLOWED_EXT.includes(ext) ? ext : '.jpg';
          cb(null, `cover-${Date.now()}${e}`);
        },
      }),
      limits: { fileSize: 4 * 1024 * 1024 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadHotelCover(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { filename: string } | undefined,
  ) {
    if (!file) throw new BadRequestException('Нужен файл');
    return this.hotels.setCoverFromUpload(user.tenantId, id, file.filename);
  }
}
