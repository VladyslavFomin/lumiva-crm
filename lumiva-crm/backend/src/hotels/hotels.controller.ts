import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RbacGuard } from '../rbac/rbac.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { HotelsService } from './hotels.service';
import { HotelRoomTypesService } from './hotel-room-types.service';
import { HotelsPricingService } from './hotels-pricing.service';
import { HotelsAgenciesService } from './hotels-agencies.service';

@Controller('hotels')
@UseGuards(JwtAuthGuard, RbacGuard)
@RequirePermission('hotels', 'read')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly roomTypes: HotelRoomTypesService,
    private readonly pricing: HotelsPricingService,
    private readonly agencies: HotelsAgenciesService,
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
}
